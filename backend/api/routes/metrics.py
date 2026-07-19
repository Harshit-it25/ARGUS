from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import User, ObligationPolicyMapping, Obligation, Circular
from api.routes.auth import get_current_active_user

router = APIRouter()

@router.get("/ai")
def get_ai_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Dynamically aggregate AI telemetry from mapping audit trails."""
    # Ensure admin or compliance officer
    if current_user.role not in ["admin", "compliance_officer"]:
        raise HTTPException(status_code=403, detail="Not authorized to view metrics")

    mappings = (
        db.query(ObligationPolicyMapping)
        .join(Obligation, ObligationPolicyMapping.obligation_id == Obligation.id)
        .join(Circular, Obligation.circular_id == Circular.id)
        .filter(Circular.org_id == current_user.org_id)
        .all()
    )
    
    total_mappings = 0
    approved = 0
    rejected = 0
    needs_review = 0
    
    total_llm_latency = 0
    total_retrieval_latency = 0
    llm_failures = 0
    validation_failures = 0
    
    confidence_bins = {
        "0.9-1.0": 0,
        "0.7-0.89": 0,
        "0.5-0.69": 0,
        "<0.5": 0
    }
    
    for m in mappings:
        audit = m.audit_trail
        if not audit:
            continue
            
        total_mappings += 1
        decision = audit.get("final_decision", "")
        
        if decision == "AUTO_APPROVED":
            approved += 1
        elif decision == "REJECTED":
            rejected += 1
        elif decision == "NEEDS_ANALYST_REVIEW":
            needs_review += 1
            
        reason = audit.get("rejection_reason", "")
        if reason in ["LLM_TIMEOUT", "RATE_LIMIT", "MALFORMED_JSON_OR_ERROR"]:
            llm_failures += 1
        elif reason in ["INVALID_INDEX", "POLICY_ARCHIVED", "POLICY_DRAFT", "LOW_CONFIDENCE", "RETRIEVAL_EMPTY"]:
            validation_failures += 1
            
        total_llm_latency += audit.get("llm_latency_ms", 0)
        total_retrieval_latency += audit.get("retrieval_latency_ms", 0)
        
        conf = audit.get("llm_confidence", 0.0)
        if conf >= 0.9:
            confidence_bins["0.9-1.0"] += 1
        elif conf >= 0.7:
            confidence_bins["0.7-0.89"] += 1
        elif conf >= 0.5:
            confidence_bins["0.5-0.69"] += 1
        else:
            confidence_bins["<0.5"] += 1

    return {
        "mapping": {
            "total_processed": total_mappings,
            "average_llm_latency_ms": total_llm_latency / total_mappings if total_mappings else 0,
            "average_retrieval_latency_ms": total_retrieval_latency / total_mappings if total_mappings else 0,
            "approval_rate": approved / total_mappings if total_mappings else 0,
            "rejection_rate": rejected / total_mappings if total_mappings else 0,
            "review_rate": needs_review / total_mappings if total_mappings else 0,
        },
        "failures": {
            "llm_failures": llm_failures,
            "validation_failures": validation_failures
        },
        "confidence_distribution": confidence_bins,
        "notes": "Extraction, Replay, and Advisor latencies are pushed directly to structured logs. Upgrade to Datadog or Prometheus recommended for full timeseries aggregation."
    }
