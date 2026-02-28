#!/usr/bin/env python3
"""
Egyptian Art Scraper — Met Museum

Reads MetObjects_Egyptian.csv, filters to public-domain objects, scrapes
curatorial descriptions/inscriptions/provenance from the website, downloads
images, and builds a searchable catalog.

Adapted from the cross-department scraper at:
  /Users/z014-ind/Documents/Apps/CV x G - Feb 27/met-museum-api/scraper.py
"""

import asyncio
import csv
import json
import re
import time
from pathlib import Path

import aiohttp
from tqdm import tqdm

# ── Paths ──────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "MetObjects_Egyptian.csv"
IMAGES_DIR = BASE_DIR / "images"
INDEX_DIR = BASE_DIR / "index"
CATALOG_PATH = BASE_DIR / "catalog_egyptian.json"
CHECKPOINT_PATH = BASE_DIR / ".checkpoint.json"

# ── Concurrency ────────────────────────────────────────────────────────────────

BATCH_SIZE = 100
SCRAPE_CONCURRENCY = 5
IMAGE_CONCURRENCY = 10

MAX_RETRIES = 3
BACKOFF_BASE = 1.0  # seconds

# ── CSV Column → snake_case mapping ────────────────────────────────────────────

COLUMN_MAP = {
    "Object Number": "object_number",
    "Is Highlight": "is_highlight",
    "Is Timeline Work": "is_timeline_work",
    "Is Public Domain": "is_public_domain",
    "Object ID": "object_id",
    "Gallery Number": "gallery_number",
    "Department": "department",
    "AccessionYear": "accession_year",
    "Object Name": "object_name",
    "Title": "title",
    "Culture": "culture",
    "Period": "period",
    "Dynasty": "dynasty",
    "Reign": "reign",
    "Portfolio": "portfolio",
    "Constituent ID": "constituent_id",
    "Artist Role": "artist_role",
    "Artist Prefix": "artist_prefix",
    "Artist Display Name": "artist_display_name",
    "Artist Display Bio": "artist_display_bio",
    "Artist Suffix": "artist_suffix",
    "Artist Alpha Sort": "artist_alpha_sort",
    "Artist Nationality": "artist_nationality",
    "Artist Begin Date": "artist_begin_date",
    "Artist End Date": "artist_end_date",
    "Artist Gender": "artist_gender",
    "Artist ULAN URL": "artist_ulan_url",
    "Artist Wikidata URL": "artist_wikidata_url",
    "Object Date": "date",
    "Object Begin Date": "date_begin",
    "Object End Date": "date_end",
    "Medium": "medium",
    "Dimensions": "dimensions",
    "Credit Line": "credit_line",
    "Geography Type": "geography_type",
    "City": "city",
    "State": "state",
    "County": "county",
    "Country": "country",
    "Region": "region",
    "Subregion": "subregion",
    "Locale": "locale",
    "Locus": "locus",
    "Excavation": "excavation",
    "River": "river",
    "Classification": "classification",
    "Rights and Reproduction": "rights_and_reproduction",
    "Link Resource": "link_resource",
    "Object Wikidata URL": "object_wikidata_url",
    "Metadata Date": "metadata_date",
    "Repository": "repository",
    "Tags": "tags_csv",
    "Tags AAT URL": "tags_aat_url",
    "Tags Wikidata URL": "tags_wikidata_url",
}

# ── Helpers ────────────────────────────────────────────────────────────────────


def load_checkpoint() -> dict:
    if CHECKPOINT_PATH.exists():
        with open(CHECKPOINT_PATH) as f:
            return json.load(f)
    return {"scrape_done": [], "image_done": []}


def save_checkpoint(cp: dict):
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump(cp, f)


def parse_bool(val: str) -> bool:
    return val.strip().upper() == "TRUE"


def parse_int(val: str, default=None):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def parse_csv_tags(raw: str) -> list[str]:
    if not raw or not raw.strip():
        return []
    return [t.strip() for t in raw.split("|") if t.strip()]


def clean_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def batches(lst: list, n: int):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


# ── Read CSV ───────────────────────────────────────────────────────────────────


