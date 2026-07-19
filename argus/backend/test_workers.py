import requests
import time
import subprocess
import os
import signal
import sys

BASE_URL = "http://localhost:8005/api/v1"

def run_tests():
    # 1. Register / Login
    email = f"test_{time.time()}@example.com"
    password = "Password123!"

    print(f"Registering user {email}...")
    res = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": password,
        "org_id": "00000000-0000-0000-0000-000000000000",
        "role": "admin"
    })
    if res.status_code != 200:
        print("Registration failed:", res.text)
        
    print("Logging in...")
    res = requests.post(f"{BASE_URL}/auth/login", data={"username": email, "password": password})
    token = res.json()["access_token"]
    print("Got token:", token[:20] + "...")

    # 2. Call /logout
    headers = {"Authorization": f"Bearer {token}"}
    print("Calling /logout...")
    res = requests.post(f"{BASE_URL}/auth/logout", headers=headers)
    print("Logout response:", res.status_code)

    # 3. Hit protected route repeatedly
    print("Repeatedly hitting /auth/me with revoked token...")
    success_count = 0
    for i in range(10):
        res = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        if res.status_code == 200:
            print(f"Attempt {i+1}: FAIL (Token still works! Returned 200 OK)")
            success_count += 1
        elif res.status_code == 401:
            print(f"Attempt {i+1}: PASS (Returned 401 Unauthorized)")
        time.sleep(0.1)

    if success_count > 0:
        print(f"Result: Token successfully bypassed revocation {success_count} times out of 10.")
        sys.exit(1)
    else:
        print("Result: Token was fully revoked across all requests.")
        sys.exit(0)

if __name__ == "__main__":
    print("Starting Uvicorn with 2 workers...")
    # On Windows we can't easily send SIGINT to a group, so we'll just terminate the process
    # Note that uvicorn might spawn child processes, we can use process group creation flag on Windows
    CREATE_NEW_PROCESS_GROUP = 0x00000200
    server_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--port", "8005", "--workers", "2"],
        creationflags=CREATE_NEW_PROCESS_GROUP
    )
    
    try:
        # Give server time to boot up and wait for it to be ready
        print("Waiting for server to be ready...")
        server_ready = False
        for _ in range(30):
            try:
                res = requests.get(f"{BASE_URL}/dashboard/stats")
                if res.status_code in [200, 401]:
                    server_ready = True
                    break
            except requests.exceptions.ConnectionError:
                pass
            time.sleep(1)
        
        if not server_ready:
            print("Server failed to start in time.")
            sys.exit(1)
            
        print("Server is ready, running tests...")
        run_tests()
    finally:
        print("Shutting down Uvicorn server...")
        # Send CTRL_BREAK_EVENT to the process group on Windows
        os.kill(server_process.pid, signal.CTRL_BREAK_EVENT)
        server_process.wait(timeout=5)
