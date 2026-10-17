# UX Evaluation Heuristics

Reference for Phase 4 evaluation. Use this checklist per page/state.

---

## Nielsen's 10 Usability Heuristics

### #1 Visibility of System Status
Keep users informed about what is going on through appropriate feedback within reasonable time.

**Check for:**
- Loading indicators when processing takes >1 second
- Progress indicators for multi-step flows (wizard, upload, checkout)
- Current location highlighted in navigation
- Form submission feedback (success/error message, not just a redirect)
- Background operation status (sync, save, import)

**Red flags:** Buttons that do nothing visible when clicked; blank screen after action; no progress bar on long operations.

---

### #2 Match Between System and Real World
Use words, phrases, and concepts familiar to the user — not system-oriented language.

**Check for:**
- Labels use the user's vocabulary (not internal/technical terms)
- Icons are universally understood or have labels
- Metaphors match real-world mental models (e.g., "Archive" not "Soft-delete")
- Date/number formats match user locale
- Error messages in plain language, not error codes

**Red flags:** "Entity", "Record", "Node", "CRUD" exposed in UI; cryptic error codes; jargon without explanation.

---

### #3 User Control and Freedom
Users often choose functions by mistake and need a clearly marked "emergency exit."

**Check for:**
- Undo/redo available for destructive actions
- Cancel button on dialogs and multi-step flows
- Back navigation works as expected
- Confirmations before irreversible actions (delete, publish, send)
- Easy way to dismiss modals (Escape key, click outside, X button)

**Red flags:** Destructive actions with no confirmation; no way to exit a modal except completing it; browser back button breaks the app.

---

### #4 Consistency and Standards
Users should not have to wonder whether different words, situations, or actions mean the same thing.

**Check for:**
- Same action uses same label throughout (not "Save" here and "Submit" there for the same operation)
- Visual treatment of same-type elements is consistent (all primary CTAs look the same)
- Navigation placement consistent across pages
- Icon usage consistent (same icon always means same thing)
- Platform conventions followed (links look like links, buttons look like buttons)

**Red flags:** Two buttons that do the same thing with different labels; different visual styles for the same component type; navigation that changes between pages.

---

### #5 Error Prevention
Design carefully to prevent problems from occurring in the first place.

**Check for:**
- Constraints on inputs (date pickers instead of free text, dropdowns for finite options)
- Inline validation before submission (not only after submit)
- Confirmation step for irreversible or high-stakes actions
- Smart defaults that reduce chance of user error
- Disabled state with explanation for unavailable actions

**Red flags:** Free-text field where format is strict (phone, date, email) without guidance; no validation until after submit; destructive action one click away with no confirmation.

---

### #6 Recognition Rather Than Recall
Minimize the user's memory load. Options, actions, and objects should be visible or easily retrievable.

**Check for:**
- Options visible in context (not hidden behind keyboard shortcut or right-click only)
- Recently used items surfaced
- Search with suggestions/autocomplete
- Form field labels always visible (not placeholder-only)
- Contextual help/tooltips for non-obvious options

**Red flags:** Labels that disappear when user starts typing (placeholder as only label); required knowledge not provided in the UI; no way to find previous actions or items.

---

### #7 Flexibility and Efficiency of Use
Accelerators allow expert users to speed up interaction without impeding novices.

**Check for:**
- Keyboard shortcuts for power users
- Bulk actions for repetitive tasks
- Saved/recent searches or filters
- Customizable workspace or views
- API or export for advanced use cases

**Note:** Less critical for simple consumer apps; more critical for productivity tools, dashboards, or B2B SaaS.

---

### #8 Aesthetic and Minimalist Design
Dialogues should not contain irrelevant or rarely needed information.

**Check for:**
- No competing CTAs of equal visual weight on a single page
- Information density appropriate for user context (don't show all data at once)
- Whitespace used to create visual breathing room
- Secondary information is visually secondary (smaller, lighter, less prominent)
- Decorative elements don't compete with functional elements

**Red flags:** 3+ primary-style buttons on one screen; cluttered forms with too many fields; dashboard with 20 widgets of equal visual prominence.

---

### #9 Help Users Recognize, Diagnose, and Recover from Errors
Error messages should be expressed in plain language, precisely indicate the problem, and constructively suggest a solution.

**Check for:**
- Error messages explain what went wrong (not just "Error" or "Something went wrong")
- Error messages suggest how to fix it
- Errors displayed near the element that caused them
- Error state is visually distinct (color, icon)
- After error, form state is preserved (user doesn't lose their input)

**Red flags:** Generic "An error occurred" with no detail; error shown at top of page but element is at bottom; form cleared after failed submit.

---

### #10 Help and Documentation
Even though it is better if the system can be used without documentation, help should be easy to search and focused on the user's task.

**Check for:**
- Onboarding for first-time users (empty states, tooltips, walkthroughs)
- Help accessible in context (not only in a separate help center)
- Helpful empty states (explain what goes here + action to fill it)
- Tooltips for icons without labels
- Documentation link accessible when needed

**Red flags:** Blank empty state with no explanation; icon-only buttons with no tooltip; no onboarding for complex features.

---

## Visual Design Evaluation Checklist

### Visual Hierarchy
- [ ] The primary CTA is visually dominant on each page (size, color, contrast)
- [ ] Content is scannable: headings, subheadings, body text are visually differentiated
- [ ] Related items are visually grouped (Gestalt: proximity)
- [ ] Important information appears before less important (F-pattern / Z-pattern for reading)

### Typography
- [ ] Body text ≥14px (≥16px preferred for consumer apps)
- [ ] Line length 50–75 characters for readability
- [ ] Sufficient contrast between text and background (at minimum eyeball-check; use a11y-test for WCAG numbers)
- [ ] No more than 2–3 font styles in use (weight/size variations are fine)

### Color
- [ ] Color is not the only differentiator (icons, labels, or patterns also used)
- [ ] Interactive elements have a distinct color not used for decorative elements
- [ ] Error state uses red/orange + an icon (not color alone)
- [ ] Brand colors used consistently

### Spacing & Layout
- [ ] Consistent spacing units used (not arbitrary pixel values — multiples of 4 or 8)
- [ ] Content has breathing room — not wall-to-wall
- [ ] Elements align to a grid (no random offsets)
- [ ] Responsive: no horizontal scroll at 375px width; tap targets ≥44×44px

### Interaction Design
- [ ] Hover/focus states visible on all interactive elements
- [ ] Loading states on async actions (buttons, fetching data)
- [ ] Disabled states are visually distinct and explain why (via tooltip or label)
- [ ] Transitions/animations are purposeful and not jarring (< 300ms for UI responses)

---

## Severity Assignment Guide

Use this to calibrate severity ratings:

| Severity | When to use |
|----------|-------------|
| 🔴 Critical | User cannot complete a primary task; data loss risk; blocking confusion |
| 🟠 High | User can complete task but with significant frustration or errors; many users affected |
| 🟡 Medium | Friction or confusion but workaround is obvious; affects subset of users or edge cases |
| 🔵 Low | Minor inconsistency or polish issue; most users won't notice |
| 💡 Suggestion | No current problem; proactive improvement idea |

**Calibration rule:** When in doubt, ask "Would a first-time user abandon the task because of this?" If yes → Critical or High. If they'd grumble but succeed → Medium. If they'd never notice → Low.
