from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import ReadinessScore, User
from schemas.schemas import ReadinessScoreResponse
from services.rri_calculator import calculate_rri
from api.routes.auth import get_current_active_user
from typing import Optional

router = APIRouter()

@router.get("/{org_id}", response_model=ReadinessScoreResponse)
def get_current_rri(
    org_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if org_id != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Access denied")
        
    return db.query(ReadinessScore).filter(
        ReadinessScore.org_id == uuid.UUID(org_id)
    ).order_by(ReadinessScore.computed_at.desc()).first()

@router.get("/{org_id}/trend", response_model=list[ReadinessScoreResponse])
def get_rri_trend(
    org_id: str, 
    limit: int = 30, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if org_id != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Access denied")
        
    return db.query(ReadinessScore).filter(
        ReadinessScore.org_id == uuid.UUID(org_id)
    ).order_by(ReadinessScore.computed_at.desc()).limit(limit).all()

@router.post("/{org_id}/recalculate")
def recalculate_rri(
    org_id: str, 
    circular_id: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if org_id != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Access denied")
        
    score = calculate_rri(org_id, circular_id, db)
    if score:
        return {"message": "RRI recalculated", "overall_score": float(score.overall_score)}
    return {"message": "RRI recalculation failed", "error": "No obligations found"}
