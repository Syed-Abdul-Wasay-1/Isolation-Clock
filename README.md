# ⏳ Isolation Clock

> **Not who is flooded — who is about to be cut off, and how many hours they have.**

**Isolation Clock** is a scenario simulator for flood rescue coordination in **Hala, Sindh,
Pakistan**. Instead of ranking households by *current* flood depth, it ranks them by **time until
isolation** — how long before every road out of their neighbourhood is under water and they can no
longer be reached.

A frail person on dry ground whose only road floods in 90 minutes outranks someone already standing
at a shelter door. The household records are synthetic by design, while the building and road data
for the study area comes from real OpenStreetMap map information.

Built for **CODE//CONNECT'26 — Vibe Coding Hackathon** (Problem 01, Disaster Response).

---

## 🎯 The Problem We Chose

> *How can technology identify who needs help most and coordinate available resources to reach them
> before the situation becomes critical?*

During floods, warnings don't reach everyone — elderly residents, people living alone, people with
disabilities and households without smartphones are the least likely to receive alerts and the most
likely to be in danger. Meanwhile rescue teams, boats, vehicles and medical supplies are finite, so
every decision about *who gets help first* carries a cost.

Most tools answer **"where is it flooded right now?"** We answer the harder, more useful question:
**"who is about to lose their last way out, and when?"**

## 💡 The Idea in One Line

Work out each household's road path to the nearest open shelter or hospital, simulate water rising
and closing low road segments, and derive an **ETI — Estimated Time to Isolation**. Then rank by
**vulnerability × time pressure**.

> **Example output**
> `Rank #3 — Age 78, wheelchair, lives alone. Only road to Shelter B floods in ~1h 40m.`

## ✨ What Makes It Different

| Typical flood tool | Isolation Clock |
|---|---|
| Ranks by current flood depth | Ranks by **time until isolation** |
| Static "flooded / not flooded" | Live countdown that changes as water rises |
| Ignores who lives there | Blends **vulnerability signals** (age, mobility, living alone) |
| Single answer | Shows a **confidence band** and sensitivity ("stays top 10 if water rises ±20 cm") |
| Needs connectivity | Precomputed snapshots + a **client-side app that works offline** |

---

## 🚀 Runs Entirely in the Browser

This project is **frontend-only by design**. There is no server, no database and no API to deploy.

- **Why:** the only hosting available is static (**Vercel / Netlify**), and in a flood the network
  may be gone anyway. A static app that computes locally is both easier to ship *and* better suited
  to the field.
- **How:** the road graph, the water model and the time-to-isolation calculation all run
  **client-side in TypeScript**. Heavy computation is pushed into a **Web Worker** so the map and
  slider never freeze.
- **Data:** all datasets (households, road network, destinations, offline snapshots) are
  **precomputed** into small JSON files and shipped as static assets — no runtime querying.
- **Offline:** once loaded, the app keeps working without a connection (installable / cacheable),
  which is exactly what a volunteer with no signal needs.

> The heavy geospatial preprocessing (turning OpenStreetMap data into a compact routable graph)
> happens **once, offline**, in a local helper script under `scripts/`. Its JSON output is committed
> to `public/data/` and served statically. Nothing runs on a server at request time.

---

## 🗂️ Project Structure

