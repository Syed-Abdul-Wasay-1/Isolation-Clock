# Template 05 - Update docs and the prompt log

**Use when:** you finished a change and the docs, README or prompt log have drifted. Run this before
you record the demo or submit.

The hackathon checklist requires: a README a judge can run, an architecture diagram, trade-off notes,
and the `prompts/` log. Drift in any of these costs marks.

---

```text
Context: Isolation Clock (see the project primer). I just made this change:

CHANGE SUMMARY
- <what changed, files, commit>
- <what the user can now do that they could not before>

TASK
1. Find every file in docs/, README.md, data/README.md and prompts/ that is now wrong or incomplete
   because of that change. List them, then edit them.
2. Flag any claim in those docs that describes behaviour the code does NOT have. Do not soften it -
   either the doc is wrong, or we have a bug. Say which.
3. Write a new entry for prompts/prompts.md in the existing format (Date - Goal - Prompt - Model -
   Outcome).
4. Keep the honesty framing: scenario simulator, not a flood forecast; synthetic households; relative
   index, not water depth.

RULES
- Do not invent numbers. Read them from the JSON or the code.
- Keep tables and headings consistent with the rest of the file.
- Do not delete the "Corrections to earlier drafts" table; add to it if you find more drift.
```

---

## Status of the docs today

The drift was **fixed** (commit range on `wasay`): `architecture.md`, `assumptions.md`, `risks.md`,
`tradeoffs.md` and `methodology.md` no longer claim a Web Worker, offline snapshots, a sensitivity
band or a road-depth tolerance. They now describe only what ships:

- No Web Worker — the graph work is precomputed in Python; the browser does per-household arithmetic.
- No offline snapshots or service worker — the app loads five static JSON files and is online-only.
- No sensitivity band — confidence is reported per household, but there is no ±margin re-run.
- No depth tolerance — road closure is a threshold on a 0–100 relative exposure index.

`docs/SIMULATION.md`, `docs/SCORING.md`, `docs/ALLOCATION.md`, `docs/DATA.md` and `README.md` match the
shipped code. The "Corrections to earlier drafts" table in [`../prompts.md`](../prompts.md) records
what the earlier drafts got wrong, on purpose.

## Final pre-submission checklist

- [ ] `npx tsc -b` and `npx oxlint` pass; `npm run build` succeeds; `npm test` is green
- [ ] README run steps work from a clean clone (`npm install`, `npm run dev`)
- [ ] Every `Model:` field in `prompts.md` names the tool actually used
- [ ] `docs/architecture.png` exists (it is still a to-do in `docs/README.md`)
- [ ] Live link deployed and reachable
- [ ] Three-minute demo video recorded
