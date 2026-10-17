#!/usr/bin/env python3
"""Build the Part A road exposure network for the Sukkur study area."""

from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import geopandas as gpd
import osmnx as ox
from shapely.geometry import LineString, box, mapping
from shapely.ops import unary_union

from generate_data import BOUNDING_BOX


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PUBLIC_DATA_DIR = ROOT / "public" / "data"
CRS_METRIC = "EPSG:32642"
ELEVATION_URL = "https://api.opentopodata.org/v1/srtm30m"
OSM_MAP_URL = "https://api.openstreetmap.org/api/0.6/map"
BATCH_SIZE = 100
BATCH_DELAY_SECONDS = 1
ox.settings.requests_timeout = 45


def bbox_key() -> str:
    return (
        f"{BOUNDING_BOX['min_lat']}_{BOUNDING_BOX['max_lat']}"
        f"_{BOUNDING_BOX['min_lon']}_{BOUNDING_BOX['max_lon']}"
    ).replace(".", "_")


def read_public_data() -> None:
    for filename, collection in (
        ("households.json", "households"),
        ("shelters.json", "shelters"),
        ("hospitals.json", "hospitals"),
    ):
        path = PUBLIC_DATA_DIR / filename
        with path.open(encoding="utf-8") as input_file:
            payload = json.load(input_file)
        if not isinstance(payload.get(collection), list):
            raise ValueError(f"{path} must contain a '{collection}' list.")
        print(f"Read {len(payload[collection])} {collection} from {path.name}")


def study_bbox() -> tuple[float, float, float, float]:
    return (
        BOUNDING_BOX["min_lon"],
        BOUNDING_BOX["min_lat"],
        BOUNDING_BOX["max_lon"],
        BOUNDING_BOX["max_lat"],
    )


def load_road_graph(cache_path: Path) -> Any:
    if cache_path.exists():
        graph = ox.load_graphml(filepath=cache_path)
    else:
        graph = ox.graph_from_bbox(bbox=study_bbox(), network_type="drive")
        graph = ox.truncate.largest_component(graph, strongly=False)
        ox.save_graphml(graph, filepath=cache_path)
    if graph.number_of_nodes() == 0 or graph.number_of_edges() == 0:
        raise RuntimeError("The cached or downloaded road network is empty.")
    return graph


def download_water_features(cache_path: Path) -> gpd.GeoDataFrame:
    if cache_path.exists():
        water = gpd.read_file(cache_path)
    else:
        tags = {
            "natural": "water",
            "waterway": ["river", "canal", "stream", "drain"],
        }
        try:
            water = ox.features_from_bbox(bbox=study_bbox(), tags=tags)
        except Exception as exc:
            print(f"OSMnx water-feature query failed ({exc}); trying the OSM map API.")
            osm_cache_path = DATA_DIR / f"osm_map_{bbox_key()}.osm"
            if not osm_cache_path.exists():
                query = urlencode({"bbox": ",".join(map(str, study_bbox()))})
                request = Request(
                    f"{OSM_MAP_URL}?{query}",
                    headers={"User-Agent": "Isolation-Clock Sukkur study data builder/1.0"},
                )
                try:
                    with urlopen(request, timeout=60) as response:
                        osm_cache_path.write_bytes(response.read())
                except Exception as fallback_exc:
                    raise RuntimeError(
                        f"Could not download water features from OSMnx or the OSM map API: "
                        f"{fallback_exc}"
                    ) from fallback_exc
            water = ox.features_from_xml(
                filepath=osm_cache_path,
                polygon=box(
                    BOUNDING_BOX["min_lon"],
                    BOUNDING_BOX["min_lat"],
                    BOUNDING_BOX["max_lon"],
                    BOUNDING_BOX["max_lat"],
                ),
                tags=tags,
            )
        water = water[water.geometry.notnull() & ~water.geometry.is_empty].copy()
        if water.empty:
            raise RuntimeError("No water features were returned for the Sukkur study area.")
        water.to_file(cache_path, driver="GeoJSON")
    if water.empty:
        raise RuntimeError("The cached water-feature file is empty.")
    return water


def fetch_elevation_batch(locations: list[tuple[float, float]]) -> list[float]:
    location_string = "|".join(f"{lat:.7f},{lon:.7f}" for lat, lon in locations)
    query = urlencode({"locations": location_string})
    request = Request(
        f"{ELEVATION_URL}?{query}",
        headers={"User-Agent": "Isolation-Clock Sukkur study data builder/1.0"},
    )
    with urlopen(request, timeout=45) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("status") != "OK":
        raise RuntimeError(f"OpenTopoData returned status {payload.get('status')!r}.")
    results = payload.get("results")
    if not isinstance(results, list) or len(results) != len(locations):
        raise RuntimeError("OpenTopoData returned an incomplete elevation batch.")
    elevations = [result.get("elevation") for result in results]
    if any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in elevations):
        raise RuntimeError("OpenTopoData returned a missing or invalid elevation.")
    return [float(value) for value in elevations]


