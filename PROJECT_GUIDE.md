# FinPath Project Guide

## What FinPath does

FinPath is a local prototype for analysing software requirements for financial services projects. Enter a single problem statement; the app automatically creates evidence-linked draft requirements, identifies review gaps, prepares candidate control mappings, and generates an SDLC recommendation and workflow. It does not ask follow-up interview questions.

The project addresses the supplied problem statement's main needs: unstructured finance requirements, ambiguity and conflict, evidence and traceability, security and compliance review, human approval, and project-specific SDLC selection.

FinPath is an advisory prototype. A person remains responsible for approving requirements, interpreting regulations, accepting control mappings, and choosing the delivery model.

## Main capabilities

- **Single-step project creation:** Enter a finance problem statement or use the built-in personal loan sample. Requirements, quality analysis, SDLC analysis, and the project workflow generate automatically.
- **Document intake and retrieval:** Accepts `.txt`, `.md`, `.csv`, `.pdf`, and `.docx` files, up to 5 MB each. Sources are split into evidence chunks and indexed in a project-specific ChromaDB collection.
- **Sensitive-pattern masking:** Masks common long account/card-number patterns, one tax-ID-like pattern, and one national-ID-like pattern before indexing. This does not detect every kind of personal or confidential information.
- **Grounded requirement drafts:** Retrieves relevant evidence and generates draft requirements with source references. Without an API key, the app creates conservative evidence-only drafts. With an OpenAI-compatible API configured, it can request structured LLM drafts and checks that generated citations point to retrieved evidence.
- **Specialist review passes:** Runs rule-based passes for requirement quality and clarification, candidate compliance mapping, security and privacy, risk and potential conflicts, and traceability. These passes are deterministic checks; they are not independent autonomous LLM agents.
- **Human review:** Requirements begin in `Needs review`. Reviewers can edit requirement text and acceptance criteria, approve or reject a requirement, and regenerate drafts. Edits return an item to review and clear the existing SDLC recommendation so it can be recalculated.
- **SDLC advice:** Ranks Waterfall, V-Model, Prototyping, RAD, Spiral, Incremental, Agile, DevSecOps, and an Agile/V-Model hybrid. The result includes decision factors, a justification, workflow phases, roles, deliverables, and approval gates.
- **Project exports:** Downloads the project data and audit trail as JSON or an SRS-style Markdown report.
- **Saved projects:** Stores project JSON locally and lets a user reopen projects in the browser.

## Create and run the app on Windows

