"""Met Museum Collection Explorer — Streamlit Dashboard."""

import streamlit as st
import pandas as pd
import numpy as np

from data_utils import load_data, precompute_aggregations, filter_dataframe

# ---------------------------------------------------------------------------
# Plotly availability
# ---------------------------------------------------------------------------
try:
    import plotly.express as px
    import plotly.graph_objects as go
    HAS_PLOTLY = True
except ImportError:
    HAS_PLOTLY = False

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Met Museum Collection Explorer",
    page_icon="🏛️",
    layout="wide",
    initial_sidebar_state="expanded",
)

PAGES = [
    "Overview",
    "Timeline",
    "Departments",
    "Artists",
    "Mediums",
    "Geography",
    "Art History",
    "Object Explorer",
]


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
def sidebar_filters(df):
    """Render sidebar and return filters dict."""
    st.sidebar.title("Met Museum Explorer")
    st.sidebar.markdown("---")

    page = st.sidebar.radio("Navigate", PAGES)
    st.sidebar.markdown("---")
    st.sidebar.subheader("Filters")

    filters = {}

    # Department
    all_depts = sorted(df["Department"].dropna().unique())
    dept_sel = st.sidebar.multiselect("Department", all_depts)
    if dept_sel:
        filters["department"] = dept_sel

    # Date range
    col1, col2 = st.sidebar.columns(2)
    date_min = col1.number_input("Date from", value=-3000, step=100)
    date_max = col2.number_input("Date to", value=2025, step=100)
    filters["date_min"] = date_min
    filters["date_max"] = date_max

    # Accession year range
    col3, col4 = st.sidebar.columns(2)
    acc_min = col3.number_input("Acquired from", value=1870, step=10)
    acc_max = col4.number_input("Acquired to", value=2025, step=10)
    filters["acc_year_min"] = acc_min
    filters["acc_year_max"] = acc_max

    # Public domain
    pd_opt = st.sidebar.selectbox("Public domain", ["All", "Yes", "No"])
    if pd_opt == "Yes":
        filters["public_domain"] = True
    elif pd_opt == "No":
        filters["public_domain"] = False

    # On view
    ov_opt = st.sidebar.selectbox("On view", ["All", "Yes", "No"])
    if ov_opt == "Yes":
        filters["on_view"] = True
    elif ov_opt == "No":
        filters["on_view"] = False

    # Text search
    search = st.sidebar.text_input("Search (title/artist/object/medium)")
    if search.strip():
        filters["search_text"] = search.strip()

    st.sidebar.markdown("---")
    st.sidebar.caption(f"Dataset: {len(df):,} objects")

    return page, filters


# ===========================================================================
# PAGES
# ===========================================================================

# ---------------------------------------------------------------------------
# 1. Overview
# ---------------------------------------------------------------------------
def page_overview(fdf, agg):
    st.header("Collection Overview")

    total = len(fdf)
    public = fdf["Is Public Domain"].sum()
    on_view = fdf["On View"].sum()
    has_artist = fdf["Has Artist"].sum()
    depts = fdf["Department"].nunique()

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Total Objects", f"{total:,}")
    c2.metric("Public Domain", f"{int(public):,}")
    c3.metric("On View", f"{int(on_view):,}")
    c4.metric("With Artist", f"{int(has_artist):,}")
    c5.metric("Departments", depts)

    col_left, col_right = st.columns([3, 2])

    with col_left:
        st.subheader("Objects by Department")
        dept_data = fdf["Department"].value_counts().reset_index()
        dept_data.columns = ["Department", "Count"]
        if HAS_PLOTLY:
            fig = px.bar(dept_data, x="Count", y="Department", orientation="h",
                         color="Count", color_continuous_scale="Viridis")
            fig.update_layout(height=550, yaxis=dict(autorange="reversed"), showlegend=False)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(dept_data.set_index("Department")["Count"])

    with col_right:
        st.subheader("Department Share")
        if HAS_PLOTLY:
            fig = px.pie(dept_data.head(12), values="Count", names="Department", hole=0.4)
            fig.update_layout(height=550)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.dataframe(dept_data)

    st.subheader("Public Domain Rate by Department")
    pd_rate = fdf.groupby("Department", observed=True)["Is Public Domain"].mean().reset_index()
    pd_rate.columns = ["Department", "Rate"]
    pd_rate = pd_rate.sort_values("Rate", ascending=False)
    if HAS_PLOTLY:
        fig = px.bar(pd_rate, x="Department", y="Rate", color="Rate",
                     color_continuous_scale="RdYlGn", text_auto=".0%")
        fig.update_layout(height=400)
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.bar_chart(pd_rate.set_index("Department")["Rate"])


