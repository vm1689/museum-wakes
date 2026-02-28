"""Data loading, cleaning, derived columns, cached aggregations, and filtering for Met Museum dataset."""

import os
import re
import streamlit as st
import pandas as pd
import numpy as np

DATA_PATH = os.path.join(os.path.dirname(__file__), "MetObjects.csv")

USE_COLUMNS = [
    "Object ID", "Is Highlight", "Is Public Domain", "Gallery Number",
    "Department", "AccessionYear", "Object Name", "Title", "Culture",
    "Period", "Dynasty", "Reign", "Artist Display Name", "Artist Nationality",
    "Artist Gender", "Object Date", "Object Begin Date", "Object End Date",
    "Medium", "Classification", "Country", "Link Resource", "City", "State",
    "Tags", "Artist Display Bio",
]

CATEGORY_COLUMNS = [
    "Department", "Culture", "Period", "Dynasty", "Reign",
    "Classification", "Country", "Object Name",
]


@st.cache_data(show_spinner="Loading Met Museum collection…")
def load_data():
    """Load and clean the Met Museum CSV. Returns a cleaned DataFrame."""
    df = pd.read_csv(
        DATA_PATH,
        usecols=USE_COLUMNS,
        low_memory=False,
    )

    # --- AccessionYear: extract year from mixed formats (ISO dates + plain years) ---
    ay = df["AccessionYear"].astype(str).str.strip()
    # ISO dates like "2005-02-15" → take first 4 chars
    ay = ay.str[:4]
    ay = pd.to_numeric(ay, errors="coerce")
    df["AccessionYear"] = ay.astype("Int64")

    # --- Object Begin Date cleaning ---
    df["Object Begin Date"] = pd.to_numeric(df["Object Begin Date"], errors="coerce")
    df["Object End Date"] = pd.to_numeric(df["Object End Date"], errors="coerce")

    # --- Derived: Century and Century Sort ---
    begin = df["Object Begin Date"]
    century = pd.Series(np.nan, index=df.index, dtype="object")
    century_sort = pd.Series(np.nan, index=df.index, dtype="float64")

    valid = begin.notna() & (begin != 0)
    before_3000 = valid & (begin < -3000)
    bce = valid & (begin < 0) & (begin >= -3000)
    ce = valid & (begin > 0)

    # Before 3000 BCE
    century[before_3000] = "Before 3000 BCE"
    century_sort[before_3000] = -40

    # BCE centuries: e.g. -500 → "5th c. BCE"
    bce_years = begin[bce].abs()
    bce_c = ((bce_years - 1) // 100 + 1).astype(int)
    century[bce] = bce_c.astype(str) + _ordinal_suffix_series(bce_c) + " c. BCE"
    century_sort[bce] = -bce_c.astype(float)

    # CE centuries: e.g. 1500 → "16th c."
    ce_c = ((begin[ce] - 1) // 100 + 1).astype(int)
    century[ce] = ce_c.astype(str) + _ordinal_suffix_series(ce_c) + " c."
    century_sort[ce] = ce_c.astype(float)

    # Zero / missing → Undated
    undated = begin.isna() | (begin == 0)
    century[undated] = "Undated"
    century_sort[undated] = 999

    df["Century"] = century
    df["Century Sort"] = century_sort

    # --- Derived: Era ---
    df["Era"] = _assign_era(begin)

    # --- Derived: On View ---
    df["On View"] = df["Gallery Number"].notna()

    # --- Derived: Primary Nationality ---
    df["Primary Nationality"] = (
        df["Artist Nationality"]
        .fillna("")
        .str.split("|")
        .str[0]
        .str.strip()
        .replace("", np.nan)
    )

    # --- Derived: Has Artist ---
    df["Has Artist"] = df["Artist Display Name"].notna()

    # --- Derived: Gender Clean ---
    df["Gender Clean"] = df["Artist Gender"].apply(_parse_gender)

    # --- Derived: Medium Simple ---
    df["Medium Simple"] = (
        df["Medium"]
        .fillna("")
        .str.split(r"[;,]", regex=True)
        .str[0]
        .str.strip()
        .replace("", np.nan)
    )

    # --- Derived: Met URL ---
    df["Met URL"] = df["Link Resource"].fillna("")

    # --- Convert low-cardinality string columns to category ---
    for col in CATEGORY_COLUMNS:
        if col in df.columns:
            df[col] = df[col].astype("category")

    return df


def _ordinal_suffix_series(s):
    """Return a Series of ordinal suffixes ('st','nd','rd','th') for integer Series."""
    suffix = pd.Series("th", index=s.index)
    suffix[s % 10 == 1] = "st"
    suffix[s % 10 == 2] = "nd"
    suffix[s % 10 == 3] = "rd"
    suffix[(s % 100 >= 11) & (s % 100 <= 13)] = "th"
    return suffix


def _assign_era(begin):
    """Assign broad era labels based on Object Begin Date."""
    era = pd.Series("Unknown", index=begin.index, dtype="object")
    valid = begin.notna() & (begin != 0)
    v = begin[valid]
    era[valid & (v < -3000)] = "Prehistoric"
    era[valid & (v >= -3000) & (v < -1200)] = "Ancient (3000-1200 BCE)"
    era[valid & (v >= -1200) & (v < -500)] = "Iron Age (1200-500 BCE)"
    era[valid & (v >= -500) & (v < 500)] = "Classical (500 BCE-500 CE)"
    era[valid & (v >= 500) & (v < 1400)] = "Medieval (500-1400)"
    era[valid & (v >= 1400) & (v < 1600)] = "Renaissance (1400-1600)"
    era[valid & (v >= 1600) & (v < 1800)] = "Early Modern (1600-1800)"
    era[valid & (v >= 1800) & (v < 1900)] = "19th Century"
    era[valid & (v >= 1900) & (v < 2000)] = "20th Century"
    era[valid & (v >= 2000)] = "21st Century"
    return era


def _parse_gender(val):
    """Parse pipe-delimited Artist Gender field."""
    if pd.isna(val) or str(val).strip() == "":
        return np.nan
    val = str(val).strip()
    parts = [p.strip() for p in val.split("|") if p.strip()]
    if not parts:
        # Only pipes, no text → Male (Met convention)
        return "Male"
    genders = set(parts)
    if genders == {"Female"}:
        return "Female"
    if genders == {"Male"}:
        return "Male"
    if "Female" in genders and "Male" not in genders and len(genders) == 1:
        return "Female"
    if "Female" in genders:
        return "Mixed"
    return "Male"


# ---------------------------------------------------------------------------
# Pre-computed aggregations
# ---------------------------------------------------------------------------

@st.cache_data(show_spinner=False)
def precompute_aggregations(_df):
    """Return dict of pre-grouped DataFrames for charting. Prefix _ so Streamlit doesn't hash."""
    agg = {}

    # Department counts
    agg["dept_counts"] = (
        _df["Department"].value_counts().reset_index()
    )
    agg["dept_counts"].columns = ["Department", "Count"]

    # Public domain rate by department
    pd_rate = _df.groupby("Department", observed=True)["Is Public Domain"].mean().reset_index()
    pd_rate.columns = ["Department", "Public Domain Rate"]
    agg["dept_pd_rate"] = pd_rate

    # Century distribution (sorted)
    cent = _df[_df["Century"] != "Undated"].groupby(
        ["Century", "Century Sort"], observed=True
    ).size().reset_index(name="Count")
    cent = cent.sort_values("Century Sort")
    agg["century_dist"] = cent

    # Era distribution
    era = _df[_df["Era"] != "Unknown"].groupby("Era", observed=True).size().reset_index(name="Count")
    era_order = [
        "Prehistoric", "Ancient (3000-1200 BCE)", "Iron Age (1200-500 BCE)",
        "Classical (500 BCE-500 CE)", "Medieval (500-1400)", "Renaissance (1400-1600)",
        "Early Modern (1600-1800)", "19th Century", "20th Century", "21st Century",
    ]
    era["Era"] = pd.Categorical(era["Era"], categories=era_order, ordered=True)
    era = era.sort_values("Era")
    agg["era_dist"] = era

    # Acquisitions over time
    acq = _df[_df["AccessionYear"].notna()].groupby("AccessionYear", observed=True).size().reset_index(name="Count")
    acq = acq.sort_values("AccessionYear")
    acq["Cumulative"] = acq["Count"].cumsum()
    agg["acquisitions"] = acq

    # Top artists
    artists = _df[_df["Has Artist"]].groupby("Artist Display Name").agg(
        Count=("Object ID", "size"),
        Nationality=("Primary Nationality", "first"),
    ).reset_index().sort_values("Count", ascending=False)
    agg["top_artists"] = artists

    # Artist nationality
    nat = _df[_df["Primary Nationality"].notna()]["Primary Nationality"].value_counts().head(30).reset_index()
    nat.columns = ["Nationality", "Count"]
    agg["artist_nationality"] = nat

    # Gender distribution
    gender = _df[_df["Gender Clean"].notna()]["Gender Clean"].value_counts().reset_index()
    gender.columns = ["Gender", "Count"]
    agg["gender_dist"] = gender

    # Gender over time (by century)
    gender_time = _df[(_df["Gender Clean"].notna()) & (_df["Century"] != "Undated")].groupby(
        ["Century", "Century Sort", "Gender Clean"], observed=True
    ).size().reset_index(name="Count")
    gender_time = gender_time.sort_values("Century Sort")
    agg["gender_time"] = gender_time

    # Top mediums
    med = _df[_df["Medium Simple"].notna()]["Medium Simple"].value_counts().head(50).reset_index()
    med.columns = ["Medium", "Count"]
    agg["top_mediums"] = med

    # Department x Medium heatmap data
    top15_mediums = list(med["Medium"].head(15))
    dm = _df[_df["Medium Simple"].isin(top15_mediums)].groupby(
        ["Department", "Medium Simple"], observed=True
    ).size().reset_index(name="Count")
    agg["dept_medium"] = dm
    agg["top15_mediums"] = top15_mediums

    # Top cultures
    cult = _df[_df["Culture"].notna()]["Culture"].value_counts().head(40).reset_index()
    cult.columns = ["Culture", "Count"]
    agg["top_cultures"] = cult

    # Cultures across centuries
    top10_cultures = list(cult["Culture"].head(10))
    cult_time = _df[(_df["Culture"].isin(top10_cultures)) & (_df["Century"] != "Undated")].groupby(
        ["Century", "Century Sort", "Culture"], observed=True
    ).size().reset_index(name="Count")
    cult_time = cult_time.sort_values("Century Sort")
    agg["culture_time"] = cult_time

    # Top countries
    country = _df[_df["Country"].notna()]["Country"].value_counts().head(30).reset_index()
    country.columns = ["Country", "Count"]
    agg["top_countries"] = country

    # Periods
    periods = _df[_df["Period"].notna()]["Period"].value_counts().head(30).reset_index()
    periods.columns = ["Period", "Count"]
    agg["top_periods"] = periods

    # Dynasties
    dyn = _df[_df["Dynasty"].notna()]["Dynasty"].value_counts().head(30).reset_index()
    dyn.columns = ["Dynasty", "Count"]
    agg["top_dynasties"] = dyn

    # Classification over time
    top10_class = list(
        _df[_df["Classification"].notna()]["Classification"].value_counts().head(10).index
    )
    class_time = _df[(_df["Classification"].isin(top10_class)) & (_df["Century"] != "Undated")].groupby(
        ["Century", "Century Sort", "Classification"], observed=True
    ).size().reset_index(name="Count")
    class_time = class_time.sort_values("Century Sort")
    agg["classification_time"] = class_time
    agg["top10_classifications"] = top10_class

    # Era x Department
    era_dept = _df[_df["Era"] != "Unknown"].groupby(
        ["Era", "Department"], observed=True
    ).size().reset_index(name="Count")
    era_dept["Era"] = pd.Categorical(era_dept["Era"], categories=era_order, ordered=True)
    era_dept = era_dept.sort_values("Era")
    agg["era_dept"] = era_dept

    return agg


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------

def filter_dataframe(df, filters):
    """Apply sidebar filters via boolean masking. Returns filtered DataFrame."""
    mask = pd.Series(True, index=df.index)

    if filters.get("department"):
        mask &= df["Department"].isin(filters["department"])

    if filters.get("date_min") is not None:
        mask &= df["Object Begin Date"].fillna(0) >= filters["date_min"]

    if filters.get("date_max") is not None:
        mask &= df["Object Begin Date"].fillna(0) <= filters["date_max"]

    if filters.get("acc_year_min") is not None:
        mask &= df["AccessionYear"].fillna(0) >= filters["acc_year_min"]

    if filters.get("acc_year_max") is not None:
        mask &= df["AccessionYear"].fillna(9999) <= filters["acc_year_max"]

    if filters.get("public_domain") is not None:
        mask &= df["Is Public Domain"] == filters["public_domain"]

    if filters.get("on_view") is not None:
        mask &= df["On View"] == filters["on_view"]

    if filters.get("search_text"):
        text = filters["search_text"].lower()
        text_mask = (
            df["Title"].astype(str).str.lower().str.contains(text, regex=False)
            | df["Artist Display Name"].astype(str).str.lower().str.contains(text, regex=False)
            | df["Object Name"].astype(str).str.lower().str.contains(text, regex=False)
            | df["Medium"].astype(str).str.lower().str.contains(text, regex=False)
        )
        mask &= text_mask

    return df[mask]
