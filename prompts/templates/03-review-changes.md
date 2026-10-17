# Template 03 - Review a diff or a branch

**Use when:** you are about to merge, or you inherited someone else's branch and need to know whether
it is still useful or already superseded.

This is the template we used for the `origin/rabia` review, which is why it asks for verdicts and
evidence rather than a summary.

---

```text
Context: Isolation Clock (see the project primer).

REVIEW TARGET
- <commit range / branch name / diff>

QUESTIONS
1. What does this actually change, file by file? Group by intent, not by file order.
2. Is any part of it still useful on top of the current code, or is it superseded? Be specific about
   which lines/ideas, and why.
3. Can it be merged cleanly? If not, name the exact files that conflict.
4. Does it contradict anything in docs/ (scoring weights, ETI formula, data shapes)?
5. Which files does it reference that do not exist on the current branch?

RULES
- Do not summarise what the branch was "trying to do". Report what is in the diff.
- Do not present a plan as fact. If you did not check a file, say you did not check it.
- Verify before asserting: quote the line or the command output that supports each claim.
- Give a clear verdict: merge / port specific parts / ignore. Then list the parts worth porting, with
  the file and the reason.

Commands you may run: git log, git diff, git show <ref>:<path>, git merge-base, git ls-tree,
git rev-parse.
```

---

## What to expect, and what to distrust

A good review comes back with a verdict plus **evidence** (commit hashes, file paths that exist,
conflict lists). Distrust a review that:

- Links to files it never confirmed exist on the current branch. Branches created before a rename,
  folder move or study-area switch often reference paths that no longer exist.
- Invents a reason for a design choice ("this avoids janky re-renders") without pointing at code.
- Describes capabilities (a Web Worker, offline snapshots, a sensitivity band) that are only in the
  docs and not in `src/`.

## Then

Log the review in [`../prompts.md`](../prompts.md), including the parts you rejected and why.
