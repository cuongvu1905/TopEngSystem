# -*- coding: utf-8 -*-

# 1. P05.svg reflow
p05_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#38BDF8" font-weight="600">• Đường cong chi phí sửa lỗi (Boehm Curve):</tspan>
      <tspan x="899" dy="20">Phát hiện lỗi ở khâu kiểm thử muộn tốn chi phí gấp 50-100 lần so với lúc phân tích.</tspan>
      <tspan x="879" dy="28" fill="#38BDF8" font-weight="600">• Nhu cầu cấp thiết về vòng lặp ngắn:</tspan>
      <tspan x="899" dy="20">Cần chia nhỏ chu kỳ bàn giao để kiểm chứng sớm và liên tục.</tspan>
      <tspan x="879" dy="28" fill="#38BDF8" font-weight="600">• Đặt nền tảng ra đời:</tspan>
      <tspan x="899" dy="20">Mở đường cho sự bùng nổ của Tuyên ngôn Agile năm 2001.</tspan>
    </text>"""

p05_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#38BDF8" font-weight="600">• Đường cong sửa lỗi Boehm:</tspan>
      <tspan x="899" dy="20">Phát hiện lỗi ở khâu kiểm thử</tspan>
      <tspan x="899" dy="20">tốn chi phí gấp 50-100 lần.</tspan>
      <tspan x="879" dy="26" fill="#38BDF8" font-weight="600">• Nhu cầu vòng lặp ngắn:</tspan>
      <tspan x="899" dy="20">Chia nhỏ chu kỳ bàn giao</tspan>
      <tspan x="899" dy="20">để kiểm chứng liên tục.</tspan>
      <tspan x="879" dy="26" fill="#38BDF8" font-weight="600">• Đặt nền tảng ra đời:</tspan>
      <tspan x="899" dy="20">Mở đường cho sự bùng nổ</tspan>
      <tspan x="899" dy="20">của Tuyên ngôn Agile 2001.</tspan>
    </text>"""

