# Finance Doctor — Design System

## 1. Brand & Context

**Product:** Finance Doctor — a personal financial advisor app for Australian households. Covers tax deduction tracking, investment portfolio analysis, and household cashflow management.

**Tone:** Calm, expert, trustworthy. Like a smart accountant who speaks plainly. Never alarmist. Uses the "doctor" metaphor throughout — diagnoses, prescriptions, and action plans.

**Aesthetic direction:** Modern fintech. Clean surfaces, generous whitespace, a strong primary blue, and data-forward layouts. Feels like Wise or Linear — precise, professional, and frictionless. No gradients, no drop shadows on interactive elements, rounded but not bubbly.

**Current stack:** Next.js 16 (App Router), Bootstrap 5 SCSS, Font Awesome 6 icons. All UI work must stay within Bootstrap 5 conventions and extend via SCSS variables — do not introduce Tailwind or a separate component library.

---

## 2. Colour Palette

### SCSS variables (from `src/styles/default/_variables.scss`)
| Token | Hex | Bootstrap semantic |
|---|---|---|
| `$blue` / `$primary` | `#348fe2` | CTAs, active states, links, key data |
| `$indigo` | `#8753de` | Investment / Financial pillar accent |
| `$teal` / `$success` / `$theme` | `#00acac` | Cashflow pillar accent, positive indicators |
| `$green` | `#32a932` | Healthy status badges |
| `$orange` / `$warning` | `#f59c1a` | Tax pillar accent, caution states |
| `$red` / `$danger` | `#ff5b57` | Negative delta, alerts, over-budget |
| `$dark` / `$inverse` | `#2d353c` | Primary text, headings, panel theme |
| `$dark-darker` | `#1a2229` | Dark mode page background |
| `$gray-600` / `$secondary` | `#6c757d` | Secondary text, labels |
| `$gray-100` / `$light` | `#f8f9fa` | Page background, subtle panels |
| `$cyan` / `$info` | `#49b6d6` | International shares accent |

### Semantic usage rules
- **Positive financial values** → `text-success` (`$teal` `#00acac`)
- **Negative financial values** → `text-danger` (`$red` `#ff5b57`)
- **Tax pillar** → `$warning` (`#f59c1a`) for accents, badges
- **Cashflow pillar** → `$teal` (`#00acac`) for accents
- **Investment / Financial pillar** → `$indigo` (`#8753de`) for accents
- **Neutral / stale** → `$secondary` (`#6c757d`)

### Investment type → colour map (used in portfolio breakdown bars)
| Asset class | Bootstrap class |
|---|---|
| Australian Shares | `bg-primary` |
| International Shares | `bg-info` |
| ETFs | `bg-teal` |
| Bonds | `bg-warning` |
| Property | `bg-danger` |
| Cryptocurrency | `bg-orange` |
| Cash / Term Deposit | `bg-success` |
| Superannuation | `bg-indigo` |
| Other | `bg-secondary` |

### Tax category → chart colour map (used in deduction charts)
| Category | Hex |
|---|---|
| Work from Home | `#20c997` |
| Vehicle & Travel | `#0d6efd` |
| Clothing & Laundry | `#6f42c1` |
| Self-Education | `#fd7e14` |
| Tools & Equipment | `#6610f2` |
| Professional Memberships | `#0dcaf0` |
| Phone & Internet | `#198754` |
| Donations | `#dc3545` |
| Investment Expenses | `#ffc107` |
| Investment Property | `#795548` |
| Other Deductions | `#6c757d` |

---

## 3. Typography

**Font:** Open Sans (Google Fonts). Loaded via `next/font/google` with weights 300, 400, 600, 700.

**Base size:** 12px. All sizing scales from this root.

| Scale | Size | Weight | Use |
|---|---|---|---|
| Page heading (`h1 .page-header`) | ~30px | 700 | Top of each module page |
| Panel heading | 14px | 600 | Card/panel section titles |
| Body | 12px | 400 | Default prose, labels |
| Small / `.small` | 10.5px | 400 | Supporting detail, timestamps, impact lines |
| Badge | 10px | 500 | Priority tags, pillar labels |
| Monospace figures | system mono | 500 | Currency values, percentages |

**Heading style:** Page headers use `.page-header` with a thin bottom border and small top margin. Sentence-case, not ALL CAPS.

**Numbers:** Use `font-variant-numeric: tabular-nums` on currency/percentage columns so figures align.

---

## 4. Spacing & Layout

**Grid:** Bootstrap 5 12-column. Content area is full-width within a fixed sidebar + header shell.