# ---------------------------------------------------------------------------
# 2. Timeline
# ---------------------------------------------------------------------------
def page_timeline(fdf, agg):
    st.header("Timeline")

    tab1, tab2, tab3 = st.tabs(["By Century", "By Era", "Acquisitions"])

    with tab1:
        cent = fdf[fdf["Century"] != "Undated"].groupby(
            ["Century", "Century Sort"], observed=True
        ).size().reset_index(name="Count")
        cent = cent.sort_values("Century Sort")

        show_bce = st.checkbox("Include BCE centuries", value=True, key="bce_toggle")
        if not show_bce:
            cent = cent[cent["Century Sort"] > 0]

        if HAS_PLOTLY:
            fig = px.bar(cent, x="Century", y="Count", color="Count",
                         color_continuous_scale="Plasma")
            fig.update_layout(height=500, xaxis_tickangle=-45)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(cent.set_index("Century")["Count"])

    with tab2:
        era_order = [
            "Prehistoric", "Ancient (3000-1200 BCE)", "Iron Age (1200-500 BCE)",
            "Classical (500 BCE-500 CE)", "Medieval (500-1400)", "Renaissance (1400-1600)",
            "Early Modern (1600-1800)", "19th Century", "20th Century", "21st Century",
        ]
        era = fdf[fdf["Era"] != "Unknown"]["Era"].value_counts().reindex(era_order).dropna().reset_index()
        era.columns = ["Era", "Count"]
        if HAS_PLOTLY:
            fig = px.bar(era, x="Era", y="Count", color="Count",
                         color_continuous_scale="Inferno")
            fig.update_layout(height=500, xaxis_tickangle=-30)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(era.set_index("Era")["Count"])

    with tab3:
        acq = fdf[fdf["AccessionYear"].notna()].groupby("AccessionYear").size().reset_index(name="Count")
        acq = acq.sort_values("AccessionYear")
        acq["Cumulative"] = acq["Count"].cumsum()

        if HAS_PLOTLY:
            from plotly.subplots import make_subplots
            fig = make_subplots(specs=[[{"secondary_y": True}]])
            fig.add_trace(
                go.Scatter(x=acq["AccessionYear"], y=acq["Count"],
                           fill="tozeroy", name="Yearly Acquisitions", mode="lines"),
                secondary_y=False,
            )
            fig.add_trace(
                go.Scatter(x=acq["AccessionYear"], y=acq["Cumulative"],
                           name="Cumulative", mode="lines", line=dict(color="firebrick", width=2)),
                secondary_y=True,
            )
            fig.update_layout(height=500, title="Acquisitions Over Time")
            fig.update_xaxes(title_text="Year")
            fig.update_yaxes(title_text="Yearly Count", secondary_y=False)
            fig.update_yaxes(title_text="Cumulative", secondary_y=True)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.line_chart(acq.set_index("AccessionYear")[["Count", "Cumulative"]])


