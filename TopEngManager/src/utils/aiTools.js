// AI Tools & Function Calling definitions for TopEng System

export const AI_TOOLS_SCHEMA = [
  {
    type: "function",
    function: {
      name: "book_meeting_room",
      description: "Tự động đặt phòng họp trong hệ thống TopEng Management khi người dùng yêu cầu đặt phòng, book phòng, giữ phòng họp mới.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            enum: ["HN", "VP"],
            description: "Địa điểm văn phòng: 'HN' cho Hà Nội (mặc định), 'VP' cho Vĩnh Phúc."
          },
          roomId: {
            type: "string",
            enum: ["room-large", "room-small"],
            description: "ID phòng họp: 'room-large' (Phòng họp lớn, 20 người) hoặc 'room-small' (Phòng họp nhỏ, 8 người)."
          },
          date: {
            type: "string",
            description: "Ngày đặt phòng theo định dạng chuẩn YYYY-MM-DD (Tính toán chính xác theo ngày hiện tại trong ngữ cảnh)."
          },
          startTime: {
            type: "string",
            description: "Thời gian bắt đầu họp theo định dạng 24h HH:MM (Ví dụ: '10:00', '14:00', '14:30')."
          },
          endTime: {
            type: "string",
            description: "Thời gian kết thúc cuộc họp theo định dạng 24h HH:MM (Ví dụ: '11:00', '15:00'). Nếu người dùng không nêu giờ kết thúc, mặc định sau giờ bắt đầu 1 tiếng."
          },
          purpose: {
            type: "string",
            description: "Mục đích hoặc tiêu đề cuộc họp (Ví dụ: 'Họp kỹ thuật', 'Họp nội bộ')."
          },
          importance: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
            description: "Mức độ quan trọng của cuộc họp: 'LOW' (Họp nội bộ, mặc định), 'MEDIUM', 'HIGH' (Họp BOD/Khách hàng)."
          }
        },
        required: ["roomId", "date", "startTime"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_meeting_room",
      description: "Hủy hoặc xóa một lịch đặt phòng họp đã có trong hệ thống khi người dùng yêu cầu hủy, xóa, không họp nữa, hoặc hủy lịch cụ thể.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            enum: ["HN", "VP"],
            description: "Địa điểm phòng họp nếu có ('HN' hoặc 'VP')."
          },
          roomId: {
            type: "string",
            enum: ["room-large", "room-small", "any"],
            description: "Phòng họp muốn hủy: 'room-large' (Phòng họp lớn), 'room-small' (Phòng họp nhỏ), hoặc 'any' nếu không nêu rõ."
          },
          date: {
            type: "string",
            description: "Ngày cuộc họp muốn hủy dạng YYYY-MM-DD (Ví dụ: '2026-08-31')."
          },
          startTime: {
            type: "string",
            description: "Giờ bắt đầu cuộc họp muốn hủy dạng 24h HH:MM (Ví dụ: '14:00', '10:00')."
          },
          reason: {
            type: "string",
            description: "Lý do hủy nếu người dùng có nêu."
          }
        }
      }
    }
  }
];

// Fallback helper to detect cancel meeting intent
export function parseCancelIntentFromText(prompt) {
  const text = (prompt || '').toLowerCase().trim();
  return /(?:hủy|huy|xóa|xoa|cancel|bỏ)\s*(?:đặt)?\s*(?:phòng|lịch|cuộc\s*họp|buổi\s*họp|meeting)/i.test(text) ||
         /(?:không|thôi)\s*họp\s*nữa/i.test(text);
}

