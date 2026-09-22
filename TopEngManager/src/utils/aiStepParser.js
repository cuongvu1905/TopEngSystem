/**
 * Intelligent Step Parser from AI responses.
 * Dynamically extracts step numbers, titles, full instructions, and identifies target UI elements.
 */

function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function extractStepsFromAiResponse(text) {
  if (!text || typeof text !== 'string') return [];

  // Remove cited documents section at the bottom
  const cleanText = text.split(/(?:📌|📍|\*\*)\s*(?:Tài liệu trích dẫn|Nguồn tham khảo|Sources)/i)[0];

  const lines = cleanText.split('\n');
  const steps = [];
  let currentStep = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Match "Bước 1:", "Bước 2.", "Step 1:", "**Bước 1:**", etc.
    const stepMatch = line.match(/^(?:[-*•]\s*)?(?:[#*]*\s*)?(?:Bước|Step)\s*(\d+)[:.]?\s*(.*)/i);

    if (stepMatch) {
      if (currentStep) {
        finalizeStep(currentStep);
        steps.push(currentStep);
      }

      const stepNum = parseInt(stepMatch[1], 10);
      let stepHeader = stepMatch[2].replace(/^[:*_\s]+|[*_\s]+$/g, '').trim();

      currentStep = {
        step: stepNum,
        rawHeader: stepHeader,
        title: stepHeader,
        descLines: [],
        rawText: line,
        target: '',
        ui_type: 'auto'
      };
    } else if (currentStep) {
      // Append bullet points or explanation lines
      const cleanBullet = line.replace(/^[*\-•\s]+/, '').replace(/[*_`]/g, '').trim();
      if (cleanBullet) {
        currentStep.descLines.push(cleanBullet);
        currentStep.rawText += '\n' + cleanBullet;
      }
    }
  }

  if (currentStep) {
    finalizeStep(currentStep);
    steps.push(currentStep);
  }

  return steps;
}

function finalizeStep(step) {
  const fullContent = [step.rawHeader, ...step.descLines].filter(Boolean).join('\n');
  const normalized = removeVietnameseTones(fullContent);

  // If header was empty (e.g. "Bước 3:" followed by bullets), derive title from first bullet
  if (!step.title && step.descLines.length > 0) {
    const firstBullet = step.descLines[0];
    step.title = firstBullet.length > 55 ? firstBullet.substring(0, 55) + '...' : firstBullet;
  }
  if (!step.title) {
    step.title = `Bước ${step.step}`;
  }

  // Build clean multi-line description
  if (step.descLines.length > 0) {
    step.desc = step.descLines.map(l => '• ' + l).join('\n');
  } else {
    step.desc = step.rawHeader;
  }

  // 1. Menu path extraction (e.g. "Dự án -> Quản lý kết quả -> Nguồn nhân lực...")
  if (normalized.includes('->') || normalized.includes('menu') || normalized.includes('thuc don') || normalized.includes('chon muc')) {
    const cleanNoBackticks = fullContent.replace(/`/g, '');
    const pathMatch = cleanNoBackticks.match(/([A-ZÀ-Ỹa-zà-ỹ0-9\s()\-]+(?:\s*->\s*[A-ZÀ-Ỹa-zà-ỹ0-9\s()\-]+)+)/);
    if (pathMatch) {
      step.target = `Menu: ${pathMatch[1].trim()}`;
    } else {
      step.target = 'Menu phân hệ (Cột thực đơn bên trái)';
    }
    step.ui_type = 'sidebar_menu';
  } else if (normalized.includes('truy cap') || normalized.includes('ksystem') || normalized.includes('mo ung dung') || normalized.includes('dang nhap')) {
    step.target = 'Cửa sổ ứng dụng KSystem';
    step.ui_type = 'main_window';
  } else if (normalized.includes('luu') || normalized.includes('save') || normalized.includes('phia tren')) {
    step.target = 'Nút "Lưu" (Góc trên thanh công cụ)';
    step.ui_type = 'toolbar_save';
  } else if (normalized.includes('bo phan kinh doanh') || normalized.includes('topv division') || normalized.includes('ngay lam viec') || normalized.includes('nguon nhan luc')) {
    step.target = 'Vùng điều kiện: Bộ phận (TOPV Division), Ngày làm việc & Nhân sự';
    step.ui_type = 'form_header';
  } else if (normalized.includes('ma du an') || normalized.includes('ngay bat dau') || normalized.includes('ngay hoan thanh') || normalized.includes('so gio') || normalized.includes('wbs')) {
    step.target = 'Vùng chi tiết: Mã dự án, Ngày bắt đầu/kết thúc & Số giờ làm việc';
    step.ui_type = 'form_detail';
  } else if (normalized.includes('xuong hang') || normalized.includes('them dong') || normalized.includes('nhieu du an') || normalized.includes('lap lai buoc')) {
    step.target = 'Bảng dữ liệu: Xuống dòng tiếp theo để nhập thêm dự án';
    step.ui_type = 'data_grid';
  } else if (normalized.includes('truy van') || normalized.includes('tim kiem') || normalized.includes('search')) {
    step.target = 'Nút "Truy vấn / Tìm kiếm"';
    step.ui_type = 'toolbar_query';
  } else {
    step.target = step.title;
    step.ui_type = 'general';
  }
}
