"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useApp } from '@/context/AppContext';
import { db } from '@/utils/db';
import { StreamChatAdapter } from '@/utils/streamChatClient';
import { getSwal } from '@/utils/swal';

const Swal = {
  fire: async (...args) => {
    const instance = await getSwal();
    return instance.fire(...args);
  },
  mixin: async (...args) => {
    const instance = await getSwal();
    return instance.mixin(...args);
  },
  close: async (...args) => {
    const instance = await getSwal();
    return instance.close(...args);
  }
};

function Chat() {
  const { currentUser, projects, projectMembers, users, chatRooms, chatRoomMembers, reloadAll, hasPermission } = useApp();

  const isAdmin = currentUser?.system_role?.includes("Admin") || false;
  const isMemberOfProject = (projId) => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    return projectMembers.some(m => m.project_id === projId && m.user_id === currentUser.id);
  };

  const myProjects = currentUser ? projects.filter(p => isMemberOfProject(p.id)) : [];
  const myDirectRoomIds = currentUser ? chatRoomMembers.filter(m => m.user_id === currentUser.id).map(m => m.room_id) : [];
  
  const allowedRooms = currentUser ? chatRooms.filter(r => {
    if (r.type === "global") return true;
    if (r.type === "project") return myProjects.some(p => p.id === r.project_id);
    if (r.type === "direct") return myDirectRoomIds.includes(r.id);
    return false;
  }) : [];

  const [activeChatRoomId, setActiveChatRoomId] = useState(null);

  // Set default active room once rooms are loaded
  useEffect(() => {
    if (allowedRooms.length > 0 && !activeChatRoomId) {
      const globalRoom = allowedRooms.find(r => r.type === 'global');
      if (globalRoom) {
        setActiveChatRoomId(globalRoom.id);
      } else {
        setActiveChatRoomId(allowedRooms[0].id);
      }
    }
  }, [allowedRooms, activeChatRoomId]);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [typingUser, setTypingUser] = useState(null);

  // Mentions
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionList, setMentionList] = useState([]);
  const chatInputRef = useRef(null);

  const loadChatMessages = async () => {
    if (!activeChatRoomId) return;
    try {
      let msgs = await db.getMessages(activeChatRoomId);
      if (chatSearchQuery) {
        msgs = msgs.filter(m => m.content.toLowerCase().includes(chatSearchQuery.toLowerCase()));
      }
      setChatMessages(msgs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (StreamChatAdapter.isEnabled() && currentUser) {
      StreamChatAdapter.init(currentUser.id, currentUser.name);
    }
    return () => {
      if (StreamChatAdapter.isEnabled()) {
        StreamChatAdapter.disconnect();
      }
    };
  }, [currentUser]);

  useEffect(() => {
    let activeChannel = null;
    const initStreamChannel = async () => {
      if (StreamChatAdapter.isEnabled() && activeChatRoomId && allowedRooms.length > 0) {
        const roomObj = allowedRooms.find(r => r.id === activeChatRoomId);
        if (roomObj) {
          const channel = await StreamChatAdapter.joinChannel(activeChatRoomId, roomObj.name);
          if (channel) {
            activeChannel = channel;
            
            // Format state messages
            const stateMessages = channel.state.messages || [];
            const formatted = stateMessages.map(msg => ({
              id: msg.id,
              room_id: activeChatRoomId,
              sender_id: msg.user.id,
              content: msg.text,
              created_at: msg.created_at,
              attachments: msg.attachments || []
            }));
            setChatMessages(formatted);

            // Listen to message.new event
            channel.on('message.new', event => {
              setChatMessages(prev => {
                if (prev.some(m => m.id === event.message.id)) return prev;
                return [...prev, {
                  id: event.message.id,
                  room_id: activeChatRoomId,
                  sender_id: event.message.user.id,
                  content: event.message.text,
                  created_at: event.message.created_at,
                  attachments: event.message.attachments || []
                }];
              });
            });
          }
        }
      } else {
        loadChatMessages();
      }
    };

    initStreamChannel();

    return () => {
      if (activeChannel) {
        activeChannel.off('message.new');
      }
    };
  }, [activeChatRoomId, chatSearchQuery, allowedRooms.length]);

  if (!currentUser) return null;

  const activeRoomObj = allowedRooms.find(r => r.id === activeChatRoomId);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Ask before sending message based on dynamic permission
    const shouldConfirm = hasPermission('chat_confirm_send');
    if (shouldConfirm) {
      const confirmResult = await Swal.fire({
        title: 'Xác nhận gửi',
        text: "Bạn có chắc chắn muốn gửi tin nhắn này?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Gửi',
        cancelButtonText: 'Hủy'
      });
      if (!confirmResult.isConfirmed) {
        return;
      }
    }

    // Check @all tag permission
    if (chatInput.includes("@all")) {
      const roomType = activeRoomObj?.type || 'global';
      if (roomType === 'global') {
        const canTagAll = hasPermission('chat_tag_all_global');
        if (!canTagAll) {
          Swal.fire({ icon: 'error', title: 'Quyền hạn', text: "Bạn không có quyền tag @all trong phòng chat chung doanh nghiệp." });
          return;
        }
      } else if (roomType === 'project') {
        const canTagAll = hasPermission('chat_tag_all_project');
        if (!canTagAll) {
          Swal.fire({ icon: 'error', title: 'Quyền hạn', text: "Bạn không có quyền tag @all trong phòng chat dự án." });
          return;
        }
      }
    }

    if (StreamChatAdapter.isEnabled()) {
      await StreamChatAdapter.sendMessage(chatInput.trim());
    } else {
      await db.sendMessage({
        room_id: activeChatRoomId,
        sender_id: currentUser.id,
        content: chatInput.trim()
      });

      users.forEach(async (u) => {
        if (chatInput.includes(`@${u.name}`)) {
          await db.createNotification(u.id, "Được nhắc tên trong Chat", `${currentUser.name} đã nhắc tên bạn trong kênh trò chuyện.`, `#chat`);
        }
      });

      await loadChatMessages();

      // Simulated reply for local testing in database fallback mode
      const activeRoom = chatRooms.find(r => r.id === activeChatRoomId);
      if (activeRoom && (activeRoom.type === "global" || activeRoom.type === "project")) {
        const roomMembersFiltered = chatRoomMembers.filter(m => m.room_id === activeChatRoomId);
        const otherMembers = roomMembersFiltered.filter(m => m.user_id !== currentUser.id);

        if (otherMembers.length > 0 && Math.random() > 0.4) {
          const randomMember = otherMembers[Math.floor(Math.random() * otherMembers.length)];
          const responder = users.find(u => u.id === randomMember.user_id);
          
          if (responder) {
            setTypingUser(responder.name);
            setTimeout(async () => {
              setTypingUser(null);
              const replies = [
                "Tôi đồng ý với quan điểm này.",
                "Vấn đề này cần được nghiên cứu kỹ thêm.",
                "Để tôi cập nhật tiến độ công việc này ngay nhé.",
                "Cảm ơn bạn đã thông báo!",
                "Okay, ghi nhận thông tin."
              ];
              const replyText = replies[Math.floor(Math.random() * replies.length)];
              await db.sendMessage({
                room_id: activeChatRoomId,
                sender_id: responder.id,
                content: `@${currentUser.name} ${replyText}`
              });
              await loadChatMessages();
            }, 2000);
          }
        }
      }
    }

    setChatInput('');
    setMentionQuery(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleChatInputChange = (e) => {
    const val = e.target.value;
    setChatInput(val);

    const cursor = e.target.selectionStart;
    const beforeText = val.slice(0, cursor);
    const lastAt = beforeText.lastIndexOf('@');

    if (lastAt !== -1 && !beforeText.slice(lastAt).includes(' ')) {
      const query = beforeText.slice(lastAt + 1).toLowerCase();
      setMentionQuery(query);
      const otherUsers = users.filter(u => u.id !== currentUser.id);
      setMentionList(otherUsers.filter(u => u.name.toLowerCase().includes(query)));
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = (user) => {
    const val = chatInput;
    const cursor = chatInputRef.current?.selectionStart || 0;
    const beforeText = val.slice(0, cursor);
    const lastAt = beforeText.lastIndexOf('@');
    
    if (lastAt !== -1) {
      const replaced = val.slice(0, lastAt) + `@${user.name} ` + val.slice(cursor);
      setChatInput(replaced);
      setMentionQuery(null);
      chatInputRef.current?.focus();
    }
  };

  const handleChatFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await db.sendMessage({
      room_id: activeChatRoomId,
      sender_id: currentUser.id,
      content: `Đã gửi tệp đính kèm: ${file.name}`,
      attachments: [{ file_url: file.name, file_type: file.type }]
    });
    await loadChatMessages();
  };

  const handleEmojiClick = async (msgId, emoji) => {
    await db.addMessageReaction(msgId, emoji, currentUser.id);
    await loadChatMessages();
  };

  const handleAddDirectRoom = async () => {
    const others = users.filter(u => u.id !== currentUser.id);
    const inputOptions = {};
    others.forEach(o => {
      inputOptions[o.id] = o.name;
    });

    const { value: targetId } = await Swal.fire({
      title: 'Nhắn tin trực tiếp',
      input: 'select',
      inputOptions: inputOptions,
      inputPlaceholder: 'Chọn người dùng muốn trò chuyện',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy'
    });
    if (!targetId) return;

    const targetUser = others.find(o => o.id === targetId);
    if (!targetUser) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Người dùng không hợp lệ!" });
      return;
    }

    const createdRoomId = await db.createDirectChatRoom(currentUser.id, targetId, `Trò chuyện với ${targetUser.name}`);
    setActiveChatRoomId(createdRoomId);
    await reloadAll();
  };

  const handleDownloadDoc = (att) => {
    Swal.fire({ icon: 'info', title: 'Đang tải file', text: `Đang tải file: ${att.file_url}` });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="chat-layout" style={{ height: '100%' }}>
        <div className="chat-rooms-sidebar">
        <div className="chat-rooms-search">
          <input type="text" placeholder="Tìm kiếm phòng chat..." />
        </div>
        <div className="chat-rooms-section">
          <div>
            <div className="chat-section-header"><span>Kênh Thảo Luận</span></div>
            <div className="chat-room-list">
              {allowedRooms
                .filter(r => r.type === "global" || r.type === "project")
                .map(r => (
                  <div className={`chat-room-item ${r.id === activeChatRoomId ? 'active' : ''}`} onClick={() => setActiveChatRoomId(r.id)} key={r.id}>
                    <span>{r.name}</span>
                  </div>
                ))}
            </div>
          </div>
          <div>
            <div className="chat-section-header">
              <span>Trực Tiếp</span>
              <button className="btn-add-room" onClick={handleAddDirectRoom}><i className="fa-solid fa-plus"></i></button>
            </div>
            <div className="chat-room-list">
              {allowedRooms
                .filter(r => r.type === "direct")
                .map(r => (
                  <div className={`chat-room-item ${r.id === activeChatRoomId ? 'active' : ''}`} onClick={() => setActiveChatRoomId(r.id)} key={r.id}>
                    <span>{r.name}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="chat-main-area">
        <div className="chat-area-header">
          <div className="chat-header-info">
            <h3>{activeRoomObj ? activeRoomObj.name : 'Vui lòng chọn phòng chat'}</h3>
            <p className="text-muted">
              {activeRoomObj?.type === "global" && "Kênh thảo luận công ty chung."}
              {activeRoomObj?.type === "project" && "Kênh dự án nội bộ."}
              {activeRoomObj?.type === "direct" && "Phòng chat riêng tư 1-1."}
            </p>
          </div>
          <div className="chat-header-actions">
            <div className="chat-search-box">
              <input type="text" value={chatSearchQuery} onChange={(e) => setChatSearchQuery(e.target.value)} placeholder="Tìm tin nhắn..." />
            </div>
          </div>
        </div>

        <div className="chat-messages-container">
          {chatMessages.map(m => {
            const sender = users.find(usr => usr.id === m.sender_id) || { name: 'Ẩn danh', color: 'var(--neutral-muted)' };
            const isSelf = m.sender_id === currentUser.id;
            const date = new Date(m.created_at);
            const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
            
            let attachmentsList = m.attachments || [];

            return (
              <div className={`chat-message-group ${isSelf ? 'self' : ''}`} key={m.id}>
                <div className="chat-msg-avatar" style={{ backgroundColor: sender.color }}>
                  {sender.name.split(" ").pop().charAt(0)}
                </div>
                <div className="chat-msg-content-wrapper">
                  <div className="chat-msg-meta">
                    <span className="chat-msg-sender">{sender.name}</span>
                    <span className="chat-msg-time">{timeStr}</span>
                  </div>
                  <div className="chat-msg-bubble">
                    {m.content}
                    {attachmentsList.map((att, index) => (
                      <div className="chat-msg-attachment" key={index} onClick={() => handleDownloadDoc(att)} style={{ cursor: 'pointer' }}>
                        <i className="fa-solid fa-file"></i> <span>{att.file_url}</span>
                      </div>
                    ))}
                  </div>
                  <div className="chat-msg-reactions">
                    <span className="reaction-badge" onClick={() => handleEmojiClick(m.id, '👍')}>👍</span>
                    <span className="reaction-badge" onClick={() => handleEmojiClick(m.id, '🎉')}>🎉</span>
                  </div>
                </div>
              </div>
            );
          })}
          {typingUser && (
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <span style={{ fontSize: '10px', color: 'var(--neutral-muted)', marginLeft: '6px' }}>{typingUser} đang gõ...</span>
            </div>
          )}
        </div>

        <form className="chat-input-area" onSubmit={handleSendMessage}>
          <div className="chat-input-wrapper">
            <textarea 
              ref={chatInputRef}
              value={chatInput} 
              onChange={handleChatInputChange} 
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn... Gõ @ nhắc tên" 
              rows="1"
            />
            {mentionQuery !== null && (
              <div className="mentions-popup" style={{ display: 'block' }}>
                {mentionList.map(u => (
                  <div className="mention-user-option" onClick={() => selectMention(u)} key={u.id}>
                    <div className="men-avatar" style={{ backgroundColor: u.color }}>{u.name.split(" ").pop().charAt(0)}</div>
                    <span>{u.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="chat-input-actions">
            <label className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', marginBottom: 0 }}>
              <i className="fa-solid fa-paperclip"></i>
              <input type="file" onChange={handleChatFileUpload} style={{ display: 'none' }} />
            </label>
            <button type="submit" className="btn btn-primary btn-sm"><i className="fa-solid fa-paper-plane"></i></button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(Chat), { ssr: false });
