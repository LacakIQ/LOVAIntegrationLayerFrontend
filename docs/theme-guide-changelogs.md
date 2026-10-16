# Theme Guide Changelogs — Architecture, Known Issues & Revision History

**Target route**: `/settings/theme-guide`
**Source files**:
- `src/views/ThemeGuideView.tsx`

**Related global index**: [`docs/project-changelogs.md § 2026-09-23`](project-changelogs.md#2026-09-23)

---

## Architecture & Technical Invariants

### Role of the Theme Guide

This file is the **Source of Truth** for all visual UI patterns in the project, as mandated by `AGENTS.md` § Project-Specific Conventions → UI Patterns:
> *Visual reference (source of truth) for all screens: src/views/ThemeGuideView.tsx → route /settings/theme-guide.*

Every component/pattern inside ThemeGuideView must match exactly what new views and forms should use. Any divergence here propagates to every new screen.

### Patterns Documented

The ThemeGuideView MUST demonstrate the following patterns (with working interactive examples, not placeholder text):

| Section | Patterns shown |
|---------|---------------|
| Top page card | `STYLES.pageCard`, `STYLES.sectionHeaderKicker`, H2, paragraph subtitle, 3-col `KeyValueRow` grid |
| Dynamic banner | `STYLES.bannerSuccess`, `.bannerWarning`, `.bannerDanger`, `.bannerInfo` wired to every interactive element |
| Typography | Label/Kicker + headline + subtitle + `<Link>`, inline emphasis with `font-semibold`, inline `code`, all 5 `Badge` tones |
| Buttons | Primary / Secondary / Danger / Ghost / Disabled (each fires banner on click) |
| SubTabs → Form Layout | Icon-input (`Mail`), select (`inputMuted`), radio cards for 3 options, md-col-span-2 textarea, top-aligned checkbox + helper, CTA row with Loading spinner (`Loader2`), required-field validation banners, error-state input card, compact info blocks with icons |
| SubTabs → Table + Actions | Kicker+headline/CTA header, rounded-3xl bordered table with gray-50 thead, Status Badges, right-aligned Actions column with ghost+secondary buttons |
| SubTabs → Status UI | 4 semantic icon-banners, status-strip 4-badge row, access-reminder icon card |
| Modal Section + Modal trigger | Section kicker "Modal" describing header-actions pattern; opens a full fixed-overlay modal with: header-top-right Cancel+Confirm, header-row validation banner spacer, body Name input with helper, gray-50 note panel |

### Invariants vs. the DSS project's ThemeGuideView

- **Intentional delta of ~82 lines**: DSS duplicates inline definitions of `STYLES.*`, `Badge`, `Section`, `KeyValueRow`, and a second copy of `SubTabs` directly inside its ThemeGuideView file. CMSFrontend already exports all four from a central `src/components/ui/STYLES.tsx` plus a `src/components/SubTabs.tsx`, so we import those instead of duplicating. This is a **strict superset** of the visual output.
- **CMS-appropriate values**: Company dropdown uses `PT CMS` / `PT Supplier` instead of DSS's `PT DSS` / `PT Supplier`. React Router `<Link>` points to `settings-theme-guide` (present in `APP_ROUTES`) instead of DSS's `settings-system-ui`.

---

### 2026-09-23.rev1 — Theme Guide brought to 100% DSS feature parity

**Scope**: `src/views/ThemeGuideView.tsx` (159 lines → 507 lines).

#### Changes

- **Interactive state hooks added** (was only `demoTab`):
  - `showModal` / `modalName` / `modalError` — modal shell state.
  - `banner: { tone, message } \| null` — page-level banner region above the first Section.
  - `formState: { fullName, email, company, notes, receiveUpdates, accessLevel }` — full demo-form state (6 fields).
  - `formError` / `submitting` — CTA status state.
  - `sampleTabs` — memoized.
- **4 handlers added**:
  - `handleSubmitDemoForm()` — async 600 ms delay, checks `fullName + email` required, on success shows success banner and clears error banner; on failure sets `formError` danger banner under the CTA. Submit button shows `Loader2` spinner while `submitting = true`.
  - `openModal()` — resets `modalName` + `modalError`, opens overlay.
  - `closeModal()` — closes + resets modal state.
  - `confirmModal()` — requires non-empty `modalName` or shows modal-level danger banner; on success closes and sets info banner with the name.
- **Dynamic banner region** added between the top theme metadata card and the Typography Section, with 4-tone coloring. Fires from every interactive button on the page:
  - Buttons section — Primary/Secondary → info banner; Danger → danger banner; Ghost → warning banner.
  - Form "Reset banners" → clears.
  - Submit sample form → success or danger.
  - Modal confirm → info.
- **Typography section expanded**: converted from 1 card → `md:grid-cols-2` grid. Right column now demonstrates inline emphasis + `code` spans + all 5 Badge tones.
- **Buttons section**: 5 buttons (Primary / Secondary / Danger / Ghost / Disabled) — each clickable with banner side effects.
- **SubTabs → Form Layout tab**: replaced single-line placeholder → 139-line working demo:
  - Info banner intro.
  - 2-col grid:
    - Full Name input + helper.
    - Email `iconInputWrap` with `Mail` icon (focus-within ring on wrapper, placeholder `name@company.com`).
    - Company `inputMuted` select with CMS values (Select… / PT CMS / PT Supplier).
    - Access Level radio cards in gray-50 bordered 3-option group.
    - Notes md-col-span-2 textarea, 4 rows.
  - CTA row in gray-50 rounded-2xl with:
    - Top-aligned "Receive update emails" checkbox + helper text block.
    - Buttons row: "Reset banners" (secondary) + "Submit sample form" (primary with inline `Loader2` spinner when submitting).
  - Form-level danger banner below CTA when `formError` set.
  - 2-card grid below that: Input error state card (red-bordered input + inline red error text); Compact info blocks card with Info-icon note + Copy-icon note.
- **SubTabs → Table + Actions tab**: Header now has an "Open modal example" Primary button wired to `openModal()`. Table demonstrates status badges with success/warning/neutral tones.
- **SubTabs → Status UI tab**: Expanded from 8 lines → 49 lines with `md:grid-cols-2`:
  - Semantic banners card with 4 icon banners (Info / Success / Warning / Danger).
  - Status strip card: 4-badge row + amber `ShieldAlert` access reminder card.
- **Modal section + full Modal overlay**: Added Section with kicker "Modal" describing the header-actions pattern. Trigger button: "Open modal" inside a gray-50 rounded-2xl card.
- **Full Modal component (63 lines)**: fixed-overlay `bg-gray-950/50` backdrop with centered max-w-2xl panel. Header bar has the Cancel/Confirm buttons in the **top-right corner** (as required by `docs/ui-modal-guidelines.md`). Header validation row shows the modal danger banner when present or a transparent spacer placeholder when absent. Body: Name input + helper + gray-50 grouped note panel.
- **SubTabs call fix**: corrected prop names from the stub's old names (`activeTab`, `onTabChange`) → `active`, `setActive`, matching the actual `SubTabs` component signature.

#### Found Bugs

- **BUG-TG-01 — CRITICAL — SubTabs prop-name mismatch caused tab switching to break completely.** The old stub was calling `<SubTabs tabs={sampleTabs} activeTab={demoTab} onTabChange={setDemoTab} />` but the component exposes props `active` and `setActive`. Clicking "Table + Actions" or "Status UI" had no visual effect; the Form tab was permanently stuck. Reproduction: click any non-first tab → content never changes.
- **BUG-TG-02 — HIGH — Table + Actions tab contained only placeholder text.** The "source of truth" for table layouts showed a single `p.text-gray-500` paragraph. No project contributor could copy a working table pattern; this violated the ThemeGuideView's documented role as the UI pattern source of truth.
- **BUG-TG-03 — HIGH — Form Layout tab contained only placeholder text.** No inputs, no validation, no CTA, no error state reference. Contributors were left guessing how STYLES.input / iconInputWrap / radio cards / banners should be composed.
- **BUG-TG-04 — HIGH — No working Modal reference on the page.** AGENTS.md §122 mandates "Modals: Actions always in the modal header." There was no demo showing this pattern, making non-compliant footer-action modals very likely on new forms.
- **BUG-TG-05 — MEDIUM — No banner region / no banner firing from any button.** The STYLES.banner* constants existed but had no live demo in the source-of-truth page. The only way to find the right class was to grep the codebase for `bannerSuccess`.
- **BUG-TG-06 — LOW — Buttons section non-interactive / no Disabled demo.** The only button was a single static Primary with no onClick, making visual regression discovery of button states impossible from the guide alone.
- **BUG-TG-07 — LOW — Typography section omitted inline-emphasis and Badge row patterns.** No visual reference existed for `font-semibold` emphasis inside paragraphs or inline `<code>` styling, nor for the 5-tone Badge chips, despite those being widely used in production views.
- **BUG-TG-08 — LOW — Status UI tab was nearly empty.** Status banners + badge strips had no visual reference, despite being required patterns in the DSS twin project.

#### Fixes

- **FIX-TG-01** — Replaced call with signature-matching props: `<SubTabs tabs={sampleTabs} active={demoTab} setActive={setDemoTab} />`. Verified: all 3 tabs switch correctly; URL sync optional per AGENTS.md.
- **FIX-TG-02** — Implemented the complete "List with actions" table header, 3 sample rows (with user email, role, status badge), and a right-aligned Actions column with Ghost/Secondary buttons. Added "Open modal example" Primary button in the header actions row, wired to `openModal()`.
- **FIX-TG-03** — Built the 2-col form grid demo with: Full Name input + helper; Email icon-input with Mail icon; Company select; Access Level 3 radio cards; Notes textarea; CTA gray-50 panel with checkbox + helper, banner reset button, and submit button with spinner; validation success and danger banners; input error-state reference card; compact info-blocks card.
- **FIX-TG-04** — Added dedicated Modal Section explaining the header-actions pattern + full fixed-overlay modal with top-right Cancel/Confirm header buttons, validation banner row below header, and Name input + note body panel.
- **FIX-TG-05** — Added a 4-tone banner region between the metadata card and first Section; wired every clickable button (all 5 buttons section, submit form, reset banners, modal confirm) to fire the appropriate tone.
- **FIX-TG-06** — All 5 buttons now have click handlers. Added a Disabled Primary button example.
- **FIX-TG-07** — Typography section right column shows inline-emphasis paragraph with `code` style and all 5 badges in a flex-wrap row.
- **FIX-TG-08** — Status UI tab expanded to show 4 semantic icon banners (2-col grid left), 4 status-strip badges + amber access-reminder card with ShieldAlert icon (right).
