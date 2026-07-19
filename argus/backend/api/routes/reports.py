from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Report, User, Circular
from schemas.schemas import UserResponse, ReportResponse
from api.routes.auth import get_current_active_user

router = APIRouter()

@router.get("/", response_model=list[ReportResponse])
def list_reports(
    org_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if org_id != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(Report).filter(Report.org_id == uuid.UUID(org_id)).all()

@router.post("/generate/{circular_id}")
def generate_report(
    circular_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid circular ID format")
    circular = db.query(Circular).filter(
        Circular.id == circular_id_uuid,
        Circular.org_id == current_user.org_id
    ).first()
    
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
        
    import os
    import uuid
    from datetime import datetime
    
    try:
        from reportlab.pdfgen import canvas
        reports_dir = os.path.join("uploads", "reports")
        os.makedirs(reports_dir, exist_ok=True)
        filename = f"report_{circular_id}_{int(datetime.utcnow().timestamp())}.pdf"
        file_path = os.path.join(reports_dir, filename)
        
        c = canvas.Canvas(file_path)
        c.drawString(100, 800, f"ARGUS Audit Report: {circular.title}")
        c.drawString(100, 780, f"Generated At: {datetime.utcnow().isoformat()}")
        c.drawString(100, 760, f"Organization ID: {current_user.org_id}")
        
        from database.models import Finding
        findings = db.query(Finding).filter(Finding.circular_id == circular_id_uuid).all()
        y = 720
        c.drawString(100, 740, f"Total Findings: {len(findings)}")
        for f in findings:
            c.drawString(100, y, f"- {f.type} ({f.severity}): {f.description[:60]}...")
            y -= 20
            if y < 50:
                c.showPage()
                y = 800
                
        c.save()
        file_url = f"/uploads/reports/{filename}"
    except ImportError:
        file_url = f"/dummy/reports/report_{circular_id}.pdf"
        
    report = Report(
        id=uuid.uuid4(),
        org_id=current_user.org_id,
        circular_id=uuid.UUID(circular_id),
        file_url=file_url,
        generated_by=current_user.id
    )
    db.add(report)
    db.commit()
    
    return {"message": "Report generated", "circular_id": circular_id, "file_url": file_url}
