"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { getSwal } from '@/utils/swal';

const AVAILABLE_FEATURES = [
  {
    key: 'chat',
    name: 'AI Chat',
    icon: 'fa-solid fa-robot',
    color: '#3b82f6',
    path: '/chat',
    desc: 'Trợ lý AI hỏi đáp, phân tích và hỗ trợ công việc thông minh'
  },
  {
    key: 'room-booking',
    name: 'Đặt phòng họp',
    icon: 'fa-solid fa-door-open',
    color: '#10b981',
    path: '/room-booking',
    desc: 'Đăng ký sử dụng phòng họp và theo dõi lịch phòng'
  },
  {
    key: 'topvwiki',
    name: 'TOPVWiki',
    icon: 'fa-solid fa-file-lines',
    color: '#8b5cf6',
    path: '/topvwiki',
    desc: 'Kho tài liệu tri thức, cẩm nang và quy trình nội bộ'
  },
  {
    key: 'daily-reports',
    name: 'Báo cáo ngày',
    icon: 'fa-solid fa-file-invoice',
    color: '#f59e0b',
    path: '/daily-reports',
    desc: 'Nộp báo cáo công việc hằng ngày và duyệt báo cáo nhân viên'
  },
  {
    key: 'approvals',
    name: 'Phê duyệt',
    icon: 'fa-solid fa-file-signature',
    color: '#06b6d4',
    path: '/approvals',
    desc: 'Quy trình xử lý đơn từ, xin nghỉ phép và phê duyệt công tác'
  },
  {
    key: 'activity-logs',
    name: 'Lịch sử làm việc',
    icon: 'fa-solid fa-clock-rotate-left',
    color: '#64748b',
    path: '/activity-logs',
    desc: 'Nhật ký hoạt động và thao tác người dùng trên toàn hệ thống'
  },
  {
    key: 'tasks',
    name: 'Công việc',
    icon: 'fa-solid fa-list-check',
    color: '#6366f1',
    path: '/tasks',
    desc: 'Quản lý nhiệm vụ, tiến độ và phân công công việc'
  },
  {
    key: 'projects',
    name: 'Dự án',
    icon: 'fa-solid fa-folder-open',
    color: '#ec4899',
    path: '/projects',
    desc: 'Quản lý dự án doanh nghiệp, cơ cấu thành viên và tiến độ'
  }
];