def synthetic_elevation(lat: float, lon: float) -> float:
    # Broad wavelength components provide a smooth fallback surface over the study area.
    return (
        10.0
        + 2.0 * math.sin((lat - BOUNDING_BOX["min_lat"]) * 45.0)
        + 1.5 * math.cos((lon - BOUNDING_BOX["min_lon"]) * 32.0)
        + 0.6 * math.sin(
            (lat + lon - BOUNDING_BOX["min_lat"] - BOUNDING_BOX["min_lon"]) * 24.0
        )
    )


def load_elevations(
    graph: Any, cache_path: Path
) -> tuple[dict[Any, float], str]:
    nodes = list(graph.nodes(data=True))
    node_ids = [node_id for node_id, _ in nodes]
    if cache_path.exists():
        with cache_path.open(encoding="utf-8") as cache_file:
            cached = json.load(cache_file)
        cached_values = cached.get("elevations", {})
        cached_source = cached.get("elevation_source")
        if cached_source == "opentopodata" and all(
            str(node_id) in cached_values for node_id in node_ids
        ):
            return (
                {node_id: float(cached_values[str(node_id)]) for node_id in node_ids},
                cached_source,
            )

    elevations: dict[Any, float] = {}
    source = "opentopodata"
    try:
        locations = [(float(data["y"]), float(data["x"])) for _, data in nodes]
        for start in range(0, len(nodes), BATCH_SIZE):
            batch = locations[start : start + BATCH_SIZE]
            values = fetch_elevation_batch(batch)
            elevations.update(
                (node_ids[start + offset], value) for offset, value in enumerate(values)
            )
            if start + BATCH_SIZE < len(nodes):
                time.sleep(BATCH_DELAY_SECONDS)
    except Exception as exc:
        print(f"OpenTopoData elevation lookup failed ({exc}); using synthetic elevation.")
        source = "synthetic"
        elevations = {
            node_id: synthetic_elevation(float(data["y"]), float(data["x"]))
            for node_id, data in nodes
        }

    with cache_path.open("w", encoding="utf-8") as cache_file:
        json.dump(
            {
                "elevation_source": source,
                "elevations": {str(node_id): value for node_id, value in elevations.items()},
            },
            cache_file,
        )
    return elevations, source


def normalise(values: dict[Any, float]) -> dict[Any, float]:
    minimum = min(values.values())
    maximum = max(values.values())
    if math.isclose(minimum, maximum):
        return {key: 0.0 for key in values}
    return {key: (value - minimum) / (maximum - minimum) for key, value in values.items()}


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    read_public_data()

    key = bbox_key()
    graph = load_road_graph(DATA_DIR / f"roads_{key}.graphml")
    nodes = list(graph.nodes(data=True))
    elevations, elevation_source = load_elevations(graph, DATA_DIR / f"elevations_{key}.json")

    water = download_water_features(DATA_DIR / f"water_{key}.geojson")
    projected_water = water.to_crs(CRS_METRIC)
    water_geometry = unary_union(projected_water.geometry.tolist())
    projected_nodes = gpd.GeoSeries(
        gpd.points_from_xy(
            [float(data["x"]) for _, data in nodes],
            [float(data["y"]) for _, data in nodes],
        ),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)
    water_distances = {
        node_id: float(water_geometry.distance(point))
        for (node_id, _), point in zip(nodes, projected_nodes)
    }

    elevation_normalised = normalise(elevations)
    water_normalised = normalise(water_distances)
    exposure = {
        node_id: 0.6 * elevation_normalised[node_id] + 0.4 * water_normalised[node_id]
        for node_id, _ in nodes
    }

    edge_features = []
    for u, v, key_value, attributes in graph.edges(keys=True, data=True):
        geometry = attributes.get("geometry")
        if geometry is None:
            geometry = LineString(
                [
                    (float(graph.nodes[u]["x"]), float(graph.nodes[u]["y"])),
                    (float(graph.nodes[v]["x"]), float(graph.nodes[v]["y"])),
                ]
            )
        edge_features.append(
            {
                "type": "Feature",
                "geometry": mapping(geometry),
                "properties": {
                    "edge_id": f"{u}-{v}-{key_value}",
                    "threshold": 100.0 * min(exposure[u], exposure[v]),
                },
            }
        )

    output_path = PUBLIC_DATA_DIR / "roads.json"
    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(
            {
                "type": "FeatureCollection",
                "features": edge_features,
                "elevation_source": elevation_source,
            },
            output_file,
            separators=(",", ":"),
        )

    thresholds = [feature["properties"]["threshold"] for feature in edge_features]
    print(f"Nodes: {len(nodes)}")
    print(f"Edges: {len(edge_features)}")
    print(f"Elevation source: {elevation_source}")
    print(f"Minimum threshold: {min(thresholds):.6f}")
    print(f"Maximum threshold: {max(thresholds):.6f}")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
