from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from database.connection import get_db, SessionLocal
from database.models import Circular, User, Obligation
from schemas.schemas import CircularCreate, CircularResponse, CircularStatus
from api.routes.auth import get_current_active_user
from services.document_parser import save_uploaded_file, extract_text_from_file, chunk_text
from typing import List
import uuid
from datetime import date
import logging

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

def process_document_task(circular_id: str, file_path: str, filename: str):
    db = SessionLocal()
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        return
    try:
        circular = db.query(Circular).filter(Circular.id == circular_id_uuid).first()
        if not circular:
            return

        # Extract text
        logger.info(f"Extracting text from file {file_path}")
        text = extract_text_from_file(file_path)
        
        if text.startswith("Error extracting text") or text.startswith("OCR extraction failed"):
            logger.error(f"Text extraction failed: {text}")
            circular.status = "extraction_failed"
            circular.processing_errors = [text]
            db.commit()
            return
            
        logger.info(f"Text extraction successful. Extracted {len(text)} characters from {filename}.")
        circular.raw_text = text
        circular.source_file_url = file_path
        circular.status = "obligations_extracted"
        db.commit()
        
        # Extract obligations using the RegulationIntelligenceAgent
        logger.info(f"Running Regulation Intelligence Agent on circular_id {circular_id}")
        from agents.langgraph_agents import get_extraction_graph
        graph = get_extraction_graph()
        state = {
            "circular_id": circular_id,
            "org_id": str(circular.org_id),
            "raw_text": text,
            "finding_id": None,
            "db_session": db,
            "obligations": [],
            "mappings": [],
            "findings": [],
            "evidence_status": [],
            "available_policies": [],
            "rri": None,
            "errors": []
        }
        
        try:
            import concurrent.futures
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            try:
                future = executor.submit(graph.invoke, state)
                state = future.result(timeout=90)
            finally:
                executor.shutdown(wait=False)
            if state.get("errors"):
                logger.error(f"Agent extraction failed explicitly: {state['errors']}")
                circular.status = "extraction_failed"
                circular.processing_errors = state["errors"]
                db.commit()
                return
                
            db.commit()
            logger.info(f"Regulation Intelligence Agent complete. Extracted {len(state.get('obligations', []))} obligations.")
        except Exception as e:
            db.rollback()
            logger.error(f"Agent pipeline failed: {str(e)}")
            circular.status = "extraction_failed"
            circular.processing_errors = [str(e)]
            db.commit()
            return
        
        # Clear any pre-existing obligations (in case of re-upload)
        from database.models import RegulatoryReplay, Evidence, ActionItem, Finding, ObligationPolicyMapping, ReadinessScore
        
        existing_obs = db.query(Obligation.id).filter(Obligation.circular_id == circular.id).all()
        ob_ids = [o.id for o in existing_obs]
        existing_findings = db.query(Finding.id).filter(Finding.circular_id == circular.id).all()
        finding_ids = [f.id for f in existing_findings]

        if finding_ids:
            db.query(RegulatoryReplay).filter(RegulatoryReplay.finding_id.in_(finding_ids)).delete(synchronize_session=False)
            db.query(ActionItem).filter(ActionItem.finding_id.in_(finding_ids)).delete(synchronize_session=False)
            db.query(Evidence).filter(Evidence.finding_id.in_(finding_ids)).delete(synchronize_session=False)
            
        if ob_ids:
            db.query(Evidence).filter(Evidence.obligation_id.in_(ob_ids)).delete(synchronize_session=False)
            db.query(ObligationPolicyMapping).filter(ObligationPolicyMapping.obligation_id.in_(ob_ids)).delete(synchronize_session=False)
            
        db.query(Finding).filter(Finding.circular_id == circular.id).delete(synchronize_session=False)
        db.query(ReadinessScore).filter(ReadinessScore.circular_id == circular.id).delete(synchronize_session=False)
        db.query(Obligation).filter(Obligation.circular_id == circular.id).delete(synchronize_session=False)
        # Save extracted obligations
        for obl in state.get("obligations", []):
            deadline_date = None
            if obl.get("deadline"):
                try:
                    deadline_date = date.fromisoformat(obl["deadline"])
                except ValueError:
                    pass
            
            db_obl = Obligation(
                id=uuid.uuid4(),
                circular_id=circular.id,
                description=obl["description"],
                deadline=deadline_date,
                applicability=obl.get("applicability"),
                source_ref=obl.get("source_ref"),
                status="ai_extracted"
            )
            db.add(db_obl)
            
        db.commit()

        # Chunk text for embedding (for RAG). This is a separate concern from
        # obligation extraction, which already succeeded and committed above —
        # a slow/unreachable embeddings API must not cause the circular to be
        # misreported as extraction_failed.
        try:
            chunks = chunk_text(text)
            from services.rag import index_document_chunks
            index_document_chunks(circular_id, str(circular.org_id), chunks)
        except Exception as rag_err:
            logger.error(f"RAG indexing failed for circular {circular_id} (non-fatal, obligations were extracted successfully): {rag_err}")

    except Exception as e:
        logger.error(f"Background task failed: {str(e)}")
        import uuid
        try:
            circular_id_uuid = uuid.UUID(circular_id)
        except ValueError:
            circular_id_uuid = circular_id
        circular = db.query(Circular).filter(Circular.id == circular_id_uuid).first()
        if circular:
            circular.status = "extraction_failed"
            db.commit()
    finally:
        db.close()


