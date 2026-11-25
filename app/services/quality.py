from __future__ import annotations

import re

from app.schemas import QualityIssue, Requirement


VAGUE = {"fast", "secure", "easy", "appropriate", "efficient", "robust", "user-friendly", "adequate"}


def _polarity(statement: str) -> str | None:
    text = statement.lower()
    negative = bool(re.search(r"\b(?:must not|shall not|cannot|prohibit(?:ed)?|disallow|disable|deny)\b", text))
    if negative:
        return "negative"
    positive = bool(re.search(r"\b(?:must|shall|allow|enable|permit|support)\b", text))
    return "positive" if positive else None


def analyse(requirements: list[Requirement]) -> list[QualityIssue]:
    issues: list[QualityIssue] = []
    for req in requirements:
        statement = req.statement.lower()
        if any(re.search(rf"\b{re.escape(word)}\b", statement) for word in VAGUE):
            issues.append(QualityIssue(id=f"QI-{len(issues)+1:03d}", requirement_id=req.id, check="Ambiguity", severity="Medium", message="The requirement contains a qualitative term without a measurable threshold.", recommendation="Define an observable metric, limit, or acceptance test."))
        if not req.evidence:
            issues.append(QualityIssue(id=f"QI-{len(issues)+1:03d}", requirement_id=req.id, check="Missing evidence", severity="High", message="No source evidence is attached.", recommendation="Link an approved source or mark the item as an explicit stakeholder decision."))
        if not req.acceptance_criteria or any("Human reviewer" in item for item in req.acceptance_criteria):
            issues.append(QualityIssue(id=f"QI-{len(issues)+1:03d}", requirement_id=req.id, check="Lack of testability", severity="Medium", message="Acceptance criteria are absent or not yet measurable.", recommendation="Add pass/fail criteria, test data, and expected outcome."))
        if not any(category.value in {"Security", "Privacy", "Regulatory"} for category in req.categories):
            issues.append(QualityIssue(id=f"QI-{len(issues)+1:03d}", requirement_id=req.id, check="Missing security or compliance requirements", severity="Low", message="This item has no linked security, privacy, or regulatory control.", recommendation="Confirm whether a control is not applicable or add an evidence-backed control."))
    for index, first in enumerate(requirements):
        normalized = set(re.findall(r"[a-z]{5,}", first.statement.lower()))
        for second in requirements[index + 1:]:
            other = set(re.findall(r"[a-z]{5,}", second.statement.lower()))
            if normalized and len(normalized & other) / len(normalized | other) > 0.72:
                issues.append(QualityIssue(id=f"QI-{len(issues)+1:03d}", requirement_id=first.id, check="Duplication", severity="Medium", message=f"Potential overlap with {second.id}.", recommendation="Merge, differentiate scope, or link the requirements."))
            first_polarity = _polarity(first.statement)
            second_polarity = _polarity(second.statement)
            if normalized and first_polarity and second_polarity and first_polarity != second_polarity:
                shared = len(normalized & other) / max(1, len(normalized | other))
                if shared > 0.4:
                    issues.append(QualityIssue(id=f"QI-{len(issues)+1:03d}", requirement_id=first.id, check="Potential conflict", severity="High", message=f"{first.id} and {second.id} use opposing obligation language over similar terms.", recommendation="Ask the requirement owners to reconcile the scope and record the approved decision."))
    return issues
