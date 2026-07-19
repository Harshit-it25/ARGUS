from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import User, Policy
from schemas.schemas import PolicyCreate, PolicyResponse
from api.routes.auth import get_current_active_user

router = APIRouter()

@router.get("/", response_model=list[PolicyResponse])
def list_policies(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if org_id != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this organization's policies")
    return db.query(Policy).filter(Policy.org_id == uuid.UUID(org_id)).all()

@router.post("/", response_model=PolicyResponse)
def create_policy(
    policy: PolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if str(policy.org_id) != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Not authorized to create a policy for this organization")
        
    if policy.department_id:
        from database.models import Department
        dept = db.query(Department).filter(
            Department.id == policy.department_id,
            Department.org_id == current_user.org_id
        ).first()
        if not dept:
            raise HTTPException(status_code=403, detail="Department not found or access denied")
            
    db_policy = Policy(**policy.dict())
    db.add(db_policy)
    db.commit()
    db.refresh(db_policy)
    return db_policy
