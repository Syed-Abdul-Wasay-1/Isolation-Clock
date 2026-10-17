#!/usr/bin/env python3
"""Generate synthetic data for the Isolation Clock flood-response prototype.

The study area is Hala, Sindh, Pakistan. Household data remains synthetic and intentionally
messy, while building and road data come from real OSM map information when available.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import geopandas as gpd
import osmnx as ox

# Hala, Sindh, Pakistan study area.
BOUNDING_BOX = {
    "min_lat": 25.805,
    "min_lon": 68.410,
    "max_lat": 25.825,
    "max_lon": 68.435,
}
SEED = 20261017

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_DIR = ROOT / "public" / "data"


def choose_weighted(rng: random.Random, options: List[tuple[Any, float]]) -> Any:
    total = sum(weight for _, weight in options)
    pick = rng.random() * total
    cumulative = 0.0
    for value, weight in options:
        cumulative += weight
        if pick <= cumulative:
            return value
    return options[-1][0]


def cache_path_for(name: str) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR / name


def fetch_cached_buildings() -> Tuple[Optional[gpd.GeoDataFrame], bool, int]:
    cache_file = cache_path_for("hala_buildings.geojson")
    if cache_file.exists():
        try:
            gdf = gpd.read_file(cache_file)
            return gdf, False, len(gdf)
        except Exception as exc:
            print(f"Warning: cached building file is unreadable ({exc}); re-fetching from OSM.")

    try:
        gdf = ox.features_from_bbox(
            bbox=(
                BOUNDING_BOX["min_lon"],
                BOUNDING_BOX["min_lat"],
                BOUNDING_BOX["max_lon"],
                BOUNDING_BOX["max_lat"],
            ),
            tags={"building": True},
        )
        if gdf.empty:
            print("Warning: no building footprints found in the Hala bounds; falling back to road-proximate points.")
            return None, True, 0
        gdf = gdf[gdf.geometry.notnull()].copy()
        gdf.to_file(cache_file, driver="GeoJSON")
        return gdf, False, len(gdf)
    except Exception as exc:
        print(f"Warning: OSM building download failed for Hala ({exc}); using road-proximate fallback points.")
        return None, True, 0


def fetch_cached_amenities() -> gpd.GeoDataFrame:
    cache_file = cache_path_for("hala_amenities.geojson")
    if cache_file.exists():
        try:
            return gpd.read_file(cache_file)
        except Exception as exc:
            print(f"Warning: cached amenity file is unreadable ({exc}); re-fetching from OSM.")

    try:
        amenity_tags = {"amenity": ["school", "hospital", "clinic", "community_centre", "place_of_worship"]}
        gdf = ox.features_from_bbox(
            bbox=(
                BOUNDING_BOX["min_lon"],
                BOUNDING_BOX["min_lat"],
                BOUNDING_BOX["max_lon"],
                BOUNDING_BOX["max_lat"],
            ),
            tags=amenity_tags,
        )
        if gdf.empty:
            return gpd.GeoDataFrame(columns=["amenity", "geometry"])
        gdf = gdf[gdf.geometry.notnull()].copy()
        gdf.to_file(cache_file, driver="GeoJSON")
        return gdf
    except Exception as exc:
        print(f"Warning: OSM amenity download failed for Hala ({exc}); using fixed fallback shelter and hospital points.")
        return gpd.GeoDataFrame(columns=["amenity", "geometry"])


def random_point_near_road(rng: random.Random, road_nodes: Sequence[Tuple[float, float]]) -> Tuple[float, float]:
    if not road_nodes:
        raise ValueError("No road nodes available for fallback placement.")
    lat, lon = rng.choice(road_nodes)
    angle = rng.random() * 2 * math.pi
    radius_m = rng.uniform(0, 150)
    offset_lat = (radius_m / 111_320.0) * math.cos(angle)
    offset_lon = (radius_m / (111_320.0 * math.cos(math.radians(lat)))) * math.sin(angle)
    return lat + offset_lat, lon + offset_lon


def generate_road_node_points(rng: random.Random, count: int) -> List[Tuple[float, float]]:
    try:
        graph = ox.graph_from_bbox(
            bbox=(
                BOUNDING_BOX["min_lon"],
                BOUNDING_BOX["min_lat"],
                BOUNDING_BOX["max_lon"],
                BOUNDING_BOX["max_lat"],
            ),
            network_type="drive",
        )
    except Exception as exc:
        raise RuntimeError(f"Road network lookup failed for fallback placement: {exc}") from exc

    if graph.number_of_nodes() == 0:
        raise RuntimeError("No road nodes were returned for the Hala fallback area.")

    nodes = [(data["y"], data["x"]) for _, data in graph.nodes(data=True)]
    if len(nodes) < count:
        return [random_point_near_road(rng, nodes) for _ in range(count)]

    points: List[Tuple[float, float]] = []
    selected = set()
    while len(points) < count:
        candidate = rng.choice(nodes)
        if candidate in selected:
            continue
        selected.add(candidate)
        points.append(random_point_near_road(rng, [candidate]))
    return points


def build_household_points(buildings_gdf: Optional[gpd.GeoDataFrame], rng: random.Random) -> Tuple[List[Tuple[float, float]], bool, int]:
    if buildings_gdf is not None and not buildings_gdf.empty:
        candidate_points: List[Tuple[float, float]] = []
        for geom in buildings_gdf.geometry:
            if geom is None:
                continue
            centroid = geom.centroid
            candidate_points.append((float(centroid.y), float(centroid.x)))

        if len(candidate_points) >= 400:
            cluster_defs = [
                (25.8131, 68.4175, 140),
                (25.8160, 68.4225, 102),
                (25.8184, 68.4274, 84),
                (25.8112, 68.4297, 66),
            ]
            selected: List[Tuple[float, float]] = []
            used = set()
            for center_lat, center_lon, target_count in cluster_defs:
                nearby = [
                    point for point in candidate_points
                    if abs(point[0] - center_lat) <= 0.006 and abs(point[1] - center_lon) <= 0.006
                ]
                if not nearby:
                    nearby = candidate_points
                nearby = list(dict.fromkeys(nearby))
                pool = [point for point in nearby if point not in used]
                if len(pool) < target_count:
                    remaining = [point for point in candidate_points if point not in used]
                    if remaining:
                        pool.extend(remaining[: target_count - len(pool)])
                chosen = rng.sample(pool, min(target_count, len(pool)))
                for point in chosen:
                    used.add(point)
                    selected.append(point)

            if len(selected) < 400:
                remaining = [point for point in candidate_points if point not in used]
                rng.shuffle(remaining)
                selected.extend(remaining[: 400 - len(selected)])

            selected = selected[:400]
            return selected, False, len(candidate_points)

    print("Warning: building availability was insufficient; using road-proximate fallback points within 150 m of roads.")
    points = generate_road_node_points(rng, 400)
    return points, True, 0


def generate_households(buildings_gdf: Optional[gpd.GeoDataFrame]) -> Tuple[List[Dict[str, Any]], bool, int]:
    rng = random.Random(SEED)
    points, fallback_used, buildings_found = build_household_points(buildings_gdf, rng)

    cluster_specs = [
        {"count": 140, "high_risk": True},
        {"count": 102, "high_risk": True},
        {"count": 84, "high_risk": False},
        {"count": 66, "high_risk": False},
    ]

    households: List[Dict[str, Any]] = []
    duplicate_specs = [
        {"lat": 25.8128, "lon": 68.4170, "household_size": 2, "age_band": "75+", "mobility": "wheelchair"},
        {"lat": 25.8129, "lon": 68.4171, "household_size": 2, "age_band": "75+", "mobility": "wheelchair"},
        {"lat": 25.8150, "lon": 68.4219, "household_size": 1, "age_band": "65-74", "mobility": "limited"},
        {"lat": 25.8151, "lon": 68.4220, "household_size": 1, "age_band": "65-74", "mobility": "limited"},
        {"lat": 25.8193, "lon": 68.4272, "household_size": 3, "age_band": "adult", "mobility": "none"},
        {"lat": 25.8194, "lon": 68.4273, "household_size": 3, "age_band": "adult", "mobility": "none"},
        {"lat": 25.8116, "lon": 68.4295, "household_size": 1, "age_band": "75+", "mobility": "wheelchair"},
        {"lat": 25.8117, "lon": 68.4296, "household_size": 1, "age_band": "75+", "mobility": "wheelchair"},
    ]

    point_iter = iter(points)
    for idx, duplicate in enumerate(duplicate_specs, start=1):
        lat, lon = next(point_iter)
        lat += rng.uniform(-0.00008, 0.00008)
        lon += rng.uniform(-0.00008, 0.00008)
        households.append(
            {
                "id": f"H{idx:03d}",
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "household_size": duplicate["household_size"],
                "age_band": duplicate["age_band"],
                "mobility": duplicate["mobility"],
                "medical_need": True,
                "lives_alone": duplicate["household_size"] == 1,
                "has_phone": False,
                "floor_level": choose_weighted(rng, [("ground", 0.75), ("upper", 0.25)]),
                "last_contact_hours": round(rng.uniform(1.0, 18.0), 1),
                "data_completeness": 0.88,
            }
        )

    household_id = len(households) + 1
    for cluster in cluster_specs:
        for _ in range(cluster["count"]):
            lat, lon = next(point_iter)
            if cluster["high_risk"]:
                age_band = choose_weighted(
                    rng,
                    [("child", 0.10), ("adult", 0.28), ("65-74", 0.30), ("75+", 0.32)],
                )
                mobility = choose_weighted(
                    rng,
                    [("none", 0.45), ("limited", 0.32), ("wheelchair", 0.23)],
                )
                has_phone = rng.random() < 0.62
                lives_alone = rng.random() < (0.27 if age_band in {"65-74", "75+"} else 0.18)
                medical_need = rng.random() < (0.32 if age_band in {"65-74", "75+"} else 0.16)
                household_size = choose_weighted(
                    rng,
                    [(1, 0.26), (2, 0.30), (3, 0.22), (4, 0.15), (5, 0.05), (6, 0.02)],
                )
            else:
                age_band = choose_weighted(
                    rng,
                    [("child", 0.18), ("adult", 0.62), ("65-74", 0.12), ("75+", 0.08)],
                )
                mobility = choose_weighted(
                    rng,
                    [("none", 0.72), ("limited", 0.18), ("wheelchair", 0.10)],
                )
                has_phone = rng.random() < 0.82
                lives_alone = rng.random() < (0.12 if age_band in {"65-74", "75+"} else 0.08)
                medical_need = rng.random() < (0.14 if age_band in {"65-74", "75+"} else 0.08)
                household_size = choose_weighted(
                    rng,
                    [(1, 0.12), (2, 0.28), (3, 0.27), (4, 0.22), (5, 0.08), (6, 0.03)],
                )

            last_contact_hours = round(rng.uniform(0.5, 72.0), 1)
            data_completeness = round(rng.uniform(0.58, 0.99), 2)
            floor_level = choose_weighted(rng, [("ground", 0.72), ("upper", 0.28)])
            field_values = {
                "age_band": age_band,
                "mobility": mobility,
                "medical_need": medical_need,
                "lives_alone": lives_alone,
                "has_phone": has_phone,
                "floor_level": floor_level,
                "last_contact_hours": last_contact_hours,
            }

            if rng.random() < 0.15:
                for field_name in [
                    "last_contact_hours",
                    "mobility",
                    "medical_need",
                    "lives_alone",
                    "has_phone",
                    "floor_level",
                    "age_band",
                ]:
                    if rng.random() < 0.5:
                        field_values[field_name] = None

            record = {
                "id": f"H{household_id:03d}",
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "household_size": household_size,
                "age_band": field_values["age_band"],
                "mobility": field_values["mobility"],
                "medical_need": field_values["medical_need"],
                "lives_alone": field_values["lives_alone"],
                "has_phone": field_values["has_phone"],
                "floor_level": field_values["floor_level"],
                "last_contact_hours": field_values["last_contact_hours"],
                "data_completeness": data_completeness,
            }
            households.append(record)
            household_id += 1

    if len(households) != 400:
        raise ValueError(f"Expected 400 households, found {len(households)}")

    return households, fallback_used, buildings_found


def generate_shelters() -> List[Dict[str, Any]]:
    amenity_gdf = fetch_cached_amenities()
    shelter_candidates = amenity_gdf[amenity_gdf["amenity"].isin(["school", "community_centre", "place_of_worship"])].copy()
    shelter_candidates = shelter_candidates[shelter_candidates.geometry.notnull()].copy()

    shelters: List[Dict[str, Any]] = []
    if not shelter_candidates.empty:
        for i, row in enumerate(shelter_candidates.geometry.centroid.head(5), start=1):
            name = row.name if hasattr(row, "name") else None
            shelters.append(
                {
                    "id": f"S{i}",
                    "name": name or f"Shelter {i}",
                    "lat": round(float(row.y), 6),
                    "lon": round(float(row.x), 6),
                    "capacity": 80 + (i * 25),
                }
            )

    if len(shelters) < 5:
        print("Warning: no suitable OSM shelter amenities found in the Hala box; using fixed fallback shelter points.")
        fallback = [
            {"id": "S1", "name": "Hala Community Shelter", "lat": 25.8132, "lon": 68.4189, "capacity": 90},
            {"id": "S2", "name": "Hala Market Shelter", "lat": 25.8172, "lon": 68.4246, "capacity": 120},
            {"id": "S3", "name": "Hala School Shelter", "lat": 25.8195, "lon": 68.4290, "capacity": 110},
            {"id": "S4", "name": "Hala Civic Shelter", "lat": 25.8114, "lon": 68.4278, "capacity": 100},
            {"id": "S5", "name": "Hala East Shelter", "lat": 25.8154, "lon": 68.4318, "capacity": 130},
        ]
        for item in fallback:
            if len(shelters) >= 5:
                break
            shelters.append(item)

    return shelters[:5]


def generate_hospitals() -> List[Dict[str, Any]]:
    amenity_gdf = fetch_cached_amenities()
    hospital_candidates = amenity_gdf[amenity_gdf["amenity"].isin(["hospital", "clinic"])].copy()
    hospital_candidates = hospital_candidates[hospital_candidates.geometry.notnull()].copy()

    hospitals: List[Dict[str, Any]] = []
    if not hospital_candidates.empty:
        for i, row in enumerate(hospital_candidates.geometry.centroid.head(2), start=1):
            name = row.name if hasattr(row, "name") else None
            hospitals.append(
                {
                    "id": f"HOSP{i}",
                    "name": name or f"Hospital {i}",
                    "lat": round(float(row.y), 6),
                    "lon": round(float(row.x), 6),
                    "capacity": 180 + (i * 40),
                }
            )

    if len(hospitals) < 2:
        print("Warning: no suitable OSM hospital or clinic amenities found in the Hala box; using fixed fallback hospital points.")
        fallback = [
            {"id": "HOSP1", "name": "Hala District Hospital", "lat": 25.8158, "lon": 68.4198, "capacity": 220},
            {"id": "HOSP2", "name": "Hala Medical Centre", "lat": 25.8183, "lon": 68.4320, "capacity": 180},
        ]
        for item in fallback:
            if len(hospitals) >= 2:
                break
            hospitals.append(item)

    return hospitals[:2]


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def build_dataset() -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], bool, int]:
    buildings_gdf, fallback_used, buildings_found = fetch_cached_buildings()
    households, fallback_used_households, buildings_found_used = generate_households(buildings_gdf)
    shelters = generate_shelters()
    hospitals = generate_hospitals()

    return (
        {
            "synthetic": True,
            "seed": SEED,
            "bounding_box": BOUNDING_BOX,
            "households": households,
        },
        {
            "synthetic": True,
            "seed": SEED,
            "bounding_box": BOUNDING_BOX,
            "shelters": shelters,
        },
        {
            "synthetic": True,
            "seed": SEED,
            "bounding_box": BOUNDING_BOX,
            "hospitals": hospitals,
        },
        fallback_used or fallback_used_households,
        max(buildings_found, buildings_found_used),
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    households_payload, shelters_payload, hospitals_payload, fallback_used, buildings_found = build_dataset()
    write_json(OUTPUT_DIR / "households.json", households_payload)
    write_json(OUTPUT_DIR / "shelters.json", shelters_payload)
    write_json(OUTPUT_DIR / "hospitals.json", hospitals_payload)

    meta = {
        "synthetic": True,
        "study_area": "Hala, Sindh, Pakistan",
        "seed": SEED,
        "bounding_box": BOUNDING_BOX,
        "buildings_found": buildings_found,
        "fallback_used": fallback_used,
        "generated_files": [
            "households.json",
            "shelters.json",
            "hospitals.json",
            "meta.json",
        ],
        "notes": [
            "Household data is synthetic and intentionally noisy to simulate incomplete field data.",
            "Only the building and road map layers are derived from real OpenStreetMap data in the Hala study area.",
            "If building data is unavailable or sparse, household placement falls back to road-proximate points.",
        ],
    }
    write_json(OUTPUT_DIR / "meta.json", meta)

    print(f"Generated datasets for Hala, Sindh, Pakistan")
    print(f"Buildings found: {buildings_found}")
    print(f"Fallback used: {fallback_used}")
    print(f"Households: {len(households_payload['households'])}")
    print(f"Shelters: {len(shelters_payload['shelters'])}")
    print(f"Hospitals: {len(hospitals_payload['hospitals'])}")


if __name__ == "__main__":
    main()
