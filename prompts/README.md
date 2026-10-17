# prompts/

> **Required by the hackathon rules.** CODE//CONNECT'26 runs a *Vibe Coding* hackathon: AI tools are
> allowed, but pre-built or plagiarised projects are disqualified. This folder proves the work was
> built during the event, with AI as a tool, and shows *how* we directed it.

## What lives here

| File | Purpose | Required? |
|---|---|---|
| [`prompts.md`](prompts.md) | The prompt log: one entry per substantive AI interaction. | **Yes** - on the submission checklist. |
| [`context.md`](context.md) | A copy-paste primer that gives any AI the project context in one message. | Optional, recommended. |
| [`templates/`](templates/) | Reusable prompt templates for the work we actually do on this repo. | Optional. |

> The repo root also has [`../AGENTS.md`](../AGENTS.md): persistent instructions an AI coding agent
> reads automatically at the start of every session. `context.md` is the copy-paste version for chat
> tools that do not support agent instruction files.

The hackathon only requires the log. `context.md` and `templates/` exist so the log stays easy to
keep accurate: instead of improvising, we start from a template and paste the result into
`prompts.md`.

## How we use the log

- Every substantive AI interaction gets an entry in [`prompts.md`](prompts.md).
- We log the **goal**, the **actual prompt**, the **model**, and the **outcome** - including when the
  AI was wrong, and how we caught it.
- We do not log trivial autocomplete. We log decisions.

## Ground rules

1. **AI writes code; humans own the model.** The isolation-level definition, the exposure heuristic,
   the ranking weights and the resource rules are human decisions.
2. **Verify, don't trust.** Anything AI generated is checked against `../docs/` - especially
   `methodology.md`, `SCORING.md` and `ALLOCATION.md`.
3. **No plagiarism.** No pre-built flood tool was copied. AI was used for scaffolding, refactors,
   docs and debugging.
4. **Log the misses.** A prompt that produced wrong output is more useful in the log than one that
   worked first time.
5. **Keep it true.** If a doc or an entry describes something the code does not do, fix the doc or
   delete the claim. The "Corrections to earlier drafts" table in `prompts.md` is the record of the
   last time we did that.

## Templates

| Template | Use it when |
|---|---|
| [`templates/01-add-feature.md`](templates/01-add-feature.md) | Adding or changing user-facing behaviour. |
| [`templates/02-fix-bug.md`](templates/02-fix-bug.md) | Something is broken or a number looks wrong. |
| [`templates/03-review-changes.md`](templates/03-review-changes.md) | Reviewing a diff or branch before merging. |
| [`templates/04-regenerate-data.md`](templates/04-regenerate-data.md) | Rebuilding `public/data/`. |
| [`templates/05-update-docs.md`](templates/05-update-docs.md) | Keeping docs and this log in sync with the code. |

After using a template, add the entry to [`prompts.md`](prompts.md) with the model that was used.
