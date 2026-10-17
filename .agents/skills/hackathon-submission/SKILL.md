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

## Doc truthfulness - verified, keep it that way

These docs used to describe features that were **never implemented**. That drift was fixed; the docs
now match the code. Keep it that way - a judge reading `docs/architecture.md` should never expect a
worker that does not exist.

| Doc claim that would be wrong | Actual fact |
|---|---|
| A **Web Worker** runs the ETI sweep | No worker; `src/workers/` holds only `.gitkeep`. The graph work is precomputed in Python; the browser does per-household arithmetic on the main thread. |
| **Offline snapshots** at +10/+20/+30 | Not built. The app loads five static JSON files and is online-only (no service worker). |
| A **sensitivity band** / fragile flag | Not built. Only the confidence value is shown. |
| Road **tolerance ~0.30 m** | No depth tolerance. Closure is a threshold on a 0–100 relative exposure percentile index. |
| "We do not assign vehicles" | Outdated. `resourceMatching.ts` makes a greedy boat/vehicle/bed suggestion; it is explicitly *not* dispatch. |

`docs/SIMULATION.md`, `docs/SCORING.md`, `docs/ALLOCATION.md`, `docs/DATA.md`, `docs/methodology.md`,
`docs/architecture.md`, `docs/assumptions.md`, `docs/risks.md`, `docs/tradeoffs.md` and `README.md`
all match the shipped code. The `prompts/prompts.md` "Corrections to earlier drafts" table keeps the
history of these mistakes on purpose.

## Pre-submission checklist

- [ ] Exactly one problem domain (Disaster Response)
- [ ] Public repo, commit history visible
- [ ] Live link deployed and reachable
- [ ] `npm install` + `npm run dev` work from a clean clone
- [ ] `npx tsc -b`, `npx oxlint`, `npm run build` and `npm test` all pass
- [ ] `prompts/prompts.md` Model fields name the tool actually used
- [ ] `docs/architecture.png` rendered and referenced from the README
- [ ] Doc drift above resolved
- [ ] 3-minute demo video recorded
- [x] Team names filled in (`README.md` "Team" table)
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