@router.get("/", response_model=list[CircularResponse])
def list_circulars(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return db.query(Circular).filter(Circular.org_id == current_user.org_id).order_by(Circular.created_at.desc()).all()

@router.post("/", response_model=CircularResponse)
def create_circular(
    circular: CircularCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    if str(circular.org_id) != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Cannot create circular for another organization")

    db_circular = Circular(
        title=circular.title,
        org_id=current_user.org_id,
        effective_date=circular.effective_date,
        status=CircularStatus.uploaded,
        uploaded_by=current_user.id
    )
    db.add(db_circular)
    db.commit()
    db.refresh(db_circular)
    return db_circular

@router.post("/{circular_id}/upload")
def upload_circular_file(
    circular_id: str, 
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid circular ID format")
    circular = db.query(Circular).filter(Circular.id == circular_id_uuid, Circular.org_id == current_user.org_id).first()
    if not circular:
        logger.error(f"Upload rejected: Circular {circular_id} not found or access denied")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Circular not found")

    filename = file.filename
    ext = filename.split('.')[-1].lower() if '.' in filename else ''
    
    if ext not in ['pdf', 'docx', 'doc']:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file format '{ext}'.")
    
    file_content = file.file.read()
    file_size = len(file_content)
    
    if file_size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid PDF. The uploaded file is empty.")
        
    MAX_SIZE = 10 * 1024 * 1024
    if file_size > MAX_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large. Maximum size allowed is 10MB.")
    
    file_path = save_uploaded_file(file_content, filename, str(circular.org_id))
    logger.info(f"File {filename} successfully saved to {file_path}. Queuing background task.")
    
    circular.status = "uploaded"
    db.commit()
    
    background_tasks.add_task(process_document_task, circular_id, file_path, filename)
    
    return {
        "message": "File uploaded successfully. Document processing started in background.",
        "filename": filename,
        "circular_id": circular_id,
        "status": "processing"
    }

@router.get("/{circular_id}", response_model=CircularResponse)
def get_circular(
    circular_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid circular ID format")
    circular = db.query(Circular).filter(Circular.id == circular_id_uuid, Circular.org_id == current_user.org_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
    return circular

@router.get("/{circular_id}/findings", response_model=list[dict])
def get_circular_findings(
    circular_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from database.models import Finding
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid circular ID format")
    circular = db.query(Circular).filter(Circular.id == circular_id_uuid, Circular.org_id == current_user.org_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
    
    findings = db.query(Finding).filter(Finding.circular_id == circular_id_uuid).all()
    # Simple dict response since schemas might be complex
    return [{"id": str(f.id), "type": f.type, "severity": f.severity, "status": f.status} for f in findings]

@router.delete("/{circular_id}")
def delete_circular(
    circular_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from database.models import RegulatoryReplay, Evidence, ActionItem, Finding, ObligationPolicyMapping, ReadinessScore
    import uuid
    try:
        circular_id_uuid = uuid.UUID(circular_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid circular ID format")
    circular = db.query(Circular).filter(Circular.id == circular_id_uuid, Circular.org_id == current_user.org_id).first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")
    
    db.delete(circular)
    db.commit()
    return {"message": "Circular deleted successfully"}
