from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import User
from schemas.schemas import UserResponse
from api.routes.auth import get_current_active_user

router = APIRouter()

@router.get("/", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(User).filter(User.org_id == current_user.org_id).all()

@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        user_id_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid user ID format")
    user = db.query(User).filter(
        User.id == user_id_uuid,
        User.org_id == current_user.org_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
