from __future__ import annotations

import re

from app.schemas import AgentReview, Category, ComplianceMapping, QualityIssue, Requirement, TraceabilityRecord


CONTROL_AREAS = {
    Category.SECURITY: "Access control and information security",
    Category.PRIVACY: "Personal data handling and retention",
    Category.REGULATORY: "Policy and regulatory obligations",
    Category.AUDIT: "Audit trail and reporting",
}


def _draft_story(requirement: Requirement) -> str:
    statement = requirement.statement.strip()
    capability = re.sub(
        r"^.*?\b(?:shall|must|should|will)\s+",
        "",
        statement,
        flags=re.IGNORECASE,
    ).rstrip(" .")
    if capability == statement:
        capability = f"implement requirement {requirement.id}"
    capability = capability[0].lower() + capability[1:] if capability else f"meet requirement {requirement.id}"
    benefit = requirement.business_justification.rstrip(" .")
    benefit = benefit[0].lower() + benefit[1:] if benefit else "support the stated project objective"
    return (
        f"As [stakeholder role to confirm], I need the system to {capability} "
        f"so that {benefit}."
    )


def _draft_use_case(requirement: Requirement) -> str:
    return (
        "Actor: [confirm with stakeholder]. Trigger: [confirm the event that starts this flow]. "
        f"Expected outcome: {requirement.statement.strip()} "
        "Exceptions and alternate flows: [confirm from an approved source]."
    )


def _compliance_mappings(requirements: list[Requirement]) -> list[ComplianceMapping]:
    mappings: list[ComplianceMapping] = []
    for requirement in requirements:
        areas = [area for category, area in CONTROL_AREAS.items() if category in requirement.categories]
        if not areas:
            continue
        for evidence in requirement.evidence:
            for area in areas:
                mappings.append(ComplianceMapping(
                    requirement_id=requirement.id,
                    control_area=area,
                    source_name=evidence.document_name,
                    source_excerpt=evidence.excerpt,
                ))
    return mappings


def coordinate_reviews(
    functionality: str,
    requirements: list[Requirement],
    quality_issues: list[QualityIssue],
) -> tuple[list[AgentReview], list[ComplianceMapping], list[TraceabilityRecord]]:
    """Run focused, deterministic review passes over evidence-grounded draft requirements."""
    mappings = _compliance_mappings(requirements)
    linked = [requirement for requirement in requirements if requirement.evidence]
    unresolved = [requirement for requirement in requirements if not requirement.acceptance_criteria]
    security_requirements = [
        requirement for requirement in requirements
        if {Category.SECURITY, Category.PRIVACY} & set(requirement.categories)
    ]
    conflict_issues = [issue for issue in quality_issues if issue.check == "Potential conflict"]
    high_risk = [requirement for requirement in requirements if requirement.risk_level == "High"]

    for requirement in requirements:
        requirement.user_story = _draft_story(requirement)
        requirement.use_case = _draft_use_case(requirement)

    reviews = [
        AgentReview(
            agent="Requirement analyst",
            status="Complete" if linked else "No evidence",
            summary=f"Reviewed {len(requirements)} draft requirement(s) for {functionality}; {len(linked)} have cited source evidence.",
            findings=["User stories and use-case outlines are drafts; confirm actors, triggers, and outcomes with stakeholders."],
            requirement_ids=[requirement.id for requirement in requirements],
        ),
        AgentReview(
            agent="Quality and clarification",
            status="Needs review" if quality_issues or unresolved else "Complete",
            summary=f"Found {len(quality_issues)} quality finding(s) and {len(unresolved)} requirement(s) without acceptance criteria.",
            findings=[issue.message for issue in quality_issues[:6]] or ["No deterministic quality findings; human validation remains required."],
            requirement_ids=sorted({issue.requirement_id for issue in quality_issues if issue.requirement_id}),
        ),
        AgentReview(
            agent="Compliance analyst",
            status="Needs review" if mappings else "No evidence",
            summary=f"Prepared {len(mappings)} source-linked candidate control mapping(s).",
            findings=["Mappings reflect categories and excerpts in the supplied project sources. A compliance officer must confirm jurisdiction, applicability, and interpretation."],
            requirement_ids=sorted({mapping.requirement_id for mapping in mappings}),
        ),
        AgentReview(
            agent="Security and privacy analyst",
            status="Complete" if security_requirements else "Needs review",
            summary=f"Identified {len(security_requirements)} draft requirement(s) classified as security or privacy.",
            findings=[] if security_requirements else ["No security or privacy requirement was identified. Ask the security and privacy owners to confirm applicable controls."],
            requirement_ids=[requirement.id for requirement in security_requirements],
        ),
        AgentReview(
            agent="Risk and conflict analyst",
            status="Needs review" if high_risk or conflict_issues else "Complete",
            summary=f"Identified {len(high_risk)} high-risk draft(s) and {len(conflict_issues)} possible conflict(s).",
            findings=[issue.message for issue in conflict_issues[:6]] or (["High-risk requirements require owner review."] if high_risk else ["No explicit contradiction was detected by the rule-based check."]),
            requirement_ids=sorted({requirement.id for requirement in high_risk} | {issue.requirement_id for issue in conflict_issues if issue.requirement_id}),
        ),
        AgentReview(
            agent="Traceability analyst",
            status="Complete" if requirements and len(linked) == len(requirements) else "Needs review",
            summary=f"Linked {len(linked)} of {len(requirements)} draft requirement(s) to source evidence.",
            findings=["Approval state and confidence are recorded per requirement; review the linked source before baselining."],
            requirement_ids=[requirement.id for requirement in linked],
        ),
    ]

    traceability = [
        TraceabilityRecord(
            requirement_id=requirement.id,
            source_references=[f"{evidence.document_name} / {evidence.chunk_id}" for evidence in requirement.evidence],
            approval_status=requirement.approval_status,
            confidence=requirement.confidence,
        )
        for requirement in requirements
    ]
    return reviews, mappings, traceability
