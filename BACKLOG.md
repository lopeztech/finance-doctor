# Finance Doctor — Backlog

## Phase 1: Data Persistence (GCP Firestore)
Store user data so it survives across sessions and devices.

- [ ] **Add Firestore to platform-infra** — enable Firestore API, create database, grant runtime SA access
- [ ] **User data model** — design Firestore collections: `users/{uid}/expenses`, `users/{uid}/investments`
- [ ] **Save expenses to Firestore** — persist on add/remove, load on page visit
- [ ] **Save investments to Firestore** — persist on add/remove, load on page visit
- [ ] **Link auth to Firestore** — use Google OAuth UID as Firestore document key
- [ ] **Loading states** — show skeleton/spinner while fetching data from Firestore

## Phase 2: Gemini-Powered Advice
Replace static rule-based assessments with Gemini AI analysis.

- [ ] **Enable Vertex AI API** — add to platform-infra, store API key in Secret Manager
- [ ] **Tax advice API route** — `/api/tax/advice` sends expense data to Gemini, returns personalised tax strategy
- [ ] **Investment advice API route** — `/api/investments/advice` sends portfolio data to Gemini, returns allocation and strategy recommendations
- [ ] **Prompt engineering** — craft system prompts for Australian tax context (ATO rules, CGT, negative gearing, super contributions, EOFY strategies)
- [ ] **Streaming responses** — stream Gemini responses for better UX on longer analyses
- [ ] **Replace static health assessment** — swap hardcoded diagnosis/prescription with Gemini-generated advice panel
- [ ] **Conversation follow-up** — allow user to ask follow-up questions about the advice ("What if I salary sacrifice $500/month?")

## Phase 3: Smarter Data Input
Reduce manual data entry.

- [ ] **CSV/Excel import for expenses** — upload bank statement or accounting export, auto-map columns
- [ ] **Gemini auto-categorisation** — send expense descriptions to Gemini to auto-assign ATO categories
- [ ] **Receipt scanning** — upload receipt photo, Gemini extracts date/amount/description
- [ ] **Bulk edit expenses** — select multiple, change category, delete
- [ ] **Recurring expenses** — mark an expense as recurring, auto-populate future months
- [ ] **Live share prices** — fetch current prices for ASX/US tickers via API to auto-update portfolio values

## Phase 4: Dashboard & Reporting
Make the dashboard more useful.

- [ ] **Dashboard summary widgets** — total deductions YTD, portfolio gain/loss, health scores
- [ ] **Tax estimate calculator** — input gross income, calculate estimated tax refund/liability based on logged deductions
- [ ] **Year-over-year comparison** — compare deductions and portfolio across financial years
- [ ] **Export to PDF** — generate a summary report for accountant or personal records
- [ ] **Charts** — pie chart for asset allocation, bar chart for deductions by category, line chart for portfolio value over time

## Phase 5: Production Hardening
Get the app production-ready.

- [ ] **Custom domain** — move Cloud Run to us-central1 for domain mapping, or add GCP load balancer
- [ ] **Add production OAuth redirect URIs** — update GCP OAuth client with production domain
- [ ] **Rate limiting** — protect Gemini API routes from abuse
- [ ] **Error boundaries** — graceful error handling on all pages
- [ ] **Audit logging** — log Gemini API calls and costs
- [ ] **Budget alerts** — set up GCP budget alerts for Gemini API spend
- [ ] **E2E tests** — Playwright tests for login flow, add expense, add investment
- [ ] **Mobile responsive** — verify and fix layout on mobile devices
