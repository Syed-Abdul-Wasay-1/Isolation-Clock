---
name: e2e-test
description: This skill should be used when the user wants to test a web app end-to-end, crawl a UI, generate Playwright tests, check user flows, or validate frontend behavior in a browser. Trigger when the user says "test my web app", "crawl this URL", "generate E2E tests", "write Playwright tests", "check my login flow", "test my checkout flow", or provides a URL to a web application. Also trigger when the user mentions Playwright, Page Object Model (POM), user journey testing, or wants to validate that a UI works correctly.

---

# E2E Testing

Explores web apps live in a browser via playwright-mcp, discovers pages and user flows, executes test scenarios directly, and saves a findings report. No code generation — everything happens in the browser in real time.

## Workspace

All output from this skill goes into **`.opentest-workspace/e2e/`** in the current working directory. Create it before starting:

```bash
mkdir -p .opentest-workspace/e2e/screenshots
```

Add to `.gitignore` if not already there:
```
.opentest-workspace/
```

| Output | Path |
|--------|------|
| Screenshots | `.opentest-workspace/e2e/screenshots/<page-name>.png` |
| Test report | `.opentest-workspace/e2e/report-<YYYY-MM-DD>.md` |

## Guiding Principle

**Every test must answer: *"What user value breaks if this check fails?"***

Before executing any scenario, have answers to:
- What is this app? What does it actually do?
- Who are the users and what are their primary goals?
- Which flows, if broken, would be a P0 incident?

Generic checks ("page loads", "form shows validation") are only useful if they map to real user impact.

## Workflow

### Phase 0: Intake

Ask these questions **in a single message**:

1. **URL** — What is the URL of the app?
2. **Auth** — Does the app require login to access its main features?
   - If yes: what type? (email/password · Google OAuth / other SSO · token or cookie · no login needed)
3. **Credentials** — If form-based: provide email + password (used only in the browser session, not stored anywhere)
4. **Focus** *(optional)* — Any specific flows or areas to prioritize?

Do not proceed until you have the URL and know the auth situation.

---

### Phase 1: Browser Setup & Auth

**Open the browser and navigate to the app:**

```
browser_navigate → <URL>
browser_screenshot → check current state
```

**Handle auth based on type:**

| Auth type | Action |
|-----------|--------|
| No login required | Proceed to Phase 2 |
| Email/password form | `browser_fill` username → `browser_fill` password → `browser_click` submit → wait for redirect |
| Google OAuth / SSO | See **OAuth flow** below |
| Token / cookie | See **Token injection** below |

**Form login — verify it worked:**
After submitting, take a screenshot. If still on login page, the credentials may be wrong — ask the user to check.

**OAuth / SSO flow:**
Claude cannot log in through Google or SSO directly (bot detection). Instead:
1. Tell the user: *"Please open `<URL>` in your browser, log in, then open DevTools → Application → Cookies and copy the session cookie value."*
2. Once the user provides the cookie value, inject it:
   ```
   browser_navigate → <URL>
   browser_evaluate → document.cookie = "session=<VALUE>; path=/; domain=<DOMAIN>"
   browser_navigate → <URL>   ← reload to apply
   browser_screenshot → verify logged in (should NOT show login page)
   ```
3. If the app uses localStorage/sessionStorage instead, adjust the injection accordingly.

**Token injection (bearer / API token):**
```
browser_evaluate → localStorage.setItem('<key>', '<token>')
browser_navigate → <URL>
browser_screenshot → verify
```

**Auth is confirmed when:** screenshot shows the app's home/dashboard, not a login page.

---

### Phase 2: Discovery

Systematic BFS exploration via playwright-mcp. **Limit: 25 pages, depth 3.**

**For each page, in order:**
1. `browser_snapshot` — extract all internal links (`<a>` same-origin) and key interactive elements
2. `browser_screenshot` — capture the page state
3. Record in the running site map (see format below)
4. Add unvisited internal links to queue

**Site map format — build this as you go:**
```
/dashboard       → Project list, "New Project" button, activity feed
/projects/new    → 3-step wizard: name → template → invite
/settings        → tabs: Profile, Team, Billing
/settings/team   → member list, invite by email
```

