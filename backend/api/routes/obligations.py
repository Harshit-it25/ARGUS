from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Obligation, Circular, User
from schemas.schemas import ObligationCreate, ObligationUpdate, ObligationResponse
from api.routes.auth import get_current_active_user

router = APIRouter()

@router.get("/circular/{circular_id}", response_model=list[ObligationResponse])
def get_obligations(
    circular_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid circular ID format")
        
    circular = db.query(Circular).filter(Circular.id == circular_id_uuid, Circular.org_id == current_user.org_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
    return db.query(Obligation).filter(Obligation.circular_id == circular_id_uuid).all()

@router.post("/", response_model=ObligationResponse)
def create_obligation(
    obligation: ObligationCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    circular = db.query(Circular).filter(Circular.id == obligation.circular_id, Circular.org_id == current_user.org_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
        
    db_obligation = Obligation(**obligation.dict())
    db.add(db_obligation)
    db.commit()
    db.refresh(db_obligation)
    return db_obligation

@router.patch("/{obligation_id}", response_model=ObligationResponse)
def update_obligation(
    obligation_id: str, 
    obligation: ObligationUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        obligation_id_uuid = uuid.UUID(obligation_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid obligation ID format")
    db_obligation = db.query(Obligation).join(Obligation.circular).filter(
        Obligation.id == obligation_id_uuid,
        Circular.org_id == current_user.org_id
    ).first()
    if not db_obligation:
        raise HTTPException(status_code=404, detail="Obligation not found")
        
    for key, value in obligation.dict(exclude_unset=True).items():
        setattr(db_obligation, key, value)
    db.commit()
    db.refresh(db_obligation)
    return db_obligation

@router.delete("/{obligation_id}")
def delete_obligation(
    obligation_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        obligation_id_uuid = uuid.UUID(obligation_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid obligation ID format")
    db_obligation = db.query(Obligation).join(Obligation.circular).filter(
        Obligation.id == obligation_id_uuid,
        Circular.org_id == current_user.org_id
    ).first()
    if not db_obligation:
        raise HTTPException(status_code=404, detail="Obligation not found")
        
    db.delete(db_obligation)
    db.commit()
    return {"message": "Deleted"}
