import pytest
import requests
import os
import time

BASE_URL = "http://localhost:8000/api/v1"

TEST_USER = {
    "email": "admin@argus.demo",
    "password": "admin123",
    "org_id": "1"
}

@pytest.fixture(scope="session")
def auth_token():
    response = requests.post(f"{BASE_URL}/auth/login", data={"username": TEST_USER["email"], "password": TEST_USER["password"]})
    if response.status_code != 200:
        pytest.fail(f"Login failed: {response.text}")
    data = response.json()
    TEST_USER["org_id"] = data.get("user", {}).get("org_id")
    return data.get("access_token")

@pytest.fixture(scope="session")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}

def test_expired_jwt():
    headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid"}
    response = requests.get(f"{BASE_URL}/dashboard/stats", headers=headers)
    assert response.status_code == 401

def test_unauthenticated():
    response = requests.get(f"{BASE_URL}/dashboard/stats")
    assert response.status_code == 401

def upload_document(filepath, doc_type, headers):
    # First create the circular
    create_data = {
        "title": f"Test Circular - {doc_type}",
        "effective_date": "2025-01-01",
        "org_id": TEST_USER.get("org_id")
    }
    create_resp = requests.post(f"{BASE_URL}/circulars/", headers=headers, json=create_data)
    if create_resp.status_code != 200:
        return create_resp
    
    circular_id = create_resp.json()["id"]
    
    # Then upload the file
    with open(filepath, 'rb') as f:
        files = {'file': (os.path.basename(filepath), f, 'application/pdf')}
        upload_resp = requests.post(f"{BASE_URL}/circulars/{circular_id}/upload", headers=headers, files=files)
        
    # We return the upload response but inject the id for the test to use
    if upload_resp.status_code == 200:
        upload_resp.json = lambda: {"id": circular_id}
    return upload_resp

@pytest.fixture(scope="session")
def circular_ids(headers):
    # This fixture uploads the files and returns their IDs for subsequent tests
    docs = [
        ("Cybersecurity.pdf", "Cybersecurity")
    ]
    
    ids = []
    
    for filepath, doc_type in docs:
        if not os.path.exists(filepath):
            try:
                from reportlab.pdfgen import canvas
                c = canvas.Canvas(filepath)
                c.setFont("Helvetica", 12)
                dummy_content = f"SEBI CIRCULAR. The regulated entity shall implement strong passwords. This applies to all brokers. Section 1."
                c.drawString(100, 750, dummy_content)
                c.save()
            except ImportError:
                with open(filepath, 'wb') as f:
                    f.write(b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Size 2\n/Root 1 0 R\n>>\nstartxref\n50\n%%EOF\n")
                
        response = upload_document(filepath, doc_type, headers)
        assert response.status_code == 200, f"Upload failed for {doc_type}: {response.text}"
        data = response.json()
        assert "id" in data
        circular_id = data["id"]
        ids.append(circular_id)
        
        max_retries = 90
        for _ in range(max_retries):
            findings_resp = requests.get(f"{BASE_URL}/obligations/circular/{circular_id}", headers=headers)
            if findings_resp.status_code == 200 and len(findings_resp.json()) > 0:
                break
            time.sleep(2)
        
        # Ensure it actually found findings before proceeding
        assert len(findings_resp.json()) > 0, "Agent timed out extracting findings"
        
    return ids

def test_findings_generated(headers, circular_ids):
    for cid in circular_ids:
        findings_resp = requests.get(f"{BASE_URL}/circulars/{cid}/findings", headers=headers)
        assert findings_resp.status_code == 200

def test_stress_test_and_replay(headers, circular_ids):
    cid = circular_ids[0]
    # 1. Run stress test
    stress_resp = requests.post(f"{BASE_URL}/findings/{cid}/run-stress-test", headers=headers)
    if stress_resp.status_code != 200:
        print(f"Stress test failed: {stress_resp.text}")
    assert stress_resp.status_code == 200
    time.sleep(2)
    
    # 2. Verify Replay
    findings_resp = requests.get(f"{BASE_URL}/circulars/{cid}/findings", headers=headers)
    findings = findings_resp.json()
    if findings:
        fid = findings[0]["id"]
        replay_resp = requests.get(f"{BASE_URL}/replay/{fid}", headers=headers)
        if replay_resp.status_code != 200:
            print(f"Replay failed: {replay_resp.text}")
        assert replay_resp.status_code == 200

def test_report_generation(headers, circular_ids):
    cid = circular_ids[0]
    report_resp = requests.post(f"{BASE_URL}/reports/generate/{cid}", headers=headers)
    assert report_resp.status_code == 200
    data = report_resp.json()
    assert "file_url" in data
    
def test_advisor(headers):
    import time
    time.sleep(30) # Wait for quota to reset (5 RPM limit)
    payload = {"question": "Why is RRI low?", "org_id": TEST_USER.get("org_id")}
    advisor_resp = requests.post(f"{BASE_URL}/advisor/query", headers=headers, json=payload)
    assert advisor_resp.status_code == 200
    data = advisor_resp.json()
    assert "answer" in data
    assert "sources" in data

def test_delete_circular(headers, circular_ids):
    cid = circular_ids[-1] # Delete the last one
    delete_resp = requests.delete(f"{BASE_URL}/circulars/{cid}", headers=headers)
    assert delete_resp.status_code == 200
    
    # Verify dashboard metrics update (no orphan rows)
    metrics_resp = requests.get(f"{BASE_URL}/dashboard/stats?org_id={TEST_USER['org_id']}", headers=headers)
    assert metrics_resp.status_code == 200
    # In a real test, we would assert the count decreased
