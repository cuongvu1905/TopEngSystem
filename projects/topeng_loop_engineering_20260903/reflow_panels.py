# -*- coding: utf-8 -*-

# P07.svg
p07_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Máy móc chỉ tự động khâu hạ tầng:</tspan>
      <tspan x="899" dy="20">Toàn bộ việc viết mã, thiết kế thuật toán và sửa bug vẫn là 100% con người.</tspan>
      <tspan x="879" dy="28" fill="#818CF8" font-weight="600">• Nút thắt cổ chai về nguồn lực:</tspan>
      <tspan x="899" dy="20">Tốc độ phát triển bị giới hạn bởi số giờ làm việc và năng lượng của kỹ sư.</tspan>
      <tspan x="879" dy="28" fill="#818CF8" font-weight="600">• Mở ra câu hỏi lớn:</tspan>
      <tspan x="899" dy="20">Liệu máy móc có thể trực tiếp tham gia vào việc viết và sửa mã hay không?</tspan>
    </text>"""

p07_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Máy móc chỉ tự động khâu hạ tầng:</tspan>
      <tspan x="899" dy="20">Viết mã, thuật toán và sửa bug</tspan>
      <tspan x="899" dy="20">vẫn hoàn toàn là 100% con người.</tspan>
      <tspan x="879" dy="26" fill="#818CF8" font-weight="600">• Nút thắt cổ chai về nguồn lực:</tspan>
      <tspan x="899" dy="20">Tốc độ bị giới hạn bởi số giờ làm việc</tspan>
      <tspan x="899" dy="20">và năng lượng của kỹ sư.</tspan>
      <tspan x="879" dy="26" fill="#818CF8" font-weight="600">• Mở ra câu hỏi lớn:</tspan>
      <tspan x="899" dy="20">Liệu AI có thể tham gia viết</tspan>
      <tspan x="899" dy="20">và tự sửa mã nguồn hay không?</tspan>
    </text>"""