def read_csv() -> dict[int, dict]:
    rows = {}
    skipped = 0
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Only process public-domain objects
            if not parse_bool(row.get("Is Public Domain", "")):
                skipped += 1
                continue

            obj_id = parse_int(row.get("Object ID"))
            if obj_id is None:
                continue
            mapped = {}
            for csv_col, snake_key in COLUMN_MAP.items():
                mapped[snake_key] = row.get(csv_col, "").strip()

            mapped["object_id"] = obj_id
            mapped["is_highlight"] = parse_bool(mapped.get("is_highlight", ""))
            mapped["is_timeline_work"] = parse_bool(mapped.get("is_timeline_work", ""))
            mapped["is_public_domain"] = True  # guaranteed by filter above
            mapped["date_begin"] = parse_int(mapped.get("date_begin"), None)
            mapped["date_end"] = parse_int(mapped.get("date_end"), None)
            mapped["gallery_number"] = mapped.get("gallery_number", "")
            mapped["tags"] = parse_csv_tags(mapped.pop("tags_csv", ""))

            mapped["description"] = ""
            mapped["inscriptions"] = ""
            mapped["provenance"] = ""
            mapped["image_file"] = ""
            mapped["image_url"] = ""
            mapped["additional_images"] = []
            mapped["met_url"] = f"https://www.metmuseum.org/art/collection/search/{obj_id}"

            rows[obj_id] = mapped

    print(f"  Public-domain objects: {len(rows)}  (skipped {skipped} non-public-domain)")
    return rows


# ── Phase 1: Website Scrape ───────────────────────────────────────────────────


def extract_description(html: str) -> str:
    match = re.search(
        r'read-more-wrapper[^"]*__wrapper[^"]*"[^>]*>'
        r'\s*<div>\s*<div>(.*?)</div>\s*</div>',
        html,
        re.DOTALL,
    )
    if match:
        return clean_html(match.group(1)).strip()
    return ""


def extract_image_url(html: str) -> str:
    """Extract web-large image URL from page HTML."""
    match = re.search(
        r'https://images\.metmuseum\.org/CRDImages/([^/]+)/(?:original|web-additional|web-large)/([^"\\]+\.jpg)',
        html,
    )
    if match:
        dept_code = match.group(1)
        filename = match.group(2)
        return f"https://images.metmuseum.org/CRDImages/{dept_code}/web-large/{filename}"
    # Fallback: og:image IIIF URL
    match = re.search(r'og:image"\s+content="(https://collectionapi[^"]+)"', html)
    if match:
        return match.group(1)
    return ""


def extract_rsc_field(html: str, tab_name: str) -> str:
    escaped_name = f'\\"{tab_name}\\"'
    idx = html.find(escaped_name)
    while idx >= 0:
        segment = html[idx : idx + 2000]
        hi = segment.find("__html")
        if hi >= 0:
            after = segment[hi:]
            start = after.find(':\\"')
            if start >= 0:
                start += 3
                end = after.find('\\"}}', start)
                if end >= 0:
                    content = after[start:end]
                    content = content.replace("\\u003c", "<").replace("\\u003e", ">")
                    content = content.replace("\\u0026", "&").replace("\\u0027", "'")
                    content = clean_html(content)
                    if content and len(content) > 2:
                        return content.strip()
        idx = html.find(escaped_name, idx + 1)
    return ""


async def scrape_one(
    session: aiohttp.ClientSession,
    obj_id: int,
    sem: asyncio.Semaphore,
) -> tuple[int, dict | None]:
    url = f"https://www.metmuseum.org/art/collection/search/{obj_id}"
    for attempt in range(MAX_RETRIES):
        try:
            async with sem:
                async with session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=45),
                    headers={"User-Agent": "MetMuseumGameAssetBuilder/1.0"},
                ) as resp:
                    if resp.status == 200:
                        html = await resp.text()
                        result = {
                            "description": extract_description(html),
                            "inscriptions": extract_rsc_field(
                                html, "Signatures, Inscriptions, and Markings"
                            ),
                            "provenance": extract_rsc_field(html, "Provenance"),
                            "image_url": extract_image_url(html),
                        }
                        boilerplate = [
                            "The Met presents over 5,000 years",
                            "The Metropolitan Museum of Art",
                        ]
                        for bp in boilerplate:
                            if result["description"].startswith(bp):
                                result["description"] = ""
                                break
                        return (obj_id, result)
                    elif resp.status == 429:
                        await asyncio.sleep(BACKOFF_BASE * (2**attempt) + 1)
                    else:
                        return (obj_id, None)
        except (aiohttp.ClientError, asyncio.TimeoutError):
            await asyncio.sleep(BACKOFF_BASE * (2**attempt))
    return (obj_id, None)


