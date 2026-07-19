# ARGUS - Agentic Regulatory Governance & Unified Simulation

**ARGUS** is an Agentic Regulatory Stress Testing Platform that converts SEBI circulars into operational intelligence. Instead of summarizing regulation or answering compliance questions, ARGUS continuously evaluates whether an organization is actually ready to comply — simulating the equivalent of a SEBI inspection before it happens.

> **Core Question:** *"If SEBI conducted an inspection tomorrow, how ready are we?"*

## Architecture

```
┌───────────────────────────┐
│  React + TypeScript +       │
│  Tailwind CSS Frontend      │
└──────────────┬──────────────┘
               │ REST / SSE
┌──────────────▼──────────────┐
│  FastAPI Backend            │
│  Auth · Orchestration API   │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  LangGraph Agent Graph      │
│  1. Regulation Intelligence │
│  2. Process Mapping         │
│  3. Regulatory Stress Test  │
│  4. Evidence Verification   │
│  5. ARGUS Advisor           │
└──────┬───────────────┬──────┘
       │               │
┌──────▼──────┐  ┌─────▼───────┐
│  ChromaDB   │  │ PostgreSQL  │
│ (embeddings)│  │ (structured)│
└─────────────┘  └─────────────┘
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | FastAPI (Python 3.11+) |
| Orchestration | LangGraph |
| RAG | LangChain + ChromaDB |
| LLM | Gemini (pluggable interface) |
| Database | PostgreSQL 15+ |
| Vector Store | ChromaDB |
| Auth | JWT (OAuth2 password/bearer) |
| Deployment | Docker Compose |

## Project Structure

```
argus/
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── components/       # Sidebar, Header, AdvisorPanel, WhyModal
│   │   ├── pages/            # Dashboard, Circulars, Obligations,
│   │   │                       Findings, RegulatoryReplay, ActionPlan,
│   │   │                       Reports, Settings, Login
│   │   ├── services/         # API client (axios)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── App.tsx, main.tsx
│   │   └── index.css
│   ├── public/               # Static assets
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── .env.example
├── backend/                  # FastAPI backend
│   ├── main.py               # FastAPI entry point
│   ├── api/
│   │   └── routes/           # All API endpoints (16 route modules)
│   ├── agents/
│   │   └── langgraph_agents.py
│   ├── database/
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── connection.py     # DB connection & session
│   │   └── config.py         # Settings
│   ├── schemas/
│   │   └── schemas.py        # Pydantic models
│   ├── services/
│   │   ├── seed.py           # Demo data generation
│   │   ├── rri_calculator.py # RRI scoring engine
│   │   ├── document_parser.py
│   │   ├── regulatory_replay.py
│   │   └── stress_test.py
│   ├── rag/                  # RAG utilities
│   ├── utils/                # Shared utilities
│   ├── migrations/
│   │   └── init.sql          # Schema initialization
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── docs/                     # Design & planning documents
│   ├── PRD.pdf
│   ├── TRD.pdf
│   ├── UIUX.pdf
│   ├── BackendSchema.pdf
│   ├── AppFlow.pdf
│   └── ImplementationPlan.pdf
├── docker-compose.yml        # Full stack orchestration
├── .env.example              # Root environment template
├── .gitignore
├── README.md
└── LICENSE
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

### Option 1: Docker Compose (Recommended)

```bash
cd argus
cp .env.example .env
# Edit .env to add your GEMINI_API_KEY
docker compose up --build
```

This starts:
- **Frontend** at http://localhost:5173
- **Backend API** at http://localhost:8000
- **PostgreSQL** at localhost:5432
- **ChromaDB** at localhost:8001

### Option 2: Local Development

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your keys
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Demo Login
- **Email:** `compliance@argus.demo`
- **Password:** `compliance123`

### API Documentation
Once running, visit: http://localhost:8000/docs (Swagger UI)

## Demo Data

The system auto-seeds realistic demo data on first startup:

| Metric | Value |
|--------|-------|
| Organization | Team Rocket Securities Ltd. |
| Departments | 5 (Risk, IT Security, Compliance, Operations, HR) |
| Users | 2 (admin, compliance officer) |
| Policies | 6 (Risk, Cybersecurity, Trading, KYC, AML, Insider) |
| Circulars | 1 (SEBI CIR/ISD/2025/045) |
| Obligations | 8 (all confirmed) |
| Findings | 5 (2 High, 2 Medium, 1 Low) |
| **RRI Score** | **82.0** |
| RRI Trend | 78.0 → 80.5 → 82.0 |
| Action Items | 5 (auto-generated) |
| Regulatory Replays | 2 (complete causal chains) |

## Core Features

### Phase 1: Authentication & Organization
- JWT-based auth with role-based access control
- Demo organization pre-seeded
- Departments and user management

### Phase 2: Dashboard
- **RRI Gauge** (0-100, color-coded)
- **Component Breakdown** (5 weighted sub-scores)
- **Trend Chart** (RRI history over time)
- **Recent Circulars** with status badges
- **Risk Counter** (high/medium/low findings)

### Phase 3: Circular Upload
- Drag-and-drop PDF upload
- Native text extraction (pypdf)
- OCR fallback (Tesseract) for scanned documents
- Text chunking for RAG embeddings

### Phase 4: Regulation Intelligence Agent
- LangGraph-based structured extraction
- Outputs: Obligation (description, deadline, applicability, source_ref)
- Deduplication via embedding similarity
- Human review gate before downstream processing

