from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import ObligationPolicyMapping, User, Obligation, Circular
from schemas.schemas import MappingCreate, MappingResponse
from api.routes.auth import get_current_active_user

router = APIRouter()

@router.get("/obligation/{obligation_id}", response_model=list[MappingResponse])
def get_mappings(
    obligation_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        obligation_id_uuid = uuid.UUID(obligation_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid obligation ID format")
    obligation = db.query(Obligation).join(Obligation.circular).filter(
        Obligation.id == obligation_id_uuid,
        Circular.org_id == current_user.org_id
    ).first()
    
    if not obligation:
        raise HTTPException(status_code=404, detail="Obligation not found")
        
    return db.query(ObligationPolicyMapping).filter(ObligationPolicyMapping.obligation_id == obligation_id_uuid).all()

@router.post("/", response_model=MappingResponse)
def create_mapping(
    mapping: MappingCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    obligation = db.query(Obligation).join(Obligation.circular).filter(
        Obligation.id == mapping.obligation_id,
        Circular.org_id == current_user.org_id
    ).first()
    
    if not obligation:
        raise HTTPException(status_code=404, detail="Obligation not found")
        
    db_mapping = ObligationPolicyMapping(**mapping.dict())
    db.add(db_mapping)
    db.commit()
    db.refresh(db_mapping)
    return db_mapping