async def phase1_scrape(objects: dict[int, dict], checkpoint: dict) -> dict:
    done_set = set(checkpoint.get("scrape_done", []))
    todo_ids = sorted(oid for oid in objects if oid not in done_set)

    if not todo_ids:
        print("Phase 1 (Scrape): Already complete.")
        return checkpoint

    total = len(todo_ids)
    num_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"\n{'='*60}")
    print(f"PHASE 1: Scraping {total} webpages in {num_batches} batches of {BATCH_SIZE}")
    print(f"{'='*60}")

    sem = asyncio.Semaphore(SCRAPE_CONCURRENCY)
    total_desc = 0
    total_insc = 0
    total_prov = 0

    async with aiohttp.ClientSession() as session:
        for batch_num, batch_ids in enumerate(batches(todo_ids, BATCH_SIZE), 1):
            t0 = time.time()
            tasks = [scrape_one(session, oid, sem) for oid in batch_ids]
            results = await asyncio.gather(*tasks)

            desc_n = insc_n = prov_n = img_n = 0
            for oid, result in results:
                if result:
                    obj = objects[oid]
                    if result["description"]:
                        obj["description"] = result["description"]
                        desc_n += 1
                    if result["inscriptions"]:
                        obj["inscriptions"] = result["inscriptions"]
                        insc_n += 1
                    if result["provenance"]:
                        obj["provenance"] = result["provenance"]
                        prov_n += 1
                    if result["image_url"]:
                        obj["image_url"] = result["image_url"]
                        img_n += 1

            total_desc += desc_n
            total_insc += insc_n
            total_prov += prov_n

            done_set.update(batch_ids)
            checkpoint["scrape_done"] = list(done_set)
            save_checkpoint(checkpoint)

            elapsed = time.time() - t0
            done_so_far = min(batch_num * BATCH_SIZE, total)
            print(
                f"  Batch {batch_num:>3}/{num_batches} "
                f"({done_so_far:>5}/{total}) "
                f"| {elapsed:5.1f}s "
                f"| desc={desc_n} insc={insc_n} prov={prov_n} img={img_n}"
            )

    print(f"\nPhase 1 done: {total_desc} descriptions, {total_insc} inscriptions, {total_prov} provenance")
    return checkpoint


# ── Phase 2: Image Download ────────────────────────────────────────────────────


async def download_one(
    session: aiohttp.ClientSession,
    obj_id: int,
    image_url: str,
    sem: asyncio.Semaphore,
) -> tuple[int, bool]:
    if not image_url:
        return (obj_id, False)

    dest = IMAGES_DIR / f"{obj_id}.jpg"
    if dest.exists() and dest.stat().st_size > 0:
        return (obj_id, True)

    for attempt in range(MAX_RETRIES):
        try:
            async with sem:
                async with session.get(
                    image_url, timeout=aiohttp.ClientTimeout(total=60)
                ) as resp:
                    if resp.status == 200:
                        dest.write_bytes(await resp.read())
                        return (obj_id, True)
                    elif resp.status == 429:
                        await asyncio.sleep(BACKOFF_BASE * (2**attempt) + 1)
                    else:
                        return (obj_id, False)
        except (aiohttp.ClientError, asyncio.TimeoutError):
            await asyncio.sleep(BACKOFF_BASE * (2**attempt))
    return (obj_id, False)


async def phase2_images(objects: dict[int, dict], checkpoint: dict) -> dict:
    done_set = set(checkpoint.get("image_done", []))

    # Mark already-done objects
    for oid in done_set:
        if oid in objects and objects[oid].get("image_url"):
            objects[oid]["image_file"] = f"images/{oid}.jpg"

    # Build download list
    download_list = [
        (oid, obj["image_url"])
        for oid, obj in sorted(objects.items())
        if oid not in done_set and obj.get("image_url")
    ]

    if not download_list:
        print("Phase 2 (Images): Already complete.")
        return checkpoint

    total = len(download_list)
    num_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"\n{'='*60}")
    print(f"PHASE 2: Downloading {total} images in {num_batches} batches of {BATCH_SIZE}")
    print(f"{'='*60}")

    sem = asyncio.Semaphore(IMAGE_CONCURRENCY)
    total_ok = 0

    async with aiohttp.ClientSession() as session:
        for batch_num, batch in enumerate(batches(download_list, BATCH_SIZE), 1):
            t0 = time.time()
            tasks = [download_one(session, oid, url, sem) for oid, url in batch]
            results = await asyncio.gather(*tasks)

            ok_n = 0
            for oid, success in results:
                if success:
                    objects[oid]["image_file"] = f"images/{oid}.jpg"
                    ok_n += 1

            total_ok += ok_n
            done_set.update(oid for oid, _ in batch)
            checkpoint["image_done"] = list(done_set)
            save_checkpoint(checkpoint)

            elapsed = time.time() - t0
            done_so_far = min(batch_num * BATCH_SIZE, total)
            print(
                f"  Batch {batch_num:>3}/{num_batches} "
                f"({done_so_far:>5}/{total}) "
                f"| {elapsed:5.1f}s "
                f"| downloaded={ok_n}/{len(batch)}"
            )

    print(f"\nPhase 2 done: {total_ok}/{total} images downloaded")
    return checkpoint


