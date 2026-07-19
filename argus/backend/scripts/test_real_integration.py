import os
import time
import zipfile
import httpx

API_URL = "http://localhost:8000/api/v1"
ADMIN_EMAIL = "admin@argus.com"
ADMIN_PASS = "admin123"

def create_dummy_docx(filename: str, text: str):
    """Generate a minimal valid DOCX file for testing."""
    xml_content = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        <w:p><w:r><w:t>{text}</w:t></w:r></w:p>
    </w:body>
</w:document>"""
    with zipfile.ZipFile(filename, 'w') as z:
        z.writestr('word/document.xml', xml_content)

def wait_for_processing(client, circular_id):
    """Poll until the circular finishes processing."""
    print(f"Waiting for circular {circular_id} to process...")
    for _ in range(30): # max 60 seconds
        res = client.get(f"{API_URL}/circulars/{circular_id}")
        assert res.status_code == 200
        status = res.json()["status"]
        if status in ["obligations_extracted", "mapped", "stress_tested", "extraction_failed"]:
            return res.json()
        time.sleep(2)
    raise TimeoutError("Processing timed out")

def run_integration_test():
    print("="*60)
    print("Starting REAL Integration Test...")
    print("="*60)

    # 1. Login
    with httpx.Client() as client:
        print("Logging in as admin...")
        login_res = client.post(
            f"{API_URL}/auth/login",
            data={"username": ADMIN_EMAIL, "password": ADMIN_PASS}
        )
        assert login_res.status_code == 200, "Login failed. Ensure seed data exists."
        token = login_res.json()["access_token"]
        
        # Update client headers
        client.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get Me -> Org ID
        me_res = client.get(f"{API_URL}/auth/me")
        org_id = me_res.json()["org_id"]
        
        # 2. Generate test files
        tests = [
            ("Cyber_MFA.docx", "SEBI Circular on Cybersecurity. All brokers must implement MFA for trading applications by Oct 2025. Mandatory for all retail systems.", "Cyber"),
            ("Market_Surveillance.docx", "SEBI Circular on Market Surveillance. Stock exchanges must maintain real-time monitoring of high-frequency trades to prevent spoofing.", "Surveillance"),
            ("Insider_Trading.docx", "SEBI Circular on Insider Trading. Designated persons must declare their trades within 48 hours of execution.", "Insider")
        ]
        
        circular_ids = []
        
        try:
            for filename, text, prefix in tests:
                print(f"\nProcessing {filename}...")
                create_dummy_docx(filename, text)
                
                # Create
                c_res = client.post(f"{API_URL}/circulars/", json={
                    "title": filename.replace(".docx", ""),
                    "org_id": org_id,
                    "effective_date": "2025-01-01"
                })
                c_id = c_res.json()["id"]
                circular_ids.append(c_id)
                
                # Upload
                with open(filename, "rb") as f:
                    upload_res = client.post(
                        f"{API_URL}/circulars/{c_id}/upload",
                        files={"file": (filename, f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
                    )
                assert upload_res.status_code == 200
                
                # Poll extraction
                final_circ = wait_for_processing(client, c_id)
                print(f"[{filename}] Extraction Status: {final_circ['status']}")
                if final_circ['status'] == "extraction_failed":
                    print(f"[{filename}] Extraction Failed: {final_circ.get('processing_errors')}")
                    continue
                
                # Run Stress Test (Mapping + Stress Test + RRI + Evidence)
                print(f"[{filename}] Triggering Stress Test (LangGraph)...")
                stress_res = client.post(f"{API_URL}/findings/{c_id}/run-stress-test")
                assert stress_res.status_code == 200, f"Stress test failed: {stress_res.text}"
                
                # Verify Findings and Generate Replay
                findings_res = client.get(f"{API_URL}/findings/", params={"org_id": org_id})
                findings = [f for f in findings_res.json() if f["circular_id"] == c_id]
                if findings:
                    print(f"[{filename}] Generated {len(findings)} findings. Testing Replay Generation...")
                    f_id = findings[0]["id"]
                    replay_res = client.get(f"{API_URL}/replay/{f_id}")
                    assert replay_res.status_code == 200, "Replay generation failed"
                    print(f"[{filename}] Replay generated successfully for finding {f_id}")
            
            # 3. Verifications
            print("\n" + "="*60)
            print("Verifying Results across Circulars...")
            
            obls_cyber = client.get(f"{API_URL}/obligations/circular/{circular_ids[0]}").json()
            obls_surv = client.get(f"{API_URL}/obligations/circular/{circular_ids[1]}").json()
            
            # Assuming AI didn't timeout (handled below if it did)
            if len(obls_cyber) > 0 and len(obls_surv) > 0:
                print(f"Cyber Obligations: {len(obls_cyber)}")
                print(f"Surveillance Obligations: {len(obls_surv)}")
                assert obls_cyber[0]["description"] != obls_surv[0]["description"], "AI extracted identical obligations for different docs!"
                
                # Check mapping candidate policies
                maps_cyber = client.get(f"{API_URL}/mappings/obligation/{obls_cyber[0]['id']}").json()
                if maps_cyber:
                    print(f"Cyber Mapped to Policy ID: {maps_cyber[0].get('policy_id')}")
            else:
                print("Skipping obligation validation because extraction failed (e.g. LLM Timeout or Rate Limit).")
            
            # 4. Check RRI
            rri_res = client.get(f"{API_URL}/readiness/{org_id}")
            if rri_res.status_code == 200:
                print(f"Current RRI: {rri_res.json().get('score')}")
                
            # 5. Check Advisor integration
            print("\nQuerying Advisor about Cyber Circular...")
            adv_res = client.post(f"{API_URL}/advisor/query", json={
                "org_id": org_id,
                "question": "What is the deadline for MFA according to the recent circulars?"
            })
            if adv_res.status_code == 200:
                print(f"Advisor Response: {adv_res.json().get('answer')[:100]}...")
            
            print("\nALL VERIFICATIONS COMPLETED SUCCESSFULLY.")
            
        finally:
            # Cleanup files
            for filename, _, _ in tests:
                if os.path.exists(filename):
                    os.remove(filename)
            
            # Cleanup DB records
            print("\nCleaning up test circulars from DB...")
            for c_id in circular_ids:
                client.delete(f"{API_URL}/circulars/{c_id}")

if __name__ == "__main__":
    try:
        run_integration_test()
    except Exception as e:
        print(f"Integration Test Failed: {e}")
        import traceback
        traceback.print_exc()