# ---------------------------------------------------------------------------
# 3. Departments
# ---------------------------------------------------------------------------
def page_departments(fdf, agg):
    st.header("Department Deep Dive")

    all_depts = sorted(fdf["Department"].dropna().unique())
    if not all_depts:
        st.warning("No departments in filtered data.")
        return
    dept = st.selectbox("Select department", all_depts)
    ddf = fdf[fdf["Department"] == dept]

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Objects", f"{len(ddf):,}")
    c2.metric("Public Domain", f"{int(ddf['Is Public Domain'].sum()):,}")
    c3.metric("On View", f"{int(ddf['On View'].sum()):,}")
    c4.metric("With Artist", f"{int(ddf['Has Artist'].sum()):,}")

    col_l, col_r = st.columns(2)

    with col_l:
        st.subheader("Top Mediums")
        med = ddf[ddf["Medium Simple"].notna()]["Medium Simple"].value_counts().head(15).reset_index()
        med.columns = ["Medium", "Count"]
        if HAS_PLOTLY:
            fig = px.bar(med, x="Count", y="Medium", orientation="h")
            fig.update_layout(height=450, yaxis=dict(autorange="reversed"))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(med.set_index("Medium")["Count"])

    with col_r:
        st.subheader("Top Classifications")
        cls = ddf[ddf["Classification"].notna()]["Classification"].value_counts().head(15).reset_index()
        cls.columns = ["Classification", "Count"]
        if HAS_PLOTLY:
            fig = px.bar(cls, x="Count", y="Classification", orientation="h")
            fig.update_layout(height=450, yaxis=dict(autorange="reversed"))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(cls.set_index("Classification")["Count"])

    st.subheader("Date Distribution")
    dates = ddf[(ddf["Object Begin Date"].notna()) & (ddf["Object Begin Date"] != 0)]["Object Begin Date"]
    if len(dates) > 0:
        if HAS_PLOTLY:
            fig = px.histogram(dates, nbins=50, labels={"value": "Object Begin Date"})
            fig.update_layout(height=350, showlegend=False)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(dates.value_counts().sort_index())
    else:
        st.info("No dated objects in this department.")

    st.subheader("Top Cultures")
    cult = ddf[ddf["Culture"].notna()]["Culture"].value_counts().head(15).reset_index()
    cult.columns = ["Culture", "Count"]
    fill = ddf["Culture"].notna().mean()
    st.caption(f"Culture field filled for {fill:.0%} of objects in this department")
    if len(cult) > 0:
        if HAS_PLOTLY:
            fig = px.bar(cult, x="Count", y="Culture", orientation="h")
            fig.update_layout(height=400, yaxis=dict(autorange="reversed"))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(cult.set_index("Culture")["Count"])


# ---------------------------------------------------------------------------
# 4. Artists
# ---------------------------------------------------------------------------
def page_artists(fdf, agg):
    st.header("Artists")

    top_n = st.slider("Top N artists", 10, 100, 30, key="artist_top_n")

    artists = fdf[fdf["Has Artist"]].groupby("Artist Display Name").agg(
        Count=("Object ID", "size"),
        Nationality=("Primary Nationality", "first"),
    ).reset_index().sort_values("Count", ascending=False).head(top_n)

    st.subheader(f"Top {top_n} Artists by Number of Objects")
    if HAS_PLOTLY:
        fig = px.bar(artists, x="Count", y="Artist Display Name", orientation="h",
                     color="Nationality", hover_data=["Nationality"])
        fig.update_layout(height=max(400, top_n * 18), yaxis=dict(autorange="reversed"))
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.bar_chart(artists.set_index("Artist Display Name")["Count"])

    col_l, col_r = st.columns(2)

    with col_l:
        st.subheader("Artist Nationality")
        nat = fdf[fdf["Primary Nationality"].notna()]["Primary Nationality"].value_counts().head(20).reset_index()
        nat.columns = ["Nationality", "Count"]
        if HAS_PLOTLY:
            fig = px.bar(nat, x="Count", y="Nationality", orientation="h")
            fig.update_layout(height=500, yaxis=dict(autorange="reversed"))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(nat.set_index("Nationality")["Count"])

    with col_r:
        st.subheader("Gender Distribution")
        gender = fdf[fdf["Gender Clean"].notna()]["Gender Clean"].value_counts().reset_index()
        gender.columns = ["Gender", "Count"]
        if HAS_PLOTLY:
            fig = px.pie(gender, values="Count", names="Gender", hole=0.35)
            fig.update_layout(height=350)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.dataframe(gender)

        st.subheader("Gender Representation Over Time")
        gt = fdf[(fdf["Gender Clean"].notna()) & (fdf["Century"] != "Undated")].groupby(
            ["Century", "Century Sort", "Gender Clean"], observed=True
        ).size().reset_index(name="Count")
        gt = gt.sort_values("Century Sort")
        # Only show CE centuries for readability
        gt_ce = gt[gt["Century Sort"] > 0]
        if len(gt_ce) > 0:
            if HAS_PLOTLY:
                fig = px.line(gt_ce, x="Century", y="Count", color="Gender Clean", markers=True)
                fig.update_layout(height=350, xaxis_tickangle=-45)
                st.plotly_chart(fig, use_container_width=True)
            else:
                pivot = gt_ce.pivot_table(index="Century", columns="Gender Clean", values="Count", fill_value=0)
                st.line_chart(pivot)


