from sqlalchemy.orm import Session
from database.models import Finding, Obligation, Circular, Policy, ObligationPolicyMapping, RegulatoryReplay
from typing import List, Dict, Any
import uuid
from datetime import datetime

def generate_regulatory_replay(finding_id: str, db: Session) -> RegulatoryReplay:
    """Generate a Regulatory Replay chain for a given finding."""
    import uuid
    if isinstance(finding_id, str):
        try:
            finding_id = uuid.UUID(finding_id)
        except ValueError:
            pass
            
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        return None
    
    obligation = db.query(Obligation).filter(Obligation.id == finding.obligation_id).first()
    circular = db.query(Circular).filter(Circular.id == finding.circular_id).first()
    mapping = db.query(ObligationPolicyMapping).filter(
        ObligationPolicyMapping.obligation_id == finding.obligation_id
    ).first()
    policy = None
    if mapping and mapping.policy_id:
        policy = db.query(Policy).filter(Policy.id == mapping.policy_id).first()
    
    # Build the chain
    chain = [
        {"entity_type": "circular", "label": circular.title if circular else "Unknown Circular"},
        {"entity_type": "obligation", "label": obligation.description[:100] + "..." if obligation and len(obligation.description) > 100 else (obligation.description if obligation else "Unknown Obligation")},
    ]
    
    if policy:
        chain.append({"entity_type": "policy", "label": policy.title})
    else:
        chain.append({"entity_type": "policy", "label": "No matching policy found"})
    
    # Add workflow step if applicable
    if finding.type == 'workflow_gap':
        chain.append({"entity_type": "workflow", "label": "Workflow step missing"})
    elif finding.type == 'missing_evidence':
        chain.append({"entity_type": "evidence", "label": "Required evidence not found"})
    elif finding.type == 'outdated_procedure':
        chain.append({"entity_type": "workflow", "label": "Procedure outdated"})
    
    chain.append({"entity_type": "gap", "label": f"{finding.type.replace('_', ' ').title()} detected"})
    chain.append({"entity_type": "risk", "label": f"{finding.severity.upper()} severity - {finding.description[:80]}..."})
    chain.append({"entity_type": "fix", "label": generate_recommended_fix(finding)})
    
    explanation = generate_explanation(finding, obligation, circular, policy)
    
    replay = RegulatoryReplay(
        id=uuid.uuid4(),
        finding_id=finding_id,
        chain_json=chain,
        explanation=explanation,
        generated_at=datetime.utcnow()
    )
    
    db.add(replay)
    db.flush()
    db.refresh(replay)
    
    return replay

def generate_recommended_fix(finding: Finding) -> str:
    """Generate a recommended fix based on finding type."""
    fixes = {
        'unimplemented': 'Draft and implement a new policy/procedure to address this obligation.',
        'outdated_procedure': 'Update existing procedures to align with the latest SEBI circular requirements.',
        'policy_conflict': 'Reconcile conflicting policies and establish a single source of truth.',
        'workflow_gap': 'Add the missing step to the workflow and assign a process owner.',
        'missing_evidence': 'Collect and upload the required evidence artifacts.'
    }
    return fixes.get(finding.type, 'Review and remediate this finding.')

def generate_explanation(finding: Finding, obligation: Obligation, circular: Circular, policy: Policy) -> str:
    """Generate a natural language explanation for the finding using Gemini."""
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0.2)
        
        policy_context = f"Policy '{policy.title}' (last updated {policy.last_updated})" if policy else "No internal policy mapped."
        
        prompt = f"""You are a regulatory compliance auditor. Explain the following compliance finding to a stakeholder in clear, professional language.
Explain WHY this is a risk and WHAT could happen during an audit.

Circular: {circular.title if circular else 'Unknown'}
Obligation: {obligation.description if obligation else 'Unknown'}
Internal Policy: {policy_context}
Finding Type: {finding.type}
Severity: {finding.severity}
Finding Description: {finding.description}

Provide a concise, 2-3 sentence explanation of the gap and its regulatory implication. Do not give advice on how to fix it, just explain the gap.
"""
        response = llm.invoke(prompt)
        content = response.content
        if isinstance(content, list):
            text = "".join([b.get("text", "") if isinstance(b, dict) else str(b) for b in content])
        else:
            text = str(content)
        return text.strip()
    except Exception as e:
        # Fallback in case of API failure
        if finding.type == 'unimplemented':
            return f"This finding traces back to the SEBI circular's requirement regarding '{obligation.description[:60]}...'. Your organization has no policy covering this obligation, creating a compliance gap."
        elif finding.type == 'missing_evidence':
            return f"While the obligation '{obligation.description[:60]}...' has been identified, there is no documented evidence proving compliance."
        elif finding.type == 'outdated_procedure':
            return f"The policy '{policy.title if policy else 'Unknown'}' was last updated before the new SEBI circular became effective."
        elif finding.type == 'workflow_gap':
            return f"The mapped workflow for '{obligation.description[:60]}...' does not include a necessary step required by the SEBI circular."
        elif finding.type == 'policy_conflict':
            return f"Multiple policies map to this obligation with conflicting guidance."
        else:
            return f"This finding was identified during the regulatory stress test. Review and remediate."
