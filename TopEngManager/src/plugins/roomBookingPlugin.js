// Room Booking Plugin for TopEng Agent Harness

export const ROOM_BOOKING_SCHEMA = [
  {
    type: "function",
    function: {
      name: "book_meeting_room",
      description: "Tự động đặt phòng họp trong hệ thống TopEng Management khi người dùng yêu cầu đặt phòng (ví dụ: 'đặt phòng họp lớn lúc 10h', 'Book large meeting room for 11 am', 'giữ phòng họp nhỏ chiều nay'). Tự động điền ngày hôm nay, thời lượng 1 tiếng và mục đích mặc định nếu người dùng không cung cấp đầy đủ.",
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
            description: "ID phòng họp: 'room-large' (Phòng họp lớn / Large room) hoặc 'room-small' (Phòng họp nhỏ / Small room). Mặc định là 'room-large'."
          },
          date: {
            type: "string",
            description: "Ngày đặt phòng theo định dạng chuẩn YYYY-MM-DD. Nếu người dùng không nêu ngày, MẶC ĐỊNH LÀ HÔM NAY (ngày hiện tại)."
          },
          startTime: {
            type: "string",
            description: "Thời gian bắt đầu họp theo định dạng 24h HH:MM (Ví dụ: '10:00', '11:00', '14:30', '15:00')."
          },
          endTime: {
            type: "string",
            description: "Thời gian kết thúc cuộc họp theo định dạng 24h HH:MM. Nếu người dùng không nêu, MẶC ĐỊNH LÀ 1 TIẾNG SAU GIỜ BẮT ĐẦU."
          },
          purpose: {
            type: "string",
            description: "Mục đích cuộc họp (Ví dụ: 'Họp nội bộ', 'Internal Meeting', 'Họp kỹ thuật'). Mặc định là 'Họp nội bộ' (hoặc 'Internal Meeting')."
          },
          importance: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
            description: "Mức độ quan trọng của cuộc họp: 'LOW' (Họp nội bộ, mặc định), 'MEDIUM', 'HIGH'."
          }
        },
        required: ["startTime"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_meeting_room",
      description: "Hủy hoặc xóa một lịch đặt phòng họp đã có trong hệ thống khi người dùng yêu cầu hủy, xóa, không họp nữa, hoặc 'cancel a meeting'. Nếu người dùng không nêu cụ thể ngày giờ, HÃY GỌI NGAY CÔNG CỤ NÀY ĐỂ TỰ ĐỘNG HỦY CUỘC HỌP GẦN NHẤT MÀ NGƯỜI ĐÓ ĐÃ ĐẶT.",
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
            description: "Phòng họp muốn hủy: 'room-large', 'room-small', hoặc 'any'."
          },
          date: {
            type: "string",
            description: "Ngày cuộc họp muốn hủy dạng YYYY-MM-DD. Mặc định là 'any' để hủy lịch gần nhất."
          },
          startTime: {
            type: "string",
            description: "Giờ bắt đầu cuộc họp muốn hủy dạng 24h HH:MM. Mặc định là 'any'."
          },
          reason: {
            type: "string",
            description: "Lý do hủy nếu người dùng có nêu."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_room_availability",
      description: "Tra cứu danh sách lịch phòng họp đã đặt trong ngày để kiểm tra các khung giờ còn trống.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            enum: ["HN", "VP"],
            description: "Văn phòng cần tra cứu ('HN' hoặc 'VP')."
          },
          date: {
            type: "string",
            description: "Ngày cần tra cứu dạng YYYY-MM-DD."
          }
        }
      }
    }
  }
];