Use Python 3.11 or later. Open PowerShell in the project folder:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open [http://finpath.localhost:8000](http://finpath.localhost:8000). If that local address does not resolve on the computer, use [http://127.0.0.1:8000](http://127.0.0.1:8000). API documentation is available at `/docs` on the same host.

To stop the server, focus the PowerShell window and press `Ctrl+C`.

### Optional LLM setup

FinPath works without an API key. In local mode, it uses deterministic local embeddings and evidence-only requirement drafts. To enable remote embeddings and LLM requirement drafting, create a `.env` file in the project folder:

```text
LLM_API_KEY=your_provider_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
APP_DATA_DIR=data
VECTOR_DB_PATH=data/chroma
```

`OPENAI_API_KEY` can be used instead of `LLM_API_KEY`. A configured remote provider receives the masked source content needed for its request. Do not use real sensitive financial data until the deployment has suitable privacy, access-control, encryption, and retention safeguards. Keep `.env` out of source control and exports.

## Create a finance project in FinPath

1. Enter a financial functionality, such as `Loan application and approval`.
2. Describe the business objective and the people or roles that will use the system.
3. Start the adaptive interview. Answer the questions about normal flow, decision rules, exceptions, data, controls, service levels, delivery, testing, and release. Skip questions whose answers are not known yet.
4. Optionally upload approved source material. The included loan source is fictional and intended only for demonstration: `sample_data/loan_origination_controls.txt`.
5. Create the project. FinPath masks supported patterns, processes the sources, and indexes their evidence chunks.
6. Review retrieved evidence. Use the search field to ask about a particular workflow or control area.
7. Generate requirements. Review each statement, category, priority, confidence, risk, acceptance criteria, user-story draft, use-case outline, and citation.
8. Resolve quality findings. Use **Modify draft** to change a requirement or its acceptance criteria. A human edit returns the item to `Needs review`.
9. Set each requirement's approval status. A status change is recorded in the audit trail and clears the previous SDLC recommendation.
10. Run SDLC analysis. Review the ranked alternatives, factors, workflow, and gates; the recommendation still needs human approval.
11. Download the JSON audit export or the SRS Markdown report. Saved projects can be reopened from **Open a saved finance project**.

Regenerating drafts replaces current requirement edits and approval decisions; the interface asks for confirmation first.

## How the system is put together

```text
Browser interview and source upload
              |
      Mask and extract text
              |
       Chunk and index sources
              |
         Retrieve evidence
              |
      Draft requirements (LLM or local fallback)
              |
Quality, compliance, security, risk, and traceability passes
              |
       Human review and approval
              |
         SDLC recommendation
              |
        JSON or SRS export
```

The web interface is plain HTML, CSS, and JavaScript served by FastAPI. Pydantic models define projects, requirements, evidence, reviews, and SDLC outputs. ChromaDB stores per-project vectors. Project state and audit events are saved as JSON files under `data/`. The `data/` folder is empty in the packaged project; it is populated when projects are created.

## Important implementation limits

- The specialist reviews use deterministic rules. Only requirement drafting can call the configured LLM.
- Candidate compliance mappings connect requirement categories to excerpts from supplied sources. FinPath does not include a versioned regulatory knowledge base, determine legal applicability, or certify compliance.
- The masking patterns cover only a small set of common formats. Review source material before upload, especially when using a remote provider.
- There is no authentication, role-based access control, encrypted storage, source-version history, production monitoring, or formal retention workflow. The prototype is intended for local demonstration and coursework, not direct production use.
- SDLC scoring uses signals available in generated requirements. Factors such as deadlines and expected change frequency remain marked as not evidenced when the sources do not establish them.
- The loan origination sample is fictional. Replace it with approved, jurisdiction-specific source material for a real project.

## Project structure

```text
app/
  main.py                  FastAPI app and API routes
  schemas.py               Project and analysis data models
  prompts/                 LLM requirement-generation prompts
  services/
    agents.py              Deterministic specialist review passes
    documents.py           Extraction, masking, and chunking
    generator.py           Evidence-only draft generation
    llm.py                 Optional structured LLM generation
    quality.py             Ambiguity, quality, and conflict checks
    rag.py                 Embeddings, ChromaDB indexing, retrieval
    reports.py              SRS-style Markdown export
    sdlc.py                SDLC scoring and workflow
    storage.py             Local JSON persistence
  static/                  Browser JavaScript and CSS
  templates/index.html     FinPath browser interface
sample_data/                Fictional or illustrative finance sources
tests/                      Existing automated test suite
data/                       Local project JSON and vector storage
README.md                   Short overview and reference
PROJECT_GUIDE.md            This guide
requirements.txt            Python dependencies
```

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/projects` | List saved project summaries. |
| `POST` | `/api/projects` | Create a project and index its sources. |
| `GET` | `/api/projects/{id}` | Read saved project data. |
| `GET` | `/api/projects/{id}/retrieval?query=...` | Search project evidence. |
| `POST` | `/api/projects/{id}/requirements` | Generate or regenerate draft requirements and specialist reviews. |
| `PUT` | `/api/projects/{id}/requirements/{requirement_id}` | Edit a requirement and return it to review. |
| `POST` | `/api/projects/{id}/requirements/{requirement_id}/approval` | Record a human approval status. |
| `POST` | `/api/projects/{id}/sdlc` | Calculate an SDLC recommendation and workflow. |
| `GET` | `/api/projects/{id}/export` | Download the JSON project export. |
| `GET` | `/api/projects/{id}/report` | Download the Markdown SRS report. |
