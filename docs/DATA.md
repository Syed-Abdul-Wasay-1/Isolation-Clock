# Synthetic data format

This project is scoped to the **Sukkur, Sindh, Pakistan** study area. The generated files under
`public/data/` intentionally use synthetic, non-personal household data only. Buildings, roads and
amenities are real OpenStreetMap-derived map data for this area, while all household details
attributes are fabricated for demo and testing.

## Household fields

Each record in `households.json` represents an artificial household in the study area.

- `id`: unique household identifier, generated from a fixed seed.
- `lat`: latitude in decimal degrees.
- `lon`: longitude in decimal degrees.
- `household_size`: number of people in the home.
- `age_band`: coarse age grouping used for vulnerability scoring.
  - `child`
  - `adult`
  - `65-74`
  - `75+`
- `mobility`: mobility status of the household or primary resident.
  - `none`
  - `limited`
  - `wheelchair`
- `medical_need`: whether the household is likely to require medical attention or support.
- `lives_alone`: whether the home is occupied by a single resident.
- `has_phone`: whether the household is assumed to have access to a phone, if known.
- `floor_level`: whether the building is at ground level or an upper floor.
  - `ground`
  - `upper`
- `last_contact_hours`: approximate hours since the last successful contact, or `null` if unknown.
- `data_completeness`: a value from 0 to 1 indicating how complete the available information is.

## Shelter fields

Each record in `shelters.json` describes a temporary shelter destination.

- `id`: shelter identifier.
- `name`: human-readable label.
- `lat`: latitude.
- `lon`: longitude.
- `capacity`: number of people the shelter can accommodate.

## Hospital fields

Each record in `hospitals.json` describes a medical destination.

- `id`: hospital identifier.
- `name`: human-readable label.
- `lat`: latitude.
- `lon`: longitude.
- `capacity`: number of patients the facility can accept or support.

## File-level metadata

Every generated file includes:

- `synthetic: true`: confirms the data is fabricated for prototyping only.
- `seed`: the fixed random seed used to make results reproducible.
- `bounding_box`: the Sukkur study-area bounds used when generating the records.
- `buildings_found`: number of OSM building features used for household placement.
- `amenity_counts`: OSM feature count for each queried amenity type.
- `fallback_used`: whether any household or facility category required fallback data.
- `fallback_details`: fallback status by households, shelters and hospitals, including real OSM facility counts used.

## Data quality note

A small percentage of records intentionally contain `null` values and near-duplicate entries to demonstrate how the Isolation Clock prototype handles imperfect, messy data in the field.

## Shelter and hospital placement

Shelters are placed at real OSM `school`, `community_centre` and `place_of_worship` features;
hospitals use real `hospital` and `clinic` features. The generator prints counts for every type.
Fixed fallback points are used only for a facility category that has no matching OSM features, and
a warning identifies the category. Household points use jittered OSM building centroids; if the
building query fails or returns fewer than 100 buildings, the script warns and uses points within
150 metres of real OSM roads instead.
