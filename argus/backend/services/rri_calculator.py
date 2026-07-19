from sqlalchemy.orm import Session
from database.models import (
    Organization, Circular, Obligation, Finding, Evidence, 
    ObligationPolicyMapping, ActionItem, ReadinessScore
)
from database.connection import SessionLocal
from datetime import datetime
from typing import Optional
import uuid

def calculate_rri(org_id: str, circular_id: Optional[str] = None, db: Session = None) -> ReadinessScore:
    """
    Deterministic RRI Calculator per TRD Section 3.5.
    
    Components:
    - Policy Alignment (25%): mapped obligations / total obligations
    - Control Coverage (25%): obligations without 'unimplemented' finding / total
    - Evidence Completeness (20%): 'present' evidence / total evidence required
    - Workflow Readiness (15%): obligations without 'workflow_gap' finding / total
    - Employee Readiness (15%): departments with training evidence / departments affected
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
    
    try:
        import uuid
        try:
            org_id_uuid = uuid.UUID(org_id)
            circular_id_uuid = uuid.UUID(circular_id) if circular_id else None
        except ValueError:
            return None
            
        # Get all obligations for this org/circular
        query = db.query(Obligation).join(Obligation.circular)
        if circular_id_uuid:
            query = query.filter(Obligation.circular_id == circular_id_uuid)
        else:
            query = query.filter(Obligation.circular.has(org_id=org_id_uuid))
        
        obligations = query.all()
        total_obligations = len(obligations)
        
        if total_obligations == 0:
            return None
        
        obligation_ids = [o.id for o in obligations]
        
        # 1. Policy Alignment (25%)
        mapped_count = db.query(ObligationPolicyMapping).filter(
            ObligationPolicyMapping.obligation_id.in_(obligation_ids),
            ObligationPolicyMapping.policy_id.isnot(None)
        ).distinct(ObligationPolicyMapping.obligation_id).count()
        policy_alignment = (mapped_count / total_obligations) * 100
        
        # 2. Control Coverage (25%)
        unimplemented_findings = db.query(Finding).filter(
            Finding.obligation_id.in_(obligation_ids),
            Finding.type == 'unimplemented'
        ).distinct(Finding.obligation_id).count()
        control_coverage = ((total_obligations - unimplemented_findings) / total_obligations) * 100
        
        # 3. Evidence Completeness (20%)
        evidence_items = db.query(Evidence).filter(
            Evidence.obligation_id.in_(obligation_ids)
        ).all()
        total_evidence = len(evidence_items)
        present_evidence = sum(1 for e in evidence_items if e.status == 'present')
        evidence_completeness = (present_evidence / total_evidence * 100) if total_evidence > 0 else 0
        
        # 4. Workflow Readiness (15%)
        workflow_gap_findings = db.query(Finding).filter(
            Finding.obligation_id.in_(obligation_ids),
            Finding.type == 'workflow_gap'
        ).distinct(Finding.obligation_id).count()
        workflow_readiness = ((total_obligations - workflow_gap_findings) / total_obligations) * 100
        
        # 5. Employee Readiness (15%)
        # Check which departments have training record evidence
        training_evidence = db.query(Evidence).filter(
            Evidence.obligation_id.in_(obligation_ids),
            Evidence.document_type == 'training_record',
            Evidence.status == 'present'
        ).distinct(Evidence.obligation_id).count()
        # Get unique departments affected
        dept_mappings = db.query(ObligationPolicyMapping).filter(
            ObligationPolicyMapping.obligation_id.in_(obligation_ids),
            ObligationPolicyMapping.department_id.isnot(None)
        ).distinct(ObligationPolicyMapping.department_id).all()
        affected_depts = len(dept_mappings) if dept_mappings else 1
        employee_readiness = (training_evidence / affected_depts * 100) if affected_depts > 0 else 0
        
        # Clamp values to 0-100
        policy_alignment = min(100, max(0, policy_alignment))
        control_coverage = min(100, max(0, control_coverage))
        evidence_completeness = min(100, max(0, evidence_completeness))
        workflow_readiness = min(100, max(0, workflow_readiness))
        employee_readiness = min(100, max(0, employee_readiness))
        
        # Weighted overall score
        overall = (
            policy_alignment * 0.25 +
            control_coverage * 0.25 +
            evidence_completeness * 0.20 +
            workflow_readiness * 0.15 +
            employee_readiness * 0.15
        )
        
        score = ReadinessScore(
            id=uuid.uuid4(),
            org_id=org_id_uuid,
            circular_id=circular_id_uuid,
            overall_score=round(overall, 2),
            policy_alignment=round(policy_alignment, 2),
            control_coverage=round(control_coverage, 2),
            evidence_completeness=round(evidence_completeness, 2),
            workflow_readiness=round(workflow_readiness, 2),
            employee_readiness=round(employee_readiness, 2),
            computed_at=datetime.utcnow()
        )
        
        db.add(score)
        if should_close:
            db.commit()
            db.refresh(score)
        else:
            db.flush()
            db.refresh(score)
        
        return score
        
    finally:
        if should_close:
            db.close()
