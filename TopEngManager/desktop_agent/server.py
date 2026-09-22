"""
TOPV Local Desktop Agent - HTTP Bridge Server
Port: 20188
Enables TopEng Web App to communicate with Windows Desktop Agent.
"""

import http.server
import json
import socketserver
import sys
import os

# Ensure desktop_agent dir is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from overlay import launch_spotlight, close_spotlight, get_spotlight_status

PORT = 20188

class AgentRequestHandler(http.server.BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/status' or self.path == '/':
            status_data = {
                "success": True,
                "status": "online",
                "name": "TOPV Desktop Spotlight Agent",
                "version": "1.0.0",
                "port": PORT,
                "overlay": get_spotlight_status()
            }
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(status_data, ensure_ascii=False).encode('utf-8'))
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        
        try:
            body = json.loads(post_body) if post_body.strip() else {}
        except Exception:
            body = {}

        if self.path == '/api/spotlight/start':
            steps = body.get('steps', [])
            window_hint = body.get('windowHint', 'KSystem')

            # Default ERP sample steps if empty
            if not steps or len(steps) == 0:
                steps = [
                    {"step": 1, "target": "Dự án", "title": "Chọn Menu Dự Án", "desc": "Trong phần Menu bên trái, bấm chọn mục 'Dự án'"},
                    {"step": 2, "target": "Quản lý kết quả", "title": "Quản Lý Kết Quả", "desc": "Chọn mục 'Quản lý kết quả' -> 'Nguồn nhân lực'"},
                    {"step": 3, "target": "TOPV Division", "title": "Chọn Bộ Phận", "desc": "Tại mục Bộ phận kinh doanh, chọn 'TOPV Division'"},
                    {"step": 4, "target": "Mã dự án", "title": "Nhập Mã Dự Án", "desc": "Nhập mã dự án và thời gian bắt đầu / hoàn thành"},
                    {"step": 5, "target": "Lưu", "title": "Lưu Kết Quả", "desc": "Bấm nút 'Lưu' phía trên trang để hoàn tất"}
                ]

            launch_spotlight(steps, window_hint)

            response = {
                "success": True,
                "message": f"Đã khởi chạy Spotlight Guide với {len(steps)} bước.",
                "total_steps": len(steps)
            }
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        elif self.path == '/api/spotlight/stop':
            closed = close_spotlight()
            response = {"success": True, "closed": closed, "message": "Đã tắt Spotlight Overlay."}
            self.send_response(200)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

def run_server():
    server_address = ('127.0.0.1', PORT)
    httpd = http.server.ThreadingHTTPServer(server_address, AgentRequestHandler)
    print("=" * 65)
    print("  🚀 TOPV DESKTOP SPOTLIGHT AGENT ĐANG CHẠY")
    print(f"  📡 Local Endpoint: http://127.0.0.1:{PORT}/api/status")
    print("  💡 Sẵn sàng nhận lệnh từ Web TopEng để chiếu đèn lên KSystem!")
    print("  👉 Nhấn Ctrl + C để dừng dịch vụ.")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Đang tắt TOPV Desktop Agent...")
        close_spotlight()
        httpd.server_close()
        print("[✓] Đã tắt thành công.")

if __name__ == '__main__':
    run_server()