# ---------------------------------------------------------------------------
# 5. Mediums
# ---------------------------------------------------------------------------
def page_mediums(fdf, agg):
    st.header("Mediums & Materials")

    top_n = st.slider("Top N mediums", 10, 60, 25, key="med_top_n")
    med = fdf[fdf["Medium Simple"].notna()]["Medium Simple"].value_counts().head(top_n).reset_index()
    med.columns = ["Medium", "Count"]

    st.subheader(f"Top {top_n} Mediums")
    if HAS_PLOTLY:
        fig = px.bar(med, x="Count", y="Medium", orientation="h", color="Count",
                     color_continuous_scale="Viridis")
        fig.update_layout(height=max(400, top_n * 20), yaxis=dict(autorange="reversed"))
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.bar_chart(med.set_index("Medium")["Count"])

    st.subheader("Department × Medium Heatmap")
    top15_mediums = list(med["Medium"].head(15))
    dm = fdf[fdf["Medium Simple"].isin(top15_mediums)].groupby(
        ["Department", "Medium Simple"], observed=True
    ).size().reset_index(name="Count")

    if len(dm) > 0:
        pivot = dm.pivot_table(index="Department", columns="Medium Simple", values="Count", fill_value=0)
        if HAS_PLOTLY:
            fig = px.imshow(pivot, color_continuous_scale="YlOrRd", aspect="auto",
                            labels=dict(color="Count"))
            fig.update_layout(height=550)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.dataframe(pivot)
    else:
        st.info("No medium data available for heatmap.")


# ---------------------------------------------------------------------------
# 6. Geography
# ---------------------------------------------------------------------------
def page_geography(fdf, agg):
    st.header("Geography & Cultures")

    col_l, col_r = st.columns(2)

    with col_l:
        st.subheader("Top Cultures")
        fill = fdf["Culture"].notna().mean()
        st.caption(f"Culture field filled for {fill:.0%} of objects")
        cult = fdf[fdf["Culture"].notna()]["Culture"].value_counts().head(25).reset_index()
        cult.columns = ["Culture", "Count"]
        if HAS_PLOTLY:
            fig = px.bar(cult, x="Count", y="Culture", orientation="h", color="Count",
                         color_continuous_scale="Teal")
            fig.update_layout(height=600, yaxis=dict(autorange="reversed"))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(cult.set_index("Culture")["Count"])

    with col_r:
        st.subheader("Top Countries of Origin")
        fill_c = fdf["Country"].notna().mean()
        st.caption(f"Country field filled for {fill_c:.0%} of objects")
        country = fdf[fdf["Country"].notna()]["Country"].value_counts().head(25).reset_index()
        country.columns = ["Country", "Count"]
        if HAS_PLOTLY:
            fig = px.bar(country, x="Count", y="Country", orientation="h", color="Count",
                         color_continuous_scale="Oranges")
            fig.update_layout(height=600, yaxis=dict(autorange="reversed"))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(country.set_index("Country")["Count"])

    st.subheader("Cultures Across Centuries")
    top10_cultures = list(fdf[fdf["Culture"].notna()]["Culture"].value_counts().head(10).index)
    cult_time = fdf[(fdf["Culture"].isin(top10_cultures)) & (fdf["Century"] != "Undated")].groupby(
        ["Century", "Century Sort", "Culture"], observed=True
    ).size().reset_index(name="Count")
    cult_time = cult_time.sort_values("Century Sort")
    if len(cult_time) > 0:
        if HAS_PLOTLY:
            fig = px.line(cult_time, x="Century", y="Count", color="Culture", markers=True)
            fig.update_layout(height=500, xaxis_tickangle=-45)
            st.plotly_chart(fig, use_container_width=True)
        else:
            pivot = cult_time.pivot_table(index="Century", columns="Culture", values="Count", fill_value=0)
            st.line_chart(pivot)


