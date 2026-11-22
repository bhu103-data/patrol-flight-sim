"""NYC DCP BK02 2014 3DM EPSG:2263 -> DUMBO local metre frame.

Source XY is NAD83 / New York Long Island (EPSG:2263), US survey feet.
The source Z datum is deliberately NOT asserted by this module.
"""
from __future__ import annotations
import math
from pyproj import Transformer

DUMBO_ORIGIN=(-73.989,40.702)
PHI=math.radians(DUMBO_ORIGIN[1])
M_PER_DEG_LAT=111132.92-559.82*math.cos(2*PHI)+1.175*math.cos(4*PHI)-.0023*math.cos(6*PHI)
M_PER_DEG_LON=111412.84*math.cos(PHI)-93.5*math.cos(3*PHI)+.118*math.cos(5*PHI)
US_SURVEY_FOOT_IN_METRES=1200.0/3937.0
_TO_WGS84=Transformer.from_crs("EPSG:2263","EPSG:4326",always_xy=True)
_FROM_WGS84=Transformer.from_crs("EPSG:4326","EPSG:2263",always_xy=True)

def stateplane_to_dumbo_metres(x_ft:float,y_ft:float)->tuple[float,float]:
    if not math.isfinite(x_ft) or not math.isfinite(y_ft):
        raise ValueError("Non-finite EPSG:2263 source coordinate")
    lon,lat=_TO_WGS84.transform(x_ft,y_ft)
    if not(-75<lon<-72 and 39<lat<42):
        raise ValueError("EPSG:2263 coordinate is outside NYC bounds")
    return ((lon-DUMBO_ORIGIN[0])*M_PER_DEG_LON,
            -(lat-DUMBO_ORIGIN[1])*M_PER_DEG_LAT)

def dumbo_metres_to_stateplane(east_m:float,south_m:float)->tuple[float,float]:
    if not math.isfinite(east_m) or not math.isfinite(south_m):
        raise ValueError("Non-finite local DUMBO metre coordinate")
    lon=DUMBO_ORIGIN[0]+east_m/M_PER_DEG_LON
    lat=DUMBO_ORIGIN[1]-south_m/M_PER_DEG_LAT
    return _FROM_WGS84.transform(lon,lat)

def source_bounds_from_oti(path):
    import json
    source=json.loads(path.read_text())
    if source.get("schema")!="patrol-nyc-dumbo-oti-metric-preview-v1":
        raise ValueError("Unexpected 48-building OTI source schema")
    points=[]
    for feature in source.get("features",[]):
        for lon,lat in feature["ring"]:
            points.append(((lon-DUMBO_ORIGIN[0])*M_PER_DEG_LON,
                           -(lat-DUMBO_ORIGIN[1])*M_PER_DEG_LAT))
    if not points:raise ValueError("No source DUMBO OTI building vertices")
    xs=[p[0] for p in points];zs=[p[1] for p in points]
    return (min(xs),min(zs),max(xs),max(zs))
