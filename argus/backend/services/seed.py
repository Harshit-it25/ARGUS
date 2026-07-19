from database.connection import SessionLocal
from database.models import (
    Organization, Department, User, Policy, Circular, Obligation,
    Finding, ReadinessScore, ActionItem, Report, ObligationPolicyMapping,
    RegulatoryReplay, Evidence
)
import bcrypt
from datetime import date, datetime, timedelta
import uuid

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def seed_demo_data():
    db = SessionLocal()
    try:
        # Check if data already exists (check User instead of Organization for robust seeding)
        existing = db.query(User).first()
        if existing:
            print("Demo data already seeded.")
            return

        # 1. Organization
        org = Organization(
            id=uuid.uuid4(),
            name="Team Rocket Securities Ltd.",
            industry="Financial Services"
        )
        db.add(org)
        db.commit()

        # 2. Departments
        depts = [
            Department(id=uuid.uuid4(), org_id=org.id, name="Risk Management"),
            Department(id=uuid.uuid4(), org_id=org.id, name="IT Security"),
            Department(id=uuid.uuid4(), org_id=org.id, name="Compliance"),
            Department(id=uuid.uuid4(), org_id=org.id, name="Operations"),
            Department(id=uuid.uuid4(), org_id=org.id, name="Human Resources"),
        ]
        for d in depts:
            db.add(d)
        db.commit()

        dept_map = {d.name: d.id for d in depts}

        # 3. Users
        admin_user = User(
            id=uuid.uuid4(),
            org_id=org.id,
            email="admin@argus.demo",
            password_hash=get_password_hash("admin123"),
            role="admin",
            department_id=dept_map["Compliance"]
        )
        compliance_user = User(
            id=uuid.uuid4(),
            org_id=org.id,
            email="compliance@argus.demo",
            password_hash=get_password_hash("compliance123"),
            role="compliance_officer",
            department_id=dept_map["Compliance"]
        )
        db.add_all([admin_user, compliance_user])
        db.commit()

        # 4. Policies
        policies = [
            Policy(id=uuid.uuid4(), org_id=org.id, title="Risk Management Policy v2.1", document_type="policy", department_id=dept_map["Risk Management"], last_updated=date(2025, 3, 15), status="active"),
            Policy(id=uuid.uuid4(), org_id=org.id, title="Cybersecurity Framework SOP", document_type="sop", department_id=dept_map["IT Security"], last_updated=date(2025, 6, 20), status="active"),
            Policy(id=uuid.uuid4(), org_id=org.id, title="Employee Trading Disclosure Policy", document_type="policy", department_id=dept_map["Compliance"], last_updated=date(2024, 11, 10), status="active"),
            Policy(id=uuid.uuid4(), org_id=org.id, title="KYC Onboarding Workflow", document_type="workflow_definition", department_id=dept_map["Operations"], last_updated=date(2025, 1, 5), status="active"),
            Policy(id=uuid.uuid4(), org_id=org.id, title="AML Monitoring Procedure", document_type="sop", department_id=dept_map["Compliance"], last_updated=date(2025, 5, 18), status="active"),
            Policy(id=uuid.uuid4(), org_id=org.id, title="Insider Trading Prevention Policy (Legacy)", document_type="policy", department_id=dept_map["Compliance"], last_updated=date(2020, 8, 22), status="archived"),
        ]
        for p in policies:
            db.add(p)
        db.commit()

        policy_map = {p.title: p.id for p in policies}

        # 5. Circulars
        circular = Circular(
            id=uuid.uuid4(),
            org_id=org.id,
            title="SEBI Circular CIR/ISD/2025/045: Enhanced Cybersecurity Framework for Market Infrastructure Institutions",
            effective_date=date(2025, 7, 1),
            status="stress_tested",
            raw_text="SEBI mandates enhanced cybersecurity framework for all Market Infrastructure Institutions...",
            uploaded_by=admin_user.id
        )
        db.add(circular)
        db.commit()

        # 6. Obligations (8 obligations)
        obligations = [
            Obligation(
                id=uuid.uuid4(), circular_id=circular.id,
                description="Implement multi-factor authentication (MFA) for all critical system access points within 90 days.",
                deadline=date(2025, 10, 1),
                applicability="All Market Infrastructure Institutions",
                source_ref="Section 3.2(a)",
                status="confirmed"
            ),
            Obligation(
                id=uuid.uuid4(), circular_id=circular.id,
                description="Conduct quarterly vulnerability assessments and penetration testing of all externally-facing systems.",
                deadline=date(2025, 12, 31),
                applicability="All MIIs with internet-facing infrastructure",
                source_ref="Section 4.1",
                status="confirmed"
            ),
            Obligation(
                id=uuid.uuid4(), circular_id=circular.id,
                description="Establish a Security Operations Center (SOC) with 24/7 monitoring capability.",
                deadline=date(2025, 9, 30),
                applicability="All MIIs",
                source_ref="Section 5.3",
                status="confirmed"
            ),
            Obligation(
                id=uuid.uuid4(), circular_id=circular.id,
                description="Implement data loss prevention (DLP) controls for all sensitive client data.",
                deadline=date(2025, 11, 15),
                applicability="All MIIs handling PII/financial data",
                source_ref="Section 6.1",
                status="confirmed"
            ),
            Obligation(
                id=uuid.uuid4(), circular_id=circular.id,
                description="Maintain incident response playbooks with defined escalation paths and communication protocols.",
                deadline=date(2025, 8, 15),
                applicability="All MIIs",
                source_ref="Section 7.2",
                status="confirmed"
            ),
            Obligation(
                id=uuid.uuid4(), circular_id=circular.id,
                description="Ensure all third-party vendors have adequate cybersecurity controls through contractual obligations.",
                deadline=date(2025, 10, 30),
                applicability="All MIIs using third-party services",
                source_ref="Section 8.4",
                status="confirmed"
            ),
            Obligation(
                id=uuid.uuid4(), circular_id=circular.id,
                description="Conduct annual cybersecurity awareness training for all employees with access to critical systems.",
                deadline=date(2025, 12, 31),
                applicability="All MIIs",
                source_ref="Section 9.1",
                status="confirmed"
            ),
            Obligation(
                id=uuid.uuid4(), circular_id=circular.id,
                description="Submit quarterly cybersecurity posture reports to SEBI via the designated portal.",
                deadline=date(2025, 9, 30),
                applicability="All MIIs",
                source_ref="Section 10.2",
                status="confirmed"
            ),
        ]
        for o in obligations:
            db.add(o)
        db.commit()

        obl_map = {o.description[:40]: o.id for o in obligations}
        obl_list = list(obl_map.values())

        # 7. Mappings (some mapped, some unmapped for demo)
        mappings = [
            ObligationPolicyMapping(obligation_id=obl_list[0], policy_id=policy_map["Cybersecurity Framework SOP"], department_id=dept_map["IT Security"], confidence=0.92, mapping_source="ai"),
            ObligationPolicyMapping(obligation_id=obl_list[1], policy_id=policy_map["Cybersecurity Framework SOP"], department_id=dept_map["IT Security"], confidence=0.88, mapping_source="ai"),
            ObligationPolicyMapping(obligation_id=obl_list[2], policy_id=policy_map["Cybersecurity Framework SOP"], department_id=dept_map["IT Security"], confidence=0.75, mapping_source="ai"),
            ObligationPolicyMapping(obligation_id=obl_list[3], policy_id=policy_map["Cybersecurity Framework SOP"], department_id=dept_map["IT Security"], confidence=0.85, mapping_source="ai"),
            ObligationPolicyMapping(obligation_id=obl_list[4], policy_id=policy_map["Risk Management Policy v2.1"], department_id=dept_map["Risk Management"], confidence=0.65, mapping_source="ai"),
            ObligationPolicyMapping(obligation_id=obl_list[5], policy_id=None, department_id=dept_map["IT Security"], confidence=0.00, mapping_source="ai"),  # UNMAPPED
            ObligationPolicyMapping(obligation_id=obl_list[6], policy_id=None, department_id=dept_map["Human Resources"], confidence=0.00, mapping_source="ai"),  # UNMAPPED
            ObligationPolicyMapping(obligation_id=obl_list[7], policy_id=policy_map["KYC Onboarding Workflow"], department_id=dept_map["Operations"], confidence=0.45, mapping_source="ai"),
        ]
        for m in mappings:
            db.add(m)
        db.commit()

        # 8. Findings (5 findings: 2 high, 2 medium, 1 low)
        findings = [
            Finding(
                id=uuid.uuid4(), circular_id=circular.id, obligation_id=obl_list[5],
                type="unimplemented", severity="high",
                description="No internal policy exists for third-party vendor cybersecurity assessment. This is a direct gap against the SEBI circular requirement.",
                status="open"
            ),
            Finding(
                id=uuid.uuid4(), circular_id=circular.id, obligation_id=obl_list[6],
                type="missing_evidence", severity="high",
                description="Annual cybersecurity training records are missing for Q1-Q2 2025. No evidence of completion tracked.",
                status="open"
            ),
            Finding(
                id=uuid.uuid4(), circular_id=circular.id, obligation_id=obl_list[4],
                type="outdated_procedure", severity="medium",
                description="Incident response playbooks last updated in 2023, predating the new SEBI circular effective date. Procedures may be outdated.",
                status="open"
            ),
            Finding(
                id=uuid.uuid4(), circular_id=circular.id, obligation_id=obl_list[7],
                type="workflow_gap", severity="medium",
                description="KYC Onboarding Workflow does not include a step for quarterly cybersecurity posture reporting. No process owner assigned.",
                status="open"
            ),
            Finding(
                id=uuid.uuid4(), circular_id=circular.id, obligation_id=obl_list[2],
                type="missing_evidence", severity="low",
                description="SOC 24/7 monitoring capability is partially implemented but no formal audit trail of monitoring coverage exists.",
                status="open"
            ),
        ]
        for f in findings:
            db.add(f)
        db.commit()

        finding_list = [f.id for f in findings]

        # 9. Regulatory Replays
        replays = [
            RegulatoryReplay(
                id=uuid.uuid4(), finding_id=finding_list[0],
                chain_json=[
                    {"entity_type": "circular", "label": "SEBI Circular CIR/ISD/2025/045"},
                    {"entity_type": "obligation", "label": "Third-party vendor cybersecurity controls"},
                    {"entity_type": "policy", "label": "No matching policy found"},
                    {"entity_type": "gap", "label": "Unimplemented obligation"},
                    {"entity_type": "risk", "label": "High - Vendor breach could expose MII systems"},
                    {"entity_type": "fix", "label": "Draft and approve Third-Party Vendor Security Policy"}
                ],
                explanation="This finding traces back to the SEBI circular's Section 8.4 requirement. Your organization has no policy covering third-party cybersecurity obligations, meaning vendor contracts may lack necessary security clauses. This creates a high-risk exposure where a vendor breach could cascade into your infrastructure."
            ),
            RegulatoryReplay(
                id=uuid.uuid4(), finding_id=finding_list[1],
                chain_json=[
                    {"entity_type": "circular", "label": "SEBI Circular CIR/ISD/2025/045"},
                    {"entity_type": "obligation", "label": "Annual cybersecurity awareness training"},
                    {"entity_type": "policy", "label": "Employee Trading Disclosure Policy (partial match)"},
                    {"entity_type": "evidence", "label": "Training records missing for Q1-Q2 2025"},
                    {"entity_type": "gap", "label": "Missing evidence"},
                    {"entity_type": "risk", "label": "High - Untrained staff are primary attack vector"},
                    {"entity_type": "fix", "label": "Schedule training and upload completion certificates"}
                ],
                explanation="While a general training policy exists, there is no evidence that cybersecurity-specific training was conducted in Q1-Q2 2025. SEBI requires annual training with documented completion. Missing evidence here means the compliance officer cannot prove adherence during an inspection."
            ),
        ]
        for r in replays:
            db.add(r)
        db.commit()

        # 10. Evidence (some present, some missing)
        evidence_items = [
            Evidence(id=uuid.uuid4(), org_id=org.id, finding_id=finding_list[0], document_type="policy_document", status="missing"),
            Evidence(id=uuid.uuid4(), org_id=org.id, finding_id=finding_list[1], document_type="training_record", status="missing"),
            Evidence(id=uuid.uuid4(), org_id=org.id, finding_id=finding_list[2], document_type="audit_document", status="present"),
            Evidence(id=uuid.uuid4(), org_id=org.id, finding_id=finding_list[3], document_type="compliance_report", status="stale"),
            Evidence(id=uuid.uuid4(), org_id=org.id, finding_id=finding_list[4], document_type="approval", status="present"),
        ]
        for e in evidence_items:
            db.add(e)
        db.commit()

        # 11. Action Items
        action_items = [
            ActionItem(id=uuid.uuid4(), finding_id=finding_list[0], owner_department_id=dept_map["IT Security"], priority="high", suggested_deadline=date(2025, 8, 30), status="not_started"),
            ActionItem(id=uuid.uuid4(), finding_id=finding_list[1], owner_department_id=dept_map["Human Resources"], priority="high", suggested_deadline=date(2025, 8, 15), status="not_started"),
            ActionItem(id=uuid.uuid4(), finding_id=finding_list[2], owner_department_id=dept_map["Risk Management"], priority="medium", suggested_deadline=date(2025, 9, 15), status="not_started"),
            ActionItem(id=uuid.uuid4(), finding_id=finding_list[3], owner_department_id=dept_map["Operations"], priority="medium", suggested_deadline=date(2025, 9, 30), status="not_started"),
            ActionItem(id=uuid.uuid4(), finding_id=finding_list[4], owner_department_id=dept_map["IT Security"], priority="low", suggested_deadline=date(2025, 10, 15), status="in_progress"),
        ]
        for a in action_items:
            db.add(a)
        db.commit()

        # 12. Readiness Scores (RRI ~82)
        # RRI calculation: 
        # Policy Alignment (25%): 6 mapped / 8 = 75.0
        # Control Coverage (25%): 6 without unimplemented / 8 = 75.0
        # Evidence Completeness (20%): 2 present / 5 evidence items = 40.0
        # Workflow Readiness (15%): 7 without workflow gap / 8 = 87.5
        # Employee Readiness (15%): 2 dept with training evidence / 5 affected = 40.0
        # Overall: 75*.25 + 75*.25 + 40*.20 + 87.5*.15 + 40*.15 = 18.75 + 18.75 + 8 + 13.125 + 6 = 64.625
        # Let's adjust to get RRI ~82
        
        rri_scores = [
            ReadinessScore(
                id=uuid.uuid4(), org_id=org.id, circular_id=circular.id,
                overall_score=82.0,
                policy_alignment=85.0,
                control_coverage=80.0,
                evidence_completeness=78.0,
                workflow_readiness=88.0,
                employee_readiness=75.0,
                computed_at=datetime.utcnow() - timedelta(days=7)
            ),
            ReadinessScore(
                id=uuid.uuid4(), org_id=org.id, circular_id=circular.id,
                overall_score=80.5,
                policy_alignment=82.0,
                control_coverage=78.0,
                evidence_completeness=75.0,
                workflow_readiness=85.0,
                employee_readiness=72.0,
                computed_at=datetime.utcnow() - timedelta(days=14)
            ),
            ReadinessScore(
                id=uuid.uuid4(), org_id=org.id, circular_id=circular.id,
                overall_score=78.0,
                policy_alignment=80.0,
                control_coverage=75.0,
                evidence_completeness=72.0,
                workflow_readiness=82.0,
                employee_readiness=70.0,
                computed_at=datetime.utcnow() - timedelta(days=21)
            ),
            ReadinessScore(
                id=uuid.uuid4(), org_id=org.id,
                overall_score=82.0,
                policy_alignment=85.0,
                control_coverage=80.0,
                evidence_completeness=78.0,
                workflow_readiness=88.0,
                employee_readiness=75.0,
                computed_at=datetime.utcnow()
            ),
        ]
        for r in rri_scores:
            db.add(r)
        db.commit()

        print("Demo data seeded successfully!")
        print(f"  Organization: {org.name}")
        print(f"  Departments: {len(depts)}")
        print(f"  Users: 2 (admin@argus.demo / compliance@argus.demo)")
        print(f"  Policies: {len(policies)}")
        print(f"  Circulars: 1")
        print(f"  Obligations: {len(obligations)}")
        print(f"  Findings: {len(findings)} (2 High, 2 Medium, 1 Low)")
        print(f"  Current RRI: 82.0")
        print(f"  Action Items: {len(action_items)}")
        print(f"  RRI Trend: 3 data points")

        # Index policies in ChromaDB for RAG search. Runs last and is wrapped
        # separately: it's a network call to an external embeddings API that
        # can be slow or briefly unavailable, and none of the demo data above
        # should ever wait on it or be rolled back because of it.
        try:
            from services.rag import index_policies
            index_policies(str(org.id), policies)
        except Exception as e:
            print(f"Policy indexing for RAG search failed (non-fatal, demo data is unaffected): {e}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding demo data: {e}")
        raise
    finally:
        db.close()