with open('svg_output/P05.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p05_old in c:
    c = c.replace(p05_old, p05_new)
    with open('svg_output/P05.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P05 fixed')
else:
    print('P05 old text not found')

# 2. P08.svg reflow
p08_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#FBBF24" font-weight="600">• Tương tác 1 chiều thụ động:</tspan>
      <tspan x="899" dy="20">Người dùng gõ prompt → AI trả lời đoạn code → Kết thúc phiên.</tspan>
      <tspan x="879" dy="28" fill="#FBBF24" font-weight="600">• Mù mờ về môi trường thực tế:</tspan>
      <tspan x="899" dy="20">AI không biết mã có biên dịch được không, có vi phạm linter hay không.</tspan>
      <tspan x="879" dy="28" fill="#FBBF24" font-weight="600">• Gánh nặng vẫn dồn về con người:</tspan>
      <tspan x="899" dy="20">Nếu code có bug, người dùng phải tự copy error log paste lại cho AI.</tspan>
    </text>"""

p08_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#FBBF24" font-weight="600">• Tương tác 1 chiều thụ động:</tspan>
      <tspan x="899" dy="20">Người dùng gõ prompt → AI trả lời</tspan>
      <tspan x="899" dy="20">đoạn code → Kết thúc phiên.</tspan>
      <tspan x="879" dy="26" fill="#FBBF24" font-weight="600">• Mù mờ về môi trường máy:</tspan>
      <tspan x="899" dy="20">AI không biết mã có biên dịch</tspan>
      <tspan x="899" dy="20">được không, có vi phạm linter không.</tspan>
      <tspan x="879" dy="26" fill="#FBBF24" font-weight="600">• Gánh nặng dồn về con người:</tspan>
      <tspan x="899" dy="20">Nếu code có bug, kỹ sư phải</tspan>
      <tspan x="899" dy="20">tự copy log dán lại vào chat.</tspan>
    </text>"""

with open('svg_output/P08.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p08_old in c:
    c = c.replace(p08_old, p08_new)
    with open('svg_output/P08.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P08 fixed')
else:
    print('P08 old text not found')

# 3. P15.svg line & font-size
with open('svg_output/P15.svg', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('<line x1="100" y1="360" x2="600" y2="360" stroke="url(#glowGrad2)" stroke-width="3"/>',
              '<rect x="100" y="360" width="500" height="3" fill="url(#glowGrad2)"/>')
c = c.replace('font-size="28"', 'font-size="32"')
with open('svg_output/P15.svg', 'w', encoding='utf-8') as f:
    f.write(c)
print('P15 fixed')

# 4. P04.svg font-size 28 -> 32
with open('svg_output/P04.svg', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('<line x1="100" y1="360" x2="600" y2="360" stroke="url(#glowGrad)" stroke-width="3"/>',
              '<rect x="100" y="360" width="500" height="3" fill="url(#glowGrad)"/>')
c = c.replace('font-size="28"', 'font-size="32"')
with open('svg_output/P04.svg', 'w', encoding='utf-8') as f:
    f.write(c)
print('P04 fixed')

# 5. P20.svg reflow
p20_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#FCA5A5" font-weight="600">• Rủi ro hành động ngoài ý muốn:</tspan>
      <tspan x="899" dy="20">AI có thể click nhầm nút Xóa dữ liệu hoặc đóng file chưa lưu.</tspan>
      <tspan x="879" dy="28" fill="#FCA5A5" font-weight="600">• Bắt buộc chạy trong Virtual Machine:</tspan>
      <tspan x="899" dy="20">Cô lập trong Docker/VM để ngăn chặn truy cập dữ liệu nhạy cảm của OS gốc.</tspan>
      <tspan x="879" dy="28" fill="#FCA5A5" font-weight="600">• Đang ở giai đoạn Beta:</tspan>
      <tspan x="899" dy="20">Cần có cơ chế xác nhận người dùng cho các hành động quan trọng.</tspan>
    </text>"""

p20_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#FCA5A5" font-weight="600">• Rủi ro hành động ngoài ý muốn:</tspan>
      <tspan x="899" dy="20">AI có thể click nhầm nút Xóa</tspan>
      <tspan x="899" dy="20">hoặc tắt file chưa lưu dữ liệu.</tspan>
      <tspan x="879" dy="26" fill="#FCA5A5" font-weight="600">• Bắt buộc chạy trong VM/Docker:</tspan>
      <tspan x="899" dy="20">Cô lập hoàn toàn để bảo vệ</tspan>
      <tspan x="899" dy="20">dữ liệu nhạy cảm của hệ điều hành.</tspan>
      <tspan x="879" dy="26" fill="#FCA5A5" font-weight="600">• Đang ở giai đoạn thử nghiệm:</tspan>
      <tspan x="899" dy="20">Cần xác nhận con người cho các</tspan>
      <tspan x="899" dy="20">hành động mang tính rủi ro cao.</tspan>
    </text>"""

with open('svg_output/P20.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p20_old in c:
    c = c.replace(p20_old, p20_new)
    with open('svg_output/P20.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P20 fixed')
else:
    print('P20 old text not found')

# 6. P27.svg line & font-size
with open('svg_output/P27.svg', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace('<line x1="100" y1="360" x2="600" y2="360" stroke="url(#glowGrad3)" stroke-width="3"/>',
              '<rect x="100" y="360" width="500" height="3" fill="url(#glowGrad3)"/>')
c = c.replace('font-size="28"', 'font-size="32"')
with open('svg_output/P27.svg', 'w', encoding='utf-8') as f:
    f.write(c)
print('P27 fixed')

# 7. P35.svg reflow & role
p35_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Trân trọng cảm ơn Quý vị:</tspan>
      <tspan x="899" dy="20">Ban Lãnh đạo, Quý đối tác và toàn thể kỹ sư TOPVSystem.</tspan>
      <tspan x="879" dy="28" fill="#818CF8" font-weight="600">• Mở rộng thảo luận chuyên sâu:</tspan>
      <tspan x="899" dy="20">1. Kiến trúc bảo mật Multi-Brain.</tspan>
      <tspan x="899" dy="20">2. Quy trình tích hợp ERP/MES.</tspan>
      <tspan x="899" dy="20">3. Trải nghiệm triển khai thực địa.</tspan>
    </text>"""

p35_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Trân trọng cảm ơn Quý vị:</tspan>
      <tspan x="899" dy="20">Ban Lãnh đạo, Quý đối tác</tspan>
      <tspan x="899" dy="20">và toàn thể đội ngũ kỹ sư TOPV.</tspan>
      <tspan x="879" dy="26" fill="#818CF8" font-weight="600">• Thảo luận chuyên sâu:</tspan>
      <tspan x="899" dy="20">1. Kiến trúc Multi-Brain.</tspan>
      <tspan x="899" dy="20">2. Tích hợp sâu ERP/MES.</tspan>
      <tspan x="899" dy="20">3. Triển khai thực địa công trường.</tspan>
    </text>"""

with open('svg_output/P35.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p35_old in c:
    c = c.replace(p35_old, p35_new)
c = c.replace('data-pptx-page-role="conclusion"', 'data-pptx-page-role="content"')
with open('svg_output/P35.svg', 'w', encoding='utf-8') as f:
    f.write(c)
print('P35 fixed')
