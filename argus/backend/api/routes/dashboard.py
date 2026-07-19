from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from database.models import Circular, Obligation, Finding, ReadinessScore, ActionItem, User, Department
from api.routes.auth import get_current_active_user
from typing import List

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    org_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        org_id_uuid = uuid.UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid org_id format")
    if org_id_uuid != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    total_circulars = db.query(Circular).filter(Circular.org_id == org_id_uuid).count()
    total_obligations = db.query(Obligation).join(Obligation.circular).filter(Circular.org_id == org_id_uuid).count()
    total_findings = db.query(Finding).join(Finding.circular).filter(Circular.org_id == org_id_uuid).count()
    high_risk = db.query(Finding).join(Finding.circular).filter(
        Circular.org_id == org_id_uuid, Finding.severity == "high"
    ).count()
    
    total_actions = db.query(ActionItem).join(ActionItem.finding).join(Finding.circular).filter(
        Circular.org_id == org_id_uuid
    ).count()
    
    current_rri = db.query(ReadinessScore).filter(
        ReadinessScore.org_id == org_id_uuid
    ).order_by(ReadinessScore.computed_at.desc()).first()
    
    recent_circulars = db.query(Circular).filter(
        Circular.org_id == org_id_uuid
    ).order_by(Circular.created_at.desc()).limit(5).all()
    
    rri_trend = db.query(ReadinessScore).filter(
        ReadinessScore.org_id == org_id_uuid
    ).order_by(ReadinessScore.computed_at.desc()).limit(30).all()

    # Dynamic Heatmap
    heatmap_data = []
    departments = db.query(Department).filter(Department.org_id == org_id_uuid).all()
    for d in departments:
        findings_count = db.query(Finding).join(ActionItem).filter(
            ActionItem.owner_department_id == d.id,
            Finding.circular.has(org_id=org_id_uuid)
        ).count()
        
        score = max(0, 100 - (findings_count * 5))
        if score >= 85: color = "bg-argus-teal"
        elif score >= 70: color = "bg-argus-amber"
        else: color = "bg-argus-terracotta"
        
        heatmap_data.append({
            "name": d.name,
            "score": score,
            "findings": findings_count,
            "color": color
        })

    # Dynamic Timeline
    timeline_data = []
    recent_circs = db.query(Circular).filter(Circular.org_id == org_id_uuid).order_by(Circular.created_at.desc()).limit(3).all()
    for c in recent_circs:
        date_str = c.created_at.strftime("%b %d, %Y") if c.created_at else "Recent"
        timeline_data.append({
            "icon": "Upload",
            "color": "text-argus-slate",
            "bg": "bg-argus-slate/10",
            "text": "Circular uploaded",
            "sub": c.title,
            "date": date_str
        })
        if c.status in ["stress_tested", "remediated"]:
            timeline_data.append({
                "icon": "Shield",
                "color": "text-argus-teal",
                "bg": "bg-argus-teal/10",
                "text": "Stress Test completed",
                "sub": f"Evaluated: {c.title}",
                "date": date_str
            })

    rri_components = {
        "policy_alignment": float(current_rri.policy_alignment) if current_rri else 0,
        "control_coverage": float(current_rri.control_coverage) if current_rri else 0,
        "evidence_completeness": float(current_rri.evidence_completeness) if current_rri else 0,
        "workflow_readiness": float(current_rri.workflow_readiness) if current_rri else 0,
        "employee_readiness": float(current_rri.employee_readiness) if current_rri else 0,
    }
    
    return {
        "total_circulars": total_circulars,
        "total_obligations": total_obligations,
        "total_findings": total_findings,
        "high_risk_findings": high_risk,
        "total_action_items": total_actions,
        "current_rri": current_rri.overall_score if current_rri else None,
        "rri_components": rri_components,
        "heatmap": heatmap_data,
        "timeline": timeline_data,
        "recent_circulars": recent_circulars,
        "rri_trend": rri_trend
    }