// Fallback helper to parse Vietnamese natural language date and time
export function parseBookingIntentFromText(prompt) {
  const text = (prompt || '').toLowerCase();
  
  // Guard: Any request containing cancel keywords must NEVER be treated as a booking request!
  if (text.includes('hủy') || text.includes('huy') || text.includes('xóa') || text.includes('xoa') || text.includes('cancel') || text.includes('bỏ')) {
    return null;
  }

  // Must indicate room booking intent
  const isBookingIntent = text.includes('đặt phòng') || 
                          text.includes('book phòng') || 
                          text.includes('đặt lịch họp') || 
                          text.includes('giữ phòng') ||
                          /(?:book|reserve|schedule)\s+(?:a\s+)?(?:large|small|meeting)?\s*(?:meeting\s*)?room/i.test(text) ||
                          (text.includes('phòng họp') && (text.includes('lúc') || text.includes('vào') || text.includes('mai') || text.includes('thứ')));

  if (!isBookingIntent) return null;

  const now = new Date();
  let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Check for Days of Week (Thứ 2 -> Thứ 7, Chủ Nhật)
  const dayOfWeekMap = [
    { pattern: /(?:thứ\s*7|thứ\s*bảy|t7|saturday)/i, day: 6 },
    { pattern: /(?:thứ\s*6|thứ\s*sáu|t6|friday)/i, day: 5 },
    { pattern: /(?:thứ\s*5|thứ\s*năm|t5|thursday)/i, day: 4 },
    { pattern: /(?:thứ\s*4|thứ\s*tư|t4|wednesday)/i, day: 3 },
    { pattern: /(?:thứ\s*3|thứ\s*ba|t3|tuesday)/i, day: 2 },
    { pattern: /(?:thứ\s*2|thứ\s*hai|t2|monday)/i, day: 1 },
    { pattern: /(?:chủ\s*nhật|cn|sunday)/i, day: 0 }
  ];

  let matchedDOW = null;
  for (const item of dayOfWeekMap) {
    if (item.pattern.test(text)) {
      matchedDOW = item.day;
      break;
    }
  }

  // 2. Resolve Date
  if (text.includes('hôm nay') || text.includes('nay') || text.includes('today')) {
    // Keep today
  } else if (text.includes('ngày mai') || text.includes('sáng mai') || text.includes('chiều mai') || text.includes('tối mai') || text.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (text.includes('ngày kia') || text.includes('hôm kia')) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (matchedDOW !== null) {
    const currentDay = now.getDay();
    let diffDays = matchedDOW - currentDay;
    if (diffDays <= 0) {
      diffDays += 7;
    }
    if (text.includes('tuần sau') && diffDays < 7) {
      diffDays += 7;
    }
    targetDate.setDate(targetDate.getDate() + diffDays);
  } else {
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (dateMatch) {
      const d = parseInt(dateMatch[1], 10);
      const m = parseInt(dateMatch[2], 10) - 1;
      const y = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3], 10) : parseInt(dateMatch[3], 10)) : now.getFullYear();
      targetDate = new Date(y, m, d);
    }
  }

  const yStr = targetDate.getFullYear();
  const mStr = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dStr = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${yStr}-${mStr}-${dStr}`;

  // 3. Determine Room
  let roomId = 'room-large';
  let roomName = 'Phòng họp lớn';

  const isSmallRoom = /(?:phòng\s*(?:họp)?\s*(?:nhỏ|bé|vừa|mini)|room-small|small\s*(?:meeting\s*)?room)/i.test(text);
  const isLargeRoom = /(?:phòng\s*(?:họp)?\s*(?:lớn|to|chính|vip)|room-large|large\s*(?:meeting\s*)?room)/i.test(text);

  if (isSmallRoom) {
    roomId = 'room-small';
    roomName = 'Phòng họp nhỏ';
  } else if (isLargeRoom) {
    roomId = 'room-large';
    roomName = 'Phòng họp lớn';
  }

  // 4. Determine Location
  let location = 'HN';
  let locationName = 'Hà Nội (HN)';
  if (text.includes('vĩnh phúc') || text.includes('vp')) {
    location = 'VP';
    locationName = 'Vĩnh Phúc (VP)';
  }

  // 5. Determine Time
  let startHour = 10;
  let startMinute = 0;

  const ampmMatch = text.match(/(?:for|at|lúc|từ)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (ampmMatch) {
    startHour = parseInt(ampmMatch[1], 10);
    startMinute = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPm = ampmMatch[3].toLowerCase() === 'pm';
    if (isPm && startHour < 12) startHour += 12;
    if (!isPm && startHour === 12) startHour = 0;
  } else {
    const timeMatch = text.match(/(\d{1,2})(?:h|:)(\d{2})?|(\d{1,2})\s*(?:giờ|h)/);
    if (timeMatch) {
      if (timeMatch[1]) {
        startHour = parseInt(timeMatch[1], 10);
        startMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      } else if (timeMatch[3]) {
        startHour = parseInt(timeMatch[3], 10);
        startMinute = 0;
      }

      if ((text.includes('chiều') || text.includes('tối')) && startHour < 12) {
        startHour += 12;
      }
    }
  }

  const startTime = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
  
  let endHour = startHour + 1;
  let endMinute = startMinute;

  const rangeMatch = text.match(/(?:đến|tới|-|to)\s*(\d{1,2})(?:h|:)?(\d{2})?/i);
  if (rangeMatch) {
    endHour = parseInt(rangeMatch[1], 10);
    endMinute = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    if ((text.includes('chiều') || text.includes('tối')) && endHour < 12) {
      endHour += 12;
    }
  }

  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

  let purpose = text.includes('meeting') ? 'Internal Meeting' : 'Họp nội bộ';
  const cleanPurposeText = text
    .replace(/(?:đặt|book|giữ)?\s*phòng\s*(?:họp)?\s*(?:lớn|nhỏ|to|bé)?/gi, '')
    .replace(/(?:book\s+(?:a\s+)?(?:large|small)?\s*(?:meeting\s*)?room)/gi, '')
    .replace(/(?:lúc|từ|for|at)\s*\d{1,2}(?:h|:)?\d{0,2}(?:\s*(?:am|pm))?/gi, '')
    .replace(/(?:đến|tới|-|to)\s*\d{1,2}(?:h|:)?\d{0,2}(?:\s*(?:am|pm))?/gi, '')
    .replace(/(?:thứ\s*\d|thứ\s*bảy|thứ\s*sáu|thứ\s*năm|thứ\s*tư|thứ\s*ba|thứ\s*hai|chủ\s*nhật|cn|hôm nay|ngày mai|sáng mai|chiều mai|today|tomorrow)/gi, '')
    .replace(/(?:tại|ở)?\s*(?:hà nội|vĩnh phúc|hn|vp)/gi, '')
    .trim();

  if (cleanPurposeText && cleanPurposeText.length >= 3) {
    purpose = cleanPurposeText;
  }

  return {
    location,
    locationName,
    roomId,
    roomName,
    date: dateStr,
    startTime,
    endTime,
    purpose,
    importance: text.includes('khẩn') || text.includes('quan trọng') ? 'HIGH' : 'LOW'
  };
}