```text
Isolation Clock/
├── README.md            # This file
├── .gitignore
├── LICENSE
│
├── scripts/             # One-off OFFLINE data prep (not deployed)
│                        #   OSM / elevation -> compact JSON for the browser
│
├── public/
│   └── data/            # Precomputed JSON shipped as static assets
│                        #   households, road graph, destinations, snapshots
│
├── src/                 # The client-side app (Vite + React + TypeScript)
│   ├── simulation/      # Water model: level over time, which roads go under
│   ├── routing/         # Road graph + ETI (time-to-isolation) calculation
│   ├── workers/         # Web Worker(s) running the heavy graph math off the UI thread
│   ├── components/      # Reusable UI: map, slider, priority cards, badges
│   ├── pages/           # Views: live ranking, offline snapshot, about
│   ├── hooks/           # React hooks wiring the logic to the UI
│   ├── types/           # Shared TypeScript types (household, edge, snapshot…)
│   └── assets/          # Images, icons, styles input to the bundler
│
├── data/                # Data documentation + raw inputs used by scripts/
│   └── README.md        #   How the synthetic data is generated; what it is NOT
│
├── docs/                # Architecture, assumptions, methodology, risks, trade-offs
│   ├── README.md        #   Index + source material
│   ├── architecture.md
│   ├── assumptions.md
│   ├── methodology.md
│   ├── risks.md
│   ├── tradeoffs.md
│   ├── idea.md              # original product idea
│   ├── problem-statement.md # official hackathon brief
│   └── event-brief.md       # event rules, judging, timeline
│
├── prompts/             # ⚠️ Required by the hackathon
│   ├── README.md        #   Why this folder exists and how we used AI
│   └── prompts.md       #   Log of AI prompts used during development
│
└── screenshots/         # UI captures for this README and the pitch
```

> **Note:** the Vite scaffold files (`package.json`, `vite.config.ts`, `tsconfig.json`,
> `index.html`, `src/main.tsx`) are added when the app is scaffolded — this repo currently holds
> the agreed structure and documentation. `docs/architecture.png` is also to be rendered and added.

### Folder roles at a glance

| Folder | What goes here |
|---|---|
| `scripts/` | Offline, run-once data prep. Turns OSM/elevation into the compact JSON the browser uses. Never deployed. |
| `public/data/` | The precomputed JSON the app fetches at load. Small, committed, static. |
| `src/simulation/` | The water model — how the level rises and which road segments go under. |
| `src/routing/` | The road network, paths to shelters/hospitals, and the **ETI** logic. |
| `src/workers/` | A Web Worker so the graph math runs without freezing the UI. |
| `src/components/`, `src/pages/` | The coordinator-facing UI. |
| `data/` | Data documentation and the raw inputs the offline scripts consume. |
| `docs/` | The reasoning behind the build. |
| `prompts/` | The AI prompt log required for this Vibe Coding hackathon. |
| `screenshots/` | UI captures for the README and demo video. |

---

## 🧠 How It Works (conceptually)

```
   Road graph          Households           Shelters / Hospitals
 (roads + elevation)  (vulnerability)          (destinations)
        │                   │                        │
        └───────────────────┴────────────────────────┘
                            ▼
                 Routing — shortest path to the
                 nearest OPEN shelter / hospital
                            ▼
                 Water model — the level rises,
                 low road segments close first
                            ▼
                 ETI — the moment the LAST route
                 closes becomes the isolation clock
                            ▼
                 Priority ranking —
                 vulnerability × urgency + confidence band
```

**ETI (Estimated Time to Isolation)**, in words:

1. Each road segment has a ground elevation.
2. As water rises, a segment becomes impassable once the water is deeper than a tolerance.
3. A household is *reachable* while any path to an open shelter or hospital survives.
4. **ETI is the point in time when the last surviving route closes** — the household's countdown.
5. Households are ranked by how vulnerable they are **and** how soon they get cut off.

Because water only rises, once a household is cut off it stays cut off — which keeps the
calculation fast enough to run live in the browser. Full reasoning in
[`docs/methodology.md`](docs/methodology.md).

---

## 🧪 Handling Bad Data

The hackathon rules require us to be explicit about behaviour when data is incomplete or wrong.

| Failure | What we do |
|---|---|
| Missing household elevation | Fall back to the **neighbourhood average**; show a **low-confidence badge** and widen the time band. |
| Missing road segment / disconnected network | Report **"no modelled route"** instead of inventing one; treat as highest urgency, low confidence. |
| Coarse elevation data | We **simulate hydrology** instead of trusting terrain for urban drains — see `docs/assumptions.md`. |
| Uncertain water level | Every ranking shows a **sensitivity band**: *"stays top 10 if water rises ±20 cm"*. |
| No connectivity at all | Serve **precomputed isolation clocks** at +10/+20/+30 cm as a static offline snapshot. |

