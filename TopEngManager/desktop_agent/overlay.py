"""
TOPV Transparent Spotlight Overlay Window (Tkinter + Windows API)
Draws glowing spotlight frame, animated arrow, target badge, and interactive step-by-step guidance card.
Guarantees the card is ALWAYS visible and positioned smartly around the target element.
"""

import tkinter as tk
from tkinter import font as tkfont
import multiprocessing
import threading
import time
from scanner import find_element_bounds, get_screen_geometry

# Global reference to running overlay process
_OVERLAY_PROCESS = None

class SpotlightOverlay:
    def __init__(self, steps, window_hint="Top Engineering Vina", on_close_callback=None):
        self.steps = steps if (steps and len(steps) > 0) else [
            {"step": 1, "title": "Hướng dẫn KSystem", "desc": "Làm theo các bước trên màn hình", "target": "menu"}
        ]
        self.window_hint = window_hint
        self.current_step_idx = 0
        self.on_close_callback = on_close_callback
        self.root = None
        self.canvas = None
        self.pulse_alpha = 0
        self.pulse_direction = 1

    def start(self):
        self.root = tk.Tk()
        self.root.title("TOPV Desktop Spotlight Guide")

        # Fullscreen borderless window
        screen = get_screen_geometry()
        self.sw = screen["width"]
        self.sh = screen["height"]
        self.root.geometry(f"{self.sw}x{self.sh}+0+0")
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)

        # Transparent Key color
        trans_color = "#010101"
        self.root.configure(bg=trans_color)
        self.root.wm_attributes("-transparentcolor", trans_color)

        self.canvas = tk.Canvas(
            self.root,
            width=self.sw,
            height=self.sh,
            bg=trans_color,
            highlightthickness=0
        )
        self.canvas.pack(fill="both", expand=True)

        # Keyboard shortcuts
        self.root.bind("<Escape>", lambda e: self.close())
        self.root.bind("<Right>", lambda e: self.next_step())
        self.root.bind("<Left>", lambda e: self.prev_step())
        self.root.bind("<space>", lambda e: self.next_step())

        # Render initial step
        self.render_current_step()

        # Start glowing pulse loop
        self.pulse_animation()

        # Main event loop
        self.root.mainloop()

    def pulse_animation(self):
        if not self.root or not self.canvas:
            return
        self.pulse_alpha += 0.1 * self.pulse_direction
        if self.pulse_alpha >= 1.0:
            self.pulse_direction = -1
        elif self.pulse_alpha <= 0.2:
            self.pulse_direction = 1

        self.canvas.delete("pulse_glow")
        if hasattr(self, 'current_bounds') and self.current_bounds:
            b = self.current_bounds
            x, y, w, h = b["x"], b["y"], b["width"], b["height"]
            glow_color = "#10b981" if self.pulse_direction > 0 else "#38bdf8"
            self.canvas.create_rectangle(
                x - 4, y - 4, x + w + 4, y + h + 4,
                outline=glow_color, width=2, tags="pulse_glow"
            )

        self.root.after(100, self.pulse_animation)

    def render_current_step(self):
        self.canvas.delete("all")

        total = len(self.steps)
        step_data = self.steps[self.current_step_idx]
        step_num = step_data.get("step", self.current_step_idx + 1)
        title = step_data.get("title", f"Bước {step_num}")
        desc = step_data.get("desc", "")

        # 1. Locate element bounds
        bounds = find_element_bounds(step_data, self.window_hint)
        self.current_bounds = bounds
        x, y, w, h = bounds["x"], bounds["y"], bounds["width"], bounds["height"]
        elem_name = bounds.get("element_name", f"Vị trí bước {step_num}")

        # Ensure bounds stay on screen
        x = max(6, min(self.sw - w - 10, x))
        y = max(6, min(self.sh - h - 10, y))

        # 2. Draw Spotlight Box (Glowing cyan & emerald frame around target)
        self.canvas.create_rectangle(
            x - 2, y - 2, x + w + 2, y + h + 2,
            outline="#10b981", width=3, tags="spotlight_box"
        )
        self.canvas.create_rectangle(
            x - 6, y - 6, x + w + 6, y + h + 6,
            outline="#38bdf8", width=1, tags="spotlight_outer"
        )

        # Corner accents
        corner_len = 14
        corners = [
            (x - 2, y - 2, x + corner_len, y - 2, x - 2, y + corner_len), # TL
            (x + w + 2, y - 2, x + w - corner_len, y - 2, x + w + 2, y + corner_len), # TR
            (x - 2, y + h + 2, x + corner_len, y + h + 2, x - 2, y + h - corner_len), # BL
            (x + w + 2, y + h + 2, x + w - corner_len, y + h + 2, x + w + 2, y + h - corner_len) # BR
        ]
        for c in corners:
            self.canvas.create_line(c[0], c[1], c[2], c[3], fill="#ffffff", width=3)
            self.canvas.create_line(c[0], c[1], c[4], c[5], fill="#ffffff", width=3)

        # 3. Position the Floating Guide Card (Guaranteed 100% visible inside screen)
        card_w = 460
        card_h = 190
        arrow_points = None

        # Case A: Huge target (e.g. Whole window or wide area)
        if w > 500 or h > 400:
            card_x = (self.sw - card_w) // 2
            card_y = 60
        # Case B: Target is in Left Sidebar (x < 300 and w < 300)
        elif x < 300 and w < 300:
            card_x = x + w + 24
            card_y = max(30, min(self.sh - card_h - 30, y - 10))
            arrow_points = [
                x + w + 4, y + min(20, h // 2),
                card_x, card_y + 35,
                card_x, card_y + 55
            ]
        # Case C: Target is near top (y < 140)
        elif y + h + card_h + 30 < self.sh:
            card_x = max(20, min(self.sw - card_w - 20, x + (w // 2) - (card_w // 2)))
            card_y = y + h + 16
            arrow_points = [
                x + (w // 2), y + h + 4,
                card_x + (card_w // 2) - 12, card_y,
                card_x + (card_w // 2) + 12, card_y
            ]
        # Case D: Target is near bottom
        else:
            card_x = max(20, min(self.sw - card_w - 20, x + (w // 2) - (card_w // 2)))
            card_y = y - card_h - 16
            arrow_points = [
                x + (w // 2), y - 4,
                card_x + (card_w // 2) - 12, card_y + card_h,
                card_x + (card_w // 2) + 12, card_y + card_h
            ]

        # Always strictly clamp card within screen boundary
        card_x = max(20, min(self.sw - card_w - 20, card_x))
        card_y = max(20, min(self.sh - card_h - 20, card_y))

        # Draw pointing arrow if applicable
        if arrow_points:
            self.canvas.create_polygon(arrow_points, fill="#0f172a", outline="#38bdf8", width=2)

        # Draw Guide Card Shadow / Background
        self.canvas.create_rectangle(
            card_x, card_y, card_x + card_w, card_y + card_h,
            fill="#0f172a", outline="#38bdf8", width=2
        )

        # Header Bar in Card
        self.canvas.create_rectangle(
            card_x + 1, card_y + 1, card_x + card_w - 1, card_y + 36,
            fill="#1e293b", outline=""
        )

        # Step Title Text
        self.canvas.create_text(
            card_x + 14, card_y + 18,
            text=f"📍 BƯỚC {step_num}/{total}: {title[:36]}",
            fill="#38bdf8", font=("Segoe UI", 11, "bold"), anchor="w"
        )

        # Target Element Badge
        self.canvas.create_rectangle(
            card_x + 14, card_y + 42, card_x + card_w - 14, card_y + 68,
            fill="#1e3a8a", outline="#60a5fa", width=1
        )
        self.canvas.create_text(
            card_x + 22, card_y + 55,
            text=f"🎯 Thao tác: {elem_name[:48]}",
            fill="#93c5fd", font=("Segoe UI", 9, "bold"), anchor="w"
        )

        # Description Text (multi-line)
        self.canvas.create_text(
            card_x + 14, card_y + 76,
            text=desc, fill="#f1f5f9", font=("Segoe UI", 10),
            anchor="nw", width=card_w - 28
        )

        # Interactive Control Buttons inside Card
        btn_y = card_y + card_h - 35

        # 1. Back Button
        if self.current_step_idx > 0:
            btn_back = tk.Button(
                self.root, text="◀ Quay lại",
                bg="#334155", fg="#ffffff", activebackground="#475569", activeforeground="#ffffff",
                font=("Segoe UI", 9, "bold"), bd=0, padx=12, pady=4, cursor="hand2",
                command=self.prev_step
            )
            self.canvas.create_window(card_x + 14, btn_y, window=btn_back, anchor="nw")

        # 2. Next / Finish Button
        is_last = self.current_step_idx == total - 1
        btn_next_text = "✔ Hoàn thành" if is_last else "Tiếp theo ▶"
        btn_next_bg = "#10b981" if is_last else "#2563eb"
        btn_next = tk.Button(
            self.root, text=btn_next_text,
            bg=btn_next_bg, fg="#ffffff", activebackground="#059669", activeforeground="#ffffff",
            font=("Segoe UI", 9, "bold"), bd=0, padx=14, pady=4, cursor="hand2",
            command=self.next_step if not is_last else self.close
        )
        self.canvas.create_window(card_x + card_w - 14, btn_y, window=btn_next, anchor="ne")

        # 3. Close Button
        btn_close = tk.Button(
            self.root, text="✖ Đóng (Esc)",
            bg="#1e293b", fg="#94a3b8", activebackground="#334155", activeforeground="#f1f5f9",
            font=("Segoe UI", 9), bd=0, padx=8, pady=4, cursor="hand2",
            command=self.close
        )
        self.canvas.create_window(card_x + card_w - 130 if not is_last else card_x + card_w - 145, btn_y, window=btn_close, anchor="ne")

    def next_step(self):
        if self.current_step_idx < len(self.steps) - 1:
            self.current_step_idx += 1
            self.render_current_step()
        else:
            self.close()

    def prev_step(self):
        if self.current_step_idx > 0:
            self.current_step_idx -= 1
            self.render_current_step()

    def close(self):
        if self.root:
            try:
                self.root.destroy()
            except Exception:
                pass
            self.root = None

def _run_overlay_proc(steps, window_hint):
    overlay = SpotlightOverlay(steps, window_hint)
    overlay.start()

def launch_spotlight(steps, window_hint="Top Engineering Vina"):
    """
    Launches Spotlight in an isolated dedicated process.
    """
    global _OVERLAY_PROCESS
    if _OVERLAY_PROCESS and _OVERLAY_PROCESS.is_alive():
        try:
            _OVERLAY_PROCESS.terminate()
            _OVERLAY_PROCESS.join(timeout=0.5)
        except Exception:
            pass

    _OVERLAY_PROCESS = multiprocessing.Process(
        target=_run_overlay_proc,
        args=(steps, window_hint),
        daemon=True
    )
    _OVERLAY_PROCESS.start()
    return True

def close_spotlight():
    global _OVERLAY_PROCESS
    if _OVERLAY_PROCESS and _OVERLAY_PROCESS.is_alive():
        try:
            _OVERLAY_PROCESS.terminate()
            _OVERLAY_PROCESS.join(timeout=0.5)
        except Exception:
            pass
        _OVERLAY_PROCESS = None
        return True
    return False

def get_spotlight_status():
    global _OVERLAY_PROCESS
    is_active = _OVERLAY_PROCESS is not None and _OVERLAY_PROCESS.is_alive()
    return {
        "active": is_active
    }
