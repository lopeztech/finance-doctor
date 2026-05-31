# Finance Doctor — Design System

## 1. Brand & Context

**Product:** Finance Doctor — a personal financial advisor app for Australian households. Covers tax deduction tracking, investment portfolio analysis, and household cashflow management.

**Tone:** Calm, expert, trustworthy. Like a smart accountant who speaks plainly. Never alarmist. Uses the "doctor" metaphor throughout — diagnoses, prescriptions, and action plans.

**Aesthetic direction:** Modern fintech. Clean white surfaces, generous whitespace, a strong primary blue, and data-forward layouts. Feels like Wise or Linear — precise, professional, and frictionless. No gradients, no drop shadows on interactive elements, rounded but not bubbly.

**Current stack:** Next.js 16 (App Router), Bootstrap 5 SCSS, Font Awesome 6 icons. All UI work must stay within Bootstrap 5 conventions and extend via SCSS variables — do not introduce Tailwind or a separate component library.

---

## 2. Colour Palette

### Brand colours
| Token | Hex | Use |
|---|---|---|
| `$primary` / `$blue` | `#007AFF` | CTAs, active states, links, key data |
| `$indigo` | `#5856D6` | Investment / Financial pillar accent |
| `$teal` | `#58eaa1` | Cashflow pillar accent, positive indicators |
| `$green` / `$success` | `#4CD964` | Positive delta, healthy status |
| `$orange` / `$warning` | `#FF9500` | Tax pillar accent, caution states |
| `$red` / `$danger` | `#FF3B30` | Negative delta, alerts, over-budget |
| `$dark` | `#222222` | Primary text, headings |
| `$gray-600` | ~`#888` | Secondary text, labels |
| `$gray-100` | ~`#f0f0f0` | Page background, subtle panels |

