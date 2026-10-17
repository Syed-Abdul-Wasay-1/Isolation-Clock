# Resource allocation

At each scenario level, households are ranked by priority score (highest first),
then by estimated time to isolation (lowest first), fewer missing vulnerability
fields, and household ID. The allocation consumes that ranking in two separate
queues: already-isolated households receive boats, and all other households
receive vehicles. Each configured boat or vehicle can take one household, up to
its per-household passenger capacity (defaults: 3 boats with capacity 6 and 4
vehicles with capacity 5).

For each household, the allocator considers every safe place — **shelters and hospitals** — with
enough remaining beds for the full household, then assigns the closest one using straight-line
Haversine distance. Hospitals are included because the isolation model already routes a household to
whichever of the two it can reach; if the allocator ignored hospitals, the ranking and the
allocation would contradict each other. It breaks equal-distance ties by id. Beds are consumed by
household size. The default bed-capacity multiplier is 1; each safe place's capacity is multiplied by
this value. If capacity is absent or invalid, the model assumes 40 beds for that safe place before
applying the multiplier, and the UI identifies the places using that assumption.

The allocator does **not** give medical-need households priority for a hospital bed: that would be a
policy decision we do not have the authority to invent. Destination type is shown, and nothing more
is inferred from it.

Household size is read from `household_size`. If it is missing or invalid, the
model assumes 4 people and flags the assumption. A household that cannot fit a
remaining boat or vehicle receives the corresponding "no boats left" or "no
vehicles left" reason. Otherwise, a household that cannot fit in any safe place's
remaining beds receives "no beds free at any destination".

This is a greedy, priority-first allocation, not a globally optimal matching:
an earlier household may consume beds needed by a later household, and the
algorithm does not reassign earlier choices. Straight-line distance does not
represent passable roads, travel time, or route safety. Capacities and the
resource pool are synthetic scenario assumptions, not verified operational
inventory; the model also assigns one household per boat or vehicle rather than
simulating trips or shared rides.

The frontend can pin a scenario level with its full household ranking, scores, and resource
assignments, then compare those results with a different level to show rank shifts, newly isolated
households, and boat or vehicle assignment changes. Those rank shifts are taken from the **overall**
order (both the rescue and evacuate tabs together), which the before/after panel labels *"overall
priority, both tabs"*; the ranking list and detail panel instead number households **within their own
tab** (see [`methodology.md`](methodology.md) §5).

The boats / vehicles / bed-multiplier inputs accept only a non-negative number: a negative, empty or
non-numeric value is rejected and the previous value is kept, and a decimal is rounded down — the
panel states both, rather than silently snapping the field back.