with open('svg_output/P07.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p07_old in c:
    c = c.replace(p07_old, p07_new)
    with open('svg_output/P07.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P07 reflowed')
else:
    print('P07 pattern not matched')

# P17.svg
p17_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Quản lý Threads &amp; Runs tự động:</tspan>
      <tspan x="899" dy="20">Lưu vết phiên làm việc trên Cloud của OpenAI mà không sợ tràn RAM.</tspan>
      <tspan x="879" dy="28" fill="#818CF8" font-weight="600">• 3 Công cụ gốc tích hợp sẵn:</tspan>
      <tspan x="899" dy="20">Code Interpreter (chạy Python), File Search (Vector RAG) &amp; Tools.</tspan>
      <tspan x="879" dy="28" fill="#818CF8" font-weight="600">• Ứng dụng rộng rãi nhất:</tspan>
      <tspan x="899" dy="20">Trở thành nền tảng xây dựng chatbot và AI Agent SaaS phổ biến nhất.</tspan>
    </text>"""

p17_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Quản lý Threads &amp; Runs tự động:</tspan>
      <tspan x="899" dy="20">Lưu vết phiên làm việc trên Cloud,</tspan>
      <tspan x="899" dy="20">không lo tràn bộ nhớ cục bộ.</tspan>
      <tspan x="879" dy="26" fill="#818CF8" font-weight="600">• 3 Công cụ gốc tích hợp sẵn:</tspan>
      <tspan x="899" dy="20">Code Interpreter, File Search</tspan>
      <tspan x="899" dy="20">và Function Calling có cấu trúc.</tspan>
      <tspan x="879" dy="26" fill="#818CF8" font-weight="600">• Ứng dụng rộng rãi nhất:</tspan>
      <tspan x="899" dy="20">Nền tảng phổ biến nhất cho việc</tspan>
      <tspan x="899" dy="20">xây dựng chatbot &amp; Agent SaaS.</tspan>
    </text>"""

with open('svg_output/P17.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p17_old in c:
    c = c.replace(p17_old, p17_new)
    with open('svg_output/P17.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P17 reflowed')
else:
    print('P17 pattern not matched')

# P18.svg
p18_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Kết nối hệ thống không có API:</tspan>
      <tspan x="899" dy="20">Nhiều phần mềm kế toán cũ hoặc cổng dịch vụ công chỉ có giao diện web.</tspan>
      <tspan x="879" dy="28" fill="#818CF8" font-weight="600">• Thay thế RPA truyền thống:</tspan>
      <tspan x="899" dy="20">Không bị gãy vỡ kịch bản tự động khi website thay đổi màu sắc hay vị trí nút.</tspan>
      <tspan x="879" dy="28" fill="#818CF8" font-weight="600">• Tiềm năng ứng dụng tại TOPV:</tspan>
      <tspan x="899" dy="20">Tự động tra cứu hóa đơn điện tử, giá vật tư xây dựng từ các sàn B2B.</tspan>
    </text>"""

p18_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Kết nối hệ thống không có API:</tspan>
      <tspan x="899" dy="20">Thao tác trực tiếp phần mềm cũ</tspan>
      <tspan x="899" dy="20">hoặc cổng dịch vụ công qua web.</tspan>
      <tspan x="879" dy="26" fill="#818CF8" font-weight="600">• Thay thế RPA truyền thống:</tspan>
      <tspan x="899" dy="20">Không bị gãy kịch bản khi trang web</tspan>
      <tspan x="899" dy="20">thay đổi màu sắc hay vị trí nút.</tspan>
      <tspan x="879" dy="26" fill="#818CF8" font-weight="600">• Tiềm năng ứng dụng tại TOPV:</tspan>
      <tspan x="899" dy="20">Tự tra cứu hóa đơn điện tử</tspan>
      <tspan x="899" dy="20">và giá vật tư từ các sàn B2B.</tspan>
    </text>"""

with open('svg_output/P18.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p18_old in c:
    c = c.replace(p18_old, p18_new)
    with open('svg_output/P18.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P18 reflowed')
else:
    print('P18 pattern not matched')

# P19.svg
p19_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#10B981" font-weight="600">• Tiếp nhận toàn bộ repo trong 1 prompt:</tspan>
      <tspan x="899" dy="20">Đọc hiểu cấu trúc hàng chục file mã nguồn mà không bị suy giảm trí nhớ.</tspan>
      <tspan x="879" dy="28" fill="#10B981" font-weight="600">• Khả năng "Needle In A Haystack" 99%:</tspan>
      <tspan x="899" dy="20">Tìm chính xác 1 hàm bị ẩn sâu trong hàng nghìn trang tài liệu.</tspan>
      <tspan x="879" dy="28" fill="#10B981" font-weight="600">• An toàn đạo đức (Constitutional AI):</tspan>
      <tspan x="899" dy="20">Hạn chế tối đa các hành vi phá hoại mã hoặc tạo lỗ hổng bảo mật.</tspan>
    </text>"""

p19_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#10B981" font-weight="600">• Tiếp nhận toàn bộ repository:</tspan>
      <tspan x="899" dy="20">Đọc hiểu hàng chục file mã nguồn</tspan>
      <tspan x="899" dy="20">mà không bị suy giảm trí nhớ.</tspan>
      <tspan x="879" dy="26" fill="#10B981" font-weight="600">• "Needle In A Haystack" 99%:</tspan>
      <tspan x="899" dy="20">Tìm chính xác 1 dòng code ẩn sâu</tspan>
      <tspan x="899" dy="20">trong hàng nghìn trang tài liệu.</tspan>
      <tspan x="879" dy="26" fill="#10B981" font-weight="600">• Constitutional AI an toàn:</tspan>
      <tspan x="899" dy="20">Hạn chế tối đa hành vi phá hoại</tspan>
      <tspan x="899" dy="20">hoặc tạo lỗ hổng bảo mật.</tspan>
    </text>"""

with open('svg_output/P19.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p19_old in c:
    c = c.replace(p19_old, p19_new)
    with open('svg_output/P19.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P19 reflowed')
else:
    print('P19 pattern not matched')

# P21.svg
p21_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#10B981" font-weight="600">• Kiểm soát lệnh nguy hiểm:</tspan>
      <tspan x="899" dy="20">Hỏi xác nhận [y/n] trước khi chạy lệnh rm, push, migrate.</tspan>
      <tspan x="879" dy="28" fill="#10B981" font-weight="600">• Tự chạy vòng lặp sửa test:</tspan>
      <tspan x="899" dy="20">Nếu npm test fail, tự đọc stderr và tự sửa code tiếp.</tspan>
      <tspan x="879" dy="28" fill="#10B981" font-weight="600">• Trải nghiệm lập trình đỉnh cao:</tspan>
      <tspan x="899" dy="20">Kỹ sư giữ nguyên môi trường làm việc dòng lệnh quen thuộc.</tspan>
    </text>"""

p21_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#10B981" font-weight="600">• Kiểm soát lệnh nguy hiểm:</tspan>
      <tspan x="899" dy="20">Hỏi xác nhận [y/n] trước khi</tspan>
      <tspan x="899" dy="20">chạy lệnh rm, push, migrate.</tspan>
      <tspan x="879" dy="26" fill="#10B981" font-weight="600">• Vòng lặp sửa test tự động:</tspan>
      <tspan x="899" dy="20">Nếu test fail, tự đọc stderr</tspan>
      <tspan x="899" dy="20">và tiếp tục sửa code khép kín.</tspan>
      <tspan x="879" dy="26" fill="#10B981" font-weight="600">• Trải nghiệm dòng lệnh tối ưu:</tspan>
      <tspan x="899" dy="20">Giữ kỹ sư ở nguyên môi trường</tspan>
      <tspan x="899" dy="20">terminal quen thuộc hàng ngày.</tspan>
    </text>"""

with open('svg_output/P21.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p21_old in c:
    c = c.replace(p21_old, p21_new)
    with open('svg_output/P21.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P21 reflowed')
else:
    print('P21 pattern not matched')

# P22.svg
p22_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#34D399" font-weight="600">• Lưu giữ kế hoạch vào file disk:</tspan>
      <tspan x="899" dy="20">Tránh mất trí nhớ tạm thời sau nhiều giờ chạy tác vụ.</tspan>
      <tspan x="879" dy="28" fill="#34D399" font-weight="600">• Báo cáo Walkthrough chuẩn mực:</tspan>
      <tspan x="899" dy="20">Tự động tổng hợp những gì đã làm, đã test và bằng chứng log.</tspan>
      <tspan x="879" dy="28" fill="#34D399" font-weight="600">• Minh bạch qua Transcript JSONL:</tspan>
      <tspan x="899" dy="20">Mọi hành vi, lệnh gọi tool đều có thể truy vết phục vụ audit.</tspan>
    </text>"""

p22_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#34D399" font-weight="600">• Lưu kế hoạch vào file disk:</tspan>
      <tspan x="899" dy="20">Tránh mất trí nhớ sau nhiều giờ</tspan>
      <tspan x="899" dy="20">thực thi các tác vụ phức tạp.</tspan>
      <tspan x="879" dy="26" fill="#34D399" font-weight="600">• Báo cáo Walkthrough chuẩn mực:</tspan>
      <tspan x="899" dy="20">Tổng hợp những gì đã làm,</tspan>
      <tspan x="899" dy="20">đã test kèm bằng chứng log thật.</tspan>
      <tspan x="879" dy="26" fill="#34D399" font-weight="600">• Minh bạch qua Transcript JSONL:</tspan>
      <tspan x="899" dy="20">Mọi lệnh gọi tool đều có thể</tspan>
      <tspan x="899" dy="20">truy vết phục vụ kiểm toán.</tspan>
    </text>"""

with open('svg_output/P22.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p22_old in c:
    c = c.replace(p22_old, p22_new)
    with open('svg_output/P22.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P22 reflowed')
else:
    print('P22 pattern not matched')

# P25.svg
p25_old = """    <text x="879" y="320" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#38BDF8" font-weight="600">• Môi trường tương tác:</tspan>
      <tspan x="899" dy="20">Shell, Git Worktrees, MCP Tools, Daemons nền.</tspan>
      <tspan x="879" dy="26" fill="#38BDF8" font-weight="600">• Cơ chế tự sửa lỗi:</tspan>
      <tspan x="899" dy="20">Tuân thủ nguyên tắc "Evidence before assertions":</tspan>
      <tspan x="899" dy="20">Phải chạy lệnh terminal xác minh trước khi xong.</tspan>
      <tspan x="879" dy="26" fill="#38BDF8" font-weight="600">• Sub-agent tự phục hồi:</tspan>
      <tspan x="899" dy="20">Ủy quyền cho sub-agent sửa bug độc lập an toàn.</tspan>
    </text>"""

p25_new = """    <text x="879" y="320" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#38BDF8" font-weight="600">• Môi trường tương tác:</tspan>
      <tspan x="899" dy="20">Shell, Git Worktrees, MCP Tools.</tspan>
      <tspan x="879" dy="26" fill="#38BDF8" font-weight="600">• Cơ chế tự sửa lỗi:</tspan>
      <tspan x="899" dy="20">Nguyên tắc "Evidence before assertions":</tspan>
      <tspan x="899" dy="20">Chạy terminal xác minh trước khi xong.</tspan>
      <tspan x="879" dy="26" fill="#38BDF8" font-weight="600">• Sub-agent tự phục hồi:</tspan>
      <tspan x="899" dy="20">Ủy quyền sub-agent sửa bug an toàn.</tspan>
    </text>"""

with open('svg_output/P25.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p25_old in c:
    c = c.replace(p25_old, p25_new)
    with open('svg_output/P25.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P25 reflowed')
else:
    print('P25 pattern not matched')

# P28.svg
p28_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#34D399" font-weight="600">• Tác động trực tiếp cơ sở dữ liệu:</tspan>
      <tspan x="899" dy="20">AI phải đặt phòng thật, tạo task thật trên MySQL DB.</tspan>
      <tspan x="879" dy="28" fill="#34D399" font-weight="600">• Hỗ trợ đa ngôn ngữ nghiêm ngặt:</tspan>
      <tspan x="899" dy="20">Phục vụ nhân sự người Việt, chuyên gia Hàn, Trung, Nhật.</tspan>
      <tspan x="879" dy="28" fill="#34D399" font-weight="600">• Bảo mật và tối ưu chi phí:</tspan>
      <tspan x="899" dy="20">Chạy trên hạ tầng kiểm soát được, không phụ thuộc một hãng AI.</tspan>
    </text>"""

p28_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#34D399" font-weight="600">• Tác động Database thật:</tspan>
      <tspan x="899" dy="20">Đặt phòng thật, tạo task thật</tspan>
      <tspan x="899" dy="20">trực tiếp trên cơ sở dữ liệu MySQL.</tspan>
      <tspan x="879" dy="26" fill="#34D399" font-weight="600">• Đa ngôn ngữ nghiêm ngặt:</tspan>
      <tspan x="899" dy="20">Phục vụ nhân sự Việt, chuyên gia</tspan>
      <tspan x="899" dy="20">Hàn, Trung và Nhật Bản.</tspan>
      <tspan x="879" dy="26" fill="#34D399" font-weight="600">• Bảo mật &amp; tối ưu chi phí:</tspan>
      <tspan x="899" dy="20">Hạ tầng kiểm soát được, không</tspan>
      <tspan x="899" dy="20">bị trói buộc vào một hãng AI.</tspan>
    </text>"""

with open('svg_output/P28.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p28_old in c:
    c = c.replace(p28_old, p28_new)
    with open('svg_output/P28.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P28 reflowed')
else:
    print('P28 pattern not matched')

# P30.svg
p30_old = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Proxy kiểm soát nội bộ:</tspan>
      <tspan x="899" dy="20">Quản lý hạn mức sử dụng (Rate limit &amp; Quota) theo user.</tspan>
      <tspan x="879" dy="28" fill="#818CF8" font-weight="600">• Lọc dữ liệu nhạy cảm (Data Masking):</tspan>
      <tspan x="899" dy="20">Ẩn thông tin bí mật kinh doanh trước khi gọi API bên thứ ba.</tspan>
      <tspan x="879" dy="28" fill="#818CF8" font-weight="600">• Caching thông minh:</tspan>
      <tspan x="899" dy="20">Lưu đệm các câu hỏi thường gặp để trả lời tức thời mà không tốn token.</tspan>
    </text>"""

p30_new = """    <text x="879" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#94A3B8">
      <tspan x="879" dy="0" fill="#818CF8" font-weight="600">• Proxy kiểm soát nội bộ:</tspan>
      <tspan x="899" dy="20">Quản lý hạn mức (Rate limit)</tspan>
      <tspan x="899" dy="20">và phân bổ Quota theo người dùng.</tspan>
      <tspan x="879" dy="26" fill="#818CF8" font-weight="600">• Lọc dữ liệu nhạy cảm:</tspan>
      <tspan x="899" dy="20">Ẩn thông tin bí mật kinh doanh</tspan>
      <tspan x="899" dy="20">trước khi gửi lên Cloud API.</tspan>
      <tspan x="879" dy="26" fill="#818CF8" font-weight="600">• Caching thông minh:</tspan>
      <tspan x="899" dy="20">Lưu đệm câu hỏi thường gặp,</tspan>
      <tspan x="899" dy="20">trả lời ngay mà không tốn token.</tspan>
    </text>"""

with open('svg_output/P30.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p30_old in c:
    c = c.replace(p30_old, p30_new)
    with open('svg_output/P30.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P30 reflowed')
else:
    print('P30 pattern not matched')

# P34.svg
p34_old = """    <text x="968" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="13" fill="#94A3B8">
      <tspan x="968" dy="0" fill="#F1F5F9" font-weight="600">• Tích hợp dữ liệu toàn diện:</tspan>
      <tspan x="968" dy="18">Kết nối sâu vào hệ thống kế toán tài chính, kho bãi và sản xuất xưởng.</tspan>
      <tspan x="968" dy="24" fill="#F1F5F9" font-weight="600">• Dự báo nhu cầu vật tư:</tspan>
      <tspan x="968" dy="18">Mô hình AI dự báo tồn kho, tự động đặt hàng vật tư tránh gián đoạn.</tspan>
      <tspan x="968" dy="24" fill="#F1F5F9" font-weight="600">• Tối ưu hóa dòng tiền:</tspan>
      <tspan x="968" dy="18">Dự báo chi phí thi công thực tế so với định mức ngân sách ban đầu.</tspan>
    </text>"""

p34_new = """    <text x="968" y="295" font-family="'Segoe UI', Arial, sans-serif" font-size="13" fill="#94A3B8">
      <tspan x="968" dy="0" fill="#F1F5F9" font-weight="600">• Tích hợp dữ liệu ERP:</tspan>
      <tspan x="968" dy="18">Kết nối tài chính, kho bãi</tspan>
      <tspan x="968" dy="18">và sản xuất gia công xưởng.</tspan>
      <tspan x="968" dy="22" fill="#F1F5F9" font-weight="600">• Dự báo vật tư thông minh:</tspan>
      <tspan x="968" dy="18">Dự báo nhu cầu tồn kho,</tspan>
      <tspan x="968" dy="18">đặt hàng tránh gián đoạn.</tspan>
      <tspan x="968" dy="22" fill="#F1F5F9" font-weight="600">• Tối ưu hóa dòng tiền:</tspan>
      <tspan x="968" dy="18">Dự báo chi phí thi công</tspan>
      <tspan x="968" dy="18">so với ngân sách ban đầu.</tspan>
    </text>"""

with open('svg_output/P34.svg', 'r', encoding='utf-8') as f:
    c = f.read()
if p34_old in c:
    c = c.replace(p34_old, p34_new)
    with open('svg_output/P34.svg', 'w', encoding='utf-8') as f:
        f.write(c)
    print('P34 reflowed')
else:
    print('P34 pattern not matched')
