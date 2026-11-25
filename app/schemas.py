from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class Category(StrEnum):
    BUSINESS = "Business"
    STAKEHOLDER = "Stakeholder"
    FUNCTIONAL = "Functional"
    SECURITY = "Security"
    PRIVACY = "Privacy"
    REGULATORY = "Regulatory"
    PERFORMANCE = "Performance"
    AVAILABILITY = "Availability / reliability"
    USABILITY = "Usability"
    DATA = "Data management"
    INTEGRATION = "Integration"
    AUDIT = "Audit / reporting"
    OPERATIONAL = "Operational / maintenance"


class Evidence(BaseModel):
    document_id: str
    document_name: str
    chunk_id: str
    excerpt: str
    relevance: float = Field(ge=0, le=1)


class Requirement(BaseModel):
    id: str
    statement: str
    categories: list[Category]
    evidence: list[Evidence] = Field(default_factory=list)
    business_justification: str
    priority: Literal["Must", "Should", "Could"] = "Should"
    dependencies: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    applicable_policy: str | None = None
    risk_level: Literal["Low", "Medium", "High"] = "Medium"
    confidence: float = Field(ge=0, le=1)
    reasoning: str
    approval_status: Literal["Draft", "Approved", "Rejected", "Needs review"] = "Draft"
    user_story: str | None = None
    use_case: str | None = None


class RequirementRevision(BaseModel):
    statement: str
    acceptance_criteria: list[str] = Field(default_factory=list)


class QualityIssue(BaseModel):
    id: str
    requirement_id: str | None = None
    check: str
    severity: Literal["Low", "Medium", "High"]
    message: str
    recommendation: str


class SdlcFactor(BaseModel):
    name: str
    value: str
    score: int = Field(ge=1, le=5)
    rationale: str
    requirement_ids: list[str] = Field(default_factory=list)


class SdlcOption(BaseModel):
    name: str
    score: int = Field(ge=0, le=100)
    suitability: str


class WorkflowPhase(BaseModel):
    phase: str
    activities: list[str]
    roles: list[str]
    deliverables: list[str]
    gate: str


class AgentReview(BaseModel):
    agent: str
    status: Literal["Complete", "Needs review", "No evidence"]
    summary: str
    findings: list[str] = Field(default_factory=list)
    requirement_ids: list[str] = Field(default_factory=list)


class ComplianceMapping(BaseModel):
    requirement_id: str
    control_area: str
    source_name: str
    source_excerpt: str
    review_status: Literal["Human mapping required"] = "Human mapping required"
    note: str = "Candidate mapping from project evidence. Confirm jurisdiction, applicability, and control interpretation with an authorised compliance reviewer."


class TraceabilityRecord(BaseModel):
    requirement_id: str
    source_references: list[str] = Field(default_factory=list)
    approval_status: Literal["Draft", "Approved", "Rejected", "Needs review"]
    confidence: float = Field(ge=0, le=1)


class SdlcRecommendation(BaseModel):
    recommended_sdlc: str
    factors: list[SdlcFactor]
    options: list[SdlcOption]
    justification: str
    workflow: list[WorkflowPhase]
    human_approval_required: bool = True


class Project(BaseModel):
    id: str
    functionality: str
    created_at: datetime
    documents: list[dict] = Field(default_factory=list)
    requirements: list[Requirement] = Field(default_factory=list)
    quality_issues: list[QualityIssue] = Field(default_factory=list)
    agent_reviews: list[AgentReview] = Field(default_factory=list)
    compliance_mappings: list[ComplianceMapping] = Field(default_factory=list)
    traceability: list[TraceabilityRecord] = Field(default_factory=list)
    sdlc: SdlcRecommendation | None = None
    audit_log: list[dict] = Field(default_factory=list)
