from __future__ import annotations

from app.schemas import Project


def _cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def build_project_report(project: Project) -> str:
    lines = [
        f"# Software Requirements Specification: {project.functionality}",
        "",
        f"Project ID: `{project.id}`  ",
        f"Created: {project.created_at.isoformat()}",
        "",
        "> This is an advisory draft. Requirements, control mappings, and the SDLC recommendation require review and approval by the responsible business, security, risk, and compliance owners.",
        "",
        "## Scope and sources",
        "",
        f"Financial functionality: **{project.functionality}**",
        "",
    ]
    if project.documents:
        lines.extend(f"- {document.get('name', 'Source document')} ({len(document.get('chunks', []))} indexed evidence chunk(s))" for document in project.documents)
    else:
        lines.append("No source documents are recorded.")

    lines.extend(["", "## Draft requirements", ""])
    if project.requirements:
        lines.extend(["| ID | Requirement | Category | Priority | Risk | Approval |", "| --- | --- | --- | --- | --- | --- |"])
        for req in project.requirements:
            categories = ", ".join(category.value for category in req.categories)
            lines.append(
                f"| {req.id} | {_cell(req.statement)} | {_cell(categories)} | {req.priority} | {req.risk_level} | {req.approval_status} |"
            )
        for req in project.requirements:
            lines.extend(["", f"### {req.id}", "", f"**User story:** {req.user_story or 'To be drafted with stakeholders.'}", "", f"**Use case outline:** {req.use_case or 'To be refined with stakeholders.'}", "", f"**Business justification:** {req.business_justification}", "", "**Acceptance criteria:**"])
            if req.acceptance_criteria:
                lines.extend(f"- {criterion}" for criterion in req.acceptance_criteria)
            else:
                lines.append("- To be defined and approved before baselining.")
            lines.extend(["", "**Evidence:**"])
            if req.evidence:
                lines.extend(f"- {evidence.document_name} / {evidence.chunk_id}: {evidence.excerpt}" for evidence in req.evidence)
            else:
                lines.append("- No source evidence linked.")
    else:
        lines.append("No requirements have been generated.")

    lines.extend(["", "## Specialist review", ""])
    if project.agent_reviews:
        for review in project.agent_reviews:
            lines.extend([f"### {review.agent} — {review.status}", "", review.summary, ""])
            lines.extend(f"- {finding}" for finding in review.findings)
            if review.requirement_ids:
                lines.append(f"- Linked requirements: {', '.join(review.requirement_ids)}")
            lines.append("")
    else:
        lines.append("Specialist review has not been run.")

    lines.extend(["## Candidate control mappings", "", "These mappings are based on source-linked requirement categories. They do not establish regulatory applicability or legal compliance.", ""])
    if project.compliance_mappings:
        lines.extend(["| Requirement | Candidate control area | Source | Evidence | Review |", "| --- | --- | --- | --- | --- |"])
        for mapping in project.compliance_mappings:
            lines.append(f"| {mapping.requirement_id} | {_cell(mapping.control_area)} | {_cell(mapping.source_name)} | {_cell(mapping.source_excerpt)} | {mapping.review_status} |")
    else:
        lines.append("No source-backed candidate control mappings are available.")

    lines.extend(["", "## Quality review queue", ""])
    if project.quality_issues:
        for issue in project.quality_issues:
            lines.append(f"- **{issue.severity} · {issue.check} · {issue.requirement_id or 'Project'}:** {issue.message} Recommended action: {issue.recommendation}")
    else:
        lines.append("No deterministic quality findings were recorded. Human review is still required.")

    lines.extend(["", "## Traceability", ""])
    if project.traceability:
        lines.extend(["| Requirement | Sources | Confidence | Approval |", "| --- | --- | --- | --- |"])
        for record in project.traceability:
            sources = "; ".join(record.source_references) or "No source linked"
            lines.append(f"| {record.requirement_id} | {_cell(sources)} | {record.confidence:.0%} | {record.approval_status} |")
    else:
        lines.append("Traceability records are not available yet.")

    lines.extend(["", "## SDLC recommendation", ""])
    if project.sdlc:
        lines.extend([f"**Recommended approach:** {project.sdlc.recommended_sdlc}", "", project.sdlc.justification, "", "### Ranked alternatives", ""])
        lines.extend(f"- {option.name}: {option.score}% — {option.suitability}" for option in project.sdlc.options)
        lines.extend(["", "### Workflow and approval gates", ""])
        for phase in project.sdlc.workflow:
            lines.extend([f"#### {phase.phase}", "", f"Activities: {'; '.join(phase.activities)}", "", f"Roles: {', '.join(phase.roles)}", "", f"Deliverables: {', '.join(phase.deliverables)}", "", f"Approval gate: {phase.gate}", ""])
        lines.append("Final SDLC selection requires human approval.")
    else:
        lines.append("Run SDLC analysis after reviewing the generated requirements.")

    lines.extend(["", "## Audit trail", ""])
    for event in project.audit_log:
        lines.append(f"- {event.get('at', '')} — {event.get('action', '')}: {event.get('detail', '')}")
    return "\n".join(lines).rstrip() + "\n"
