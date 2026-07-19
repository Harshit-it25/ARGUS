import os
from typing import List, Dict, Any
from database.config import GEMINI_API_KEY
import logging
from database.config import settings

logger = logging.getLogger("uvicorn.error")

os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY or "dummy_key"

class MockCollection:
    def add(self, *args, **kwargs):
        pass
    def query(self, *args, **kwargs):
        return {"documents": [["Mock chunk 1"]], "metadatas": [[{"circular_id": "mock_id", "policy_id": "mock_policy"}]], "distances": [[0.1]]}

class MockEmbeddings:
    def embed_documents(self, chunks):
        return [[0.1]*768 for _ in chunks]
    def embed_query(self, query):
        return [0.1]*768

collection = MockCollection()
policy_collection = MockCollection()
embeddings = MockEmbeddings()

def index_document_chunks(circular_id: str, org_id: str, chunks: List[str]):
    pass

def retrieve_context(query: str, org_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
    return []

_policy_retrieval_cache = {}

def index_policies(org_id: str, policies: List[Any]):
    pass

def retrieve_candidate_policies(query: str, org_id: str, top_k: int = 5) -> List[str]:
    return []
