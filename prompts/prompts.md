# AI Prompt Log — Isolation Clock

> Hackathon requirement. One entry per substantive AI interaction.
> **Format:** Date · Goal · Prompt · Model · Outcome.

## Strategy

**How we directed the AI:**

1. **Contract first.** We agreed the project structure, the data shape and the water curve *before*
   prompting for anything — so the AI filled in a known shape instead of inventing an architecture.
2. **One component per prompt.** Each area (simulation, routing, frontend) was prompted and reviewed
   separately so it stayed understandable and testable.
3. **Ask for the trade-off, not just the answer.** Prompts like *"what breaks if water recedes?"*
   produced the risk notes in `../docs/risks.md`.
4. **Force honesty.** We explicitly asked the AI to label the tool a *scenario simulator* and to add
   confidence bands — never to pretend it was a forecast.
5. **Verify against our own spec.** Every generated result was checked against
   `../docs/methodology.md`; where the AI disagreed, our spec won.

**Division of labour:** AI = scaffolding, boilerplate, refactors, docs, debugging.
Humans = problem framing, the ETI definition, hydrology assumptions, ranking weights, UX and pitch.

---

## Entries

### 2026-10-17 · Project scaffold · 🟡

- **Model:** (your coding assistant)
- **Goal:** Agree a clean repo structure for a flood "time-to-isolation" project.
- **Prompt:**
  > *"Give me a folder structure for a geospatial hackathon project. It has a hydrology simulation,
  > road-network routing with a time-to-isolation calculation, synthetic household data, docs, and a
  > required `prompts/` folder. Include a README, .gitignore and a LICENSE."*
- **Outcome:** Produced the tree now in `../README.md`. We simplified it so the source areas stay
  readable and the contributors fill in the rest.

### 2026-10-17 · Frontend-only constraint · 🟢

- **Model:** (your coding assistant)
- **Goal:** Decide how to ship the app given that only static hosting (Vercel / Netlify) is
  available and there is no backend.
- **Prompt:**
  > *"We have no backend hosting — only Vercel and Netlify, which serve static frontends. How should
  > we architect a geospatial app that computes shortest paths and simulates rising water, so it runs
  > entirely in the browser?"*
- **Outcome:** Adopted a client-side design: **Vite + React + TypeScript**, all computation in the
  browser, the heavy graph sweep in a **Web Worker**, and data **precomputed offline** into JSON in
  `public/data/`. Python was dropped entirely. This decision is captured in
  `../docs/architecture.md` and `../docs/tradeoffs.md`.

### 2026-10-17 · ETI definition · 🟢

- **Model:** (your coding assistant)
- **Goal:** Get a rigorous definition of "time to isolation".
- **Prompt:**
  > *"Define ETI (estimated time to isolation) for a household on a road graph where water rises over
  > time and closes road segments below a tolerance. Give a plain-language definition and an
  > efficient approach. Assume water is monotonically non-decreasing."*
- **Outcome:** Reached the *reachability* definition plus the monotonicity insight (once isolated,
  always isolated), which keeps the calculation fast. Adopted into `../docs/methodology.md`.

### 2026-10-17 · Hydrology honesty check · 🟡

- **Model:** (your coding assistant)
- **Goal:** Decide whether coarse elevation data can be trusted for urban street flooding.
- **Prompt:**
  > *"Is roughly 30 m elevation data good enough to model which urban streets flood from drains and
  > rainfall? What should a two-day prototype do instead?"*
- **Outcome:** Confirmed it is too coarse for urban micro-topography. We chose to **simulate water
  level plus a drainage allowance** and documented it in `../docs/assumptions.md` rather than
  interpolating terrain we can't trust.

### 2026-10-17 · Ranking formula · 🟢

- **Model:** (your coding assistant)
- **Goal:** A transparent priority score blending vulnerability and urgency.
- **Prompt:**
  > *"Propose a weighted priority score combining a household vulnerability index, urgency derived
  > from the time to isolation, and a penalty for low-confidence data. Keep it explainable to a
  > rescue coordinator."*
- **Outcome:** Adopted a simple weighted blend with all weights exposed as configuration. We added a
  hard rule: households with no modelled route surface at the **top**, not the bottom.

### 2026-10-17 · Bad-data behaviour · 🔴 (AI first proposed hiding missing data)

- **Model:** (your coding assistant)
- **Goal:** Define behaviour when elevation or roads are missing.
- **Prompt:**
  > *"What should a flood prioritisation tool do when a household has no elevation data or no
  > modelled route?"*
- **Outcome:** The AI initially suggested **excluding** incomplete households. **We rejected that** —
  the people most likely to be missing from data are exactly the people most at risk. Final rule:
  fall back to the neighbourhood average with a low-confidence badge, and *surface* no-route
  households as urgent. Logged here because the miss sharpened the design.

### 2026-10-17 · README + docs · 🟢

- **Model:** (your coding assistant)
- **Goal:** A README a judge can run, plus trade-off and risk docs.
- **Prompt:**
  > *"Write a README for a geospatial hackathon MVP with problem statement, project structure,
  > approach and submission checklist. Then draft docs for assumptions, risks and trade-offs, and be
  > explicit about what the tool is NOT."*
- **Outcome:** Drafted the docs in this repo. Human edit added the offline-snapshot and
  false-precision framing.

---

<!--
TEMPLATE — copy for each new entry:

### YYYY-MM-DD · <short label> · 🟢/🟡/🔴

- **Model:** <model name + version>
- **Goal:** <what you were trying to achieve>
- **Prompt:**
  > *"<the actual prompt text>"*
- **Outcome:** <what you got, what you kept, what you changed and why>
-->
