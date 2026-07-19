from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import RegulatoryReplay, User, Finding, Circular
from schemas.schemas import RegulatoryReplayResponse
from services.regulatory_replay import generate_regulatory_replay
from api.routes.auth import get_current_active_user

router = APIRouter()

@router.get("/{finding_id}", response_model=RegulatoryReplayResponse)
def get_replay(
    finding_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    try:
        finding_id_uuid = uuid.UUID(finding_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid finding ID format")
    finding = db.query(Finding).join(Finding.circular).filter(
        Finding.id == finding_id_uuid,
        Circular.org_id == current_user.org_id
    ).first()
    
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    # Check if replay exists
    replay = db.query(RegulatoryReplay).filter(RegulatoryReplay.finding_id == finding_id_uuid).first()
    if not replay:
        # Generate on demand using LangGraph
        from agents.langgraph_agents import get_replay_graph
        graph = get_replay_graph()
        state = {
            "circular_id": "",
            "org_id": str(current_user.org_id),
            "raw_text": "",
            "finding_id": finding_id,
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
                future.result(timeout=25)
            finally:
                executor.shutdown(wait=False)
            db.commit()
        except concurrent.futures.TimeoutError:
            db.rollback()
            raise HTTPException(status_code=504, detail="Replay generation timed out. Please try again.")
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Replay generation failed: {str(e)}")
            
        # Fetch newly created replay
        replay = db.query(RegulatoryReplay).filter(RegulatoryReplay.finding_id == finding_id_uuid).first()
        
    return replay
