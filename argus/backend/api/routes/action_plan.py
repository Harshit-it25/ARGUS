from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import ActionItem, User, Finding, Circular
from schemas.schemas import ActionItemResponse, ActionItemUpdate
from api.routes.auth import get_current_active_user

router = APIRouter()

@router.get("/", response_model=list[ActionItemResponse])
def list_action_items(
    org_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if org_id != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Access denied")
        
    return db.query(ActionItem).join(ActionItem.finding).join(Finding.circular).filter(
        Circular.org_id == uuid.UUID(org_id)
    ).all()

@router.patch("/{action_id}")
def update_action_item(
    action_id: str, 
    action_update: ActionItemUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        action_id_uuid = uuid.UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid action item ID format")
    item = db.query(ActionItem).join(ActionItem.finding).join(Finding.circular).filter(
        ActionItem.id == action_id_uuid,
        Circular.org_id == current_user.org_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")
        
    item.status = action_update.status
    db.commit()
    return {"message": "Updated"}
