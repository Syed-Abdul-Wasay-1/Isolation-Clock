#!/usr/bin/env python3
"""Build the Sukkur road exposure network and household isolation scenarios."""

from __future__ import annotations

import heapq
import itertools
import json
import math
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import geopandas as gpd
import networkx as nx
import osmnx as ox
from pyproj import Transformer
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
RISE_RATE_DEFAULT = 10.0
ox.settings.requests_timeout = 45


def bbox_key() -> str:
    return (
        f"{BOUNDING_BOX['min_lat']}_{BOUNDING_BOX['max_lat']}"
        f"_{BOUNDING_BOX['min_lon']}_{BOUNDING_BOX['max_lon']}"
    ).replace(".", "_")


def read_public_data() -> dict[str, list[dict[str, Any]]]:
    data: dict[str, list[dict[str, Any]]] = {}
    for filename, collection in (
        ("households.json", "households"),
        ("shelters.json", "shelters"),
        ("hospitals.json", "hospitals"),
    ):
        path = PUBLIC_DATA_DIR / filename
        with path.open(encoding="utf-8") as input_file:
            payload = json.load(input_file)
        records = payload.get(collection)
        if not isinstance(records, list):
            raise ValueError(f"{path} must contain a '{collection}' list.")
        data[collection] = records
        print(f"Read {len(records)} {collection} from {path.name}")
    return data


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