function getRoomBookingText(lang) {
  const l = ['vi', 'en', 'ko', 'zh', 'ja'].includes(lang) ? lang : 'vi';
  const texts = {
    vi: {
      roomLarge: 'Phòng họp lớn',
      roomSmall: 'Phòng họp nhỏ',
      locHn: 'Hà Nội (HN)',
      locVp: 'Vĩnh Phúc (VP)',
      conflictTitle: '⚠️ **Khung giờ này đã có người đặt trước!**',
      conflictRoom: 'Phòng:',
      conflictTime: 'Thời gian bị trùng:',
      conflictBookedBy: 'Nhóm đã đặt:',
      conflictDatePrefix: 'ngày',
      conflictPrompt: (other) => `Bạn có muốn đổi sang khung giờ khác hoặc đặt **${other}** không?`,
      otherTeam: 'Nhóm khác',
      successTitle: '🎉 **Tôi đã tự động đặt phòng họp thành công cho bạn!**',
      successDesc: 'Lịch họp của bạn đã được lưu vào hệ thống và hiển thị trực tiếp trên thẻ **Đặt phòng họp**.',
      notFoundTitle: '⚠️ **Không tìm thấy lịch họp:** Hiện tại hệ thống không tìm thấy cuộc họp nào',
      notFoundSuffix: 'để hủy.',
      noPermissionTitle: '⛔ **Từ chối thao tác: Bạn không có quyền hủy cuộc họp này!**',
      noPermissionRoom: 'Phòng họp:',
      noPermissionTime: 'Thời gian:',
      noPermissionBooker: 'Người đặt:',
      noPermissionDesc: (booker) => `Theo quy định phân quyền của TopEng, nhân viên chỉ có thể hủy những cuộc họp do chính mình đặt. Vui lòng liên hệ **${booker}** hoặc **Quản trị viên (Admin)** để hủy lịch này.`,
      cancelSuccessTitle: '🗑️ **Đã hủy lịch đặt phòng họp thành công!**',
      cancelSuccessPurpose: 'Mục đích:',
      cancelSuccessDesc: 'Phòng họp đã được giải phóng trên hệ thống để các nhóm khác có thể sử dụng.',
      defaultPurpose: 'Họp nội bộ'
    },
    en: {
      roomLarge: 'Large Meeting Room',
      roomSmall: 'Small Meeting Room',
      locHn: 'Hanoi (HN)',
      locVp: 'Vinh Phuc (VP)',
      conflictTitle: '⚠️ **This time slot is already booked!**',
      conflictRoom: 'Room:',
      conflictTime: 'Conflicting Time:',
      conflictBookedBy: 'Booked by:',
      conflictDatePrefix: 'on',
      conflictPrompt: (other) => `Would you like to choose another time slot or book the **${other}** instead?`,
      otherTeam: 'Another team',
      successTitle: '🎉 **Meeting room booked successfully!**',
      successDesc: 'Your meeting schedule has been saved to the system and is now displayed on the **Meeting Rooms** board.',
      notFoundTitle: '⚠️ **No meeting found:** The system could not find any matching meeting',
      notFoundSuffix: 'to cancel.',
      noPermissionTitle: '⛔ **Access Denied: You do not have permission to cancel this meeting!**',
      noPermissionRoom: 'Meeting Room:',
      noPermissionTime: 'Time Slot:',
      noPermissionBooker: 'Booked by:',
      noPermissionDesc: (booker) => `Under TopEng policy, employees can only cancel meetings they booked themselves. Please contact **${booker}** or an **Administrator** to cancel this booking.`,
      cancelSuccessTitle: '🗑️ **Meeting reservation cancelled successfully!**',
      cancelSuccessPurpose: 'Purpose:',
      cancelSuccessDesc: 'The room has been released and is now available for other teams to book.',
      defaultPurpose: 'Internal Meeting'
    },
    ko: {
      roomLarge: '대회의실',
      roomSmall: '소회의실',
      locHn: '하노이 (HN)',
      locVp: '빈푹 (VP)',
      conflictTitle: '⚠️ **해당 시간대는 이미 예약되어 있습니다!**',
      conflictRoom: '회의실:',
      conflictTime: '중복 시간:',
      conflictBookedBy: '예약자/팀:',
      conflictDatePrefix: '일자:',
      conflictPrompt: (other) => `다른 시간대를 선택하시거나 **${other}**을(를) 예약하시겠습니까?`,
      otherTeam: '다른 팀',
      successTitle: '🎉 **회의실 예약이 성공적으로 완료되었습니다!**',
      successDesc: '예약 일정이 시스템에 등록되었으며 **회의실 예약** 탭에서 확인하실 수 있습니다.',
      notFoundTitle: '⚠️ **회의 일정을 찾을 수 없습니다:** 취소할 수 있는 회의 일정이 없습니다',
      notFoundSuffix: '.',
      noPermissionTitle: '⛔ **권한 없음: 본인이 예약한 회의만 취소할 수 있습니다!**',
      noPermissionRoom: '회의실:',
      noPermissionTime: '시간:',
      noPermissionBooker: '예약자:',
      noPermissionDesc: (booker) => `TopEng 규정에 따라 직접 예약한 회의만 취소할 수 있습니다. **${booker}** 님 또는 **관리자(Admin)**에게 문의해 주세요.`,
      cancelSuccessTitle: '🗑️ **회의실 예약이 성공적으로 취소되었습니다!**',
      cancelSuccessPurpose: '목적:',
      cancelSuccessDesc: '회의실이 정상적으로 반환되어 다른 팀이 이용할 수 있습니다.',
      defaultPurpose: '내부 회의'
    },
    zh: {
      roomLarge: '大会议室',
      roomSmall: '小会议室',
      locHn: '河内 (HN)',
      locVp: '永福 (VP)',
      conflictTitle: '⚠️ **该时间段已被预订！**',
      conflictRoom: '会议室:',
      conflictTime: '冲突时间:',
      conflictBookedBy: '预订人/团队:',
      conflictDatePrefix: '日期:',
      conflictPrompt: (other) => `您想更换其他时间段还是改订**${other}**？`,
      otherTeam: '其他团队',
      successTitle: '🎉 **已为您成功预订会议室！**',
      successDesc: '您的会议日程已保存到系统中，并可在**会议室预订**面板中查看。',
      notFoundTitle: '⚠️ **未找到会议日程:** 系统中未找到相符的会议',
      notFoundSuffix: '以进行取消。',
      noPermissionTitle: '⛔ **权限不足: 您没有权限取消此会议！**',
      noPermissionRoom: '会议室:',
      noPermissionTime: '时间:',
      noPermissionBooker: '预订人:',
      noPermissionDesc: (booker) => `根据 TopEng 权限规定，员工只能取消自己预订的会议。请联系 **${booker}** 或 **管理员(Admin)** 取消此日程。`,
      cancelSuccessTitle: '🗑️ **已成功取消会议室预订！**',
      cancelSuccessPurpose: '目的:',
      cancelSuccessDesc: '会议室已在系统中释放，其他团队现可使用。',
      defaultPurpose: '内部会议'
    },
    ja: {
      roomLarge: '大会議室',
      roomSmall: '小会議室',
      locHn: 'ハノイ (HN)',
      locVp: 'ヴィンフック (VP)',
      conflictTitle: '⚠️ **この時間帯は既に予約されています！**',
      conflictRoom: '会議室:',
      conflictTime: '重複時間:',
      conflictBookedBy: '予約チーム/担当:',
      conflictDatePrefix: '日付:',
      conflictPrompt: (other) => `別の時間帯に変更するか、**${other}**を予約しますか？`,
      otherTeam: '他のチーム',
      successTitle: '🎉 **会議室の予約が完了しました！**',
      successDesc: '予約スケジュールがシステムに保存され、**会議室予約**画面で確認できます。',
      notFoundTitle: '⚠️ **会議が見つかりません:** キャンセル対象の会議が見つかりませんでした',
      notFoundSuffix: '。',
      noPermissionTitle: '⛔ **権限エラー: この会議をキャンセルする権限がありません！**',
      noPermissionRoom: '会議室:',
      noPermissionTime: '時間:',
      noPermissionBooker: '予約者:',
      noPermissionDesc: (booker) => `TopEngの規定により、自分が予約した会議のみキャンセルできます。**${booker}** 様または **管理者 (Admin)** にご連絡ください。`,
      cancelSuccessTitle: '🗑️ **会議室の予約をキャンセルしました！**',
      cancelSuccessPurpose: '目的:',
      cancelSuccessDesc: '会議室が解放され、他のチームが利用可能になりました。',
      defaultPurpose: '社内会議'
    }
  };
  return texts[l] || texts.vi;
}