> **Risk we name openly:** false precision. A countdown looks authoritative on a crude model. We
> label this a **scenario simulator, not a forecast**, and always show the confidence band.

---

## ⚖️ Trade-offs

Full list in [`docs/tradeoffs.md`](docs/tradeoffs.md). Headlines:

- **Frontend-only, no backend** — required by the hosting we have, and genuinely better for the
  field; the cost is that datasets must be precomputed and shipped rather than queried live.
- **Small study area, a few hundred synthetic households** — enough to show the re-sorting live,
  small enough to run instantly in the browser.
- **Synthetic population, not real resident data** — privacy and zero data-availability risk; only
  the map footprint and road network are real data for Hala, Sindh.
- **Simulated hydrology, not hydrodynamic modelling** — coarse elevation can't resolve urban drains.
- **Ranking, not dispatch** — we prioritise *who*; vehicle assignment stays with the coordinator.

---

## 🛠️ Stack

| Layer | Tooling |
|---|---|
| Build / dev server | **Vite** |
| UI | **React + TypeScript** |
| Map | A client-side map library (e.g. MapLibre GL / Leaflet) with the road graph as GeoJSON |
| Graph / routing | Client-side graph algorithms (Dijkstra / BFS) in TypeScript |
| Heavy compute | **Web Worker** for the ETI sweep |
| Data | Precomputed **JSON** in `public/data/` |
| Hosting | **Vercel / Netlify** — static deploy, no server |

### Running it locally

> Placeholder — filled in once the scaffold exists, so judges can run it with one command:

```bash
git clone <your-public-repo-url>
cd "Isolation Clock"
npm install
npm run dev
```

---

## 📋 Submission Checklist (CODE//CONNECT'26)

- [x] **One** problem domain chosen — Problem 01, Disaster Response
- [ ] Public GitHub repo with visible commit history
- [ ] Live deployed link submitted (**Vercel or Netlify**)
- [ ] `prompts/` folder documenting AI prompts and strategy → [`prompts/prompts.md`](prompts/prompts.md)
- [ ] README with setup steps judges can run locally
- [ ] Architecture diagram + trade-off notes → [`docs/architecture.md`](docs/architecture.md), [`docs/tradeoffs.md`](docs/tradeoffs.md)
- [ ] 3-minute demo video prepared
- [ ] Submitted before **18 Oct 22:00 PKT**

---

## 👥 Team

| Role | Name |
|---|---|
| Lead | _TBD_ |
| Simulation | _TBD_ |
| Routing | _TBD_ |
| Frontend / UX | _TBD_ |

## 📄 Documentation Index

| Doc | What's inside |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Client-side system design + component responsibilities |
| [`docs/methodology.md`](docs/methodology.md) | ETI definition, water model, ranking formula |
| [`docs/assumptions.md`](docs/assumptions.md) | Every assumption we made, stated plainly |
| [`docs/risks.md`](docs/risks.md) | Model, data, runtime and UX risks + mitigations |
| [`docs/tradeoffs.md`](docs/tradeoffs.md) | What we built, what we cut, and why |
| [`docs/idea.md`](docs/idea.md) | The original product idea |
| [`docs/problem-statement.md`](docs/problem-statement.md) | The official hackathon brief |
| [`docs/event-brief.md`](docs/event-brief.md) | Full event reference: rules, judging, timeline |
| [`data/README.md`](data/README.md) | How the synthetic data is generated |
| [`prompts/README.md`](prompts/README.md) | AI usage strategy |
| [`prompts/prompts.md`](prompts/prompts.md) | AI prompt log |

---

## 📜 License

[MIT](LICENSE) — free to use, adapt and extend.
