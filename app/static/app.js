let projectId = null;
let projectHasRequirements = false;
let questionIndex = 0;
let questionQueue = [];
let askedQuestionKeys = new Set();
const interviewAnswers = {};
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const INTERVIEW_QUESTION_LIMIT = 8;
const coverageQuestions = [
  { key: "business rules", topic: "Decision rules", prompt: "Which rules, limits, approvals, or eligibility conditions decide whether the workflow can continue?" },
  { key: "exceptions", topic: "Exceptions", prompt: "What should happen for failures, missing information, rejected decisions, or manual overrides? Who owns the resolution?" },
  { key: "data and integrations", topic: "Data and integrations", prompt: "Which data is collected or exchanged, which systems or third parties are involved, and what happens if an integration is unavailable?" },
  { key: "security and compliance", topic: "Security and compliance", prompt: "Which access controls, audit records, privacy obligations, fraud checks, or compliance requirements must be met?" },
  { key: "service levels and scale", topic: "Operational scale", prompt: "What volumes, peak periods, response times, availability targets, or recovery expectations should the solution support?" },
  { key: "delivery constraints", topic: "Delivery context", prompt: "What deadlines, budget or team constraints, stakeholder availability, technical dependencies, and change expectations should shape delivery?" },
  { key: "validation and rollout", topic: "Validation and rollout", prompt: "How should this be tested, approved, piloted, released, monitored, and improved after launch?" },
];
const domainOpeners = [
  { terms: ["onboard", "kyc", "identity", "account opening"], topic: "Onboarding", prompt: "For the onboarding journey, what starts identity verification, what evidence is checked, and what outcome should the customer receive?" },
  { terms: ["payment", "transfer", "transaction", "card"], topic: "Payments", prompt: "For the payment journey, what starts a transaction, which decisions or checks occur, and what confirmation should each party receive?" },
  { terms: ["loan", "credit", "lending"], topic: "Loan processing", prompt: "For the lending journey, what starts an application, which decisions occur, and what result should the applicant receive?" },
  { terms: ["fraud", "suspicious", "risk detection"], topic: "Fraud detection", prompt: "Which events start a fraud investigation, how are cases assessed, and what outcome should the case owner receive?" },
  { terms: ["insurance", "claim", "policyholder"], topic: "Insurance", prompt: "For the claim journey, what starts assessment, which decisions occur, and what outcome should the policyholder receive?" },
  { terms: ["report", "regulatory", "compliance"], topic: "Reporting", prompt: "For the reporting journey, what starts a report, which validation and approval decisions occur, and what submission outcome is required?" },
];

function answerExcerpt(answer) {
  const compact = answer.replace(/\s+/g, " ").trim();
  return compact.length > 150 ? `${compact.slice(0, 147)}...` : compact;
}

function selectOpeningQuestion(context) {
  const opener = domainOpeners.find((rule) => rule.terms.some((term) => context.includes(term)));
  return { key: "workflow and outcomes", ...(opener || { topic: "Workflow", prompt: "Walk through the normal journey. What starts the process, what decisions happen, and what outcome should the user receive?" }) };
}

function selectNextQuestion(previousAnswer) {
  const remaining = coverageQuestions.filter((question) => !askedQuestionKeys.has(question.key));
  if (!remaining.length) return null;
  const answer = previousAnswer.toLowerCase();
  const followUpOrder = [
    { key: "exceptions", terms: ["fail", "error", "reject", "declin", "exception", "manual", "override"] },
    { key: "data and integrations", terms: ["api", "system", "integrat", "third party", "vendor", "data", "document"] },
    { key: "security and compliance", terms: ["risk", "fraud", "security", "audit", "privacy", "compliance", "access"] },
    { key: "business rules", terms: ["rule", "limit", "approv", "eligib", "decision", "threshold"] },
    { key: "service levels and scale", terms: ["volume", "peak", "time", "urgent", "daily", "availability", "customer"] },
  ];
  const followUp = followUpOrder.find((rule) => rule.terms.some((term) => answer.includes(term)));
  const selected = remaining.find((question) => question.key === followUp?.key) || remaining[0];
  const context = previousAnswer ? `You mentioned "${answerExcerpt(previousAnswer)}". ` : "To complete the project picture, ";
  return { ...selected, prompt: `${context}${selected.prompt}` };
}