### Semantic usage rules
- **Positive financial values** → `$success` (#4CD964)
- **Negative financial values** → `$danger` (#FF3B30)
- **Tax pillar** → `$warning` (#FF9500) for accents, badges
- **Cashflow pillar** → `$teal` (#58eaa1) for accents
- **Investment / Financial pillar** → `$indigo` (#5856D6) for accents
- **Neutral/stale** → `$secondary` (~`#888`)

---

## 3. Typography

**Base size:** 12px (`rem-default(12px)`). All sizing scales from this root.

| Scale | Size | Weight | Use |
|---|---|---|---|
| Page heading (`h1 .page-header`) | ~30px | 700 | Top of each module page |
| Panel heading | 14px | 600 | Card/panel section titles |
| Body | 12px | 400 | Default prose, labels |
| Small / `.small` | 10.5px | 400 | Supporting detail, timestamps, impact lines |
| Badge | 10px | 500 | Priority tags, pillar labels |
| Monospace figures | system mono | 500 | Currency values, percentages |

**Font stack:** System UI first — `system-ui, -apple-system, "Segoe UI", Roboto`. No custom web fonts. Currency and number figures should use `font-variant-numeric: tabular-nums` so they align in columns.

**Heading style:** Page headers use `.page-header` with a thin bottom border and small top margin. Keep them sentence-case, not ALL CAPS.

---

## 4. Spacing & Layout

**Grid:** Bootstrap 5 12-column. Content area is full-width within a fixed sidebar + header shell.

**App chrome:**
- Header height: 50px, dark (`#222`), white text
- Sidebar width: 220px (minified: 60px)
- Content padding: 20px

**Spacing scale (Bootstrap 5):**
- `mb-3` (1rem / 16px) — standard gap between panels
- `gap-2` (0.5rem) — within a row of badges or actions
- `px-0` on list-group items inside panels — flush to panel edges

**Panel anatomy:** Every data section lives in a `<Panel>` with `<PanelHeader>` + `<PanelBody>`. Headers are 14px/600 weight, have a single left-aligned icon, and optionally a right-aligned control (badge, button, toggle). No heavy border — just a subtle `border-bottom` on the header.

**Breakpoints:** Mobile-first. Cards stack vertically on `xs`, go 2-up on `md`, 3-up on `lg`. The advisor action plan is always full-width.

---

## 5. Components

### Panels
The primary container unit. Used for every data section.
```
<Panel>
  <PanelHeader noButton>
    <i className="fa fa-[icon] me-2" /> Section Title
    <span className="badge bg-dark ms-auto">count</span>
  </PanelHeader>
  <PanelBody> … </PanelBody>
</Panel>
```
Panel headers should never have a heavy background — they rely on a subtle bottom border only.

### Advisor Action Plan items
Each action item in the home page action plan has:
- A coloured icon badge on the left (16px, `bg-{color}`)
- A title (14px/600) + pillar badge + priority badge inline
- A `.small.text-muted` detail line below the title
- An impact line with a bullseye icon: `fa-bullseye me-1 text-muted`
- Either an inline button (for instant actions like "Save snapshot") or a right-arrow chevron for navigation

Priority badges: `bg-danger` = High, `bg-warning text-dark` = Medium, `bg-secondary` = Low/stale.
Pillar badges: light border style `bg-light text-dark border`.

### Doctor chat UI
AI advice is streamed as HTML into a `dangerouslySetInnerHTML` block. The HTML uses `<h4>` for Diagnosis/Prescription/Action Plan sections, `<ol>/<ul>` for recommendations, `<strong>` for key figures, and Bootstrap `badge` spans for status chips. Follow-up questions appear as a chat thread below.

### Priority / status badges
- Always use Bootstrap badge sizing (no custom sizes)
- Use `bg-{semantic-color}` not raw hex
- Pillar labels use the border-only style to avoid colour clutter alongside the priority badge

### Buttons
- Primary action: `btn btn-primary` (blue, white text)
- Secondary/outline: `btn btn-outline-{color}`
- Destructive: `btn btn-danger` or `btn btn-outline-danger`
- Small in-panel actions: `btn btn-sm`
- Icon-only actions: include a visually-hidden label or `title` attribute

### Currency display
- Always prefix `$` with no space
- Use `toLocaleString('en-AU', { minimumFractionDigits: 2 })` for full amounts
- Use `formatCurrency()` from `@/lib/format` — never raw `.toFixed(2)` in JSX
- Positive deltas: `text-success ▲`, negative: `text-danger ▼`, flat: `text-muted –`

### Charts
- ApexCharts via `react-apexcharts`
- Donut/pie for allocation breakdown
- Area/line for net worth trends
- Bar for category comparisons
- Chart colours should draw from the semantic palette above (indigo → investments, teal → cashflow, orange → tax)
- All charts: no title inside the chart; use the Panel header instead

---

## 6. Icons

Font Awesome 6 Free (`fa` prefix). Icons are always `<i className="fa fa-{name}">` — never SVG inline.

**Module icons:**
- Net Worth / Financial: `fa-chart-line`
- Tax: `fa-file-invoice-dollar`
- Cashflow: `fa-money-bill-wave`
- Investments: `fa-chart-bar`
- Doctor / AI advice: `fa-stethoscope`
- Action plan: `fa-list-check`
- Snapshot: `fa-camera`
- Concentration risk: `fa-chart-pie`

**State icons:**
- Warning / caution: `fa-triangle-exclamation`
- Success / healthy: `fa-circle-check`
- Spinner / loading: `fa-spinner fa-spin`
- Arrow (navigation): `fa-arrow-right`
- Bullseye (impact): `fa-bullseye`

---

## 7. Motion & Interaction

**Keep motion minimal.** This is a data app, not a marketing site.

- Loading states: Bootstrap spinner (`fa-spinner fa-spin`) inline with button text. No full-page skeletons.
- Streaming AI text: updates in-place via React state. No animation on text chunks.
- Toasts: Bootstrap toast, position `top-end`, auto-dismiss after 4 s.
- No page transition animations.
- Hover states on interactive rows: Bootstrap's built-in `table-hover` or `list-group-item-action` — no custom hover effects.

---

## 8. Dark Mode

The app shell supports a dark mode toggle (via the existing SCSS theme system). Dark mode swaps:
- Page bg: `#111` (`$dark-darker`)
- Panel bg: `#1a1a1a`
- Border colour: `rgba(255,255,255,0.08)`
- Text: `#f0f0f0` primary, `#888` secondary

All colour tokens should reference CSS variables (`var(--bs-*)`) in component-level styles so dark mode works without overrides.

---

## 9. Voice & Microcopy

- **Doctor metaphor is pervasive but light.** Sections are called "Health Assessment", "Diagnosis", "Prescription", "Action Plan" — not "Analysis" or "Dashboard".
- **Pillar names:** Financial, Tax, Cashflow. Always title-case. Never "finances" or "money".
- **Australian English throughout.** "Categorise" not "Categorize", "colour" not "color", dollar amounts in AUD.
- **Numbers:** Compact format for large values in summary cards (`$1.2M`, `$45K`). Full format in tables and detail views.
- **Avoid jargon** unless followed immediately by a plain-English gloss. "CGT (Capital Gains Tax)" on first use.
- **Empty states** should invite action, not apologise. "Add your first investment to get started" not "No investments found."
- **Error messages** use the doctor voice: "We couldn't reach the server — check your connection and try again." Not "Error 500."
