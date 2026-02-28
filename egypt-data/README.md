# Met Museum Game Asset Library

8,872 public-domain Met artworks scraped, cataloged, and indexed for game development.

## What's Inside

| Metric | Count |
|--------|-------|
| Catalog objects | 8,872 (public domain, on-view) |
| Images downloaded | 8,830 (99.5%) — 654 MB |
| Descriptions | 6,642 (74.9%) |
| Inscriptions | 4,772 (53.8%) |
| Provenance records | 6,124 (69.0%) |
| Search indexes | 6 |

Source: MetObjects v2.csv from the Met's Open Access initiative.

## Project Structure

```
met-museum-api/
├── scraper.py                    # Async ETL pipeline (scrape + download + index)
├── app.py                        # Streamlit dashboard (8 pages)
├── data_utils.py                 # Data loading & aggregation utilities
├── MetObjects.csv                # Full Met collection (375K+ objects)
├── MetObjects_OnView.csv         # On-view subset (source for scraper)
├── game_assets/
│   ├── catalog.json              # 8,872 objects with all metadata
│   ├── catalog_full.json         # Same + absolute image paths
│   ├── .checkpoint.json          # Scraper resume state
│   ├── images/                   # 8,830 JPEGs named by Object ID
│   └── index/                    # 6 pre-built search indexes
│       ├── by_department.json    #   18 groups
│       ├── by_culture.json       #  523 groups
│       ├── by_classification.json#  220 groups
│       ├── by_century.json       #   34 groups
│       ├── by_tags.json          #  690 groups
│       └── by_medium.json        # 2,074 groups
├── Raphael_at_the_Met.pptx
└── Tiffany_at_the_Met.pptx
```

## Catalog Schema

Each entry in `catalog.json` contains up to 60 fields. Here's the shape of a single object:

```json
{
  "object_number": "1970.289.6",
  "is_highlight": false,
  "is_timeline_work": false,
  "is_public_domain": true,
  "object_id": 34,
  "gallery_number": "774",
  "department": "The American Wing",
  "accession_year": "1970",
  "object_name": "Clock",
  "title": "Acorn Clock",
  "culture": "American",
  "period": "",
  "dynasty": "",
  "reign": "",
  "portfolio": "",
  "constituent_id": "108",
  "artist_role": "Maker",
  "artist_prefix": "",
  "artist_display_name": "Forestville Manufacturing Company",
  "artist_display_bio": "1835–1853",
  "artist_suffix": "",
  "artist_alpha_sort": "Forestville Manufacturing Company",
  "artist_nationality": "American",
  "artist_begin_date": "1835",
  "artist_end_date": "1853",
  "artist_gender": "",
  "artist_ulan_url": "",
  "artist_wikidata_url": "",
  "date": "1847–50",
  "date_begin": 1847,
  "date_end": 1850,
  "medium": "Mahogany, laminated",
  "dimensions": "24 3/8 x 14 5/8 x 5 1/8 in. (61.9 x 37.1 x 13 cm)",
  "credit_line": "Gift of Mrs. Paul Moore, 1970",
  "geography_type": "Made in",
  "city": "Bristol",
  "state": "",
  "county": "",
  "country": "United States",
  "region": "",
  "subregion": "",
  "locale": "",
  "locus": "",
  "excavation": "",
  "river": "",
  "classification": "",
  "rights_and_reproduction": "",
  "object_wikidata_url": "https://www.wikidata.org/wiki/Q116373732",
  "metadata_date": "",
  "repository": "Metropolitan Museum of Art, New York, NY",
  "tags_aat_url": "http://vocab.getty.edu/...|...",
  "tags_wikidata_url": "https://www.wikidata.org/wiki/...|...",
  "tags": ["Landscapes", "Boats"],
  "description": "The proprietor of the Forestville Manufacturing Company...",
  "inscriptions": "Inscription: inscribed on the dial (in script): ...",
  "provenance": "Mrs. Paul Moore, Convent, New Jersey, until 1970",
  "image_file": "images/34.jpg",
  "image_url": "https://images.metmuseum.org/CRDImages/ad/web-large/204788.jpg",
  "additional_images": [],
  "met_url": "https://www.metmuseum.org/art/collection/search/34"
}
```

**Field categories:**
- **Identity** — `object_id`, `object_number`, `title`, `object_name`
- **Artist** — `artist_display_name`, `artist_display_bio`, `artist_nationality`, `artist_begin_date`, `artist_end_date`, `artist_gender`, etc.
- **Dates** — `date` (text), `date_begin` / `date_end` (integers)
- **Geography** — `geography_type`, `city`, `state`, `county`, `country`, `region`, `subregion`, `locale`, `locus`, `excavation`, `river`
- **Classification** — `department`, `culture`, `period`, `dynasty`, `reign`, `classification`, `medium`
- **Scraped** — `description`, `inscriptions`, `provenance` (from Met website)
- **Images** — `image_file` (local path), `image_url` (CDN), `additional_images`
- **Links** — `met_url`, `object_wikidata_url`, `artist_wikidata_url`, `artist_ulan_url`, `tags_aat_url`, `tags_wikidata_url`

## Search Indexes

Each index maps a group name to an array of `object_id` values:

```json
{ "The American Wing": [34, 37, 108, 109, ...], "European Paintings": [203, 205, ...] }
```

