# Template 01 - Add or change a feature

**Use when:** you want new user-facing behaviour, a new panel, a new field on screen, or a change to
how the ranking feels.

**Before you send:** replace every `<...>`. Attach or paste the files you name.

---

```text
Context: Isolation Clock (see the project primer). Today's task is a feature change, not a refactor.

GOAL
<one or two sentences on the behaviour you want, and for whom>

ACCEPTANCE CRITERIA
- <what must be true when it works>
- <what must still be true (do not break)>
- <edge cases: empty data, null fields, level 0, level 100>

CONSTRAINTS
- Change only <files/area>. Do not touch the scoring weights or the ETI formula.
- Keep the data shapes in public/data/ unchanged unless you also update docs/.
- Match the existing style in <a file to copy from>.

DELIVERABLE
1. The smallest diff that satisfies the criteria.
2. A short note on any assumption you made.
3. How to verify it, and what you could not verify.

Relevant files: <paths>
```

---

## What a good answer looks like

- Touches the fewest files that make sense, and says which ones.
- Does not silently change the meaning of the scenario level, ETI, or the weights.
- Handles the empty / null / boundary cases it was given.
- Ends with a verification step that actually runs in this repo:

```bash
npx tsc -b          # typecheck
npx oxlint          # lint
npm run build       # full production build
```

## Then

Add the result to [`../prompts.md`](../prompts.md), and update any behaviour doc it changed
(`../docs/` plus the README if the user-facing story moved).
