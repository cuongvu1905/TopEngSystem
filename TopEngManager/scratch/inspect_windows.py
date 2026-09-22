import ctypes

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

total_seen = [0]
def enum_cb(hwnd, lparam):
    total_seen[0] += 1
    buf = ctypes.create_unicode_buffer(512)
    user32.GetWindowTextW(hwnd, buf, 512)
    vis = user32.IsWindowVisible(hwnd)
    if buf.value:
        print(f"HWND: {hwnd}, vis={vis}, title={buf.value!r}")
    return True

cb = WNDENUMPROC(enum_cb)
res = user32.EnumWindows(cb, 0)
print(f"EnumWindows returned: {res}, total windows seen: {total_seen[0]}")
