import { extractStepsFromAiResponse } from '../src/utils/aiStepParser.js';

const sampleAiResponse = `Để nhập ERP hàng tháng, bạn thực hiện theo các bước sau:

Bước 1: Truy cập hệ thống KSystem.

Bước 2: Trong phần Menu, chọn mục \`Dự án\` -> \`Quản lý kết quả\` -> \`Nguồn nhân lực\` -> \`Nhập kết quả dự án (theo từng nguồn lực - nguồn lực)\`.

Bước 3:
• Bộ phận kinh doanh chọn \`TOPV Division\`.
• Nhập ngày làm việc: ngày đầu tiên làm việc trong tháng và ngày cuối cùng làm việc trong tháng.
• Nguồn nhân lực: Nhập tên và chọn đúng tên nhân sự và mã nhân viên muốn nhập.

Bước 4:
• Chọn vào phần \`Mã dự án\` và nhập mã dự án.
• Sau khi nhập Mã dự án, mục \`Dự án\` và \`Tên WBS\` sẽ tự động được hệ thống điền vào.
• Nhập ngày bắt đầu làm việc trong dự án đó vào \`Ngày bắt đầu làm việc\`.
• Nhập ngày hoàn thành công việc trong dự án đó vào \`Ngày hoàn thành công việc\`.
• Nhân viên tự tính số giờ làm việc thực tế trong dự án đó (= số giờ làm việc cơ bản + số giờ OT - số giờ nghỉ).

Bước 5: Nếu nhân viên tham gia nhiều dự án trong tháng thì sẽ xuống hàng tiếp theo và lặp lại Bước 3 cho tất cả các dự án.

Bước 6: Bấm nút \`Lưu\` phía trên của trang để lưu lại.

📌 Tài liệu trích dẫn:
• DataToRAG.txt (Đoạn 1, Đoạn 2)`;

const steps = extractStepsFromAiResponse(sampleAiResponse);
console.log("PARSED DYNAMIC STEPS COUNT:", steps.length);
steps.forEach(s => {
  console.log(`\n--- BƯỚC ${s.step} ---`);
  console.log("Title:", s.title);
  console.log("Target:", s.target);
  console.log("UI Type:", s.ui_type);
  console.log("Desc:\n" + s.desc);
});
