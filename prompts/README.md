# prompts/

> ⚠️ **Required by the hackathon rules** — the `prompts/` folder documents the AI prompts and
> strategy used during development.

## Why this folder matters

CODE//CONNECT'26 is a *Vibe Coding* hackathon: AI tools are allowed, but pre-built or plagiarised
projects are disqualified. This log proves the work was built during the event with AI as a tool,
and shows *how* we directed it.

## How we use it

- Every substantive AI interaction gets an entry in [`prompts.md`](prompts.md).
- We log the **goal**, the **actual prompt**, the **model**, and the **outcome** — including when
  the AI was wrong, and how we caught it.
- We do not log trivial autocomplete. We log decisions.

## Ground rules we held ourselves to

1. **AI writes code; humans own the model.** Every hydrology/ETI assumption is a human decision.
2. **Verify, don't trust.** Anything AI generated was checked against `docs/methodology.md`.
3. **No plagiarism.** No pre-built flood tool was copied. AI was used for scaffolding, refactors,
   docs and debugging.
4. **Log the misses.** A prompt that produced wrong output is more useful in the log than one that
   worked first time.

See [`prompts.md`](prompts.md) for the full entry log and the strategy notes at the top.
