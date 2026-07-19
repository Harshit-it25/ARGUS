from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from enum import Enum

# Organization Schemas
class OrganizationCreate(BaseModel):
    name: str
    industry: Optional[str] = None

class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    industry: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Department Schemas
class DepartmentCreate(BaseModel):
    name: str
    org_id: UUID

class DepartmentResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    model_config = ConfigDict(from_attributes=True)

# User Schemas
class UserRole(str, Enum):
    admin = "admin"
    compliance_officer = "compliance_officer"
    department_head = "department_head"
    auditor = "auditor"
    viewer = "viewer"

class UserCreate(BaseModel):
    email: str
    password: str
    role: UserRole = UserRole.viewer
    org_id: UUID
    department_id: Optional[UUID] = None

class UserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole
    org_id: UUID
    department_id: Optional[UUID]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Circular Schemas
class CircularStatus(str, Enum):
    uploaded = "uploaded"
    obligations_extracted = "obligations_extracted"
    extraction_failed = "extraction_failed"
    mapped = "mapped"
    stress_tested = "stress_tested"
    remediated = "remediated"

class CircularCreate(BaseModel):
    title: str
    org_id: UUID
    effective_date: Optional[date] = None

class CircularResponse(BaseModel):
    id: UUID
    org_id: UUID
    title: str
    source_file_url: Optional[str]
    effective_date: Optional[date]
    status: CircularStatus
    raw_text: Optional[str]
    processing_errors: Optional[List[str]] = None
    uploaded_by: Optional[UUID]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Obligation Schemas
class ObligationStatus(str, Enum):
    ai_extracted = "ai_extracted"
    confirmed = "confirmed"
    edited = "edited"
    manually_added = "manually_added"

class ObligationCreate(BaseModel):
    circular_id: UUID
    description: str
    deadline: Optional[date] = None
    applicability: Optional[str] = None
    source_ref: Optional[str] = None

class ObligationUpdate(BaseModel):
    description: Optional[str] = None
    deadline: Optional[date] = None
    applicability: Optional[str] = None
    source_ref: Optional[str] = None
    status: Optional[ObligationStatus] = None

class ObligationResponse(BaseModel):
    id: UUID
    circular_id: UUID
    description: str
    deadline: Optional[date]
    applicability: Optional[str]
    source_ref: Optional[str]
    status: ObligationStatus
    confirmed_by: Optional[UUID]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Policy Schemas
class DocumentType(str, Enum):
    policy = "policy"
    sop = "sop"
    workflow_definition = "workflow_definition"

class PolicyCreate(BaseModel):
    title: str
    org_id: UUID
    department_id: Optional[UUID] = None
    document_type: DocumentType
    last_updated: Optional[date] = None

class PolicyResponse(BaseModel):
    id: UUID
    org_id: UUID
    title: str
    document_url: Optional[str]
    department_id: Optional[UUID]
    last_updated: Optional[date]
    document_type: DocumentType
    model_config = ConfigDict(from_attributes=True)

# Mapping Schemas
class MappingSource(str, Enum):
    ai = "ai"
    manual = "manual"

class MappingCreate(BaseModel):
    obligation_id: UUID
    policy_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    confidence: Optional[float] = None
    mapping_source: MappingSource = MappingSource.ai

class MappingResponse(BaseModel):
    id: UUID
    obligation_id: UUID
    policy_id: Optional[UUID]
    department_id: Optional[UUID]
    confidence: Optional[float]
    mapping_source: MappingSource
    confirmed_by: Optional[UUID]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Finding Schemas
class FindingType(str, Enum):
    unimplemented = "unimplemented"
    outdated_procedure = "outdated_procedure"
    policy_conflict = "policy_conflict"
    workflow_gap = "workflow_gap"
    missing_evidence = "missing_evidence"

class FindingSeverity(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"

class FindingStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"

class FindingResponse(BaseModel):
    id: UUID
    circular_id: UUID
    obligation_id: UUID
    type: FindingType
    severity: FindingSeverity
    description: str
    status: FindingStatus
    detected_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Evidence Schemas
class EvidenceDocumentType(str, Enum):
    policy_document = "policy_document"
    training_record = "training_record"
    compliance_report = "compliance_report"
    approval = "approval"
    audit_document = "audit_document"

class EvidenceStatus(str, Enum):
    present = "present"
    stale = "stale"
    missing = "missing"

class EvidenceCreate(BaseModel):
    org_id: UUID
    finding_id: Optional[UUID] = None
    obligation_id: Optional[UUID] = None
    document_type: EvidenceDocumentType

class EvidenceResponse(BaseModel):
    id: UUID
    org_id: UUID
    finding_id: Optional[UUID]
    obligation_id: Optional[UUID]
    document_url: Optional[str]
    document_type: EvidenceDocumentType
    status: EvidenceStatus
    uploaded_by: Optional[UUID]
    verified_at: Optional[datetime]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Readiness Score Schemas
class ReadinessScoreResponse(BaseModel):
    id: UUID
    org_id: UUID
    circular_id: Optional[UUID]
    overall_score: float
    policy_alignment: float
    control_coverage: float
    evidence_completeness: float
    workflow_readiness: float
    employee_readiness: float
    computed_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Regulatory Replay Schemas
class RegulatoryReplayResponse(BaseModel):
    id: UUID
    finding_id: UUID
    chain_json: List[dict]
    explanation: str
    generated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Action Plan Schemas
class ActionPriority(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"

class ActionStatus(str, Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"

class ActionItemUpdate(BaseModel):
    status: ActionStatus

class ActionItemResponse(BaseModel):
    id: UUID
    finding_id: UUID
    owner_department_id: Optional[UUID]
    priority: ActionPriority
    suggested_deadline: Optional[date]
    status: ActionStatus
    updated_by: Optional[UUID]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Dashboard Schemas
class DashboardStats(BaseModel):
    total_circulars: int
    total_obligations: int
    total_findings: int
    high_risk_findings: int
    current_rri: Optional[float]
    recent_circulars: List[CircularResponse]
    rri_trend: List[ReadinessScoreResponse]

# Report Schemas
class ReportResponse(BaseModel):
    id: UUID
    org_id: UUID
    circular_id: Optional[UUID]
    file_url: Optional[str]
    generated_at: datetime
    generated_by: Optional[UUID]
    model_config = ConfigDict(from_attributes=True)

# Advisor Schemas
class AdvisorQuery(BaseModel):
    question: str
    org_id: Optional[UUID] = None

class AdvisorResponse(BaseModel):
    answer: str
    sources: List[str]