function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); setTimeout(() => node.classList.remove("show"), 3200); }
async function request(url, options = {}) { const response = await fetch(url, options); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail || "Request failed"); } return response.json(); }
function displayDocuments(documents, rag) { $("#documentList").innerHTML = documents.map((doc) => `<div class="doc-row"><strong>${escapeHtml(doc.name)}</strong><small>${doc.chunks} processed evidence chunks</small></div>`).join(""); $("#ragSummary").innerHTML = `<span>${escapeHtml(rag.vector_database)}</span><span>${escapeHtml(rag.embedding_model)}</span><span>${rag.indexed_chunks} vectors indexed</span>`; $("#documentsPanel").classList.remove("is-hidden"); }
async function refreshSavedProjects() {
  const list = $("#savedProjects");
  try {
    const result = await request("/api/projects");
    list.innerHTML = result.projects.length ? result.projects.map((project) => `<div class="saved-project"><div><strong>${escapeHtml(project.functionality)}</strong><br><small>${project.requirement_count} requirement(s) · ${project.document_count} source(s) · ${escapeHtml(new Date(project.created_at).toLocaleDateString())}</small></div><button type="button" class="open-saved-project" data-id="${escapeHtml(project.id)}">Open</button></div>`).join("") : "<p class=\"muted\">No saved projects yet. Create a finance project to begin.</p>";
    list.querySelectorAll(".open-saved-project").forEach((button) => button.addEventListener("click", () => openSavedProject(button.dataset.id)));
  } catch (error) {
    list.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}
async function openSavedProject(id) {
  try {
    const project = await request(`/api/projects/${id}`);
    projectId = project.id;
    projectHasRequirements = project.requirements.length > 0;
    $("#functionality").value = project.functionality;
    $("#projectState").textContent = "Saved project opened";
    $("#newProjectButton").classList.remove("is-hidden");
    $("#exportLink").href = `/api/projects/${projectId}/export`;
    $("#reportLink").href = `/api/projects/${projectId}/report`;
    $("#exportLink").classList.remove("is-hidden");
    $("#reportLink").classList.remove("is-hidden");
    $("#interviewStartForm").classList.add("is-hidden");
    $("#interviewSession").classList.add("is-hidden");
    $("#interviewComplete").classList.add("is-hidden");
    const rag = await request("/api/rag/status");
    const documents = project.documents.map((document) => ({ name: document.name, chunks: (document.chunks || []).length }));
    rag.indexed_chunks = documents.reduce((total, document) => total + document.chunks, 0);
    displayDocuments(documents, rag);
    $("#generateButton").textContent = projectHasRequirements ? "Regenerate drafts" : "Generate requirements";
    if (project.requirements.length) {
      displayRequirements(project);
      displayIssues(project.quality_issues);
      displayAgentAnalysis(project);
      $("#sdlcPanel").classList.remove("is-hidden");
      if (project.sdlc) displaySdlc(project.sdlc);
      else $("#sdlcResult").innerHTML = "";
    } else {
      $("#requirementsPanel").classList.add("is-hidden");
      $("#qualityPanel").classList.add("is-hidden");
      $("#agentsPanel").classList.add("is-hidden");
      $("#sdlcPanel").classList.add("is-hidden");
    }
    try {
      displayRetrievedEvidence(await request(`/api/projects/${projectId}/retrieval`));
    } catch {
      displayRetrievedEvidence({ matches: [], count: 0 });
    }
    $(".saved-projects").open = false;
    toast("Saved project opened.");
  } catch (error) {
    toast(error.message);
  }
}
function displayRetrievedEvidence(result) { const list = $("#retrievalResults"); list.innerHTML = result.matches.length ? result.matches.map((match) => `<article class="retrieval-match"><div><span class="field-label">${escapeHtml(match.document_name)} / ${escapeHtml(match.id)}</span><p>${escapeHtml(match.text)}</p></div><strong>${Math.round(match.relevance * 100)}%</strong></article>`).join("") : "<p class=\"muted\">No matching chunks found.</p>"; $("#retrievalCount").textContent = `${result.count} match(es)`; }
function addRequirementEditors(project, list) {
  list.querySelectorAll(".requirement").forEach((card, index) => {
    const requirement = project.requirements[index];
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "quiet-button edit-toggle";
    editButton.textContent = "Modify draft";
    const editor = document.createElement("div");
    editor.className = "req-edit-form is-hidden";
    const statementLabel = document.createElement("label");
    statementLabel.textContent = "Requirement statement";
    const statement = document.createElement("textarea");
    statement.value = requirement.statement;
    statementLabel.append(statement);
    const criteriaLabel = document.createElement("label");
    criteriaLabel.textContent = "Acceptance criteria, one per line";
    const criteria = document.createElement("textarea");
    criteria.value = requirement.acceptance_criteria.join("\n");
    criteriaLabel.append(criteria);
    const actions = document.createElement("div");
    actions.className = "edit-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save changes";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "quiet-button";
    cancel.textContent = "Cancel";
    actions.append(save, cancel);
    editor.append(statementLabel, criteriaLabel, actions);
    card.append(editButton, editor);
    editButton.addEventListener("click", () => editor.classList.toggle("is-hidden"));
    cancel.addEventListener("click", () => {
      statement.value = requirement.statement;
      criteria.value = requirement.acceptance_criteria.join("\n");
      editor.classList.add("is-hidden");
    });
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        const updated = await request(`/api/projects/${projectId}/requirements/${requirement.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statement: statement.value, acceptance_criteria: criteria.value.split(/\r?\n/) }),
        });
        displayRequirements(updated);
        displayIssues(updated.quality_issues);
        displayAgentAnalysis(updated);
        $("#sdlcResult").innerHTML = "";
        toast("Changes saved. The requirement needs review again, and SDLC analysis must be rerun.");
      } catch (error) {
        toast(error.message);
      } finally {
        save.disabled = false;
      }
    });
  });
}

function displayRequirements(project) {
  const list = $("#requirementsList");
  list.innerHTML = project.requirements.map((req) => `<article class="requirement"><div class="requirement-head"><div><span class="req-id">${escapeHtml(req.id)}</span><h3>${escapeHtml(req.statement)}</h3><div class="tags">${req.categories.map((category) => `<span class="tag">${escapeHtml(category)}</span>`).join("")}</div></div><select class="status" data-id="${escapeHtml(req.id)}" aria-label="Approval status for ${escapeHtml(req.id)}">${["Draft", "Needs review", "Approved", "Rejected"].map((status) => `<option ${req.approval_status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div><div class="requirement-artifacts"><div><span class="field-label">Draft user story · confirm actor</span><p>${escapeHtml(req.user_story || "To be refined with stakeholders.")}</p></div><div><span class="field-label">Use case outline · confirm trigger and exceptions</span><p>${escapeHtml(req.use_case || "To be refined with stakeholders.")}</p></div></div><div class="requirement-grid"><div><span class="field-label">Business justification</span><p>${escapeHtml(req.business_justification)}</p></div><div><span class="field-label">Confidence / risk</span><p>${Math.round(req.confidence * 100)}% confidence · ${escapeHtml(req.risk_level)} risk · ${escapeHtml(req.priority)}</p></div><div><span class="field-label">Acceptance criteria</span><p>${req.acceptance_criteria.map(escapeHtml).join("<br>")}</p></div><div><span class="field-label">Reasoning</span><p>${escapeHtml(req.reasoning)}</p></div></div>${req.evidence.map((evidence) => `<div class="evidence"><span class="field-label">Evidence · ${escapeHtml(evidence.document_name)} / ${escapeHtml(evidence.chunk_id)}</span><p>${escapeHtml(evidence.excerpt)}</p></div>`).join("")}</article>`).join("");
  $("#requirementCount").textContent = `${project.requirements.length} draft(s)`;
  $("#requirementsPanel").classList.remove("is-hidden");
  list.querySelectorAll("select").forEach((select) => select.addEventListener("change", async () => {
    const data = new FormData();
    data.append("status", select.value);
    try {
      await request(`/api/projects/${projectId}/requirements/${select.dataset.id}/approval`, { method: "POST", body: data });
      document.querySelectorAll(".traceability-status").forEach((cell) => { if (cell.dataset.id === select.dataset.id) cell.textContent = select.value; });
      $("#sdlcResult").innerHTML = "";
      toast("Approval status recorded. Rerun SDLC analysis to refresh the recommendation.");
    } catch (error) {
      toast(error.message);
    }
  }));
  addRequirementEditors(project, list);
}
function displayIssues(issues) { $("#issuesList").innerHTML = issues.length ? issues.map((issue) => `<article class="issue"><div><span class="severity">${escapeHtml(issue.severity)}</span><p class="muted">${escapeHtml(issue.check)}</p></div><div><strong>${escapeHtml(issue.requirement_id || "Project")}</strong><p>${escapeHtml(issue.message)}</p><p class="recommendation">${escapeHtml(issue.recommendation)}</p></div></article>`).join("") : "<p class=\"muted\">No rule-based issues found. Human review is still required.</p>"; $("#issueCount").textContent = `${issues.length} issue(s)`; $("#qualityPanel").classList.remove("is-hidden"); }
function displayAgentAnalysis(project) { const reviews = project.agent_reviews || []; $("#agentReviews").innerHTML = reviews.map((review) => `<article class="agent-card"><div class="agent-card-head"><h3>${escapeHtml(review.agent)}</h3><span class="review-status ${review.status === "Complete" ? "complete" : "review"}">${escapeHtml(review.status)}</span></div><p>${escapeHtml(review.summary)}</p>${review.findings.length ? `<ul>${review.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}</ul>` : ""}${review.requirement_ids.length ? `<small>Linked: ${escapeHtml(review.requirement_ids.join(", "))}</small>` : ""}</article>`).join(""); const mappings = project.compliance_mappings || []; $("#complianceMappings").innerHTML = mappings.length ? `<div class="table-wrap"><table><thead><tr><th>Requirement</th><th>Candidate control area</th><th>Source evidence</th><th>Review</th></tr></thead><tbody>${mappings.map((mapping) => `<tr><td>${escapeHtml(mapping.requirement_id)}</td><td>${escapeHtml(mapping.control_area)}</td><td><strong>${escapeHtml(mapping.source_name)}</strong><br>${escapeHtml(mapping.source_excerpt)}</td><td>${escapeHtml(mapping.review_status)}</td></tr>`).join("")}</tbody></table></div>` : "<p class=\"muted\">No source-backed security, privacy, audit, or regulatory mappings were identified. Confirm applicable controls with the project owners.</p>"; const records = project.traceability || []; $("#traceabilityRecords").innerHTML = records.length ? `<div class="table-wrap"><table><thead><tr><th>Requirement</th><th>Source references</th><th>Confidence</th><th>Approval</th></tr></thead><tbody>${records.map((record) => `<tr><td>${escapeHtml(record.requirement_id)}</td><td>${record.source_references.map(escapeHtml).join("<br>") || "No linked source"}</td><td>${Math.round(record.confidence * 100)}%</td><td class="traceability-status" data-id="${escapeHtml(record.requirement_id)}">${escapeHtml(record.approval_status)}</td></tr>`).join("")}</tbody></table></div>` : "<p class=\"muted\">Traceability will appear after analysis.</p>"; $("#agentsPanel").classList.remove("is-hidden"); }
function displaySdlc(sdlc) { $("#sdlcResult").innerHTML = `<div class="sdlc-overview"><div><p class="eyebrow">Recommended model</p><h3>${escapeHtml(sdlc.recommended_sdlc)}</h3><p>${escapeHtml(sdlc.justification)}</p></div><div class="rankings">${sdlc.options.map((option) => `<div class="ranking"><span>${escapeHtml(option.name)}</span><div class="bar"><span style="width:${option.score}%"></span></div><strong>${option.score}%</strong></div>`).join("")}</div></div><div class="workflow"><p class="eyebrow">SDLC decision factors</p><div class="factor-grid">${sdlc.factors.map((factor) => `<div class="factor"><h4>${escapeHtml(factor.name)}</h4><strong>${escapeHtml(factor.value)}</strong><p>${escapeHtml(factor.rationale)}</p>${factor.requirement_ids.length ? `<small>Linked: ${escapeHtml(factor.requirement_ids.join(", "))}</small>` : ""}</div>`).join("")}</div></div><div class="workflow"><p class="eyebrow">Project-specific workflow</p><div class="workflow-grid">${sdlc.workflow.map((phase) => `<div class="phase"><h4>${escapeHtml(phase.phase)}</h4><p>${escapeHtml(phase.activities.join(" · "))}</p><p><strong>Gate:</strong> ${escapeHtml(phase.gate)}</p></div>`).join("")}</div></div>`; }
function renderQuestion() { const question = questionQueue[questionIndex]; if (!question) { $("#interviewSession").classList.add("is-hidden"); $("#interviewComplete").classList.remove("is-hidden"); $("#interviewSummary").textContent = `The adaptive interview is complete. ${Object.keys(interviewAnswers).length} responses are ready for requirement and SDLC analysis.`; return; } $("#questionProgress").textContent = `Question ${questionIndex + 1} of ${INTERVIEW_QUESTION_LIMIT}`; $("#answerCount").textContent = `${Object.keys(interviewAnswers).length} answers saved`; $("#questionTopic").textContent = question.topic; $("#interviewQuestion").textContent = question.prompt; $("#interviewAnswer").value = interviewAnswers[question.key] || ""; $("#interviewAnswer").focus(); }
function advanceInterview(saveAnswer) { const question = questionQueue[questionIndex]; const answer = $("#interviewAnswer").value.trim(); if (saveAnswer && !answer) { toast("Add an answer or choose Skip for now."); return; } if (answer) interviewAnswers[question.key] = answer; if (questionQueue.length < INTERVIEW_QUESTION_LIMIT) { const nextQuestion = selectNextQuestion(answer); if (nextQuestion) { askedQuestionKeys.add(nextQuestion.key); questionQueue.push(nextQuestion); } } questionIndex += 1; renderQuestion(); }

$("#interviewStartForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const statement = $("#businessObjective").value.trim();
  if (statement.length < 10) { toast("Describe the finance problem in at least 10 characters."); return; }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Generating your project…";
  try {
    const functionality = statement.split(/[.!?\n]/)[0].slice(0, 100) || "Finance solution";
    const data = new FormData();
    data.append("functionality", functionality);
    data.append("stakeholder_input", JSON.stringify({ "problem statement": statement }));
    const created = await request("/api/projects", { method: "POST", body: data });
    projectId = created.project_id;
    projectHasRequirements = false;
    $("#functionality").value = functionality;
    $("#projectState").textContent = "Generating project";
    $("#newProjectButton").classList.remove("is-hidden");
    $("#exportLink").href = `/api/projects/${projectId}/export`;
    $("#reportLink").href = `/api/projects/${projectId}/report`;
    $("#exportLink").classList.remove("is-hidden");
    $("#reportLink").classList.remove("is-hidden");
    displayDocuments(created.documents, created.rag);
    const project = await request(`/api/projects/${projectId}/requirements`, { method: "POST" });
    projectHasRequirements = true;
    displayRequirements(project);
    displayIssues(project.quality_issues);
    displayAgentAnalysis(project);
    $("#sdlcPanel").classList.remove("is-hidden");
    displaySdlc(await request(`/api/projects/${projectId}/sdlc`, { method: "POST" }));
    $("#interviewStartForm").classList.add("is-hidden");
    $("#projectState").textContent = "Project ready";
    await refreshSavedProjects();
    toast("Requirements, SDLC analysis, and workflow generated.");
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Generate SDLC and workflow";
  }
});
$("#useSampleButton").addEventListener("click", () => {
  $("#businessObjective").value = "Customers need a simple way to apply for a personal loan online, submit income and identity documents, receive an eligibility decision, and track their application. The system should protect customer data, flag applications that need manual review, and notify applicants when their status changes.";
  $("#businessObjective").focus();
});
$("#continueInterview").addEventListener("click", () => advanceInterview(true));
$("#skipInterviewQuestion").addEventListener("click", () => advanceInterview(false));
$("#createProject").addEventListener("click", async () => {
  const button = $("#createProject");
  button.disabled = true;
  try {
    const data = new FormData();
    data.append("functionality", $("#functionality").value.trim());
    data.append("stakeholder_input", JSON.stringify(interviewAnswers));
    [...$("#files").files].forEach((file) => data.append("files", file));
    const result = await request("/api/projects", { method: "POST", body: data });
    projectId = result.project_id;
    projectHasRequirements = false;
    $("#generateButton").textContent = "Generate requirements";
    $("#projectState").textContent = "Project ready";
    $("#newProjectButton").classList.remove("is-hidden");
    $("#exportLink").href = `/api/projects/${projectId}/export`;
    $("#reportLink").href = `/api/projects/${projectId}/report`;
    $("#exportLink").classList.remove("is-hidden");
    $("#reportLink").classList.remove("is-hidden");
    displayDocuments(result.documents, result.rag);
    displayRetrievedEvidence(await request(`/api/projects/${projectId}/retrieval`));
    $("#interviewComplete").classList.add("is-hidden");
    toast("Sources were indexed and the most relevant evidence is ready for review.");
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
});
$("#retrieveButton").addEventListener("click", async () => { if (!projectId) return; const button = $("#retrieveButton"); button.disabled = true; try { const query = $("#retrievalQuery").value.trim() || $("#functionality").value.trim(); displayRetrievedEvidence(await request(`/api/projects/${projectId}/retrieval?query=${encodeURIComponent(query)}`)); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
$("#generateButton").addEventListener("click", async () => {
  if (!projectId) return;
  if (projectHasRequirements && !window.confirm("Regenerating replaces draft edits and approval decisions. Continue?")) return;
  const button = $("#generateButton");
  button.disabled = true;
  try {
    const project = await request(`/api/projects/${projectId}/requirements`, { method: "POST" });
    projectHasRequirements = true;
    button.textContent = "Regenerate drafts";
    displayRequirements(project);
    displayIssues(project.quality_issues);
    displayAgentAnalysis(project);
    $("#sdlcPanel").classList.remove("is-hidden");
    $("#sdlcResult").innerHTML = "";
    toast("Evidence-grounded drafts and specialist reviews are ready.");
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
});
$("#sdlcButton").addEventListener("click", async () => { if (!projectId) return; const button = $("#sdlcButton"); button.disabled = true; try { displaySdlc(await request(`/api/projects/${projectId}/sdlc`, { method: "POST" })); toast("SDLC recommendation generated. Human approval remains required."); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
$("#newProjectButton").addEventListener("click", () => window.location.reload());
$(".saved-projects").addEventListener("toggle", () => { if ($(".saved-projects").open) refreshSavedProjects(); });
refreshSavedProjects();
