from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import User, Department
from schemas.schemas import DepartmentCreate, DepartmentResponse
from api.routes.auth import get_current_active_user

router = APIRouter()

@router.get("/", response_model=list[DepartmentResponse])
def list_departments(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if org_id != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this organization's departments")
    return db.query(Department).filter(Department.org_id == uuid.UUID(org_id)).all()

@router.post("/", response_model=DepartmentResponse)
def create_department(
    department: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if str(department.org_id) != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Not authorized to create a department for this organization")
    db_dept = Department(**department.dict())
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    return db_dept