# ---------------------------------------------------------------------------
# 7. Art History
# ---------------------------------------------------------------------------
def page_art_history(fdf, agg):
    st.header("Art History")

    col_l, col_r = st.columns(2)

    with col_l:
        st.subheader("Periods")
        periods = fdf[fdf["Period"].notna()]["Period"].value_counts().head(25).reset_index()
        periods.columns = ["Period", "Count"]
        fill_p = fdf["Period"].notna().mean()
        st.caption(f"Period field filled for {fill_p:.0%} of objects")
        if HAS_PLOTLY:
            fig = px.bar(periods, x="Count", y="Period", orientation="h")
            fig.update_layout(height=600, yaxis=dict(autorange="reversed"))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(periods.set_index("Period")["Count"])

    with col_r:
        st.subheader("Dynasties")
        dyn = fdf[fdf["Dynasty"].notna()]["Dynasty"].value_counts().head(25).reset_index()
        dyn.columns = ["Dynasty", "Count"]
        fill_d = fdf["Dynasty"].notna().mean()
        st.caption(f"Dynasty field filled for {fill_d:.0%} of objects")
        if HAS_PLOTLY:
            fig = px.bar(dyn, x="Count", y="Dynasty", orientation="h")
            fig.update_layout(height=600, yaxis=dict(autorange="reversed"))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(dyn.set_index("Dynasty")["Count"])

    st.subheader("Classification Over Centuries")
    top10_class = list(fdf[fdf["Classification"].notna()]["Classification"].value_counts().head(10).index)
    class_time = fdf[(fdf["Classification"].isin(top10_class)) & (fdf["Century"] != "Undated")].groupby(
        ["Century", "Century Sort", "Classification"], observed=True
    ).size().reset_index(name="Count")
    class_time = class_time.sort_values("Century Sort")
    if len(class_time) > 0:
        if HAS_PLOTLY:
            fig = px.area(class_time, x="Century", y="Count", color="Classification")
            fig.update_layout(height=500, xaxis_tickangle=-45)
            st.plotly_chart(fig, use_container_width=True)
        else:
            pivot = class_time.pivot_table(index="Century", columns="Classification", values="Count", fill_value=0)
            st.line_chart(pivot)

    st.subheader("Era × Department")
    era_dept = fdf[fdf["Era"] != "Unknown"].groupby(
        ["Era", "Department"], observed=True
    ).size().reset_index(name="Count")
    era_order = [
        "Prehistoric", "Ancient (3000-1200 BCE)", "Iron Age (1200-500 BCE)",
        "Classical (500 BCE-500 CE)", "Medieval (500-1400)", "Renaissance (1400-1600)",
        "Early Modern (1600-1800)", "19th Century", "20th Century", "21st Century",
    ]
    era_dept["Era"] = pd.Categorical(era_dept["Era"], categories=era_order, ordered=True)
    era_dept = era_dept.sort_values("Era")
    if len(era_dept) > 0:
        if HAS_PLOTLY:
            fig = px.bar(era_dept, x="Era", y="Count", color="Department", barmode="stack")
            fig.update_layout(height=550, xaxis_tickangle=-30)
            st.plotly_chart(fig, use_container_width=True)
        else:
            pivot = era_dept.pivot_table(index="Era", columns="Department", values="Count", fill_value=0)
            st.bar_chart(pivot)


