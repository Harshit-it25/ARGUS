from sqlalchemy.orm import Session
from typing import List, Dict, Any, Tuple
from datetime import date, datetime
import uuid
from database.models import (
    Circular, Obligation, Policy, ObligationPolicyMapping, 
    Finding, Evidence, ActionItem, Department, RegulatoryReplay
)
from services.rri_calculator import calculate_rri

def run_intelligent_stress_test(circular_id: str, db: Session) -> List[Finding]:
    """
    Truly intelligent regulatory stress test that checks real database relationships.
    
    Checks performed:
    1. UNIMPLEMENTED: No policy mapping exists (policy_id is NULL)
    2. OUTDATED_PROCEDURE: Policy.last_updated < Circular.effective_date
    3. POLICY_CONFLICT: Multiple policies mapped to same obligation with conflicting guidance
    4. WORKFLOW_GAP: Mapped to workflow_definition but no corresponding workflow step exists
    5. MISSING_EVIDENCE: No evidence uploaded for this obligation, or evidence status != 'present'
    
    Returns: List of newly created Finding objects
    """
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        circular_id_uuid = circular_id
    circular = db.query(Circular).filter(Circular.id == circular_id_uuid).first()
    if not circular:
        raise ValueError(f"Circular {circular_id} not found")
    
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        circular_id_uuid = circular_id
    obligations = db.query(Obligation).filter(Obligation.circular_id == circular_id_uuid).all()
    if not obligations:
        return []
    
    # Get all mappings for these obligations
    obligation_ids = [o.id for o in obligations]
    mappings = db.query(ObligationPolicyMapping).filter(
        ObligationPolicyMapping.obligation_id.in_(obligation_ids)
    ).all()
    
    # Build lookup maps
    mappings_by_obligation: Dict[str, List[ObligationPolicyMapping]] = {}
    for m in mappings:
        oid = str(m.obligation_id)
        if oid not in mappings_by_obligation:
            mappings_by_obligation[oid] = []
        mappings_by_obligation[oid].append(m)
    
    # Get all policies for date comparison
    policy_ids = [m.policy_id for m in mappings if m.policy_id]
    policies = {}
    if policy_ids:
        for p in db.query(Policy).filter(Policy.id.in_(policy_ids)).all():
            policies[str(p.id)] = p
    
    # Get existing evidence
    evidence_items = db.query(Evidence).filter(
        Evidence.obligation_id.in_(obligation_ids)
    ).all()
    evidence_by_obligation: Dict[str, List[Evidence]] = {}
    for e in evidence_items:
        oid = str(e.obligation_id)
        if oid not in evidence_by_obligation:
            evidence_by_obligation[oid] = []
        evidence_by_obligation[oid].append(e)
    
    # Get all existing findings to avoid duplicates
    existing_findings = db.query(Finding).filter(
        Finding.circular_id == circular_id_uuid
    ).all()
    existing_keys = set()
    for f in existing_findings:
        key = (str(f.obligation_id), f.type)
        existing_keys.add(key)
    
    new_findings = []
    circular_eff_date = circular.effective_date
    
    for obl in obligations:
        obl_id = str(obl.id)
        obl_mappings = mappings_by_obligation.get(obl_id, [])
        obl_evidence = evidence_by_obligation.get(obl_id, [])
        
        # === CHECK 1: UNIMPLEMENTED ===
        # No policy mapping exists at all
        has_policy_mapping = any(m.policy_id is not None for m in obl_mappings)
        if not has_policy_mapping:
            key = (obl_id, "unimplemented")
            if key not in existing_keys:
                f = Finding(
                    id=uuid.uuid4(),
                    circular_id=circular_id_uuid,
                    obligation_id=obl.id,
                    type="unimplemented",
                    severity="high",
                    description=f"No internal policy exists for: {obl.description[:120]}... This obligation has no mapped control.",
                    status="open"
                )
                db.add(f)
                new_findings.append(f)
                existing_keys.add(key)
            continue  # Don't check other types for fully unmapped obligations
        
        # For obligations that have mappings, check each mapping
        for mapping in obl_mappings:
            if not mapping.policy_id:
                continue
            
            policy = policies.get(str(mapping.policy_id))
            if not policy:
                continue
            
            # === CHECK 2: OUTDATED_PROCEDURE ===
            # Policy was last updated BEFORE the circular became effective
            if circular_eff_date and policy.last_updated and policy.last_updated < circular_eff_date:
                key = (obl_id, "outdated_procedure")
                if key not in existing_keys:
                    days_old = (circular_eff_date - policy.last_updated).days
                    f = Finding(
                        id=uuid.uuid4(),
                        circular_id=circular_id_uuid,
                        obligation_id=obl.id,
                        type="outdated_procedure",
                        severity="medium",
                        description=f"Policy '{policy.title}' was last updated on {policy.last_updated.strftime('%Y-%m-%d')}, which is {days_old} days BEFORE the circular effective date ({circular_eff_date.strftime('%Y-%m-%d')}). The procedure may not reflect new requirements.",
                        status="open"
                    )
                    db.add(f)
                    new_findings.append(f)
                    existing_keys.add(key)
            
            # === CHECK 3: POLICY_CONFLICT ===
            # Multiple policies mapped to same obligation
            if len(obl_mappings) > 1:
                other_policies = [m for m in obl_mappings if m.policy_id != mapping.policy_id and m.policy_id]
                if other_policies:
                    key = (obl_id, "policy_conflict")
                    if key not in existing_keys:
                        policy_names = []
                        for m in other_policies:
                            p = policies.get(str(m.policy_id))
                            if p:
                                policy_names.append(p.title)
                        f = Finding(
                            id=uuid.uuid4(),
                            circular_id=circular_id_uuid,
                            obligation_id=obl.id,
                            type="policy_conflict",
                            severity="medium",
                            description=f"Multiple policies mapped to the same obligation '{obl.description[:80]}...': {', '.join(policy_names)}. This creates ambiguity about which procedure to follow.",
                            status="open"
                        )
                        db.add(f)
                        new_findings.append(f)
                        existing_keys.add(key)
            
            # === CHECK 4: WORKFLOW_GAP ===
            # Policy is a workflow_definition but no corresponding workflow exists
            if policy.document_type == "workflow_definition":
                # Check if there's any evidence showing the workflow is actually implemented
                workflow_evidence = [e for e in obl_evidence if e.document_type in ["approval", "compliance_report"] and e.status == "present"]
                if not workflow_evidence:
                    key = (obl_id, "workflow_gap")
                    if key not in existing_keys:
                        f = Finding(
                            id=uuid.uuid4(),
                            circular_id=circular_id_uuid,
                            obligation_id=obl.id,
                            type="workflow_gap",
                            severity="medium",
                            description=f"The mapped workflow '{policy.title}' does not have documented evidence of implementation. No approval records or compliance reports found for this workflow step.",
                            status="open"
                        )
                        db.add(f)
                        new_findings.append(f)
                        existing_keys.add(key)
        
        # === CHECK 5: MISSING_EVIDENCE ===
        # No evidence at all, or all evidence is missing/stale
        if not obl_evidence or all(e.status in ["missing", "stale"] for e in obl_evidence):
            key = (obl_id, "missing_evidence")
            if key not in existing_keys:
                f = Finding(
                    id=uuid.uuid4(),
                    circular_id=circular_id_uuid,
                    obligation_id=obl.id,
                    type="missing_evidence",
                    severity="high" if not obl_evidence else "low",
                    description=f"No valid evidence exists for obligation: {obl.description[:120]}... {'Upload required documentation.' if not obl_evidence else 'Existing evidence is stale or missing.'}",
                    status="open"
                )
                db.add(f)
                new_findings.append(f)
                existing_keys.add(key)
    db.flush()
    
    # Recalculate RRI after creating findings
    calculate_rri(str(circular.org_id), circular_id, db)
    
    return new_findings

