# Finance Doctor

An AI-powered personal finance advisor built for Australian households. Track tax deductions, manage a family investment portfolio, and get personalised advice from "Dr Finance" — powered by Google Gemini on Vertex AI.

## Features

### Tax Health Check

- Log tax-deductible expenses across 10 ATO-aligned categories (Work from Home, Vehicle & Travel, Self-Education, etc.)
- Filter by Australian financial year (FY 2023-24 through 2025-26)
- Summary cards: total deductions, categories used, expenses logged
- Category breakdown with progress bars

### Family Portfolio

- Track investments across 9 asset types: Australian Shares, International Shares, ETFs, Property, Cryptocurrency, Bonds, Cash/Term Deposits, Superannuation, and Other
- **Family member management** — add household members with their annual salary to calculate marginal tax brackets
- **Investment ownership** — assign each investment to a family member for per-person CGT analysis
- Type-specific fields: units/buy price (shares), mortgage/rental income (property), interest rate (cash), coupon rate (bonds), employer contribution (super)
- Portfolio health score based on diversification, concentration risk, and super allocation

### Dr Finance AI Advisor

- Streaming AI advice powered by **Gemini 2.5 Flash** via Vertex AI
- Uses the "doctor" metaphor: Diagnosis (what it observes) and Prescription (what to do)
- **Tax advice**: assesses deduction claims, flags audit risks, suggests missed categories, references ATO rules
- **Investment advice**: analyses diversification, per-member CGT impact based on marginal tax rates, income-splitting strategies, super optimisation
- **Conversational follow-ups** — ask Dr Finance follow-up questions with full conversation context
- **Persistent chat history** — conversations are saved to Firestore and restored on page load
- Collapsible advice panel to manage screen space
- Responses formatted as styled HTML with headings, lists, and status badges

### Dashboard

- At-a-glance summary: total deductions, portfolio value, gain/loss, allocation, and health scores
- Top deduction categories and investment holdings

### Settings

- Google profile display
- Last successful build timestamp
- Sign out

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, standalone output) |
| Language | TypeScript (strict mode) |
| UI | Bootstrap 5, SASS, FontAwesome |
| Auth | NextAuth v5 (Google OAuth) |
| Database | Cloud Firestore (firebase-admin) |
| AI | Vertex AI — Gemini 2.5 Flash |
| Charts | ApexCharts |
| Runtime | Node.js 22 (Alpine) |
| Hosting | Google Cloud Run (australia-southeast1) |
| CI/CD | GitHub Actions |
| Container Registry | Google Artifact Registry |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── login/                      # Google OAuth login
│   ├── tax/                        # Tax deductions page
│   ├── investments/                # Family portfolio page
│   ├── settings/                   # Settings page
│   └── api/
│       ├── auth/[...nextauth]/     # NextAuth handlers
│       ├── expenses/               # Expense CRUD
│       ├── investments/            # Investment CRUD
│       │   └── advice/             # Gemini investment advice (streaming)
│       ├── family-members/         # Family member CRUD
│       ├── advice-chat/            # Chat history persistence
│       └── tax/advice/             # Gemini tax advice (streaming)
├── lib/
│   ├── firestore.ts                # Firestore client initialisation
│   ├── gemini.ts                   # Vertex AI model setup
│   ├── prompts.ts                  # System prompts and prompt builders
│   ├── auth-helpers.ts             # Auth utilities
│   └── types.ts                    # TypeScript interfaces
├── components/                     # Reusable UI components
├── config/                         # App menu and theme settings
└── styles/                         # SCSS themes (apple, material, etc.)
```

## Data Model

```
Firestore: users/{email}/
├── expenses/{id}          → { date, description, amount, category, financialYear }
├── investments/{id}       → { name, type, owner?, currentValue, costBasis, units?, ... }
├── family-members/{id}    → { name, salary }
└── advice-chats/{type}    → { history: [{ role, text }], updatedAt }
```

## Getting Started

### Prerequisites

- Node.js 22+
- A Google Cloud project with Firestore and Vertex AI APIs enabled
- Google OAuth credentials

### Local Development

```bash
# Install dependencies
npm install

# Create SCSS symlinks (required for theme styles)
for dir in src/styles/default src/styles/apple src/styles/facebook \
           src/styles/google src/styles/material src/styles/transparent; do
  ln -s "$PWD/node_modules" "$dir/node_modules" 2>/dev/null || true
done

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Start dev server (Turbopack)
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `AUTH_SECRET` | Yes | NextAuth session encryption key |
| `AUTH_URL` | Production | Full URL of the app (e.g. `https://your-app.run.app`) |
| `GOOGLE_CLOUD_PROJECT` | Production | GCP project ID (auto-detected on Cloud Run) |
| `GEMINI_MODEL` | No | Gemini model name (default: `gemini-2.5-flash`) |
| `GEMINI_REGION` | No | Vertex AI region (default: `us-central1`) |

### Scripts

```bash
npm run dev       # Start dev server with Turbopack
npm run build     # Production build
npm start         # Start production server
npm run lint      # Run ESLint
npm test          # Run Jest tests
```

## Deployment

The app deploys automatically to **Google Cloud Run** on every push to `master` via GitHub Actions.

### CI/CD Pipeline

**CI** (`.github/workflows/ci.yml`):
- Builds the project
- Runs tests with coverage
- Uploads to Codecov

**Build & Deploy** (`.github/workflows/deploy.yml`):
1. Authenticates via Workload Identity Federation
2. Builds a multi-stage Docker image (`node:22-alpine`)
3. Pushes to Artifact Registry (`australia-southeast1-docker.pkg.dev`)
4. Deploys to Cloud Run with zero-downtime revision rollout

### Cloud Run Configuration

- **Min instances**: 0 (scale to zero)
- **Max instances**: 3
- **CPU**: 1 vCPU (throttled — allocated only during requests)
- **Memory**: 512 MiB
- **Startup CPU boost**: enabled
- **Concurrency**: 80 requests per instance

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `WIF_PROVIDER` | Workload Identity Federation provider |
| `SA_EMAIL` | Deployer service account email |
| `CODECOV_TOKEN` | Codecov upload token |

## Infrastructure

All infrastructure (Cloud Run service, Artifact Registry, IAM, secrets) is managed via Terraform in a separate `platform-infra` repository. Do not create infrastructure resources directly via `gcloud` CLI.

## License

Private repository. All rights reserved.
