# FinPath

FinPath is a finance-focused requirements engineering application based on the supplied problem statement. Its domain is Financial Requirements Engineering. It turns stakeholder responses and supporting documents into evidence-linked draft requirements, runs coordinated specialist review passes, highlights quality and control gaps, and recommends an SDLC approach for human review.

## Highlights

- Adaptive stakeholder interview for finance workflows including onboarding, lending, payments, fraud, insurance, and regulatory reporting.
- Upload and process `.txt`, `.md`, `.csv`, `.pdf`, and `.docx` source documents.
- Mask common account/card, tax-ID, and national-ID-like patterns before indexing.
- Store embeddings in a persistent, per-project ChromaDB collection.
- Save projects locally and reopen them from the workspace.
- Inspect retrieved evidence before generating requirements.
- Generate requirements with citations to the retrieved source chunks.
- Review quality, ambiguity, potential conflicts, security, privacy, candidate compliance mappings, and source traceability.
- Draft user stories, use-case outlines, and acceptance criteria alongside each requirement.
- Approve, reject, or return requirements for review; approval changes are recorded in the audit trail.
- Produce a transparent SDLC recommendation across Waterfall, V-Model, Spiral, Agile, DevSecOps, and hybrid options, with finance-focused validation and release gates.
- Download the project as JSON or as a Markdown Software Requirements Specification (SRS).

## RAG Flow

```text
Stakeholder interview + uploaded documents
              |
       Mask sensitive patterns
              |
          Chunk sources
              |
     Create embeddings and index
              |
     ChromaDB semantic retrieval
              |
  LLM or evidence-only requirement drafts
              |
  Specialist review + traceability + SDLC workflow + export
```

Every generated requirement is linked to retrieved evidence and starts in `Needs review`. The coordinator runs deterministic specialist passes for quality and clarification, compliance mapping, security and privacy, risk and conflict, and traceability. Candidate control mappings are based only on project sources; they do not establish legal or regulatory applicability. Final requirements, mappings, and SDLC choices need approval from authorised people.

## Quick Start

Requires Python 3.11 or later.

Windows PowerShell:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open the local FinPath address: http://finpath.localhost:8000. `finpath.localhost` is a local development address and is not a public internet domain.

To use a different port, replace `8000` in the start command, for example `--port 8080`, then open `http://finpath.localhost:8080`.

## LLM Configuration

The project works without an API key. In this local mode, it uses deterministic local embeddings for ChromaDB retrieval and creates evidence-only requirement drafts.

To enable OpenAI-compatible embeddings and LLM-generated requirements, create a `.env` file in the project root:

```text
LLM_API_KEY=your_new_api_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

APP_DATA_DIR=data
VECTOR_DB_PATH=data/chroma
```

`OPENAI_API_KEY` is also supported as an alternative to `LLM_API_KEY`. Restart the server after changing `.env`.

Keep API keys only in `.env`, which is ignored by Git. Never add a key to source code, JSON exports, screenshots, or documentation. If a key is exposed, revoke it and create a replacement immediately.

## Using the App

1. Enter the financial functionality, business objective, and users/roles.
2. Complete the adaptive interview and optionally attach policy or requirement documents.
3. Create the project. The app masks, chunks, and indexes the sources.
4. Review the retrieved evidence or use the evidence search field to query the vector index.
5. Generate evidence-grounded requirements and review their citations, confidence, risk, user-story drafts, use-case outlines, and acceptance criteria.
6. Edit requirements as needed; edits return them to `Needs review` and refresh the quality and specialist analyses.
7. Approve or reject requirements, run the SDLC analysis, and download the JSON audit export or SRS report.

Try the included [loan origination requirements](sample_data/loan_origination_controls.txt) with the functionality `Loan application and approval`. The source is explicitly fictional. The [digital onboarding policy](sample_data/digital_onboarding_policy.txt) is also available as a sample.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/rag/status` | Safe RAG configuration and provider status; never returns secrets. |
| `GET` | `/api/projects` | List saved project summaries. |
| `POST` | `/api/projects` | Create a project and index its source chunks. |
| `GET` | `/api/projects/{project_id}/retrieval?query=...` | Retrieve the highest-ranked ChromaDB evidence chunks. |
| `POST` | `/api/projects/{project_id}/requirements` | Generate evidence-grounded draft requirements. |
| `PUT` | `/api/projects/{project_id}/requirements/{requirement_id}` | Edit a requirement and return it to human review. |
| `POST` | `/api/projects/{project_id}/requirements/{requirement_id}/approval` | Record an approval decision in the audit trail. |
| `POST` | `/api/projects/{project_id}/sdlc` | Generate the SDLC recommendation. |
| `GET` | `/api/projects/{project_id}` | Retrieve the project analysis and audit data. |
| `GET` | `/api/projects/{project_id}/export` | Download the project audit trail as JSON. |
| `GET` | `/api/projects/{project_id}/report` | Download an SRS-style Markdown report. |

Interactive API documentation is available at http://finpath.localhost:8000/docs while the server is running.

## Project Structure

```text
app/
  main.py                 FastAPI routes and application lifecycle
  services/documents.py   Extraction, masking, and chunking
  services/rag.py         Embeddings, ChromaDB indexing, and retrieval
  services/llm.py         OpenAI-compatible structured generation
  services/quality.py     Requirement quality and conflict checks
  services/agents.py      Coordinated specialist review passes and traceability
  services/reports.py     SRS-style Markdown export
  services/sdlc.py        SDLC scoring and workflow recommendation
  services/storage.py     Local project JSON storage
  prompts/                Requirement-generation prompt templates
sample_data/              Example supporting document
tests/                    Automated checks
data/                     Local JSON projects and ChromaDB data
```

## Tests

Run the automated test suite from the project root:

```bash
.venv/bin/python -m pytest -q
```

## Troubleshooting

| Problem | Resolution |
| --- | --- |
| `Address already in use` | A server is already using the chosen port. Stop it with `Ctrl+C`, or start this app on another port. |
| `embedding_provider_configured: false` | Add a valid replacement key to `.env`, then restart the server. Local fallback mode still works without it. |
| The configured embedding provider rejects a request | The app automatically indexes with local embeddings so project creation remains available. Verify `LLM_BASE_URL`, `EMBEDDING_MODEL`, and the provider key before relying on remote embeddings. |
| `500` while creating a project | Stop the server, ensure the `data/` directory is writable, then restart. A fresh ChromaDB collection is created for each project. |
| Browser appears frozen | In DevTools, select Resume script execution if the page is paused in the debugger, then refresh. |

## Limitations

This is a local prototype, not a compliance or legal decision system. Before production use, add authentication, access controls, encrypted durable storage, source versioning, prompt-injection safeguards, retention policies, monitoring, and a formal compliance approval workflow.
