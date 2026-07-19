-- ARGUS Database Schema Initialization
-- Run on first startup to create all tables

-- Drop enums if they exist (for clean re-runs)
DO $$
BEGIN
    -- These will be created by SQLAlchemy; this file is a fallback
    -- for Docker init when needed.
END $$;

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'compliance_officer', 'department_head', 'auditor', 'viewer')),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_url TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    last_updated DATE,
    document_type TEXT NOT NULL CHECK (document_type IN ('policy', 'sop', 'workflow_definition')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circulars
CREATE TABLE IF NOT EXISTS circulars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_file_url TEXT,
    effective_date DATE,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'obligations_extracted', 'mapped', 'stress_tested', 'remediated')),
    raw_text TEXT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Obligations
CREATE TABLE IF NOT EXISTS obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circular_id UUID NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    deadline DATE,
    applicability TEXT,
    source_ref TEXT,
    status TEXT DEFAULT 'ai_extracted' CHECK (status IN ('ai_extracted', 'confirmed', 'edited', 'manually_added')),
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Obligation-Policy Mappings
CREATE TABLE IF NOT EXISTS obligation_policy_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obligation_id UUID NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    confidence NUMERIC(3,2),
    mapping_source TEXT DEFAULT 'ai' CHECK (mapping_source IN ('ai', 'manual')),
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(obligation_id, policy_id)
);

-- Findings
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circular_id UUID NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
    obligation_id UUID NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('unimplemented', 'outdated_procedure', 'policy_conflict', 'workflow_gap', 'missing_evidence')),
    severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES findings(id) ON DELETE SET NULL,
    obligation_id UUID REFERENCES obligations(id) ON DELETE SET NULL,
    document_url TEXT,
    document_type TEXT CHECK (document_type IN ('policy_document', 'training_record', 'compliance_report', 'approval', 'audit_document')),
    status TEXT DEFAULT 'missing' CHECK (status IN ('present', 'stale', 'missing')),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regulatory Replays
CREATE TABLE IF NOT EXISTS regulatory_replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    chain_json JSONB,
    explanation TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Readiness Scores
CREATE TABLE IF NOT EXISTS readiness_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    circular_id UUID REFERENCES circulars(id) ON DELETE SET NULL,
    overall_score NUMERIC(5,2),
    policy_alignment NUMERIC(5,2),
    control_coverage NUMERIC(5,2),
    evidence_completeness NUMERIC(5,2),
    workflow_readiness NUMERIC(5,2),
    employee_readiness NUMERIC(5,2),
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Action Items
CREATE TABLE IF NOT EXISTS action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    owner_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    suggested_deadline DATE,
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    circular_id UUID REFERENCES circulars(id) ON DELETE SET NULL,
    file_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Revoked Tokens
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_obligations_circular_id ON obligations(circular_id);
CREATE INDEX IF NOT EXISTS idx_findings_circular_id ON findings(circular_id);
CREATE INDEX IF NOT EXISTS idx_readiness_scores_org_computed ON readiness_scores(org_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_departments_org_id ON departments(org_id);
CREATE INDEX IF NOT EXISTS idx_policies_org_id ON policies(org_id);
CREATE INDEX IF NOT EXISTS idx_evidence_org_id ON evidence(org_id);
CREATE INDEX IF NOT EXISTS idx_action_items_finding_id ON action_items(finding_id);
CREATE INDEX IF NOT EXISTS idx_mappings_obligation_id ON obligation_policy_mappings(obligation_id);
CREATE INDEX IF NOT EXISTS idx_mappings_policy_id ON obligation_policy_mappings(policy_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_type ON findings(type);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_circulars_org_id ON circulars(org_id);
CREATE INDEX IF NOT EXISTS idx_circulars_status ON circulars(status);
