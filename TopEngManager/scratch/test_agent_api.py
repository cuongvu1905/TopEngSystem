import urllib.request
import json
import time

def test_api():
    print("Testing Desktop Agent API...")
    url = "http://127.0.0.1:20188/api/status"
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print("Status API Response:", data)
            if data.get("status") == "online":
                print("✅ Desktop Agent is ONLINE!")
                return True
    except Exception as e:
        print("❌ Agent offline or unreachable:", e)
        return False

if __name__ == '__main__':
    test_api()