# ── Phase 3: Build Catalog & Indexes ───────────────────────────────────────────


def century_from_year(begin: int | None, end: int | None) -> str:
    year = begin or end
    if year is None:
        return ""
    if year <= 0:
        century = (abs(year) // 100) + 1
        return f"{century}th century B.C."
    else:
        century = ((year - 1) // 100) + 1
        suffixes = {1: "st", 2: "nd", 3: "rd"}
        suffix = suffixes.get(century if century < 20 else century % 10, "th")
        return f"{century}{suffix} century"


def build_catalog_and_indexes(objects: dict[int, dict]):
    print(f"\n{'='*60}")
    print("PHASE 3: Building catalog and indexes")
    print(f"{'='*60}")

    catalog = []
    for oid in sorted(objects.keys()):
        obj = objects[oid]
        record = {k: v for k, v in obj.items() if k not in ("link_resource",)}
        catalog.append(record)

    with open(CATALOG_PATH, "w") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
    print(f"  catalog_egyptian.json: {len(catalog)} objects")

    indexes = {
        "by_department": {},
        "by_culture": {},
        "by_classification": {},
        "by_century": {},
        "by_tags": {},
        "by_medium": {},
    }

    for obj in catalog:
        oid = obj["object_id"]
        for key, field in [
            ("by_department", "department"),
            ("by_culture", "culture"),
            ("by_classification", "classification"),
        ]:
            val = obj.get(field, "")
            if val:
                indexes[key].setdefault(val, []).append(oid)

        century = century_from_year(obj.get("date_begin"), obj.get("date_end"))
        if century:
            indexes["by_century"].setdefault(century, []).append(oid)

        tags = obj.get("tags", [])
        if isinstance(tags, list):
            for tag in tags:
                if tag:
                    indexes["by_tags"].setdefault(tag, []).append(oid)

        medium = obj.get("medium", "")
        if medium:
            indexes["by_medium"].setdefault(medium, []).append(oid)

    for name, data in indexes.items():
        path = INDEX_DIR / f"{name}.json"
        sorted_data = dict(sorted(data.items()))
        with open(path, "w") as f:
            json.dump(sorted_data, f, indent=2, ensure_ascii=False)
        print(f"  {name}.json: {len(sorted_data)} groups")

    print("Phase 3 complete.")


# ── Main ───────────────────────────────────────────────────────────────────────


async def main():
    start_time = time.time()

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_DIR.mkdir(parents=True, exist_ok=True)

    print("Reading Egyptian CSV...")
    objects = read_csv()
    print(f"Loaded {len(objects)} public-domain Egyptian objects.\n")

    checkpoint = load_checkpoint()

    # Order: website scrape (get descriptions + image URLs), then download images
    checkpoint = await phase1_scrape(objects, checkpoint)
    checkpoint = await phase2_images(objects, checkpoint)
    build_catalog_and_indexes(objects)

    elapsed = time.time() - start_time
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)

    total = len(objects)
    with_images = sum(1 for o in objects.values() if o.get("image_file"))
    with_desc = sum(1 for o in objects.values() if o.get("description"))
    with_insc = sum(1 for o in objects.values() if o.get("inscriptions"))
    with_prov = sum(1 for o in objects.values() if o.get("provenance"))

    print(f"\n{'='*60}")
    print(f"ALL DONE in {minutes}m {seconds}s")
    print(f"  Total objects:      {total}")
    print(f"  Images downloaded:  {with_images}")
    print(f"  Descriptions found: {with_desc}")
    print(f"  Inscriptions found: {with_insc}")
    print(f"  Provenance found:   {with_prov}")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
