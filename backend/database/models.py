from sqlalchemy import Column, String, Text, Date, DateTime, Numeric, Enum, ForeignKey, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from database.connection import Base

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    industry = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="organization", cascade="all, delete-orphan")
    circulars = relationship("Circular", back_populates="organization", cascade="all, delete-orphan")

class Department(Base):
    __tablename__ = "departments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    organization = relationship("Organization", back_populates="departments")
    users = relationship("User", back_populates="department")

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    email = Column(Text, nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    role = Column(Enum("admin", "compliance_officer", "department_head", "auditor", "viewer", name="user_role"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    organization = relationship("Organization", back_populates="users")
    department = relationship("Department", back_populates="users")

class Policy(Base):
    __tablename__ = "policies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    document_url = Column(Text)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    last_updated = Column(Date)
    document_type = Column(Enum("policy", "sop", "workflow_definition", name="document_type"), nullable=False)
    status = Column(Enum("active", "archived", "draft", name="policy_status"), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Circular(Base):
    __tablename__ = "circulars"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    source_file_url = Column(Text)
    effective_date = Column(Date)
    status = Column(Enum("uploaded", "obligations_extracted", "extraction_failed", "mapped", "stress_tested", "remediated", name="circular_status"), default="uploaded")
    raw_text = Column(Text)
    processing_errors = Column(JSON)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    organization = relationship("Organization", back_populates="circulars")
    obligations = relationship("Obligation", back_populates="circular", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="circular", cascade="all, delete-orphan")

class Obligation(Base):
    __tablename__ = "obligations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circular_id = Column(UUID(as_uuid=True), ForeignKey("circulars.id"), nullable=False)
    description = Column(Text, nullable=False)
    deadline = Column(Date, nullable=True)
    applicability = Column(Text)
    source_ref = Column(Text)
    status = Column(Enum("ai_extracted", "confirmed", "edited", "manually_added", name="obligation_status"), default="ai_extracted")
    confirmed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    circular = relationship("Circular", back_populates="obligations")
    findings = relationship("Finding", back_populates="obligation", cascade="all, delete-orphan")
    mappings = relationship("ObligationPolicyMapping", back_populates="obligation", cascade="all, delete-orphan")

class ObligationPolicyMapping(Base):
    __tablename__ = "obligation_policy_mappings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    obligation_id = Column(UUID(as_uuid=True), ForeignKey("obligations.id"), nullable=False)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("policies.id"), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    confidence = Column(Numeric(3, 2))
    mapping_source = Column(Enum("ai", "manual", name="mapping_source"), default="ai")
    audit_trail = Column(JSON, nullable=True)
    confirmed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    obligation = relationship("Obligation", back_populates="mappings")

class Finding(Base):
    __tablename__ = "findings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circular_id = Column(UUID(as_uuid=True), ForeignKey("circulars.id"), nullable=False)
    obligation_id = Column(UUID(as_uuid=True), ForeignKey("obligations.id"), nullable=False)
    type = Column(Enum("unimplemented", "outdated_procedure", "policy_conflict", "workflow_gap", "missing_evidence", name="finding_type"), nullable=False)
    severity = Column(Enum("high", "medium", "low", name="finding_severity"), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum("open", "in_progress", "resolved", name="finding_status"), default="open")
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    circular = relationship("Circular", back_populates="findings")
    obligation = relationship("Obligation", back_populates="findings")
    action_items = relationship("ActionItem", back_populates="finding", cascade="all, delete-orphan")
    replay = relationship("RegulatoryReplay", back_populates="finding", uselist=False, cascade="all, delete-orphan")
    evidence = relationship("Evidence", back_populates="finding")

class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    finding_id = Column(UUID(as_uuid=True), ForeignKey("findings.id"), nullable=True)
    obligation_id = Column(UUID(as_uuid=True), ForeignKey("obligations.id"), nullable=True)
    document_url = Column(Text)
    document_type = Column(Enum("policy_document", "training_record", "compliance_report", "approval", "audit_document", name="evidence_document_type"))
    status = Column(Enum("present", "stale", "missing", name="evidence_status"), default="missing")
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    finding = relationship("Finding", back_populates="evidence")

class RegulatoryReplay(Base):
    __tablename__ = "regulatory_replays"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    finding_id = Column(UUID(as_uuid=True), ForeignKey("findings.id"), nullable=False)
    chain_json = Column(JSON)
    explanation = Column(Text)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    finding = relationship("Finding", back_populates="replay")

class ReadinessScore(Base):
    __tablename__ = "readiness_scores"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    circular_id = Column(UUID(as_uuid=True), ForeignKey("circulars.id"), nullable=True)
    overall_score = Column(Numeric(5, 2))
    policy_alignment = Column(Numeric(5, 2))
    control_coverage = Column(Numeric(5, 2))
    evidence_completeness = Column(Numeric(5, 2))
    workflow_readiness = Column(Numeric(5, 2))
    employee_readiness = Column(Numeric(5, 2))
    computed_at = Column(DateTime(timezone=True), server_default=func.now())

class ActionItem(Base):
    __tablename__ = "action_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    finding_id = Column(UUID(as_uuid=True), ForeignKey("findings.id"), nullable=False)
    owner_department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    priority = Column(Enum("high", "medium", "low", name="action_priority"), nullable=False)
    suggested_deadline = Column(Date)
    status = Column(Enum("not_started", "in_progress", "done", name="action_status"), default="not_started")
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    finding = relationship("Finding", back_populates="action_items")

class Report(Base):
    __tablename__ = "reports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    circular_id = Column(UUID(as_uuid=True), ForeignKey("circulars.id"), nullable=True)
    file_url = Column(Text)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
