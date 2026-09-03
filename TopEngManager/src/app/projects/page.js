"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { db } from '@/utils/db';
import { useRouter } from 'next/navigation';
import { ProjectModal, CustomerModal, FolderTemplateModal } from '@/components/Modals';
import { getSwal } from '@/utils/swal';

// Sentinel customer-code bucket for projects that aren't linked to any customer,
// used as a tree node/filter key alongside real customer codes like "SEVT"/"SDV".
const UNASSIGNED_CUSTOMER = '__UNASSIGNED__';

export default function Projects() {
  const { currentUser, projects, tasks, projectMembers, users, reloadAll, hasPermission, setHeaderActions } = useApp();
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isFolderTemplateModalOpen, setIsFolderTemplateModalOpen] = useState(false);
  const router = useRouter();

  const currentYear = new Date().getFullYear();

  // Year → customer-code tree navigation (replaces the old "Từ năm/Đến năm" range filter).
  const [customers, setCustomers] = useState([]);
  const [expandedYears, setExpandedYears] = useState(() => new Set([String(currentYear)]));
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedCustomerCode, setSelectedCustomerCode] = useState(null);

  useEffect(() => {
    db.getCustomers().then(setCustomers).catch(() => {});
  }, []);

  const customerNameByCode = customers.reduce((acc, c) => {
    acc[c.customer_id] = c.customer_name;
    return acc;
  }, {});

  const getProjectYear = (p) => {
    if (p.start_date && typeof p.start_date === 'string' && p.start_date.includes('-')) {
      return p.start_date.split('-')[0];
    }
    if (p.created_at) {
      return new Date(p.created_at).getFullYear().toString();
    }
    return '2026';
  };

  const toggleYearExpanded = (year) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  if (!currentUser) return null;

  const isAdmin = currentUser.system_role.includes("Admin");
  const isHR = currentUser.system_role.includes("Nhân sự");

  const isMemberOfProject = (projId) => {
    if (hasPermission('view_all_projects')) return true;
    return projectMembers.some(m => m.project_id === projId && m.user_id === currentUser.id);
  };

  const handleProjectClick = async (pId) => {
    if (!hasPermission('view_all_projects') && !projectMembers.some(m => m.project_id === pId && m.user_id === currentUser.id)) {
      const Swal = await getSwal();
      Swal.fire({ icon: 'error', title: 'Từ chối truy cập', text: "Bạn không có quyền truy cập vì không thuộc dự án này." });
      return;
    }
    router.push(`/projects/${pId}`);
  };

  const handleDeleteProject = async (e, project) => {
    e.stopPropagation();
    const Swal = await getSwal();
    const result = await Swal.fire({
      icon: 'warning',
      title: t('project.deleteProjectConfirmTitle', 'Xóa dự án'),
      html: t('project.deleteProjectConfirmText', 'Bạn có chắc chắn muốn xóa dự án "{name}"? Toàn bộ công việc, issue, tài liệu và kênh chat liên quan sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.').replace('{name}', project.name),
      showCancelButton: true,
      confirmButtonText: t('common.delete', 'Xóa'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--danger-color)'
    });
    if (!result.isConfirmed) return;

    try {
      await db.deleteProject(project.id, currentUser.id);
      Swal.fire({ icon: 'success', title: t('common.success', 'Thành công'), text: t('project.deleteProjectSuccessText', 'Đã xóa dự án thành công.'), timer: 2000, showConfirmButton: false });
      await reloadAll();
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('common.error', 'Lỗi'), text: err.message || t('project.deleteProjectErrorText', 'Không thể xóa dự án.') });
    }
  };

  const handleJoinProjectClick = async () => {
    const Swal = await getSwal();
    
    Swal.fire({
      title: t('project.joinNewProjectTitle', 'Tham gia dự án mới'),
      html: `
        <div style="text-align: left; padding: 10px 0;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; font-size: 13.5px;">${t('project.joinProjectCodeLabel', 'Nhập mã dự án hoặc mã khóa (Key)')} <span style="color: red;">*</span></label>
          <input type="text" id="join-project-id" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box;" placeholder="${t('project.joinProjectCodePlaceholder', 'Ví dụ: proj-12345, RND, WEB...')}">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: t('project.searchBtn', 'Tìm kiếm'),
      cancelButtonText: t('common.cancel', 'Hủy'),
      confirmButtonColor: 'var(--primary-color)',
      focusConfirm: false,
      preConfirm: async () => {
        const projectIdInput = document.getElementById('join-project-id').value;
        if (!projectIdInput || !projectIdInput.trim()) {
          Swal.showValidationMessage(t('project.enterProjectCodeWarning', 'Vui lòng nhập mã dự án.'));
          return false;
        }

        try {
          const project = await db.findProjectById(projectIdInput);
          return project;
        } catch (err) {
          Swal.showValidationMessage(err.message || t('project.projectNotFound', 'Không tìm thấy dự án nào khớp với mã đã nhập.'));
          return false;
        }
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const project = result.value;
        
        const showTermsPopup = true; // Luôn hiển thị điều khoản và checkbox đồng ý

        const performJoin = async () => {
          try {
            Swal.fire({
              title: t('project.joiningProject', 'Đang xử lý...'),
              allowOutsideClick: false,
              didOpen: () => {
                Swal.showLoading();
              }
            });

            await db.addProjectMember(project.id, currentUser.id, 'Member', 'ACTIVE');

            await db.logActivity(
              currentUser.id, 
              "ADD_MEMBER", 
              "Project", 
              project.id, 
              `đã tự tham gia vào dự án '${project.name}' (${project.project_key})`
            );

            await reloadAll();

            Swal.fire({
              icon: 'success',
              title: 'Thành công',
              text: `Bạn đã tham gia dự án "${project.name}" thành công!`,
              confirmButtonColor: 'var(--primary-color)'
            });
          } catch (err) {
            console.error(err);
            Swal.fire({
              icon: 'error',
              title: 'Thất bại',
              text: err.message || 'Không thể tham gia dự án này.',
              confirmButtonColor: 'var(--primary-color)'
            });
          }
        };

        if (showTermsPopup) {
          const showTermsDialog = (initialChecked = false) => {
            Swal.fire({
              title: t('project.projectTermsTitle', 'Điều khoản dự án'),
              html: `
                <div style="text-align: left; padding: 10px; font-size: 14.5px; line-height: 1.6;">
                  <div style="margin-bottom: 8px;"><strong>${t('project.projectNameLabel', 'Tên dự án:')}</strong> ${project.name}</div>
                  <div style="margin-bottom: 8px;"><strong>${t('project.projectKeyLabel', 'Mã khóa (Key):')}</strong> <span class="badge badge-info">${project.project_key}</span></div>
                  <div style="margin-bottom: 8px;"><strong>${t('project.projectCreatorLabel', 'Người tạo:')}</strong> ${project.creator || 'Hệ thống'}</div>
                  <div style="margin-bottom: 8px;"><strong>${t('project.projectStatusLabel', 'Trạng thái:')}</strong> ${project.status}</div>
                  <div style="margin-bottom: 16px;"><strong>${t('project.projectDescLabel', 'Mô tả:')}</strong> ${project.description}</div>

                  <div style="background-color: rgba(30, 64, 175, 0.05); border-left: 4px solid #1e40af; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
                    <strong style="color: #1e40af;">${t('project.joinProjectTermsHeading', 'Điều khoản tham gia dự án:')}</strong>
                    <p style="margin-top: 6px; font-size: 13px;">${t('project.joinProjectTermsText', 'Bằng cách tham gia dự án, bạn đồng ý tuân thủ các quy định bảo mật, hoàn thành các nhiệm vụ được giao đúng hạn và chia sẻ thông tin công việc một cách minh bạch với các thành viên khác.')}</p>
                  </div>
                  
                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 15px; font-size: 13px; border-top: 1px solid var(--neutral-border); padding-top: 12px;">
                    <input type="checkbox" id="agree-terms-checkbox" style="width: 16px; height: 16px; cursor: pointer;" ${initialChecked ? 'checked' : ''} />
                    <label for="agree-terms-checkbox" style="cursor: pointer; font-weight: 500; color: var(--foreground-color);">${t('project.agreePrivacyTermsCheckbox', 'Tôi đồng ý với điều khoản bảo mật của dự án')}</label>
                    <span id="view-terms-detail" style="color: #1e40af; text-decoration: underline; cursor: pointer; font-weight: 600; margin-left: 4px;">${t('project.viewDetailsLink', '[Chi tiết]')}</span>
                  </div>
                </div>
              `,
              showCancelButton: true,
              confirmButtonText: t('common.confirm', 'Đồng ý'),
              cancelButtonText: t('common.cancel', 'Hủy'),
              confirmButtonColor: 'var(--primary-color)',
              didOpen: () => {
                const confirmBtn = Swal.getConfirmButton();
                if (confirmBtn) {
                  confirmBtn.disabled = !initialChecked;
                }

                const checkbox = document.getElementById('agree-terms-checkbox');
                if (checkbox && confirmBtn) {
                  checkbox.onchange = (e) => {
                    confirmBtn.disabled = !e.target.checked;
                  };
                }

                const detailBtn = document.getElementById('view-terms-detail');
                if (detailBtn) {
                  detailBtn.onclick = async () => {
                    const isCurrentlyChecked = checkbox ? checkbox.checked : false;
                    const InnerSwal = await getSwal();
                    InnerSwal.fire({
                      title: t('project.privacyTermsDetailTitle', 'Chi tiết điều khoản bảo mật'),
                      html: `
                        <div style="text-align: left; padding: 10px; font-size: 13.5px; line-height: 1.6;">
                          ${t('project.privacyTermsDetailContent', '1. ...')}
                        </div>
                      `,
                      confirmButtonText: t('project.understoodBtn', 'Đã hiểu'),
                      confirmButtonColor: 'var(--primary-color)'
                    }).then(() => {
                      showTermsDialog(isCurrentlyChecked);
                    });
                  };
                }
              }
            }).then((termsConfirm) => {
              if (termsConfirm.isConfirmed) {
                performJoin();
              }
            });
          };

          showTermsDialog();
        } else {
          Swal.fire({
            title: t('project.projectTermsTitle', 'Điều khoản dự án'),
            html: `
              <div style="text-align: left; padding: 10px; font-size: 14.5px; line-height: 1.6;">
                <div style="margin-bottom: 8px;"><strong>Tên dự án:</strong> ${project.name}</div>
                <div style="margin-bottom: 8px;"><strong>Mã khóa (Key):</strong> <span class="badge badge-info">${project.project_key}</span></div>
                <div style="margin-bottom: 8px;"><strong>Người tạo:</strong> ${project.creator || 'Hệ thống'}</div>
                <div style="margin-bottom: 8px;"><strong>Trạng thái:</strong> ${project.status}</div>
                <div><strong>Mô tả:</strong> ${project.description}</div>
              </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Xác nhận tham gia',
            cancelButtonText: 'Đóng',
            confirmButtonColor: 'var(--primary-color)',
          }).then((joinConfirm) => {
            if (joinConfirm.isConfirmed) {
              performJoin();
            }
          });
        }
      }
    });
  };

  const showCreateBtn = hasPermission('create_project');
  
  if (isHR) {
    return (
      <div className="scrollable-view" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '32px' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '48px', color: 'var(--danger-color)', marginBottom: '16px' }}></i>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Không có quyền truy cập</h2>
          <p className="text-muted" style={{ fontSize: '13px' }}>Bộ phận Nhân sự (HR) không có quyền xem thông tin và bảng điều khiển của dự án.</p>
        </div>
      </div>
    );
  }

  const [isMobileTreeOpen, setIsMobileTreeOpen] = useState(false);

  // Filter projects by permission
  const visibleProjects = projects.filter(p => {
    if (hasPermission('view_all_projects')) return true;
    return projectMembers.some(m => m.project_id === p.id && (m.user_id === currentUser.id || m.userId === currentUser.id));
  });

  // Group visible projects by creation year, then by customer code within each year,
  // to drive the year → customer tree on the left (mirrors the folder-tree UX already
  // used for Documents: pick a year, then a customer, to narrow the project list).
  const projectsByYear = {};
  visibleProjects.forEach(p => {
    const year = getProjectYear(p);
    if (!year) return;
    if (!projectsByYear[year]) projectsByYear[year] = [];
    projectsByYear[year].push(p);
  });
  const availableYears = Object.keys(projectsByYear).sort((a, b) => b - a);

  const getCustomersForYear = (year) => {
    const byCode = {};
    (projectsByYear[year] || []).forEach(p => {
      const code = p.customer_id || UNASSIGNED_CUSTOMER;
      if (!byCode[code]) byCode[code] = [];
      byCode[code].push(p);
    });
    return Object.entries(byCode).sort(([a], [b]) => {
      if (a === UNASSIGNED_CUSTOMER) return 1;
      if (b === UNASSIGNED_CUSTOMER) return -1;
      return a.localeCompare(b);
    });
  };

  // Newest-created project first — db_id is the underlying auto-increment row id,
  // a reliable creation-order proxy since projects have no dedicated created_at field.
  const filteredByYearProjects = visibleProjects
    .filter(p => {
      if (!selectedYear) return true;
      if (getProjectYear(p) !== selectedYear) return false;
      if (!selectedCustomerCode) return true;
      return (p.customer_id || UNASSIGNED_CUSTOMER) === selectedCustomerCode;
    })
    .sort((a, b) => (b.db_id || 0) - (a.db_id || 0));

  useEffect(() => {
    setHeaderActions(
      <div className="projects-header-actions desktop-header-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          className="btn btn-secondary btn-sm" 
          onClick={handleJoinProjectClick}
          style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <i className="fa-solid fa-right-to-bracket"></i> <span>{t('projects.joinProject', 'Tham gia dự án')}</span>
        </button>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => setIsCustomerModalOpen(true)}
          style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <i className="fa-solid fa-user-tie"></i> <span>{t('projects.manageCustomers', 'Khách hàng')}</span>
        </button>
        {isAdmin && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsFolderTemplateModalOpen(true)}
            style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <i className="fa-solid fa-folder-tree"></i> <span>{t('projects.designFolderTemplate', 'Cây thư mục')}</span>
          </button>
        )}
        {showCreateBtn && (
          <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)} style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <i className="fa-solid fa-plus"></i> <span>{t('projects.createProject', 'Tạo Dự Án')}</span>
          </button>
        )}
      </div>
    );
    return () => setHeaderActions(null);
  }, [isAdmin, showCreateBtn, t]);

  return (
    <div className="scrollable-view">
      {/* Mobile-Only Action Buttons Bar (Sits neatly at top of page on mobile, leaves Header clean) */}
      <div className="mobile-projects-action-bar">
        {showCreateBtn && (
          <button 
            type="button"
            className="btn btn-primary mobile-btn-create" 
            onClick={() => setIsModalOpen(true)}
          >
            <i className="fa-solid fa-plus"></i>
            <span>{t('projects.createProject', 'Tạo Dự Án')}</span>
          </button>
        )}
        <div className="mobile-secondary-actions-row">
          <button
            type="button"
            className="btn btn-secondary" 
            onClick={handleJoinProjectClick}
          >
            <i className="fa-solid fa-right-to-bracket"></i>
            <span>{t('projects.joinProject', 'Tham gia')}</span>
          </button>
          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={() => setIsCustomerModalOpen(true)}
          >
            <i className="fa-solid fa-user-tie"></i>
            <span>{t('projects.manageCustomers', 'Khách hàng')}</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsFolderTemplateModalOpen(true)}
            >
              <i className="fa-solid fa-folder-tree"></i>
              <span>{t('projects.designFolderTemplate', 'Cây thư mục')}</span>
            </button>
          )}
        </div>
      </div>

      <button 
        type="button" 
        className="doc-folder-toggle-btn mobile-only-toggle" 
        onClick={() => setIsMobileTreeOpen(prev => !prev)}
      >
        <i className="fa-solid fa-filter"></i>
        <span>{selectedYear ? `${selectedYear} ${selectedCustomerCode ? `• [${selectedCustomerCode}]` : ''}` : t('projects.treeAllProjects', 'Tất cả dự án')}</span>
        <i className={`fa-solid ${isMobileTreeOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginLeft: 'auto' }}></i>
      </button>

      <div className="doc-layout projects-doc-layout" style={{ alignItems: 'start' }}>
        <div className={`doc-folder-tree-panel ${isMobileTreeOpen ? 'show' : ''}`} style={{ maxHeight: 'none' }}>
          <div className="doc-folder-tree-header">
            <span>{t('projects.byYearAndCustomer', 'Theo năm / khách hàng')}</span>
          </div>
          <div className="doc-folder-tree-scroll">
            <div
              className={`doc-folder-node ${!selectedYear ? 'active' : ''}`}
              onClick={() => { setSelectedYear(null); setSelectedCustomerCode(null); setIsMobileTreeOpen(false); }}
            >
              <div className="doc-folder-node-left">
                <span className="doc-folder-node-spacer" />
                <i className="fa-solid fa-layer-group"></i>
                <span>{t('projects.treeAllProjects', 'Tất cả dự án')}</span>
              </div>
            </div>
            {availableYears.length === 0 ? (
              <div className="doc-folder-empty">{t('projects.noYearsYet', 'Chưa có dự án nào')}</div>
            ) : (
              availableYears.map(year => {
                const yearProjects = projectsByYear[year] || [];
                const isExpanded = expandedYears.has(year);
                const isYearSelected = selectedYear === year && !selectedCustomerCode;
                const customerEntries = getCustomersForYear(year);
                return (
                  <div key={year}>
                    <div
                      className={`doc-folder-node ${isYearSelected ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedYear(year);
                        setSelectedCustomerCode(null);
                        setIsMobileTreeOpen(false);
                        if (!isExpanded) toggleYearExpanded(year);
                      }}
                    >
                      <div className="doc-folder-node-left">
                        <i
                          className={`doc-folder-node-chevron ${isExpanded ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'}`}
                          onClick={(e) => { e.stopPropagation(); toggleYearExpanded(year); }}
                        ></i>
                        <i className="fa-solid fa-calendar-days"></i>
                        <span>{year}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--neutral-muted)', flexShrink: 0 }}>{yearProjects.length}</span>
                    </div>
                    {isExpanded && (
                      <div className="doc-folder-children">
                        {customerEntries.map(([code, custProjects]) => {
                          const isSelected = selectedYear === year && selectedCustomerCode === code;
                          const label = code === UNASSIGNED_CUSTOMER
                            ? t('projects.unassignedCustomer', 'Chưa gán khách hàng')
                            : `[${code}]`;
                          return (
                            <div
                              key={code}
                              className={`doc-folder-node ${isSelected ? 'active' : ''}`}
                              onClick={() => { setSelectedYear(year); setSelectedCustomerCode(code); setIsMobileTreeOpen(false); }}
                            >
                              <div className="doc-folder-node-left">
                                <span className="doc-folder-node-spacer" />
                                <i className="fa-solid fa-user-tie"></i>
                                <span title={customerNameByCode[code] || label}>{label}</span>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--neutral-muted)', flexShrink: 0 }}>{custProjects.length}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="doc-main-panel" style={{ gap: 0 }}>
          <div className="project-list-grid" style={{ marginTop: 0 }}>
        {filteredByYearProjects.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--neutral-muted)', fontSize: '14px' }}>
            {t('projects.noProjectsFound', 'Không tìm thấy dự án nào trong năm đã chọn.')}
          </div>
        ) : (
          filteredByYearProjects.map(p => {
            const isMember = isMemberOfProject(p.id);
          const pTasks = tasks.filter(t => t.project_id === p.id);
          const done = pTasks.filter(t => t.status === "Done").length;
          const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
          const pMembers = projectMembers.filter(m => m.project_id === p.id);
          
          let badgeClass = "badge-info";
          if (p.status === "Thực thi" || p.status === "Giám sát") badgeClass = "badge-warning";
          if (p.status === "Kết thúc") badgeClass = "badge-success";

          return (
            <div 
              className="project-card" 
              style={{ opacity: isMember ? 1 : 0.6, cursor: isMember ? 'pointer' : 'not-allowed' }} 
              key={p.id} 
              onClick={() => handleProjectClick(p.id)}
            >
              <div className="project-card-header">
                <div className="project-title">{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge ${badgeClass}`}>{(p.status === 'Thực thi' || p.status === 'Ongoing') ? 'ONGOING' : (p.status === 'Giám sát' || p.status === 'Monitoring') ? 'MONITORING' : (p.status === 'Kết thúc' || p.status === 'Finished') ? 'FINISHED' : (p.status ? p.status.toUpperCase() : 'ONGOING')}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      title={t('project.deleteProjectTooltip', 'Xóa dự án')}
                      onClick={(e) => handleDeleteProject(e, p)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  )}
                </div>
              </div>
              <div className="project-card-body">
                <p className="project-desc">{p.description || 'Không có mô tả.'}</p>
                
                <div className="project-progress-container">
                  <div className="progress-bar-wrapper">
                    <span>{t('project.progress', 'Tiến độ')}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="progress-bar-outer">
                    <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
                
                <div className="project-card-footer">
                  <div className="project-dates">
                    <span><i className="fa-regular fa-calendar"></i> {p.start_date}</span>
                  </div>
                  <div className="project-members-avatars">
                    {pMembers.slice(0, 4).map(m => {
                      const u = users.find(usr => usr.id === m.user_id);
                      return u ? (
                        <div className="member-avatar-stacked" style={{ backgroundColor: u.color }} key={m.id} title={`${u.name} (${m.project_role})`}>
                          {u.name.split(" ").pop().charAt(0)}
                        </div>
                      ) : null;
                    })}
                    {pMembers.length > 4 && <div className="member-avatar-stacked" style={{ backgroundColor: 'var(--neutral-muted)' }}>+{pMembers.length - 4}</div>}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
          </div>
        </div>
      </div>

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={null}
        currentUser={currentUser}
        onSaved={reloadAll}
      />

      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        currentUser={currentUser}
        onSaved={reloadAll}
      />

      <FolderTemplateModal
        isOpen={isFolderTemplateModalOpen}
        onClose={() => setIsFolderTemplateModalOpen(false)}
      />
    </div>
  );
}
