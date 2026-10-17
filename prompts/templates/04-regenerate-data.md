# Template 04 - Regenerate or adjust the data

**Use when:** the study area, the household count, the exposure heuristic, or the seed changes, and
`public/data/` has to be rebuilt.

**Warning:** this rewrites the files the whole app is built on. Regenerating with a different seed
invalidates screenshots, README examples and any numbers written in `docs/`.

---

```text
Context: Isolation Clock (see the project primer). The offline pipeline is Python and lives in
scripts/; the browser only reads public/data/.

GOAL
<what should change: study area, household count, a field distribution, the exposure mix, the seed>

CURRENT PIPELINE
1. scripts/generate_data.py      -> households.json, shelters.json, hospitals.json, meta.json
   (osmnx buildings + amenities, cached as GeoJSON in data/, fixed seed 20261017)
2. scripts/build_isolation_clock.py -> roads.json, isolation.json
   (loads the cached graphml, fetches elevations, computes exposure percentile thresholds, runs the
   widest-path isolation search)

CONSTRAINTS
- Keep the output shapes identical to docs/DATA.md and src/types/study.ts.
- Keep the seed fixed and printable so results stay reproducible.
- Do not change the meaning of threshold / isolation_level without telling me.
- If elevation or water data must be re-fetched, warn me that it needs network access and may be
  rate-limited.

DELIVERABLE
1. The script change.
2. The exact commands to run, in order, from the repo root.
3. Which output files change and how to sanity-check them (counts, ranges, e.g. isolation levels
   should stay within 0-100).
4. Anything that must be updated because of the change: docs/DATA.md, docs/SIMULATION.md, README
   numbers, screenshots.
```

---

## Sanity checks that must pass

```bash
# household count and null fields
node -e "const h=require('./public/data/households.json');console.log(h.households.length)"
# isolation levels must be null or within 0..100
node -e "const i=require('./public/data/isolation.json');const l=i.households.map(r=>r.isolation_level);console.log(Math.min(...l),Math.max(...l))"
# every household must have an isolation record
node -e "const h=require('./public/data/households.json'),i=require('./public/data/isolation.json');const s=new Set(i.households.map(r=>r.id));console.log(h.households.filter(x=>!s.has(x.id)).length)"
```

Then, if anything user-visible changed, refresh the affected screenshots and README figures.
