---
name: a11y-test
description: >
  Run accessibility audit on a web page or application. Invoke when user wants
  WCAG compliance checking or accessibility issue detection.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: --url <target-url> [--standard WCAG2AA] [--pages <comma-separated-urls>]
---

# Accessibility Testing Skill

You are an expert accessibility engineer. Scan web pages with axe-core via Playwright, map violations to WCAG criteria, and produce concrete, actionable recommendations.

## Workspace

All output goes into **`.opentest-workspace/a11y/`** in the current working directory. Create it before starting:

```bash
mkdir -p .opentest-workspace/a11y
```

Add to `.gitignore` if not already there:
```
.opentest-workspace/
```

## Prerequisites Check

Ensure Playwright is installed:
```bash
uv run .claude/skills/a11y-test/scripts/scan_a11y.py --help
```

If it fails, run:
```bash
uv run --with playwright playwright install chromium
```

## Step 1: Scan

For a single page:
```bash
uv run .claude/skills/a11y-test/scripts/scan_a11y.py \
  --url <target_url> \
  --standard WCAG2AA \
  --output .opentest-workspace/a11y/results.json
```

For multiple pages at once:
```bash
uv run .claude/skills/a11y-test/scripts/scan_a11y.py \
  --url <target_url> \
  --pages "<url1,url2,url3>" \
  --standard WCAG2AA \
  --output .opentest-workspace/a11y/results.json
```

For a quick summary first:
```bash
uv run .claude/skills/a11y-test/scripts/scan_a11y.py \
  --url <target_url> \
  --summary
```

## Step 2: Report

Lead with violation count by severity: **Critical / Serious / Moderate / Minor**.

Group findings by WCAG guideline. For each critical/serious violation:
1. Plain-English description (not WCAG jargon)
2. Who it affects (screen reader users, keyboard-only users, low-vision users)
3. The specific HTML element from `nodes[].html`
4. An exact before/after code fix

## WCAG Impact Levels

- **Critical** (Level A violations) — major barriers; some users cannot access content at all
- **Serious** (Level AA violations) — required for legal compliance (ADA, EN 301 549, EAA)
- **Moderate** (best-practice) — improves assistive technology experience
- **Minor** — small improvements with low user impact

## Common Violations Reference

| Rule | WCAG | Who it affects | Quick fix |
|------|------|---------------|-----------|
| `color-contrast` | 1.4.3 | Low-vision users | Increase contrast ratio to 4.5:1 for normal text |
| `image-alt` | 1.1.1 | Screen reader users | Add descriptive `alt="..."` to `<img>` |
| `label` | 1.3.1 | Screen reader users | Associate `<label for="id">` or use `aria-label` |
| `heading-order` | 1.3.1 | Screen reader navigation | Don't skip heading levels (h1 → h2, not h1 → h3) |
| `keyboard` | 2.1.1 | Keyboard-only users | Ensure all interactive elements are focusable |
| `focus-visible` | 2.4.7 | Keyboard-only users | Add visible `:focus` styles; never `outline: none` |
| `link-name` | 4.1.2 | Screen reader users | Add descriptive text or `aria-label` to all links |
| `button-name` | 4.1.2 | Screen reader users | Add visible label or `aria-label` to buttons |
| `document-title` | 2.4.2 | All users | Add a meaningful `<title>` to every page |
| `html-has-lang` | 3.1.1 | Screen readers | Add `lang="en"` to `<html>` element |

## Reporting

End with a **prioritized fix list** — critical issues first, then quick wins (violations affecting many elements with simple fixes).

Offer to re-scan after fixes are applied to verify resolution.
