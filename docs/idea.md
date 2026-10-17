# Idea — Isolation Clock

> Original concept note. The product idea and the nine points behind it, as first written.

1. Isolation Clock (core)
Pitch: instead of asking who is flooded, ask who is about to be cut off, and how many hours they
have.
1. Different because: it prioritises by time until isolation, not by current flood depth. A frail person
on dry ground whose only road floods in 90 minutes outranks someone already at a shelter
door.
2. User and moment: a rescue coordinator 6 to 12 hours before heavy rain, deciding where to park
boats and ambulances.
3. Risk signals: OSM road graph, relative elevation per road segment, household vulnerability, and
road distance to the nearest hospital or shelter.
4. Prioritisation and explanation: compute each household’s road path to the nearest open
shelter or hospital, simulate water rising and closing low segments, and get an ETI (estimated
time to isolation). Rank by vulnerability × time pressure. Example: “Rank #3: age 78, wheelchair,
lives alone. Only road to Shelter B floods in ~1h 40m.”
5. Bad data: missing elevation or road data falls back to the neighbourhood average with a low-
confidence badge. The ranking shows a sensitivity band (“stays top 10 if water rises ±20 cm”).
6. Offline: precompute isolation clocks at several water levels (+10, +20, +30 cm and so on) and
cache them as a static snapshot on volunteer phones.
7. MVP: a 2 to 3 km² area, 300 to 500 synthetic households, osmnx + networkx, and a water-level
slider that closes roads. Simulate the hydrology, because 30 m elevation data is too coarse to
model urban drains.
8. Risk: false precision, since a countdown looks authoritative on a crude model. Label it a scenario
simulator, not a forecast, and show the confidence band.
9. Wow: drag the slider and roads turn blue one by one, households flip to “isolated in 2h 10m”,
boats re-route and the list re-sorts live