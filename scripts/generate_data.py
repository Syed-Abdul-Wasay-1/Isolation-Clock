#!/usr/bin/env python3
"""Generate synthetic data for the Isolation Clock flood-response prototype.

This script intentionally creates noisy, realistic-but-fabricated household data for
simulation and demo purposes only. No real personal information is used.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Dict, List

# Placeholder study area: roughly 2.5 km² in a compact urban block.
# Replace this with the real site bounds when the project is configured.
BOUNDING_BOX = {
    "min_lat": 52.4700,
    "min_lon": -1.9200,
    "max_lat": 52.4860,
    "max_lon": -1.9050,
}
SEED = 20261017

ROOT = Path(__file__).resolve().parents[1]
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


def generate_households() -> List[Dict[str, Any]]:
    rng = random.Random(SEED)

    cluster_specs = [
        {
            "center_lat": 52.4736,
            "center_lon": -1.9168,
            "count": 140,
            "high_risk": True,
        },
        {
            "center_lat": 52.4789,
            "center_lon": -1.9144,
            "count": 102,
            "high_risk": True,
        },
        {
            "center_lat": 52.4812,
            "center_lon": -1.9098,
            "count": 84,
            "high_risk": False,
        },
        {
            "center_lat": 52.4748,
            "center_lon": -1.9072,
            "count": 66,
            "high_risk": False,
        },
    ]

    households: List[Dict[str, Any]] = []

    # Intentionally create a few nearly identical records to simulate messy/duplicated inputs.
    duplicate_specs = [
        {"lat": 52.4739, "lon": -1.9165, "household_size": 2, "age_band": "75+", "mobility": "wheelchair"},
        {"lat": 52.4740, "lon": -1.9164, "household_size": 2, "age_band": "75+", "mobility": "wheelchair"},
        {"lat": 52.4787, "lon": -1.9142, "household_size": 1, "age_band": "65-74", "mobility": "limited"},
        {"lat": 52.4788, "lon": -1.9143, "household_size": 1, "age_band": "65-74", "mobility": "limited"},
        {"lat": 52.4808, "lon": -1.9097, "household_size": 3, "age_band": "adult", "mobility": "none"},
        {"lat": 52.4809, "lon": -1.9098, "household_size": 3, "age_band": "adult", "mobility": "none"},
        {"lat": 52.4745, "lon": -1.9071, "household_size": 1, "age_band": "75+", "mobility": "wheelchair"},
        {"lat": 52.4746, "lon": -1.9072, "household_size": 1, "age_band": "75+", "mobility": "wheelchair"},
    ]

    for idx, duplicate in enumerate(duplicate_specs, start=1):
        households.append(
            {
                "id": f"H{idx:03d}",
                "lat": round(duplicate["lat"] + rng.uniform(-0.00008, 0.00008), 6),
                "lon": round(duplicate["lon"] + rng.uniform(-0.00008, 0.00008), 6),
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
            lat = cluster["center_lat"] + rng.uniform(-0.0027, 0.0027)
            lon = cluster["center_lon"] + rng.uniform(-0.0027, 0.0027)

            if cluster["high_risk"]:
                age_band = choose_weighted(
                    rng,
                    [
                        ("child", 0.10),
                        ("adult", 0.28),
                        ("65-74", 0.30),
                        ("75+", 0.32),
                    ],
                )
                mobility = choose_weighted(
                    rng,
                    [
                        ("none", 0.45),
                        ("limited", 0.32),
                        ("wheelchair", 0.23),
                    ],
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
                    [
                        ("child", 0.18),
                        ("adult", 0.62),
                        ("65-74", 0.12),
                        ("75+", 0.08),
                    ],
                )
                mobility = choose_weighted(
                    rng,
                    [
                        ("none", 0.72),
                        ("limited", 0.18),
                        ("wheelchair", 0.10),
                    ],
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

            # Deliberate data-quality issues: about 15% of records have missing values.
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

    # Ensure the final set has exactly 400 households after duplicates and generation.
    if len(households) != 400:
        raise ValueError(f"Expected 400 households, found {len(households)}")

    return households


def generate_shelters() -> List[Dict[str, Any]]:
    shelters = [
        {"id": "S1", "name": "North Community Centre", "lat": 52.4738, "lon": -1.9196, "capacity": 90},
        {"id": "S2", "name": "South Market Hall", "lat": 52.4768, "lon": -1.9068, "capacity": 120},
        {"id": "S3", "name": "East School Hall", "lat": 52.4817, "lon": -1.9125, "capacity": 110},
        {"id": "S4", "name": "West Civic Hub", "lat": 52.4831, "lon": -1.9185, "capacity": 100},
        {"id": "S5", "name": "Midtown Shelter", "lat": 52.4794, "lon": -1.9108, "capacity": 130},
    ]
    return shelters


def generate_hospitals() -> List[Dict[str, Any]]:
    hospitals = [
        {"id": "HOSP1", "name": "Riverside General", "lat": 52.4840, "lon": -1.9182, "capacity": 220},
        {"id": "HOSP2", "name": "Parkside Medical Centre", "lat": 52.4728, "lon": -1.9070, "capacity": 180},
    ]
    return hospitals


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def build_dataset() -> Dict[str, Any]:
    households = generate_households()
    shelters = generate_shelters()
    hospitals = generate_hospitals()

    return {
        "synthetic": True,
        "seed": SEED,
        "bounding_box": BOUNDING_BOX,
        "households": households,
    }, {
        "synthetic": True,
        "seed": SEED,
        "bounding_box": BOUNDING_BOX,
        "shelters": shelters,
    }, {
        "synthetic": True,
        "seed": SEED,
        "bounding_box": BOUNDING_BOX,
        "hospitals": hospitals,
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    households_payload, shelters_payload, hospitals_payload = build_dataset()
    write_json(OUTPUT_DIR / "households.json", households_payload)
    write_json(OUTPUT_DIR / "shelters.json", shelters_payload)
    write_json(OUTPUT_DIR / "hospitals.json", hospitals_payload)

    meta = {
        "synthetic": True,
        "seed": SEED,
        "bounding_box": BOUNDING_BOX,
        "generated_files": [
            "households.json",
            "shelters.json",
            "hospitals.json",
        ],
        "notes": [
            "Synthetic-only demo dataset for flood-response prioritization.",
            "Contains deliberate missing values and duplicate-like records to stress-test data handling.",
        ],
    }
    write_json(OUTPUT_DIR / "meta.json", meta)

    print(f"Generated 3 synthetic datasets at {OUTPUT_DIR}")
    print(f"Households: {len(households_payload['households'])}")
    print(f"Shelters: {len(shelters_payload['shelters'])}")
    print(f"Hospitals: {len(hospitals_payload['hospitals'])}")


if __name__ == "__main__":
    main()
