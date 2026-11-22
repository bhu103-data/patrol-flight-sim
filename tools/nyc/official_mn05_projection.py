"""NYC DCP Rhino MN05 2014 XY -> PATROL true-scale Times Square metre frame.

Original model coordinates: NAD83 EPSG:2263, US survey feet, NOT WGS84
degrees and NOT 1:1 metres. Y/height intentionally not assumed to share
a source or vertical datum with 2022 OTI roadbed y=0.
"""
from __future__ import annotations
import math
from pyproj import Transformer

ORIGIN_WGS84 = (-73.9864883, 40.756421)
SOURCE_EPSG = 2263
LONGITUDE_REF, LATITUDE_REF = ORIGIN_WGS84
LATITUDE_RAD = math.radians(LATITUDE_REF)
METRES_PER_DEG_LONGITUDE = (
    111412.84 * math.cos(LATITUDE_RAD)
    - 93.5 * math.cos(3 * LATITUDE_RAD)
    + .118 * math.cos(5 * LATITUDE_RAD)
)
METRES_PER_DEG_LATITUDE = (
    111132.92 - 559.82 * math.cos(2 * LATITUDE_RAD)
    + 1.175 * math.cos(4 * LATITUDE_RAD)
)
US_SURVEY_FOOT_IN_METRES = 1200.0 / 3937.0
_SOURCE_TO_WGS84 = Transformer.from_crs(
    "EPSG:2263", "EPSG:4326", always_xy=True)
_WGS84_TO_SOURCE = Transformer.from_crs(
    "EPSG:4326", "EPSG:2263", always_xy=True)


def wgs84_to_local_metres(longitude: float, latitude: float) -> tuple[float, float]:
    """Convert 2022 official WGS84 footprint coordinates to the shared local frame."""
    if not math.isfinite(longitude) or not math.isfinite(latitude):
        raise ValueError("Non-finite WGS84 building footprint coordinate")
    if not (-75 < longitude < -72 and 39 < latitude < 42):
        raise ValueError("Official WGS84 footprint point outside NYC")
    return ((longitude - LONGITUDE_REF) * METRES_PER_DEG_LONGITUDE,
            (latitude - LATITUDE_REF) * METRES_PER_DEG_LATITUDE)


def mn05_stateplane_to_metric(source_x_ft: float, source_y_ft: float) -> tuple[float, float]:
    """Convert projected source-foot XY to local east/north metres.

    This deliberately matches the parent source-pilot local tangent
    projection, which is valid over its ~700 m Times Square sample and
    is NOT an exact citywide geocentric ENU projection.
    """
    if not math.isfinite(source_x_ft) or not math.isfinite(source_y_ft):
        raise ValueError("Non-finite official Rhino source coordinates")
    lon, lat = _SOURCE_TO_WGS84.transform(source_x_ft, source_y_ft)
    if not (-75 < lon < -72 and 39 < lat < 42):
        raise ValueError("Official Rhino EPSG:2263 source point outside NYC")
    return ((lon - LONGITUDE_REF) * METRES_PER_DEG_LONGITUDE,
            (lat - LATITUDE_REF) * METRES_PER_DEG_LATITUDE)


def metric_to_mn05_stateplane(east_m: float, north_m: float) -> tuple[float, float]:
    if not math.isfinite(east_m) or not math.isfinite(north_m):
        raise ValueError("Non-finite local coordinates")
    lon = LONGITUDE_REF + east_m / METRES_PER_DEG_LONGITUDE
    lat = LATITUDE_REF + north_m / METRES_PER_DEG_LATITUDE
    return _WGS84_TO_SOURCE.transform(lon, lat)


def relative_roof_metres(roof_z_source_ft: float,
                         building_base_z_source_ft: float,
                         *,
                         source_vertical_unit_verified: bool = False) -> float:
    """Use source roof *relief* only, not unknown absolute source altitude.

    The NYC metadata gives EPSG:2263 for its horizontal CRS, but the Rhino
    Z vertical datum/unit still needs confirmation against actual model
    metadata/source records. Never silently assign the city model's
    absolute Z to PATROL's synthetic flat ground.
    """
    if not source_vertical_unit_verified:
        raise ValueError("Rhino source vertical unit/datum not yet verified")
    if not math.isfinite(roof_z_source_ft) or not math.isfinite(building_base_z_source_ft):
        raise ValueError("Non-finite municipal Rhino Z elevations")
    delta = roof_z_source_ft - building_base_z_source_ft
    if not 0 < delta < 2000:
        raise ValueError("Implausible or inverted source roof relief")
    return delta * US_SURVEY_FOOT_IN_METRES
