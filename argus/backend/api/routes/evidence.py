from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
import uuid
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Evidence, User
from schemas.schemas import EvidenceCreate, EvidenceResponse
from api.routes.auth import get_current_active_user

router = APIRouter()

ALLOWED_EVIDENCE_EXTENSIONS = {"pdf", "docx", "doc", "png", "jpg", "jpeg", "xlsx", "csv"}
MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB, consistent with circulars upload

@router.get("/", response_model=list[EvidenceResponse])
def list_evidence(
    org_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if org_id != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Evidence).filter(Evidence.org_id == uuid.UUID(org_id)).all()

@router.post("/", response_model=EvidenceResponse)
def create_evidence(
    evidence: EvidenceCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if str(evidence.org_id) != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Access denied")
        
    if evidence.finding_id:
        from database.models import Finding, Circular
        finding = db.query(Finding).join(Finding.circular).filter(
            Finding.id == evidence.finding_id,
            Circular.org_id == current_user.org_id
        ).first()
        if not finding:
            raise HTTPException(status_code=403, detail="Finding not found or access denied")
            
    if evidence.obligation_id:
        from database.models import Obligation, Circular
        obligation = db.query(Obligation).join(Obligation.circular).filter(
            Obligation.id == evidence.obligation_id,
            Circular.org_id == current_user.org_id
        ).first()
        if not obligation:
            raise HTTPException(status_code=403, detail="Obligation not found or access denied")
            
    evidence_data = evidence.dict()
    evidence_data["uploaded_by"] = current_user.id
    db_evidence = Evidence(**evidence_data)
    db.add(db_evidence)
    db.commit()
    db.refresh(db_evidence)
    return db_evidence

@router.post("/upload")
def upload_evidence_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    from services.document_parser import save_uploaded_file

    filename = file.filename or ""
    ext = filename.split('.')[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_EVIDENCE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'."
        )

    file_content = file.file.read()
    file_size = len(file_content)

    if file_size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    if file_size > MAX_EVIDENCE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size allowed is 10MB."
        )

    file_path = save_uploaded_file(file_content, filename, str(current_user.org_id))

    return {"message": "Evidence uploaded", "filename": filename, "document_url": file_path}