# ---------------------------------------------------------------------------
# 8. Object Explorer
# ---------------------------------------------------------------------------
def page_explorer(fdf, agg):
    st.header("Object Explorer")

    col1, col2, col3 = st.columns([3, 1, 1])
    with col1:
        search = st.text_input("Search title, artist, or object name", key="explorer_search")
    with col2:
        sort_by = st.selectbox("Sort by", ["Title", "Object Begin Date", "AccessionYear", "Department"])
    with col3:
        sort_asc = st.selectbox("Order", ["Ascending", "Descending"]) == "Ascending"

    results = fdf.copy()
    if search.strip():
        s = search.strip().lower()
        results = results[
            results["Title"].fillna("").str.lower().str.contains(s, regex=False)
            | results["Artist Display Name"].fillna("").str.lower().str.contains(s, regex=False)
            | results["Object Name"].fillna("").str.lower().str.contains(s, regex=False)
        ]

    results = results.sort_values(sort_by, ascending=sort_asc, na_position="last")
    total = len(results)
    st.caption(f"{total:,} results found (showing up to 100)")
    results = results.head(100)

    view = st.radio("View", ["Table", "Cards"], horizontal=True)

    if view == "Table":
        display_cols = [
            "Title", "Artist Display Name", "Department", "Object Date",
            "Medium Simple", "Classification", "Culture", "Met URL",
        ]
        display_df = results[[c for c in display_cols if c in results.columns]].copy()
        display_df = display_df.rename(columns={"Artist Display Name": "Artist", "Medium Simple": "Medium", "Met URL": "Link"})
        st.dataframe(
            display_df,
            column_config={
                "Link": st.column_config.LinkColumn("Met Link", display_text="View"),
            },
            use_container_width=True,
            height=600,
        )
    else:
        # Card view — 3 columns, up to 30 results
        card_results = results.head(30)
        cols = st.columns(3)
        for idx, (_, row) in enumerate(card_results.iterrows()):
            with cols[idx % 3]:
                title = row.get("Title", "Untitled") or "Untitled"
                artist = row.get("Artist Display Name", "") or "Unknown Artist"
                dept = row.get("Department", "")
                date = row.get("Object Date", "")
                medium = row.get("Medium Simple", "")
                url = row.get("Met URL", "")
                culture = row.get("Culture", "")

                with st.container(border=True):
                    st.markdown(f"**{title}**")
                    st.caption(f"{artist}")
                    info_parts = [str(p) for p in [dept, date, medium, culture] if pd.notna(p) and str(p).strip()]
                    if info_parts:
                        st.markdown(f"_{' · '.join(info_parts)}_")
                    if url and str(url).startswith("http"):
                        st.markdown(f"[View on Met Museum]({url})")


# ===========================================================================
# Main
# ===========================================================================
def main():
    df = load_data()
    page, filters = sidebar_filters(df)
    fdf = filter_dataframe(df, filters)
    agg = precompute_aggregations(fdf)

    st.sidebar.caption(f"Filtered: {len(fdf):,} / {len(df):,} objects")

    if page == "Overview":
        page_overview(fdf, agg)
    elif page == "Timeline":
        page_timeline(fdf, agg)
    elif page == "Departments":
        page_departments(fdf, agg)
    elif page == "Artists":
        page_artists(fdf, agg)
    elif page == "Mediums":
        page_mediums(fdf, agg)
    elif page == "Geography":
        page_geography(fdf, agg)
    elif page == "Art History":
        page_art_history(fdf, agg)
    elif page == "Object Explorer":
        page_explorer(fdf, agg)


if __name__ == "__main__":
    main()
