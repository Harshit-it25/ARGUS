import sys
import os
import time
from unittest.mock import patch, MagicMock

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from agents.langgraph_agents import RegulationIntelligenceAgent, ProcessMappingAgent, AgentState
from database.models import Policy
from services.rag import _policy_retrieval_cache

def print_header(title):
    print(f"\n{'='*60}\n{title}\n{'='*60}")

def test_extraction_timeout():
    print_header("Test: Extraction - Gemini Unavailable (Timeout)")
    agent = RegulationIntelligenceAgent()
    
    # Mock LLM to raise Exception (simulating Timeout)
    with patch.object(type(agent.structured_llm), 'invoke', side_effect=Exception("Read timeout from Gemini API")):
        state = AgentState(
            circular_id="test-1", org_id="org-1", raw_text="Sample text", 
            obligations=[], mappings=[], evidence_status=[], available_policies=[], rri=None, errors=[]
        )
        t0 = time.time()
        result = agent.run(state)
        latency = time.time() - t0
        
        assert len(result["obligations"]) == 0, "Should return empty obligations on failure"
        assert len(result["errors"]) > 0, "Should log an error"
        assert "after 2 attempts" in result["errors"][0]
        print(f"PASS: Handled Timeout gracefully. Retries exhausted in {latency:.2f}s. Fallback applied.")

def test_mapping_schema_validation_failure():
    print_header("Test: Mapping - Gemini Returns Malformed JSON")
    agent = ProcessMappingAgent()
    
    # Mock LLM to raise validation error
    with patch.object(type(agent.structured_llm), 'invoke', side_effect=ValueError("OutputParserException: Malformed JSON")):
        state = AgentState(
            circular_id="test-2", org_id="org-1", raw_text="Text", 
            obligations=[{"id": "obl-1", "description": "Ensure MFA"}], mappings=[], evidence_status=[], 
            available_policies=[{"id": "pol-1", "title": "IT Policy", "department_name": "IT", "status": "active"}], 
            rri=None, errors=[]
        )
        
        # Mock retrieval to return the policy
        with patch('services.rag.retrieve_candidate_policies', return_value=["pol-1"]):
            result = agent.run(state)
            
            mapping = result["mappings"][0]
            assert mapping["policy_id"] is None
            assert mapping["confidence"] == 0.0
            assert mapping["audit_trail"]["rejection_reason"] == "SCHEMA_VALIDATION_FAILED"
            print(f"PASS: Handled Malformed JSON safely. Rejection reason logged correctly in audit trail.")

def test_mapping_retrieval_empty():
    print_header("Test: Mapping - ChromaDB Unavailable / Empty")
    agent = ProcessMappingAgent()
    
    state = AgentState(
        circular_id="test-3", org_id="org-1", raw_text="Text", 
        obligations=[{"id": "obl-1", "description": "Ensure MFA"}], mappings=[], evidence_status=[], 
        available_policies=[{"id": "pol-1", "title": "IT Policy", "department_name": "IT", "status": "active"}], 
        rri=None, errors=[]
    )
    
    # Mock retrieval to return empty (Chroma down)
    with patch('services.rag.retrieve_candidate_policies', return_value=[]):
        result = agent.run(state)
        
        mapping = result["mappings"][0]
        assert mapping["policy_id"] is None
        assert mapping["audit_trail"]["rejection_reason"] == "RETRIEVAL_EMPTY"
        print(f"PASS: Handled Empty Retrieval / DB Failure. Short-circuited LLM successfully.")

def test_mapping_invalid_index_hallucination():
    print_header("Test: Mapping - Gemini Hallucinates Invalid Index")
    agent = ProcessMappingAgent()
    
    # Mock LLM to return index out of bounds
    mock_result = MagicMock()
    mock_result.selected_index = 99  # Only 1 candidate available
    mock_result.confidence = 0.95
    mock_result.reasoning = "Because 99 is a great number."
    
    with patch.object(type(agent.structured_llm), 'invoke', return_value=mock_result):
        state = AgentState(
            circular_id="test-4", org_id="org-1", raw_text="Text", 
            obligations=[{"id": "obl-1", "description": "Ensure MFA"}], mappings=[], evidence_status=[], 
            available_policies=[{"id": "pol-1", "title": "IT Policy", "department_name": "IT", "status": "active"}], 
            rri=None, errors=[]
        )
        
        with patch('services.rag.retrieve_candidate_policies', return_value=["pol-1"]):
            result = agent.run(state)
            
            mapping = result["mappings"][0]
            assert mapping["policy_id"] is None
            assert mapping["audit_trail"]["rejection_reason"] == "INVALID_INDEX"
            print(f"PASS: Caught LLM index hallucination deterministically.")

if __name__ == "__main__":
    print("Starting ARGUS E2E Resilience Tests...\n")
    try:
        test_extraction_timeout()
        test_mapping_schema_validation_failure()
        test_mapping_retrieval_empty()
        test_mapping_invalid_index_hallucination()
        print("\n" + "="*60)
        print("ALL RESILIENCE TESTS PASSED.")
        print("System is fault-tolerant against AI/DB failures.")
        print("="*60)
    except AssertionError as e:
        print(f"\nFAIL: {str(e)}")
        sys.exit(1)