### Phase 5: Human Review
- Spreadsheet-style table for compliance officers
- Inline edit, expand rows, bulk confirm
- Add/delete obligations manually

### Phase 6: Process Mapping Agent
- Semantic retrieval over policy corpus (ChromaDB)
- LLM relevance judgment + confidence score
- Department assignment
- Unmapped obligation flagging

### Phase 7: Mapping Review
- Confidence score display
- Manual override capability
- Unmapped badge visualization

### Phase 8: Regulatory Stress Test ⭐ (USP)
- **Missing controls** check
- **Workflow gap** detection
- **Policy conflict** identification
- **Outdated procedure** flag (date comparison)
- **Missing evidence** verification
- Severity assignment (High/Medium/Low)

### Phase 9: Findings Dashboard
- Cards grouped by severity
- Filter by type, severity, department
- Status badges (open/in progress/resolved)
- One-click to Regulatory Replay

### Phase 10: Evidence Verification
- Upload artifacts (policy, training, audit, approval)
- AI classification: Present / Stale / Missing
- Live RRI recalculation on evidence changes

### Phase 11: Regulatory Readiness Index
- Deterministic weighted calculator:
  - Policy Alignment: 25%
  - Control Coverage: 25%
  - Evidence Completeness: 20%
  - Workflow Readiness: 15%
  - Employee Readiness: 15%
- Append-only history for trend tracking
- Live update on any state change

### Phase 12: Regulatory Replay ⭐ (Signature)
- Vertical chain visualization
- Nodes: Circular → Obligation → Policy → Workflow → Gap → Risk → Fix
- Each node is a distinct entity type with unique styling
- Directional flow lines
- ARGUS Advisor explanation beneath

### Phase 13: ARGUS Advisor (RAG Chat)
- Persistent floating chat panel
- Suggested questions: "Why is RRI low?", "High risks?", etc.
- RAG-grounded answers using circular + policy chunks
- Sources cited for every answer

### Phase 14: Action Plan
- Auto-generated from findings
- Columns: Task | Finding | Owner | Priority | Deadline | Status
- Editable status tracking
- Feeds back into RRI on completion

### Phase 15: Audit Reports
- One-click PDF generation
- Includes: RRI summary, findings, replays, action plan, evidence status
- Reportlab-based server-side rendering

### Phase 16: Demo Hardening
- Pre-seeded "before" state (RRI ~82, realistic gaps)
- Complete 5-minute demo flow
- Zero dead clicks — every CTA is obvious
- Repeatable on every fresh start

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | OAuth2 login |
| POST | `/api/v1/auth/register` | User registration |
| GET | `/api/v1/auth/me` | Current user |
| GET | `/api/v1/dashboard/stats` | Dashboard stats |
| GET | `/api/v1/circulars` | List circulars |
| POST | `/api/v1/circulars` | Create circular |
| POST | `/api/v1/circulars/{id}/upload` | Upload PDF |
| GET | `/api/v1/obligations/circular/{id}` | Get obligations |
| POST | `/api/v1/obligations` | Create obligation |
| PATCH | `/api/v1/obligations/{id}` | Update obligation |
| GET | `/api/v1/findings` | List findings (with filters) |
| POST | `/api/v1/findings/{id}/run-stress-test` | Run stress test |
| GET | `/api/v1/readiness/{org_id}` | Current RRI |
| GET | `/api/v1/readiness/{org_id}/trend` | RRI trend |
| POST | `/api/v1/readiness/{org_id}/recalculate` | Recalculate RRI |
| GET | `/api/v1/replay/{finding_id}` | Get regulatory replay |
| POST | `/api/v1/advisor/query` | Ask ARGUS Advisor |
| GET | `/api/v1/action-plan` | List action items |
| GET | `/api/v1/reports` | List reports |
| POST | `/api/v1/reports/generate/{circular_id}` | Generate PDF |

## Design Principles

1. **Score-first, detail-on-demand** — RRI is always the largest element
2. **Trust through traceability** — every AI claim links to source
3. **Calm authority, not alarm** — muted terracotta for risk, not pure red
4. **Reviewable AI, not autonomous AI** — every output has edit/confirm affordance

## Known Limitations & Unverified Features

As of the latest release, the following features have been implemented and validated via isolated or single-process testing, but remain **explicitly unverified** in a true production or live-render environment due to host infrastructure constraints (missing Docker/WSL, and incompatible native C-extensions like `chromadb` on Windows):

1. **Multi-Worker Token Blocklist:** The `RevokedToken` DB table and JWT rejection logic is architecturally complete and passes Pytest validation. However, it has not been tested against a live multi-worker instance (e.g., `uvicorn --workers 2` or Dockerized `gunicorn`), which is required to definitively prove there are no cross-worker cache/memory leaks in production.
2. **Regulatory Replay Diff View Binding:** The React component (`RegulatoryReplay.tsx`) has been updated to conditionally render a side-by-side gap comparison diff. The JSX correctly attempts to map `replay.chain_json.find(...)` to extract live obligation and policy texts. However, because the frontend could not connect to a live backend (due to the same environment constraints blocking `chromadb`), this data binding has not been observed or verified on a live, rendered screen.

*These features should be considered strictly unverified until tested in a fully provisioned Linux/Docker environment.*

## License

MIT License — see [LICENSE](LICENSE)