export default function FeatureVisibilityPanel() {
  const { hiddenFeatures, updateHiddenFeatures } = useApp();
  const { t } = useLanguage();

  const [selectedHidden, setSelectedHidden] = useState([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync initial state from global AppContext
  useEffect(() => {
    if (Array.isArray(hiddenFeatures)) {
      setSelectedHidden([...hiddenFeatures]);
    }
  }, [hiddenFeatures]);

  const hasUnsavedChanges = useMemo(() => {
    const current = new Set(selectedHidden);
    const original = new Set(hiddenFeatures || []);
    if (current.size !== original.size) return true;
    for (const item of current) {
      if (!original.has(item)) return true;
    }
    return false;
  }, [selectedHidden, hiddenFeatures]);

  const toggleFeature = (featureKey) => {
    setSelectedHidden(prev => {
      if (prev.includes(featureKey)) {
        return prev.filter(k => k !== featureKey);
      } else {
        return [...prev, featureKey];
      }
    });
  };

  const handleShowAll = () => {
    setSelectedHidden([]);
  };

  const handleHideAll = () => {
    setSelectedHidden(AVAILABLE_FEATURES.map(f => f.key));
  };

  const handleSave = async () => {
    const Swal = await getSwal();
    setSaving(true);
    try {
      const res = await updateHiddenFeatures(selectedHidden);
      if (res && res.error) {
        throw new Error(res.error);
      }
      Swal.fire({
        icon: 'success',
        title: t('common.success', 'Thành công'),
        text: 'Đã lưu cấu hình hiển thị thẻ thành công! Các tài khoản nhân viên sẽ được cập nhật giao diện theo thiết lập.',
        confirmButtonColor: 'var(--primary-color)'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: t('common.error', 'Lỗi'),
        text: err.message || 'Không thể lưu cấu hình hiển thị thẻ.',
        confirmButtonColor: 'var(--primary-color)'
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredFeatures = useMemo(() => {
    if (!searchTerm.trim()) return AVAILABLE_FEATURES;
    const q = searchTerm.toLowerCase();
    return AVAILABLE_FEATURES.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.desc.toLowerCase().includes(q) ||
      f.path.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  const hiddenCount = selectedHidden.length;
  const visibleCount = AVAILABLE_FEATURES.length - hiddenCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Card */}
      <div className="card" style={{ padding: '24px', borderRadius: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--primary-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}>
              <i className="fa-solid fa-eye-slash"></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: 'var(--neutral-dark)' }}>
                  {t('featureVisibility.title', 'Cấu hình ẩn / hiển thị thẻ tính năng')}
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(234, 88, 12, 0.12)',
                  color: '#ea580c',
                  border: '1px solid rgba(234, 88, 12, 0.3)'
                }}>
                  <i className="fa-solid fa-lock" style={{ marginRight: '4px' }}></i>
                  Chỉ Quản trị viên
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--neutral-muted)', margin: '6px 0 0 0', maxWidth: '720px', lineHeight: '1.5' }}>
                {t('featureVisibility.desc', 'Tùy chỉnh các thẻ tính năng hiển thị trên Sidebar menu và điều hướng cho nhân viên. Thẻ bị ẩn sẽ không hiển thị với người dùng thông thường; tài khoản Admin vẫn luôn nhìn thấy đầy đủ toàn bộ các thẻ kèm biểu tượng cảnh báo.')}
              </p>
            </div>
          </div>

          {/* Quick Counter badges */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--neutral-bg-hover)',
              border: '1px solid var(--neutral-border)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '750', color: 'var(--success-color)' }}>{visibleCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--neutral-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hiển thị</div>
            </div>
            <div style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--neutral-bg-hover)',
              border: '1px solid var(--neutral-border)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '750', color: hiddenCount > 0 ? 'var(--warning-color)' : 'var(--neutral-muted)' }}>{hiddenCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--neutral-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Đang ẩn</div>
            </div>
          </div>
        </div>

        {/* Toolbar row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--neutral-border)'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '240px', maxWidth: '360px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <i className="fa-solid fa-magnifying-glass" style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--neutral-muted)',
                fontSize: '13px'
              }}></i>
              <input
                type="text"
                placeholder="Tìm thẻ tính năng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 34px',
                  borderRadius: '6px',
                  border: '1px solid var(--neutral-border)',
                  backgroundColor: 'var(--neutral-bg-main)',
                  color: 'var(--neutral-dark)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleShowAll}
              style={{ fontSize: '12px', padding: '6px 12px' }}
              title="Đặt lại: Hiện tất cả các thẻ"
            >
              <i className="fa-solid fa-eye" style={{ marginRight: '6px' }}></i>
              Hiện tất cả
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleHideAll}
              style={{ fontSize: '12px', padding: '6px 12px' }}
              title="Ẩn tất cả các thẻ đối với nhân viên"
            >
              <i className="fa-solid fa-eye-slash" style={{ marginRight: '6px' }}></i>
              Ẩn tất cả
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              style={{
                fontSize: '12px',
                padding: '6px 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                opacity: saving || !hasUnsavedChanges ? 0.65 : 1,
                cursor: saving || !hasUnsavedChanges ? 'not-allowed' : 'pointer'
              }}
            >
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
              {saving ? 'Đang lưu...' : hasUnsavedChanges ? 'Lưu thay đổi *' : 'Đã lưu'}
            </button>
          </div>
        </div>

        {hasUnsavedChanges && (
          <div style={{
            marginTop: '12px',
            padding: '8px 14px',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.35)',
            borderRadius: '6px',
            color: '#b45309',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>Bạn có thay đổi chưa được lưu. Vui lòng bấm <strong>"Lưu thay đổi"</strong> để áp dụng.</span>
          </div>
        )}
      </div>

      {/* Feature Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {filteredFeatures.map(item => {
          const isHidden = selectedHidden.includes(item.key);
          return (
            <div
              key={item.key}
              className="card"
              style={{
                padding: '18px 20px',
                borderRadius: '10px',
                border: isHidden
                  ? '1px dashed var(--warning-color)'
                  : '1px solid var(--neutral-border)',
                backgroundColor: isHidden
                  ? 'rgba(234, 179, 8, 0.03)'
                  : 'var(--neutral-bg-card)',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      backgroundColor: `${item.color}15`,
                      color: item.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      border: `1px solid ${item.color}30`
                    }}>
                      <i className={item.icon}></i>
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '700', color: 'var(--neutral-dark)' }}>
                        {item.name}
                      </h4>
                      <code style={{ fontSize: '11px', color: 'var(--neutral-muted)', fontFamily: 'monospace' }}>
                        {item.path}
                      </code>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: '600',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: isHidden ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    color: isHidden ? 'var(--danger-color, #ef4444)' : 'var(--success-color, #10b981)',
                    border: `1px solid ${isHidden ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                  }}>
                    <i className={isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                    {isHidden ? 'Đang ẩn' : 'Hiển thị'}
                  </span>
                </div>

                <p style={{
                  fontSize: '12.5px',
                  color: 'var(--neutral-muted)',
                  margin: 0,
                  lineHeight: '1.45',
                  minHeight: '36px'
                }}>
                  {item.desc}
                </p>
              </div>

              {/* Action Toggle Area */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid var(--neutral-border)'
              }}>
                <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--neutral-dark)' }}>
                  {isHidden ? 'Ẩn đối với nhân viên' : 'Hiển thị với nhân viên'}
                </span>

                <button
                  type="button"
                  onClick={() => toggleFeature(item.key)}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: isHidden ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    color: isHidden ? 'var(--danger-color, #ef4444)' : 'var(--success-color, #10b981)',
                    fontWeight: '600',
                    fontSize: '12px',
                    transition: 'all 0.15s ease'
                  }}
                  title={isHidden ? 'Bấm để hiển thị lại thẻ' : 'Bấm để ẩn thẻ này với nhân viên'}
                >
                  <i className={`fa-solid ${isHidden ? 'fa-toggle-off' : 'fa-toggle-on'}`} style={{ fontSize: '18px' }}></i>
                  <span>{isHidden ? 'Bật hiển thị' : 'Ẩn thẻ'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