**Go deeper than just links — interact to discover:**
- Open hamburger menus and dropdowns to find hidden nav items
- Click tabs that reveal sub-sections (same URL, different content)
- Trigger modals by clicking "New", "Edit", "Delete" buttons — note what appears (don't navigate away)
- Try empty states: what does the app show when there's no data?

**Per-page record:**
- URL and title
- Page purpose (1 sentence)
- Forms: field names, submit action, validation visible?
- Key buttons / CTAs
- Any error messages or empty states visible

**Stop early if:**
- The same content repeats (paginated list items, detail pages with different IDs)
- You've reached a clear boundary (external links, API endpoints, /admin behind extra auth)

---

### Phase 3: Analysis

After discovery, write a brief analysis before running any tests:

1. **App domain & purpose** (1–2 sentences)
2. **Primary user journeys** — what are users trying to accomplish?
3. **Critical paths (P0)** — which flows, if broken, would immediately stop users from getting value?
4. **Notable observations** — unusual patterns, error states, role-based UI, multi-step flows, real-time elements

Present this to the user and ask:
- "Does this match your understanding of the app?"
- "Any flows you want me to prioritize or skip?"

Wait for confirmation before proceeding to Phase 4.

---

### Phase 4: Test Execution

Execute scenarios directly in the browser. No code — just navigate, interact, observe, record.

**Execution pattern for each scenario:**
```
browser_navigate → starting page
browser_screenshot → starting state
<step-by-step interactions>
browser_screenshot → after each significant action
→ check: does outcome match expectation?
→ record: ✅ Pass or ❌ Fail + reason
```

**Scenario tiers to cover (P0 first, skip P2 if time is short):**

| Priority | Type | Example |
|----------|------|---------|
| P0 | Core happy path | User creates and completes the main action in the app |
| P0 | Auth boundary | Unauthenticated user is redirected to login, not shown protected content |
| P1 | Form validation | Required field left blank → appropriate error shown |
| P1 | Navigation completeness | All major nav sections reachable, no 404/500 |
| P2 | Empty state | Section with no data shows a helpful empty state, not a broken layout |
| P2 | Error handling | Action that fails (e.g., duplicate name) shows error, doesn't crash |

**Pass criteria:**
- Expected content or element is visible after the action
- No unintended error messages
- No redirect to login page mid-flow
- Form submission produces the expected outcome (success message, redirect, data visible)

**For every failure:**
- Take a screenshot of the failure state
- Note: what was the expected outcome? what actually happened?
- Rate severity: Critical (P0 broken) / High (P1 broken) / Medium / Low

**Mobile check (do at least one P0 scenario):**
```
browser_resize → 375 × 812
<repeat P0 scenario>
browser_screenshot
browser_resize → 1440 × 900   ← restore after
```

---

### Phase 5: Report

Save findings to `.opentest-workspace/e2e/report-<YYYY-MM-DD>.md`.

```markdown
# E2E Test Report

**App:** <URL>
**Date:** <YYYY-MM-DD>
**Pages Discovered:** N
**Scenarios Run:** N  |  ✅ Pass: N  |  ❌ Fail: N

---

## Site Map

| URL | Purpose | Key Elements |
|-----|---------|-------------|
| /dashboard | Main project list | New Project button, activity feed |
| ... | ... | ... |

---

## Issues Found

### 🔴 [CRITICAL] <Issue title>
- **URL:** ...
- **Steps to reproduce:** ...
- **Expected:** ...
- **Actual:** ...

### 🟠 [HIGH] <Issue title>
...

### 🟡 [MEDIUM] <Issue title>
...

---

## Test Results

| Scenario | Priority | Status | Notes |
|----------|----------|--------|-------|
| User creates first project | P0 | ✅ Pass | |
| Form submit with empty name | P1 | ❌ Fail | No error message shown |
| ... | | | |

---

## Coverage

**Tested:** N of N discovered pages
**Not tested:** <list any areas skipped and why>
**Suggested follow-up:** <anything that needs deeper investigation or credentials not available>
```

After saving the report, present a short summary to the user:
- Total issues found (by severity)
- Most critical finding
- Path to the saved report file
