from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Finding, Circular, Obligation, User, ObligationPolicyMapping
from schemas.schemas import FindingResponse, FindingSeverity, FindingType
from api.routes.auth import get_current_active_user
from services.stress_test import run_intelligent_stress_test, generate_action_items_from_findings
from services.rri_calculator import calculate_rri
from typing import List, Optional
import uuid

router = APIRouter()

@router.get("/", response_model=list[FindingResponse])
def list_findings(
    org_id: str,
    severity: Optional[FindingSeverity] = None,
    type: Optional[FindingType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if org_id != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Access denied")
        
    query = db.query(Finding).join(Finding.circular).filter(Circular.org_id == uuid.UUID(org_id))
    if severity:
        query = query.filter(Finding.severity == severity)
    if type:
        query = query.filter(Finding.type == type)
    return query.order_by(Finding.detected_at.desc()).all()

@router.get("/{finding_id}", response_model=FindingResponse)
def get_finding(
    finding_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        finding_id_uuid = uuid.UUID(finding_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid finding ID format")
    finding = db.query(Finding).join(Finding.circular).filter(
        Finding.id == finding_id_uuid,
        Circular.org_id == current_user.org_id
    ).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return finding

from pydantic import BaseModel
class FindingUpdate(BaseModel):
    status: str

@router.patch("/{finding_id}", response_model=FindingResponse)
def update_finding(
    finding_id: str,
    finding_update: FindingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        finding_id_uuid = uuid.UUID(finding_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid finding ID format")
    finding = db.query(Finding).join(Finding.circular).filter(
        Finding.id == finding_id_uuid,
        Circular.org_id == current_user.org_id
    ).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    if finding_update.status not in ["open", "in_progress", "closed", "resolved"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    finding.status = finding_update.status
    db.commit()
    db.refresh(finding)
    return finding

@router.post("/{circular_id}/run-stress-test")
def run_stress_test(
    circular_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid circular ID format")
    circular = db.query(Circular).filter(
        Circular.id == circular_id_uuid,
        Circular.org_id == current_user.org_id
    ).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
    
    obligations = db.query(Obligation).filter(Obligation.circular_id == circular_id_uuid).all()
    if not obligations:
        raise HTTPException(status_code=400, detail="No obligations found for this circular")
    
    # Check for unmapped obligations
    obligation_ids = [o.id for o in obligations]
    existing_mappings = db.query(ObligationPolicyMapping).filter(
        ObligationPolicyMapping.obligation_id.in_(obligation_ids)
    ).all()
    mapped_ob_ids = {m.obligation_id for m in existing_mappings}
    
    unmapped_obligations = [o for o in obligations if o.id not in mapped_ob_ids]
    
    if unmapped_obligations:
        from agents.langgraph_agents import get_mapping_and_stress_graph
        graph = get_mapping_and_stress_graph()
        
        state = {
            "circular_id": circular_id,
            "org_id": str(current_user.org_id),
            "raw_text": "",
            "finding_id": None,
            "db_session": db,
            "obligations": [{"id": str(o.id), "description": o.description} for o in unmapped_obligations],
            "available_policies": [],
            "mappings": [],
            "findings": [],
            "evidence_status": [],
            "rri": None,
            "errors": []
        }
        
        try:
            import concurrent.futures
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            try:
                future = executor.submit(graph.invoke, state)
                result_state = future.result(timeout=60)
            finally:
                executor.shutdown(wait=False)
            db.commit()
            new_findings_count = len(result_state.get("findings", []))
        except concurrent.futures.TimeoutError:
            db.rollback()
            raise HTTPException(status_code=504, detail="Stress test timed out. Please try again.")
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")
    else:
        new_findings_count = 0
    
    circular.status = "stress_tested"
    db.commit()
    
    total_findings = db.query(Finding).filter(Finding.circular_id == circular_id_uuid).count()
    from database.models import ActionItem
    total_actions = db.query(ActionItem).join(Finding).filter(Finding.circular_id == circular_id_uuid).count()
    
    return {
        "message": "Stress test completed",
        "circular_id": circular_id,
        "new_findings": new_findings_count,
        "new_actions": total_actions, # returning total for simplicity, or delta if we tracked it
        "total_findings": total_findings
    }