**App chrome:**
- Header height: 50px, dark (`#2d353c` inverse theme), white text
- Sidebar width: 220px (minified: 60px)
- Content padding: 20px

**Spacing scale (Bootstrap 5):**
- `mb-3` (1rem / 16px) — standard gap between panels
- `gap-2` (0.5rem) — within a row of badges or actions
- `px-0` on list-group items inside panels — flush to panel edges

**Panel anatomy:** Every data section lives in a `<Panel>` (default `theme="inverse"`) with `<PanelHeader>` + `<PanelBody>`. Headers are 14px/600 weight, have a single left-aligned icon, and optionally a right-aligned control (badge, button, toggle). No heavy border — just a subtle `border-bottom` on the header.

**Breakpoints:** Mobile-first. Cards stack vertically on `xs`, go 2-up on `md`, 3-up on `lg`. The advisor action plan is always full-width.

---

## 5. Navigation

Seven pages, defined in `src/config/app-menu.tsx`:

| Path | Icon | Label |
|---|---|---|
| `/` | `fa-user-doctor` | Financial Advisor |
| `/tax` | `fa-file-invoice-dollar` | Tax Advisor |
| `/cashflow` | `fa-water` | Cashflow Advisor |
| `/investments` | `fa-chart-line` | Investments |
| `/expenses` | `fa-wallet` | Spending Data |
| `/budgets` | `fa-gauge-high` | Budgets |
| `/settings` | `fa-cog` | Settings |

---

## 6. Components

### Panels
The primary container unit. Default theme is `inverse` (dark heading, white body).
```tsx
<Panel>
  <PanelHeader noButton>
    <i className="fa fa-[icon] me-2" /> Section Title
    <span className="badge bg-dark ms-auto">count</span>
  </PanelHeader>
  <PanelBody> … </PanelBody>
</Panel>
```
`noButton` suppresses the expand/reload/collapse/remove controls. Use it on all data panels.

### Summary stat cards
The home page opens with a 4-column row of coloured stat cards (full-bleed, no border):
```tsx
<div className="card border-0 bg-teal text-white mb-3">
  <div className="card-body">
    <div className="text-white text-opacity-75 mb-1">Label</div>
    <h3 className="text-white mb-0">{value}</h3>
  </div>
</div>
```
Standard card colours: `bg-teal` (portfolio), `bg-success`/`bg-danger` (gain/loss), `bg-dark` (tax), `bg-indigo` (categories).

### Advisor Action Plan items
Each action item in the home page action plan has:
- A coloured icon badge on the left (`badge bg-{color}` with an `<i>` inside)
- A title (14px/600) + pillar badge + priority badge inline
- A `.small.text-muted` detail line below the title
- An impact line: `<i className="fa fa-bullseye me-1 text-muted"></i>{impact}`
- Either an inline button (for instant actions like "Save snapshot") or a right-arrow chevron for navigation

Priority badges: `bg-danger` = High, `bg-warning text-dark` = Medium, `bg-secondary` = Low/stale.
Pillar badges: border-only style `bg-light text-dark border`.
Stale doctor assessments (>30 days old): priority bumps to Medium, icon colour becomes `secondary`.

### Doctor chat UI
AI advice is streamed as HTML into a `dangerouslySetInnerHTML` block. The HTML uses `<h4>` for Diagnosis/Prescription/Action Plan sections, `<ol>/<ul>` for recommendations, `<strong>` for key figures, and Bootstrap `badge` spans for status chips. Follow-up questions appear as a chat thread below.

Doctor assessment staleness: `assessmentAge(savedAt)` returns `stale: true` when `days > 30`.

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
- Always prefix `$` with no space (AUD locale)
- Use `formatCurrency(amount, prefs)` from `@/lib/format` — never raw `.toFixed(2)` in JSX
- Default output is 0 decimal places; pass `{ decimals: 2 }` for full amounts
- Positive deltas: `text-success ▲`, negative: `text-danger ▼`, flat: `text-muted –`
- `deltaBadge(delta)` returns `{ className, arrow }` for consistent delta display

### Progress bar rows (allocation and category breakdowns)
```tsx
<div className="progress" style={{ height: '3px' }}>
  <div className="progress-bar bg-primary" style={{ width: `${pct}%` }} />
</div>
```
Use 3–4px height for sparkline-style bars inside list items. Full-height bars (`height: 4`) for standalone allocation panels.

### Charts
- ApexCharts via `react-apexcharts`
- Donut/pie for allocation breakdown
- Area/line for net worth trends
- Bar for category comparisons
- Chart colours draw from the semantic palette (indigo → investments, teal → cashflow, orange → tax)
- All charts: no title inside the chart; use the Panel header instead