| Index | Groups | Example keys |
|-------|--------|-------------|
| `by_department.json` | 18 | "The American Wing", "European Paintings", "Asian Art" |
| `by_culture.json` | 523 | "American", "French", "Japanese", "Egyptian" |
| `by_classification.json` | 220 | "Paintings", "Ceramics", "Textiles", "Glass" |
| `by_century.json` | 34 | "19th century", "5th century BCE", "1st century" |
| `by_tags.json` | 690 | "Landscapes", "Portraits", "Animals", "Boats" |
| `by_medium.json` | 2,074 | "Oil on canvas", "Bronze", "Silk", "Watercolor" |

**Usage:**
```python
import json

with open("game_assets/index/by_department.json") as f:
    dept_index = json.load(f)

# Get all object IDs for European Paintings
euro_ids = dept_index["European Paintings"]

# Load catalog and filter
with open("game_assets/catalog.json") as f:
    catalog = json.load(f)

euro_paintings = [obj for obj in catalog if obj["object_id"] in set(euro_ids)]
```

## How to Run the Scraper

### Dependencies

```bash
pip install aiohttp tqdm
```

(`beautifulsoup4` is not required — the scraper uses regex-based HTML extraction.)

### Run

```bash
python3 scraper.py
```

### What it does

1. Reads `MetObjects_OnView.csv` → filters to public-domain, on-view objects
2. Scrapes descriptions, inscriptions, provenance from Met website (batches of 100, 5 concurrent requests)
3. Downloads images from Met CDN (10 concurrent downloads)
4. Builds `catalog.json` and 6 search indexes

Checkpoint-based: if interrupted, re-run and it picks up where it left off. Full run takes ~8 minutes on a decent connection.

### Configuration (in `scraper.py`)

| Constant | Default | Purpose |
|----------|---------|---------|
| `BATCH_SIZE` | 100 | Objects per batch |
| `SCRAPE_CONCURRENCY` | 5 | Parallel scrape requests |
| `IMAGE_CONCURRENCY` | 10 | Parallel image downloads |
| `MAX_RETRIES` | 3 | Retry attempts per request |
| `BACKOFF_BASE` | 1.0 | Exponential backoff base (seconds) |

## Game Concept — Chronos Hunt

> **Note:** This is a brainstorm, not a finalized game design. Ideas are meant to be explored, combined, and iterated on.

### Premise

A time traveler is altering history by hiding temporal artifacts inside real Met artworks. Players physically visit the museum, investigate 30 pieces across 6 departments, and piece together where (and when) the traveler will strike next.

### Investigation Mechanics

- Point your phone camera at a real artwork → CV identifies it → unlocks that artwork's "temporal anomaly"
- GenAI narrator plays as your handler from the future, reacting dynamically to what you find
- Each artwork has a hidden clue embedded in its real details (inscriptions, symbols, dates, materials) that players must actually observe in person

### Clue Types (Using Real Metadata)

1. **Date mismatches** — something depicted in the artwork doesn't belong in its time period
2. **Inscription ciphers** — inscriptions across multiple works form anagrams or coded messages
3. **Gallery coordinates** — gallery numbers map to physical coordinates in the museum
4. **Provenance chains** — "this passed through the hands of X, who also owned artwork Y — go find it"
5. **Material connections** — "the traveler only hides in objects made of bronze"

### GenAI Narration & Voice

- Narrator adapts based on which artworks you've found, and in what order
- Voice-based Q&A — ask questions about the artwork, AI responds in character
- Red herrings and branching theories based on player guesses
- Story shifts based on which clues the player prioritizes

### Computer Vision Features

- Scan artwork → overlay AR "anomaly" (glowing symbol, temporal crack)
- Zoom into real details the AI instructs you to examine
- Compare two artworks side by side (photo one, walk to another)

### Location-Based / IRL Features

- GPS/beacon unlock — can only investigate artworks when physically near them
- Gallery-based progression — certain wings unlock after solving a department's puzzle
- Time pressure — the "temporal rift" closes at museum closing time
- Multiplayer: different players get different subsets of 30 artworks, must collaborate

### Meta-Puzzle Structure

- 30 artworks across ~6 departments = 5 artworks per "era"
- Each era gives a fragment of the traveler's identity
- Final puzzle requires synthesizing all 6 fragments at a specific location in the museum

### Why This Works

- Uses real art history as game content — descriptions, inscriptions, and provenance are already in the 8,872-object catalog
- Physical movement through the museum IS the gameplay
- No two playthroughs identical — GenAI makes the narrative adapt dynamically
- Educational without trying to be — players learn about art because the clues demand it

## Top Artists in the Dataset

The dataset skews toward 19th-century American decorative arts, so manufacturers and studios dominate:

| Rank | Artist / Maker | Works |
|------|---------------|-------|
| 1 | Union Porcelain Works | 141 |
| 2 | Boston & Sandwich Glass Company | 119 |
| 3 | Sevres Manufactory | 104 |
| 4 | New England Glass Company | 103 |
| 5 | Hobbs, Brockunier and Company | 101 |
| 6 | Meissen Manufactory | 96 |
| 7 | **Edgar Degas** | 96 |
| 8 | Henry Kellam Hancock | 76 |
| 9 | Adams and Company | 60 |
| 10 | Challinor, Taylor and Company | 59 |
| 11 | Paul Revere Jr. | 52 |
| 12 | Worcester factory | 51 |
| 13 | Chelsea Porcelain Manufactory | 49 |
| 14 | United States Pottery Company | 47 |
| 15 | Richards and Hartley Flint Glass Co. | 45 |
| 16 | **Louis C. Tiffany** | 44 |
| 17 | **Auguste Rodin** | 42 |
| 18 | J. and J. G. Low Art Tile Works | 41 |
| 19 | Duncan Phyfe | 38 |
| 20 | Vienna | 38 |

Notable individual artists: **Degas** (96), **Tiffany** (44), **Rodin** (42).