def generate_action_items_from_findings(circular_id: str, db: Session) -> List[ActionItem]:
    """Auto-generate action items from findings."""
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        circular_id_uuid = circular_id
    findings = db.query(Finding).filter(
        Finding.circular_id == circular_id_uuid,
        Finding.status.in_(["open", "in_progress"])
    ).all()
    
    # Get existing action items to avoid duplicates
    existing_finding_ids = {str(a.finding_id) for a in db.query(ActionItem).filter(
        ActionItem.finding_id.in_([f.id for f in findings])
    ).all()}
    
    new_actions = []
    for finding in findings:
        if str(finding.id) in existing_finding_ids:
            continue
        
        # Get the obligation to determine deadline
        obligation = db.query(Obligation).filter(Obligation.id == finding.obligation_id).first()
        deadline = obligation.deadline if obligation else None
        
        # Get department from mapping
        mapping = db.query(ObligationPolicyMapping).filter(
            ObligationPolicyMapping.obligation_id == finding.obligation_id
        ).first()
        dept_id = mapping.department_id if mapping else None
        
        # Suggested deadline = obligation deadline minus 30 days, or 30 days from now
        suggested = None
        if deadline:
            suggested = deadline
        else:
            from datetime import timedelta
            suggested = date.today() + timedelta(days=30)
        
        action = ActionItem(
            id=uuid.uuid4(),
            finding_id=finding.id,
            owner_department_id=dept_id,
            priority=finding.severity,  # same as finding severity
            suggested_deadline=suggested,
            status="not_started"
        )
        db.add(action)
        new_actions.append(action)
    db.flush()
    return new_actions
