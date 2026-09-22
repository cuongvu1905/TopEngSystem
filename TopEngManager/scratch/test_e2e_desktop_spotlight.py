import urllib.request
import json
import time
import subprocess
import sys

def run_test():
    print("--- STARTING E2E DYNAMIC DESKTOP SPOTLIGHT TEST ---")

    # Sample 6 dynamic steps extracted from the AI's actual ERP answer
    dynamic_steps = [
        {
            "step": 1,
            "title": "Truy cập hệ thống KSystem.",
            "desc": "Truy cập hệ thống KSystem.",
            "target": "Cửa sổ ứng dụng KSystem",
            "ui_type": "main_window"
        },
        {
            "step": 2,
            "title": "Trong phần Menu, chọn mục Dự án -> Quản lý kết quả -> Nguồn nhân lực...",
            "desc": "Trong phần Menu, chọn mục Dự án -> Quản lý kết quả -> Nguồn nhân lực -> Nhập kết quả dự án (theo từng nguồn lực - nguồn lực).",
            "target": "Menu: Dự án -> Quản lý kết quả -> Nguồn nhân lực",
            "ui_type": "sidebar_menu"
        },
        {
            "step": 3,
            "title": "Bộ phận kinh doanh chọn TOPV Division.",
            "desc": "• Bộ phận kinh doanh chọn TOPV Division.\n• Nhập ngày làm việc: ngày đầu tiên làm việc trong tháng và ngày cuối cùng làm việc trong tháng.\n• Nguồn nhân lực: Nhập tên và chọn đúng tên nhân sự và mã nhân viên muốn nhập.",
            "target": "Vùng điều kiện: Bộ phận (TOPV Division), Ngày làm việc & Nhân sự",
            "ui_type": "form_header"
        },
        {
            "step": 4,
            "title": "Chọn vào phần Mã dự án và nhập mã dự án.",
            "desc": "• Chọn vào phần Mã dự án và nhập mã dự án.\n• Sau khi nhập Mã dự án, mục Dự án và Tên WBS sẽ tự động được hệ thống điền vào.\n• Nhập ngày bắt đầu làm việc trong dự án đó vào Ngày bắt đầu làm việc.\n• Nhập ngày hoàn thành công việc trong dự án đó vào Ngày hoàn thành công việc.\n• Nhân viên tự tính số giờ làm việc thực tế trong dự án đó (= số giờ làm việc cơ bản + số giờ OT - số giờ nghỉ).",
            "target": "Vùng chi tiết: Mã dự án, Ngày bắt đầu/kết thúc & Số giờ làm việc",
            "ui_type": "form_detail"
        },
        {
            "step": 5,
            "title": "Nếu nhân viên tham gia nhiều dự án trong tháng...",
            "desc": "Nếu nhân viên tham gia nhiều dự án trong tháng thì sẽ xuống hàng tiếp theo và lặp lại Bước 3 cho tất cả các dự án.",
            "target": "Bảng dữ liệu: Xuống dòng tiếp theo để nhập thêm dự án",
            "ui_type": "data_grid"
        },
        {
            "step": 6,
            "title": "Bấm nút Lưu phía trên của trang để lưu lại.",
            "desc": "Bấm nút Lưu phía trên của trang để lưu lại.",
            "target": "Nút \"Lưu\" (Góc trên thanh công cụ)",
            "ui_type": "toolbar_save"
        }
    ]

    # Start server in background if not running
    proc = subprocess.Popen([sys.executable, "desktop_agent/server.py"], cwd=".")
    time.sleep(2)

    try:
        # 1. Test status
        status_url = "http://127.0.0.1:20188/api/status"
        with urllib.request.urlopen(status_url, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print("Status response:", data)
            assert data.get("success") is True
            print("✅ Bước 1: Desktop Agent Server đang online.")

        # 2. Test start dynamic spotlight
        start_url = "http://127.0.0.1:20188/api/spotlight/start"
        payload = json.dumps({
            "steps": dynamic_steps,
            "windowHint": "Top Engineering Vina"
        }).encode('utf-8')
        req = urllib.request.Request(start_url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print("Start Dynamic Spotlight response:", data)
            assert data.get("success") is True
            assert data.get("total_steps") == 6
            print("✅ Bước 2: Đã kích hoạt Dynamic Spotlight Overlay với 6 bước trích xuất từ AI.")

        time.sleep(1)

        # 3. Test stop spotlight
        stop_url = "http://127.0.0.1:20188/api/spotlight/stop"
        req = urllib.request.Request(stop_url, data=b"{}", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print("Stop Spotlight response:", data)
            assert data.get("success") is True
            print("✅ Bước 3: Đã đóng Spotlight Overlay thành công.")

        print("🎉 --- ALL DYNAMIC SPOTLIGHT E2E TESTS PASSED 100% ---")

    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    run_test()
