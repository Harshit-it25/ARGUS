from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Circular, Obligation, Finding, ReadinessScore, Evidence, ActionItem, User
from schemas.schemas import AdvisorQuery, AdvisorResponse
from api.routes.auth import get_current_active_user
from services.rag import retrieve_context
from langchain_google_genai import ChatGoogleGenerativeAI
import json

router = APIRouter()

@router.post("/query", response_model=AdvisorResponse)
def advisor_query(
    query: AdvisorQuery, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    org_id = current_user.org_id
    if query.org_id and str(query.org_id) != str(org_id):
        raise HTTPException(status_code=403, detail="Access denied")
        
    question = query.question
    
    # 1. Fetch DB Stats (Structured Context)
    rri = db.query(ReadinessScore).filter(
        ReadinessScore.org_id == org_id
    ).order_by(ReadinessScore.computed_at.desc()).first()
    
    findings = db.query(Finding).join(Finding.circular).filter(
        Circular.org_id == org_id
    ).all()
    
    open_actions = db.query(ActionItem).join(ActionItem.finding).join(Finding.circular).filter(
        Circular.org_id == org_id,
        ActionItem.status != "done"
    ).all()
    
    db_context = {
        "rri_overall": float(rri.overall_score) if rri else None,
        "high_severity_findings": sum(1 for f in findings if f.severity == 'high'),
        "total_findings": len(findings),
        "open_actions": len(open_actions)
    }
    
    # 2. Retrieve Unstructured Context via RAG
    # Bounded with a hard timeout: an unreachable/slow embeddings API must
    # degrade to "no document context" rather than hang this request forever.
    # Note: deliberately NOT using the executor as a context manager — that
    # would block on __exit__ waiting for the background thread to finish,
    # defeating the timeout below entirely.
    import concurrent.futures
    rag_results = []
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        future = executor.submit(retrieve_context, question, str(org_id), 3)
        rag_results = future.result(timeout=8)
    except Exception as e:
        rag_results = []
    finally:
        executor.shutdown(wait=False)
    rag_text = "\n\n".join([f"Source Circular ID {res.get('circular_id')}:\n{res.get('text')}" for res in rag_results])
    sources = [f"circular_{res.get('circular_id')}" for res in rag_results] if rag_results else ["Database Metrics"]

    prompt = f"""You are the ARGUS AI Compliance Advisor.
Answer the user's compliance question based on the provided context. Be professional, concise, and helpful.

User Question: {question}

--- DATABASE CONTEXT ---
{json.dumps(db_context, indent=2)}

--- DOCUMENT CONTEXT (RAG) ---
{rag_text if rag_text else "No relevant document text found."}

If the question is about statistics, use the Database Context. If it's about regulatory text, use the Document Context.
If you cannot answer based on the context, state that clearly.
"""

    try:
        llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0.2, timeout=12)
        llm_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            llm_future = llm_executor.submit(llm.invoke, prompt)
            response = llm_future.result(timeout=15)
        finally:
            llm_executor.shutdown(wait=False)
        content = response.content
        if isinstance(content, list):
            answer = "".join([b.get("text", "") if isinstance(b, dict) else str(b) for b in content])
        else:
            answer = str(content)
    except Exception as e:
        answer = f"I'm sorry, I encountered an error generating an answer: {str(e)}"
    
    return AdvisorResponse(
        answer=answer,
        sources=list(set(sources))
    )
