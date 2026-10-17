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

Everything under `docs/` is trustworthy for **concepts and intent**, but `architecture.md`,
`assumptions.md`, `risks.md` and `tradeoffs.md` still describe some features that were never built
(a Web Worker, offline snapshots, a sensitivity band) and a road-depth tolerance that does not exist.
`docs/SIMULATION.md`, `docs/SCORING.md` and `docs/ALLOCATION.md` match the shipped code.

If you want a clean submission, either build those features or edit those four files. The
"Corrections to earlier drafts" table in [`../prompts.md`](../prompts.md) already records the
mismatches, so nothing is hidden - but a judge reading `architecture.md` will still expect a worker.

## Final pre-submission checklist

- [ ] `npx tsc -b` and `npx oxlint` pass; `npm run build` succeeds
- [ ] README run steps work from a clean clone (`npm install`, `npm run dev`)
- [ ] Every `Model:` field in `prompts.md` names the tool actually used
- [ ] `docs/architecture.png` exists (it is still a to-do in `docs/README.md`)
- [ ] Live link deployed and reachable
- [ ] Three-minute demo video recorded
