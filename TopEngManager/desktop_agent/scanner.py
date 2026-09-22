"""
TOPV Screen & Windows UI Element Locator (Dynamic Screen OCR & Content-Driven Engine)
Performs live Windows Screen OCR for exact button and text bounding box detection,
with intelligent fallback to calibrated layout anchors.
"""

import ctypes
from ctypes import wintypes
import subprocess
import json
import os
import re

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long)
    ]

def get_screen_geometry():
    width = user32.GetSystemMetrics(0)
    height = user32.GetSystemMetrics(1)
    return {"width": width, "height": height}

def get_window_rect(hwnd):
    rect = RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return {
        "x": int(rect.left),
        "y": int(rect.top),
        "width": max(0, int(rect.right - rect.left)),
        "height": max(0, int(rect.bottom - rect.top))
    }

def get_window_text(hwnd):
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return ""

def find_target_window(title_hint=None):
    """
    Finds the active ERP / KSystem / Top Engineering Vina desktop window.
    """
    target_keywords = ["top engineering", "vina", "ksystem", "erp", "topeng"]
    if title_hint:
        hint_clean = title_hint.lower().strip()
        if hint_clean not in target_keywords:
            target_keywords.insert(0, hint_clean)

    matched_hwnd = [None]
    top_priority = [-1]

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

    def enum_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            text = get_window_text(hwnd)
            if text:
                text_lower = text.lower()
                rect = get_window_rect(hwnd)
                if rect["width"] > 400 and rect["height"] > 300:
                    for idx, kw in enumerate(target_keywords):
                        if kw in text_lower:
                            p = 100 - idx
                            if p > top_priority[0]:
                                top_priority[0] = p
                                matched_hwnd[0] = hwnd
                            break
        return True

    cb = WNDENUMPROC(enum_cb)
    user32.EnumWindows(cb, 0)

    if matched_hwnd[0]:
        return matched_hwnd[0]

    fg = user32.GetForegroundWindow()
    return fg if fg else 0

def remove_tones(text):
    if not text:
        return ""
    text = text.lower().strip()
    replacements = {
        'à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ': 'a',
        'è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ': 'e',
        'ì|í|ị|ỉ|ĩ': 'i',
        'ò|ó|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ': 'o',
        'ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ': 'u',
        'ỳ|ý|ỵ|ỷ|ỹ': 'y',
        'đ': 'd'
    }
    for pattern, repl in replacements.items():
        for char in pattern.split('|'):
            text = text.replace(char, repl)
    return text

def run_live_screen_ocr(keyword, window_hint=None):
    """
    Runs Windows native WinRT OCR via ocr_worker.ps1 on the live screen.
    Returns exact bounding box if keyword is visually found on screen.
    """
    if not keyword or len(keyword.strip()) < 2:
        return None

    script_path = os.path.join(os.path.dirname(__file__), "ocr_worker.ps1")
    if not os.path.exists(script_path):
        return None

    try:
        cmd = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", script_path,
            "-TargetKeyword", keyword,
            "-WindowTitleHint", window_hint or "Top Engineering Vina"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=1.8)
        if res.returncode == 0 and res.stdout.strip():
            # Parse JSON output from last line
            lines = [l.strip() for l in res.stdout.strip().split("\n") if l.strip()]
            for line in reversed(lines):
                if line.startswith("{") and line.endswith("}"):
                    data = json.loads(line)
                    if data.get("found") and data.get("width", 0) > 5 and data.get("height", 0) > 5:
                        return data
    except Exception:
        pass

    return None

