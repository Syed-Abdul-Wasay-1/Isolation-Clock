---
name: Isolation Clock Submission
description: Use when preparing or checking the CODE//CONNECT'26 hackathon submission - README, docs, the prompts folder, architecture diagram, deploy, or the pre-submission checklist. Also use when asked whether a doc or prompt file is required.
---

# Isolation Clock - hackathon submission

Event: **Vibe Coding Hackathon, CODE//CONNECT'26** (a sub-event of Career Connect'26), hosted by the
Department of Computer Science, UBIT, University of Karachi.

## The rules that shape the repo

| Rule | Consequence for this project |
|---|---|
| Choose **exactly 1** of 3 problem domains | We are on **Problem A - Disaster Response** only. |
| Public GitHub repo, visible commit history | Work is committed; no squashed single commit. |
| A **live deployed link** is required | Static deploy (Vercel / Netlify). The app must work from a clean build. |
| `prompts/` folder documenting AI prompts and strategy | **Required.** `prompts/prompts.md` is on the checklist. Do not delete it. |
| README with setup steps judges can run locally | `npm install` then `npm run dev` must work from a clean clone. |
| Architecture diagram + trade-off notes | Planned as `docs/architecture.png` (still a to-do) plus `docs/tradeoffs.md`. |
| AI tools allowed; pre-built/plagiarised disqualified | Keep the prompt log honest; never paste a whole prebuilt flood tool. |
| Deadline 18 Oct 22:00 PKT; late = not evaluated | Freeze scope early; deploy and record the video before the deadline. |

Judging weights: problem fit & impact 30%, MVP functionality 25%, UI/UX 20%, innovation 15%,
pitch & clarity 10%.

## Honesty is part of the submission

The rules ask how the system behaves with incomplete or wrong data, and the docs are graded. The
project's stated framing must stay consistent everywhere:

- **"Scenario simulator, not a flood forecast."**
- Household details are **synthetic**; buildings, roads and amenities are real OSM data.
- The scenario level is a **relative index, not water depth**.

## Known doc drift - fix or own it

These files describe features that were **never implemented**. Either build them or edit them before
submitting, otherwise a judge reading `docs/architecture.md` will expect a worker that does not exist:

| Doc | Claim | Reality |
|---|---|---|
| `docs/architecture.md` | ETI sweep runs in a **Web Worker** | No worker; `src/workers/` is empty. |
| `docs/architecture.md`, `docs/assumptions.md`, `docs/risks.md`, `docs/tradeoffs.md` | **Offline snapshots** at +10/+20/+30 | Not built; the app recomputes in the browser. |
| `docs/methodology.md`, `docs/risks.md` | **Sensitivity band** / fragile flag | Not built; only confidence is shown. |
| `docs/assumptions.md` | Road **tolerance ~0.30 m** | No depth tolerance; thresholds are a 0-100 percentile. |
| `README.md` / `docs/*` | "We do not assign vehicles" | `resourceMatching.ts` suggests boats/vehicles/beds (greedy, not dispatch). |

`docs/SIMULATION.md`, `docs/SCORING.md`, `docs/ALLOCATION.md` and `docs/DATA.md` match the code.
The `prompts/prompts.md` "Corrections to earlier drafts" table already records these mismatches.

## Pre-submission checklist

- [ ] Exactly one problem domain (Disaster Response)
- [ ] Public repo, commit history visible
- [ ] Live link deployed and reachable
- [ ] `npm install` + `npm run dev` work from a clean clone
- [ ] `npx tsc -b`, `npx oxlint`, `npm run build` all pass
- [ ] `prompts/prompts.md` Model fields name the tool actually used
- [ ] `docs/architecture.png` rendered and referenced from the README
- [ ] Doc drift above resolved
- [ ] 3-minute demo video recorded
- [ ] Team names filled in (`README.md` "Team" table is still `_TBD_`)
- [ ] Submitted before 18 Oct 22:00 PKT

## Deploy notes

- Static only. Vercel / Netlify: build `npm run build`, output `dist/`.
- `public/data/*.json` are shipped as static assets and fetched at runtime, so the data paths must
  resolve against the deploy base. `useStudyData.ts` uses `import.meta.env.BASE_URL` for this reason;
  if you deploy under a sub-path, set Vite's `base` accordingly.
- The README "large inputs are gitignored" note is accurate: `data/*.graphml` and the geojson caches
  are committed, but `data/**/*.osm|pbf|tif|gpkg|shp` are ignored, and `public/data/*.json` is
  force-kept.

## Prompt-log etiquette

Every substantive AI interaction gets an entry in `prompts/prompts.md`: **Date - Goal - Prompt -
Model - Outcome**. Misses are worth recording - the existing log keeps a "Corrections to earlier
drafts" table on purpose.