export async function handleRoomBookingTool(toolName, args, { currentUser, config, backendUrl, language, triggerN8N }) {
  const txt = getRoomBookingText(language);

  if (toolName === 'book_meeting_room') {
    const loc = args.location || 'HN';
    const locName = loc === 'HN' ? txt.locHn : txt.locVp;
    const rId = args.roomId === 'room-small' ? 'room-small' : 'room-large';
    const rName = rId === 'room-small' ? txt.roomSmall : txt.roomLarge;
    const otherName = rId === 'room-small' ? txt.roomLarge : txt.roomSmall;

    const now = new Date();
    let bookingDate = args.date;
    if (!bookingDate || bookingDate === 'today' || bookingDate.includes('nay')) {
      bookingDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    let start = args.startTime || '10:00';
    let end = args.endTime;
    if (!end) {
      const [h, m] = start.split(':').map(Number);
      end = `${String(h + 1).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
    }

    // Check overlap
    let existingBookings = [];
    try {
      const checkRes = await fetch(`${backendUrl}/getRoomBookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDate: bookingDate, toDate: bookingDate, location: loc })
      });
      if (checkRes.ok) existingBookings = await checkRes.json();
    } catch (e) {
      console.warn('Could not check overlap:', e.message);
    }

    const conflict = Array.isArray(existingBookings) && existingBookings.find(b => 
      b.location === loc &&
      b.roomId === rId &&
      b.date === bookingDate &&
      start < b.endTime && end > b.startTime
    );

    if (conflict) {
      return {
        success: true,
        reply: `${txt.conflictTitle}\n\n* **${txt.conflictRoom}** ${rName} (${locName})\n* **${txt.conflictTime}** ${conflict.startTime} - ${conflict.endTime}, ${txt.conflictDatePrefix} ${bookingDate}\n* **${txt.conflictBookedBy}** ${conflict.team || conflict.bookerName || txt.otherTeam}\n\n${txt.conflictPrompt(otherName)}`,
        isConflict: true
      };
    }

    const teamName = currentUser?.department_name ? `Team ${currentUser.department_name}` : (currentUser?.name ? `Team ${currentUser.name}` : 'Team R&D');
    const bookerName = currentUser?.name || 'Nguyễn Admin';
    const bookerId = currentUser?.id || 'usr-admin';

    const createRes = await fetch(`${backendUrl}/createRoomBooking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: loc,
        roomId: rId,
        date: bookingDate,
        startTime: start,
        endTime: end,
        team: teamName,
        bookerName,
        bookerId,
        purpose: args.purpose || txt.defaultPurpose,
        importance: args.importance || 'LOW'
      })
    });

    const createdData = await createRes.json();
    if (!createRes.ok) {
      throw new Error(createdData.error || 'Lỗi khi lưu lịch đặt phòng vào hệ thống.');
    }

    const [y, m, d] = bookingDate.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    let n8nTriggered = false;
    if (triggerN8N) {
      triggerN8N({
        event: 'ROOM_BOOKING_CREATED',
        bookingId: createdData.booking_id || createdData.id || `rbk-${Date.now()}`,
        roomId: rId,
        roomName: rName,
        location: loc,
        locationName: locName,
        date: bookingDate,
        formattedDate,
        startTime: start,
        endTime: end,
        purpose: args.purpose || txt.defaultPurpose,
        importance: args.importance || 'LOW',
        booker: {
          id: bookerId,
          name: bookerName,
          team: teamName,
          email: currentUser?.email || 'admin@topeng.com'
        },
        timestamp: new Date().toISOString()
      });
      n8nTriggered = true;
    }

    return {
      success: true,
      reply: `${txt.successTitle}\n\n${txt.successDesc}`,
      bookingData: {
        id: createdData.booking_id || createdData.id || `rbk-${Date.now()}`,
        roomName: rName,
        locationName: locName,
        date: formattedDate,
        rawDate: bookingDate,
        startTime: start,
        endTime: end,
        purpose: args.purpose || txt.defaultPurpose,
        bookerName,
        team: teamName,
        importance: args.importance || 'LOW',
        n8nTriggered
      }
    };
  }

  if (toolName === 'cancel_meeting_room') {
    let allBookings = [];
    try {
      const checkRes = await fetch(`${backendUrl}/getRoomBookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (checkRes.ok) allBookings = await checkRes.json();
    } catch (e) {
      console.warn('Could not fetch bookings for cancel:', e.message);
    }

    const hasSpecificFilter = Boolean(
      (args.date && args.date !== 'any' && args.date !== 'all') ||
      (args.roomId && args.roomId !== 'any') ||
      (args.startTime && args.startTime !== 'any')
    );

    let candidates = [...allBookings];

    if (args.date && args.date !== 'any' && args.date !== 'all') {
      candidates = candidates.filter(b => b.date === args.date);
    }

    if (args.roomId && args.roomId !== 'any') {
      candidates = candidates.filter(b => b.roomId === args.roomId);
    }

    if (args.startTime && args.startTime !== 'any') {
      const h = String(args.startTime.split(':')[0]).padStart(2, '0');
      candidates = candidates.filter(b => b.startTime.startsWith(h));
    }

    let candidate = null;

    if (!hasSpecificFilter) {
      // Find the user's latest booking
      const myBookings = allBookings.filter(b => 
        (currentUser?.id && b.bookerId === currentUser.id) ||
        (currentUser?.name && b.bookerName && b.bookerName.toLowerCase() === currentUser.name.toLowerCase())
      );
      if (myBookings.length > 0) {
        candidate = myBookings[myBookings.length - 1];
      } else if (allBookings.length > 0) {
        candidate = allBookings[allBookings.length - 1];
      }
    } else if (candidates.length > 0) {
      // Prioritize the user's own booking among matching candidates
      const myMatch = candidates.filter(b => 
        (currentUser?.id && b.bookerId === currentUser.id) ||
        (currentUser?.name && b.bookerName && b.bookerName.toLowerCase() === currentUser.name.toLowerCase())
      );
      candidate = myMatch.length > 0 ? myMatch[myMatch.length - 1] : candidates[candidates.length - 1];
    }

    if (!candidate) {
      const filterDetails = [];
      if (args.roomId && args.roomId !== 'any') filterDetails.push(args.roomId === 'room-large' ? txt.roomLarge : txt.roomSmall);
      if (args.date && args.date !== 'any') filterDetails.push(`${args.date}`);
      if (args.startTime && args.startTime !== 'any') filterDetails.push(`${args.startTime}`);
      
      const filterMsg = filterDetails.length > 0 ? ` (${filterDetails.join(', ')})` : '';
      return {
        success: true,
        reply: `${txt.notFoundTitle}${filterMsg} ${txt.notFoundSuffix}`
      };
    }

    const isAdmin = (currentUser?.system_role || '').toLowerCase().includes('admin') ||
                    (currentUser?.system_role || '').toLowerCase().includes('quản trị') ||
                    currentUser?.email === 'admin@topeng.com';

    const isOwner = (currentUser?.id && candidate.bookerId === currentUser.id) ||
                    (currentUser?.name && candidate.bookerName && candidate.bookerName.toLowerCase() === currentUser.name.toLowerCase());

    if (!isAdmin && !isOwner) {
      const candRoomName = candidate.roomId === 'room-large' ? txt.roomLarge : txt.roomSmall;
      const candLocName = candidate.location === 'HN' ? txt.locHn : txt.locVp;
      return {
        success: true,
        reply: `${txt.noPermissionTitle}\n\n* **${txt.noPermissionRoom}** ${candRoomName} (${candLocName})\n* **${txt.noPermissionTime}** ${candidate.startTime} - ${candidate.endTime}, ${candidate.date}\n* **${txt.noPermissionBooker}** **${candidate.bookerName || txt.otherTeam}** (${candidate.team || ''})\n\n${txt.noPermissionDesc(candidate.bookerName || 'Admin')}`,
        isForbidden: true
      };
    }

    const deleteRes = await fetch(`${backendUrl}/deleteRoomBooking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: candidate.id,
        requesterId: currentUser?.id || 'usr-admin'
      })
    });

    const deleteData = await deleteRes.json().catch(() => ({}));
    if (!deleteRes.ok) {
      return {
        success: true,
        reply: `⚠️ ${deleteData.error || 'Failed to cancel meeting.'}`
      };
    }

    const candRoomName = candidate.roomId === 'room-large' ? txt.roomLarge : txt.roomSmall;
    const candLocName = candidate.location === 'HN' ? txt.locHn : txt.locVp;

    if (triggerN8N) {
      triggerN8N({
        event: 'ROOM_BOOKING_CANCELLED',
        bookingId: candidate.id,
        roomName: candRoomName,
        locationName: candLocName,
        date: candidate.date,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        bookerName: candidate.bookerName,
        cancelledBy: currentUser?.name || 'Admin',
        reason: args.reason || 'Requested by user',
        timestamp: new Date().toISOString()
      });
    }

    return {
      success: true,
      reply: `${txt.cancelSuccessTitle}\n\n* **${txt.conflictRoom}** ${candRoomName} (${candLocName})\n* **${txt.noPermissionTime}** ${candidate.startTime} - ${candidate.endTime}, ${candidate.date}\n* **${txt.cancelSuccessPurpose}** ${candidate.purpose || txt.defaultPurpose}\n\n${txt.cancelSuccessDesc}`,
      isCancelled: true
    };
  }

  if (toolName === 'check_room_availability') {
    const loc = args.location || 'HN';
    const locName = loc === 'HN' ? txt.locHn : txt.locVp;
    const now = new Date();
    const targetDate = args.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let bookings = [];
    try {
      const res = await fetch(`${backendUrl}/getRoomBookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDate: targetDate, toDate: targetDate, location: loc })
      });
      if (res.ok) bookings = await res.json();
    } catch (e) {
      console.warn('Check availability failed:', e.message);
    }

    const largeBookings = bookings.filter(b => b.roomId === 'room-large');
    const smallBookings = bookings.filter(b => b.roomId === 'room-small');

    let reply = `📅 **${txt.roomLarge} / ${txt.roomSmall} - ${targetDate} (${locName}):**\n\n`;
    
    reply += `🏢 **${txt.roomLarge}:**\n`;
    if (largeBookings.length === 0) {
      reply += `  • *Available all day*\n`;
    } else {
      largeBookings.forEach(b => {
        reply += `  • **${b.startTime} - ${b.endTime}**: ${b.purpose || txt.defaultPurpose} (${b.bookerName || b.team})\n`;
      });
    }

    reply += `\n🏢 **${txt.roomSmall}:**\n`;
    if (smallBookings.length === 0) {
      reply += `  • *Available all day*\n`;
    } else {
      smallBookings.forEach(b => {
        reply += `  • **${b.startTime} - ${b.endTime}**: ${b.purpose || txt.defaultPurpose} (${b.bookerName || b.team})\n`;
      });
    }

    return { success: true, reply };
  }

  return null;
}
