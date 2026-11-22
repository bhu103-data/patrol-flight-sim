"""Exact official NYC DCP Rhino surface-layer name mapping.

Only the source's Surface_* / * Surface geometry layers are rendered.
The parallel Building_* inventory layers are deliberately not selected.
"""
def classify_surface_layer(name):
    if not isinstance(name,str):
        return None
    leaf=name.rsplit("::",1)[-1].strip().casefold()
    if leaf in {"rooftop surface","surface_rooftop","surface_roof top"}:
        return "roof"
    if leaf in {"facade surface","surface_facade"}:
        return "facade"
    if leaf in {"footprint surface","footprint surface","surface_footprint",
                "surface_foot print"}:
        return "footprint"
    return None