def snap_to_road_nodes(graph: Any, places: list[dict[str, Any]]) -> dict[str, Any]:
    if not places:
        return {}
    transformer = Transformer.from_crs("EPSG:4326", CRS_METRIC, always_xy=True)
    place_coordinates: list[tuple[float, float]] = []
    for place in places:
        try:
            lat, lon = float(place["lat"]), float(place["lon"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"Place has invalid coordinates: {place!r}") from exc
        if not math.isfinite(lat) or not math.isfinite(lon):
            raise ValueError(f"Place has non-finite coordinates: {place!r}")
        place_coordinates.append(transformer.transform(lon, lat))
    projected_nodes = {
        node_id: transformer.transform(float(attributes["x"]), float(attributes["y"]))
        for node_id, attributes in graph.nodes(data=True)
    }
    snapped: dict[str, Any] = {}
    for place, place_coordinate in zip(places, place_coordinates):
        snapped[str(place["id"])] = min(
            projected_nodes,
            key=lambda node_id: math.hypot(
                projected_nodes[node_id][0] - place_coordinate[0],
                projected_nodes[node_id][1] - place_coordinate[1],
            ),
        )
    return snapped


def bottleneck_road_fields(edge_data: dict[str, Any]) -> tuple[str, str]:
    """Return ``(edge_id, display_name)`` for the bottleneck edge.

    ``edge_id`` is the locatable key the frontend matches against ``roads.json``. The street name is
    kept as a **separate** field for display, because a name cannot be located in the shipped road
    data (several edges can share one street name, and some edges have none).
    """
    name = edge_data.get("name")
    if isinstance(name, list):
        name = next((item for item in name if item), None)
    edge_id = str(edge_data["edge_id"])
    return edge_id, str(name) if name else edge_id


def widest_path_results(
    graph: Any,
    households: list[dict[str, Any]],
    safe_places: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    if not nx.is_directed(graph):
        raise TypeError("Widest-path routing requires the directed drive graph.")
    household_nodes = snap_to_road_nodes(graph, households)
    safe_nodes = snap_to_road_nodes(graph, safe_places)

    best_level = {node: -1.0 for node in graph.nodes}
    best_distance = {node: math.inf for node in graph.nodes}
    best_safe_id: dict[Any, str | None] = {node: None for node in graph.nodes}
    best_bottleneck: dict[Any, tuple[str, str] | None] = {node: None for node in graph.nodes}
    sequence = itertools.count()
    queue: list[tuple[float, float, str, int, Any]] = []

    for place in sorted(safe_places, key=lambda item: str(item["id"])):
        safe_id = str(place["id"])
        node = safe_nodes[safe_id]
        if (
            best_level[node] < 100.0
            or (best_level[node] == 100.0 and safe_id < str(best_safe_id[node]))
        ):
            best_level[node] = 100.0
            best_distance[node] = 0.0
            best_safe_id[node] = safe_id
            heapq.heappush(queue, (-100.0, 0.0, safe_id, next(sequence), node))

    reverse_graph = graph.reverse(copy=False)
    while queue:
        negative_level, distance, safe_id, _, node = heapq.heappop(queue)
        level = -negative_level
        if (
            level != best_level[node]
            or distance != best_distance[node]
            or safe_id != best_safe_id[node]
        ):
            continue
        for _, neighbor, edge_key, edge_data in reverse_graph.out_edges(
            node, keys=True, data=True
        ):
            candidate_level = min(level, float(edge_data["threshold"]))
            candidate_distance = distance + float(edge_data.get("length", 0.0))
            current_safe_id = best_safe_id[neighbor]
            is_better = candidate_level > best_level[neighbor] or (
                candidate_level == best_level[neighbor]
                and (
                    candidate_distance < best_distance[neighbor]
                    or (
                        candidate_distance == best_distance[neighbor]
                        and (current_safe_id is None or safe_id < current_safe_id)
                    )
                )
            )
            if not is_better:
                continue

            edge_id = str(edge_data.get("edge_id", f"{neighbor}-{node}-{edge_key}"))
            if float(edge_data["threshold"]) <= level:
                bottleneck = bottleneck_road_fields({**edge_data, "edge_id": edge_id})
            else:
                bottleneck = best_bottleneck[node]
            best_level[neighbor] = candidate_level
            best_distance[neighbor] = candidate_distance
            best_safe_id[neighbor] = safe_id
            best_bottleneck[neighbor] = bottleneck
            heapq.heappush(
                queue,
                (
                    -candidate_level,
                    candidate_distance,
                    safe_id,
                    next(sequence),
                    neighbor,
                ),
            )

    results: list[dict[str, Any]] = []
    no_route_count = 0
    for household in households:
        household_id = str(household["id"])
        node = household_nodes[household_id]
        isolation_level = best_level[node]
        if isolation_level < 0.0:
            isolation_value: float | None = None
            nearest_safe_id = None
            bottleneck = None
            no_route_count += 1
        else:
            isolation_value = isolation_level
            nearest_safe_id = best_safe_id[node]
            bottleneck = best_bottleneck[node]
        results.append(
            {
                "id": household_id,
                "road_node_id": str(node),
                "isolation_level": isolation_value,
                "nearest_safe_place_id": nearest_safe_id,
                "bottleneck_road": bottleneck[0] if bottleneck else None,
                "bottleneck_road_name": bottleneck[1] if bottleneck else None,
            }
        )
    return results, no_route_count


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    public_data = read_public_data()
    households = public_data["households"]
    safe_places = public_data["shelters"] + public_data["hospitals"]

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
    raw_exposure = {
        node_id: 0.6 * elevation_normalised[node_id] + 0.4 * water_normalised[node_id]
        for node_id, _ in nodes
    }
    exposure_order = sorted(raw_exposure, key=lambda node_id: (raw_exposure[node_id], str(node_id)))
    exposure = {
        node_id: rank / (len(exposure_order) - 1)
        for rank, node_id in enumerate(exposure_order)
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
        edge_id = f"{u}-{v}-{key_value}"
        threshold = 100.0 * min(exposure[u], exposure[v])
        attributes["edge_id"] = edge_id
        attributes["threshold"] = threshold
        edge_features.append(
            {
                "type": "Feature",
                "geometry": mapping(geometry),
                "properties": {
                    "edge_id": edge_id,
                    "threshold": threshold,
                },
            }
        )

    isolation_households, no_route_count = widest_path_results(
        graph, households, safe_places
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

    isolation_path = PUBLIC_DATA_DIR / "isolation.json"
    with isolation_path.open("w", encoding="utf-8") as output_file:
        json.dump(
            {
                "config": {"rise_rate_default": RISE_RATE_DEFAULT},
                "households": isolation_households,
            },
            output_file,
            separators=(",", ":"),
        )

    for level in range(10, 101, 10):
        isolated = sum(
            household["isolation_level"] is None
            or household["isolation_level"] <= level
            for household in isolation_households
        )
        print(f"Households isolated at level {level}: {isolated}")
    if no_route_count:
        print(
            f"Warning: {no_route_count} households have no directed route to any "
            "snapped shelter or hospital."
        )
    print(f"Wrote {isolation_path}")


if __name__ == "__main__":
    main()