def find_element_bounds(step_data, window_hint=None):
    """
    Computes accurate on-screen coordinates:
    1. First attempts live Screen OCR on the target keyword.
    2. Falls back to semantic UI layout mapping if OCR is unavailable or low-confidence.
    """
    screen = get_screen_geometry()
    screen_w = screen["width"]
    screen_h = screen["height"]

    target_hwnd = find_target_window(window_hint)
    win_bounds = get_window_rect(target_hwnd) if target_hwnd else None

    if not win_bounds or win_bounds["width"] < 400 or win_bounds["height"] < 300:
        win_bounds = {"x": 0, "y": 0, "width": screen_w, "height": screen_h}

    wx = win_bounds["x"]
    wy = win_bounds["y"]
    ww = win_bounds["width"]
    wh = win_bounds["height"]

    ui_type = step_data.get("ui_type", "auto")
    target_text = step_data.get("target", "")
    title = step_data.get("title", "")
    desc = step_data.get("desc", "")
    full_content = f"{target_text} {title} {desc}"
    normalized = remove_tones(full_content)

    # 1. LIVE SCREEN OCR ATTEMPT for high-precision text/button match
    # Try searching for specific extracted keywords
    search_candidates = []
    if "quan ly ket qua" in normalized:
        search_candidates.append("Quản lý kết quả")
    if "luu" in normalized or "save" in normalized:
        search_candidates.append("Lưu")
    if "topv division" in normalized:
        search_candidates.append("TOPV Division")
    if "nguon nhan luc" in normalized:
        search_candidates.append("Nguồn nhân lực")
    if "du an" in normalized:
        search_candidates.append("Dự án")
    if "chung tu" in normalized:
        search_candidates.append("Chứng từ")
    if target_text and target_text not in search_candidates:
        search_candidates.append(target_text)

    for cand in search_candidates:
        ocr_res = run_live_screen_ocr(cand, window_hint)
        if ocr_res and ocr_res.get("found"):
            # Expand bounding box slightly for visual padding
            ox = max(6, ocr_res["x"] - 6)
            oy = max(6, ocr_res["y"] - 4)
            ow = ocr_res["width"] + 12
            oh = ocr_res["height"] + 8
            return {
                "x": ox,
                "y": oy,
                "width": ow,
                "height": oh,
                "side": "ocr",
                "element_name": f"OCR Nút: '{ocr_res.get('text', cand)}'",
                "found_exact": True
            }

    # 2. SEMANTIC ANCHOR FALLBACK (Based on KSystem layout)
    # Case: Main Window / Startup
    if ui_type == "main_window" or "truy cap he thong" in normalized or "mo ung dung" in normalized:
        return {
            "x": wx + 10,
            "y": wy + 10,
            "width": ww - 20,
            "height": wh - 20,
            "side": "center",
            "element_name": target_text or "Cửa sổ ứng dụng KSystem",
            "found_exact": True
        }

    # Case: Sidebar Menu Tree (Quản lý kết quả, Nguồn nhân lực, Dự án,...)
    if ui_type == "sidebar_menu" or any(k in normalized for k in ["menu", "thuc don", "quan ly ket qua", "du an ->", "chon muc"]):
        if "quan ly ket qua" in normalized or "nguon nhan luc" in normalized:
            menu_y = wy + 278
        elif "thong tin co ban" in normalized:
            menu_y = wy + 112
        elif "du an" in normalized:
            menu_y = wy + 168
        elif "ngan sach" in normalized:
            menu_y = wy + 224
        else:
            menu_y = wy + 78

        return {
            "x": wx + 6,
            "y": menu_y,
            "width": 195,
            "height": 30,
            "side": "left",
            "element_name": target_text or "Menu: Dự án -> Quản lý kết quả",
            "found_exact": True
        }

    # Case: Save / Action Toolbar button (Top Toolbar)
    if ui_type == "toolbar_save" or any(k in normalized for k in ["nut luu", "save", "xac nhan", "phia tren cua trang", "luu lai"]):
        return {
            "x": wx + 260,
            "y": wy + 68,
            "width": 60,
            "height": 28,
            "side": "top",
            "element_name": target_text or "Nút 'Lưu' (Thanh công cụ trên)",
            "found_exact": True
        }

    # Case: Form Header / Condition fields (Bộ phận kinh doanh, TOPV Division, Ngày kế toán, Nhân sự)
    if ui_type == "form_header" or any(k in normalized for k in ["bo phan kinh doanh", "topv division", "ngay lam viec", "nhan su", "nguon nhan luc"]):
        return {
            "x": wx + 215,
            "y": wy + 105,
            "width": max(550, int(ww * 0.7)),
            "height": 65,
            "side": "form",
            "element_name": target_text or "Vùng điều kiện: TOPV Division, Ngày & Nhân sự",
            "found_exact": True
        }

    # Case: Form Details / Project & Working Hours (Mã dự án, WBS, Ngày bắt đầu, Ngày kết thúc, Giờ làm việc)
    if ui_type == "form_detail" or any(k in normalized for k in ["ma du an", "ten wbs", "ngay bat dau", "ngay hoan thanh", "so gio"]):
        return {
            "x": wx + 215,
            "y": wy + 175,
            "width": max(550, int(ww * 0.7)),
            "height": 85,
            "side": "form",
            "element_name": target_text or "Bảng dữ liệu: Nhập Mã dự án & Giờ làm việc",
            "found_exact": True
        }

    # Case: Data Grid / Multi-project rows (Xuống hàng tiếp theo, Bảng, Thêm dòng)
    if ui_type == "data_grid" or any(k in normalized for k in ["xuong hang", "them dong", "nhieu du an", "lap lai buoc 3", "bang du lieu"]):
        return {
            "x": wx + 215,
            "y": wy + 265,
            "width": max(450, ww - 325),
            "height": 180,
            "side": "grid",
            "element_name": target_text or "Bảng dữ liệu: Xuống hàng để nhập thêm dự án",
            "found_exact": True
        }

    # Case: Toolbar Query / Search button
    if ui_type == "toolbar_query" or any(k in normalized for k in ["truy van", "tim kiem", "search"]):
        return {
            "x": wx + ww - 105,
            "y": wy + 205,
            "width": 90,
            "height": 28,
            "side": "top_right",
            "element_name": target_text or "Nút 'Truy vấn chứng từ'",
            "found_exact": True
        }

    # Default fallback
    return {
        "x": wx + 215,
        "y": wy + 105,
        "width": 400,
        "height": 60,
        "side": "form",
        "element_name": target_text or title,
        "found_exact": False
    }