---

## 7. Icons

Font Awesome 6 Free (`fa` prefix). Icons are always `<i className="fa fa-{name}">` — never SVG inline.

**Navigation icons:**
- Financial Advisor: `fa-user-doctor`
- Tax Advisor: `fa-file-invoice-dollar`
- Cashflow Advisor: `fa-water`
- Investments: `fa-chart-line`
- Spending Data: `fa-wallet`
- Budgets: `fa-gauge-high`

**Module icons:**
- Net Worth / Financial summary: `fa-scale-balanced`
- Portfolio composition: `fa-chart-bar`
- Concentration risk: `fa-chart-pie`
- Snapshot / camera: `fa-camera`
- Doctor / AI advice: `fa-stethoscope`
- Action plan: `fa-list-check`
- Liabilities: `fa-credit-card`
- Tax estimate: `fa-calculator`
- Household members: `fa-users`

**Tax deduction category icons:**
| Category | Icon |
|---|---|
| Work from Home | `fa-house-laptop` |
| Vehicle & Travel | `fa-car` |
| Clothing & Laundry | `fa-shirt` |
| Self-Education | `fa-graduation-cap` |
| Tools & Equipment | `fa-tools` |
| Professional Memberships | `fa-id-card` |
| Phone & Internet | `fa-mobile-alt` |
| Donations | `fa-hand-holding-heart` |
| Investment Expenses | `fa-piggy-bank` |
| Investment Property | `fa-building` |
| Other Deductions | `fa-receipt` |

**Investment type icons:**
| Type | Icon |
|---|---|
| Australian Shares | `fa-chart-bar` |
| International Shares | `fa-globe` |
| ETFs | `fa-layer-group` |
| Bonds | `fa-file-contract` |
| Property | `fa-building` |
| Cryptocurrency | `fa-bitcoin-sign` |
| Cash / Term Deposit | `fa-university` |
| Superannuation | `fa-piggy-bank` |
| Other | `fa-wallet` |

**State icons:**
- Warning / caution: `fa-triangle-exclamation`
- Success / healthy: `fa-circle-check`
- Spinner / loading: `fa-spinner fa-spin`
- Arrow (navigation): `fa-arrow-right`
- Bullseye (impact): `fa-bullseye`
- Uncategorised: `fa-file-circle-question`
- Assignment needed: `fa-user-tag`
- Search for deductions: `fa-magnifying-glass-dollar`

---

## 8. Motion & Interaction

**Keep motion minimal.** This is a data app, not a marketing site.

- Loading states: Bootstrap spinner (`fa-spinner fa-spin`) inline with button text. No full-page skeletons.
- Streaming AI text: updates in-place via React state. No animation on text chunks.
- Toasts: Bootstrap toast, position `top-end`, auto-dismiss after 4 s.
- No page transition animations.
- Hover states on interactive rows: Bootstrap's built-in `table-hover` or `list-group-item-action` — no custom hover effects.

---

## 9. Dark Mode

The app shell supports a dark mode toggle (via the existing SCSS theme system). Dark mode swaps:
- Page bg: `#1a2229` (`$dark-darker`)
- Panel bg: `#2d353c` (`$dark`)
- Border colour: `rgba(255,255,255,0.08)`
- Text: `#f0f0f0` primary, `#6c757d` secondary

All colour tokens should reference CSS variables (`var(--bs-*)`) in component-level styles so dark mode works without overrides.

---

## 10. Voice & Microcopy

- **Doctor metaphor is pervasive but light.** Sections are called "Health Assessment", "Diagnosis", "Prescription", "Action Plan" — not "Analysis" or "Dashboard".
- **Page names:** "Financial Advisor", "Tax Advisor", "Cashflow Advisor". Advisor suffix on the three diagnostic pages.
- **Pillar names:** Financial, Tax, Cashflow. Always title-case. Never "finances" or "money".
- **Australian English throughout.** "Categorise" not "Categorize", "colour" not "color", dollar amounts in AUD.
- **Numbers:** Compact format for large values in summary cards (`$1.2M`, `$45K`). Full format in tables and detail views.
- **Avoid jargon** unless followed immediately by a plain-English gloss. "CGT (Capital Gains Tax)" on first use.
- **Empty states** should invite action, not apologise. "Add your first investment to get started" not "No investments found."
- **Error messages** use the doctor voice: "We couldn't reach the server — check your connection and try again." Not "Error 500."
- **Disclaimer line** on tax estimates: "This is not tax advice — consult your accountant."
