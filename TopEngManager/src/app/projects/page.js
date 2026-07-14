"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { db } from '@/utils/db';
import { useRouter } from 'next/navigation';
import { ProjectModal, CustomerModal } from '@/components/Modals';
import { getSwal } from '@/utils/swal';

export default function Projects() {
  const { currentUser, projects, tasks, projectMembers, users, reloadAll, hasPermission } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const [startYearFilter, setStartYearFilter] = useState(String(previousYear));
  const [endYearFilter, setEndYearFilter] = useState(String(currentYear));

  const getProjectYear = (p) => {
    if (p.start_date && p.start_date.includes('-')) {
      return p.start_date.split('-')[0];
    }
    return '';
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

  const handleJoinProjectClick = async () => {
    const Swal = await getSwal();
    
    Swal.fire({
      title: 'Tham gia dự án mới',
      html: `
        <div style="text-align: left; padding: 10px 0;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; font-size: 13.5px;">Nhập mã dự án hoặc mã khóa (Key) <span style="color: red;">*</span></label>
          <input type="text" id="join-project-id" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box;" placeholder="Ví dụ: proj-12345, RND, WEB...">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Tìm kiếm',
      cancelButtonText: 'Hủy',
      confirmButtonColor: 'var(--primary-color)',
      focusConfirm: false,
      preConfirm: async () => {
        const projectIdInput = document.getElementById('join-project-id').value;
        if (!projectIdInput || !projectIdInput.trim()) {
          Swal.showValidationMessage('Vui lòng nhập mã dự án.');
          return false;
        }

        try {
          const project = await db.findProjectById(projectIdInput);
          return project;
        } catch (err) {
          Swal.showValidationMessage(err.message || 'Không tìm thấy dự án nào khớp với mã đã nhập.');
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
              title: 'Đang xử lý...',
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
              title: 'Điều khoản dự án',
              html: `
                <div style="text-align: left; padding: 10px; font-size: 14.5px; line-height: 1.6;">
                  <div style="margin-bottom: 8px;"><strong>Tên dự án:</strong> ${project.name}</div>
                  <div style="margin-bottom: 8px;"><strong>Mã khóa (Key):</strong> <span class="badge badge-info">${project.project_key}</span></div>
                  <div style="margin-bottom: 8px;"><strong>Người tạo:</strong> ${project.creator || 'Hệ thống'}</div>
                  <div style="margin-bottom: 8px;"><strong>Trạng thái:</strong> ${project.status}</div>
                  <div style="margin-bottom: 16px;"><strong>Mô tả:</strong> ${project.description}</div>

                  <div style="background-color: rgba(30, 64, 175, 0.05); border-left: 4px solid #1e40af; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
                    <strong style="color: #1e40af;">Điều khoản tham gia dự án:</strong>
                    <p style="margin-top: 6px; font-size: 13px;">Bằng cách tham gia dự án, bạn đồng ý tuân thủ các quy định bảo mật, hoàn thành các nhiệm vụ được giao đúng hạn và chia sẻ thông tin công việc một cách minh bạch với các thành viên khác.</p>
                  </div>
                  
                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 15px; font-size: 13px; border-top: 1px solid var(--neutral-border); padding-top: 12px;">
                    <input type="checkbox" id="agree-terms-checkbox" style="width: 16px; height: 16px; cursor: pointer;" ${initialChecked ? 'checked' : ''} />
                    <label for="agree-terms-checkbox" style="cursor: pointer; font-weight: 500; color: var(--foreground-color);">Tôi đồng ý với điều khoản bảo mật của dự án</label>
                    <span id="view-terms-detail" style="color: #1e40af; text-decoration: underline; cursor: pointer; font-weight: 600; margin-left: 4px;">[Chi tiết]</span>
                  </div>
                </div>
              `,
              showCancelButton: true,
              confirmButtonText: 'Đồng ý',
              cancelButtonText: 'Hủy',
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
                      title: 'Chi tiết điều khoản bảo mật',
                      html: `
                        <div style="text-align: left; padding: 10px; font-size: 13.5px; line-height: 1.6;">
                          <p><strong>1. Bảo mật thông tin:</strong> Thành viên cam kết không tiết lộ, chuyển nhượng hoặc sao chép bất kỳ tài liệu, mã nguồn hay thông tin mật nào của dự án ra bên ngoài.</p>
                          <p style="margin-top: 8px;"><strong>2. Minh bạch công việc:</strong> Các hoạt động phát triển, tài liệu và tiến độ phải được cập nhật thường xuyên trên hệ thống.</p>
                          <p style="margin-top: 8px;"><strong>3. Trách nhiệm cá nhân:</strong> Thành viên chịu hoàn toàn trách nhiệm đối với tài khoản của mình và các công việc được bàn giao.</p>
                          <p style="margin-top: 8px;"><strong>4. Kỷ luật dự án:</strong> Hoàn thành nhiệm vụ đúng hạn và tuân thủ các quy chuẩn kỹ thuật đã thống nhất.</p>
                        </div>
                      `,
                      confirmButtonText: 'Đã hiểu',
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
            title: 'Thông tin dự án',
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

  // Filter projects by permission
  const visibleProjects = projects.filter(p => {
    if (hasPermission('view_all_projects')) return true;
    return projectMembers.some(m => m.project_id === p.id && m.user_id === currentUser.id);
  });

  const filteredByYearProjects = visibleProjects.filter(p => {
    const startInput = startYearFilter.trim();
    const endInput = endYearFilter.trim();
    
    // If both inputs are empty, don't filter (show all)
    if (!startInput && !endInput) return true;
    
    const pYearStr = getProjectYear(p);
    if (!pYearStr) return false; // Hide projects without start dates if any filter is set
    
    const pYear = parseInt(pYearStr);
    const startVal = startInput ? parseInt(startInput) : null;
    const endVal = endInput ? parseInt(endInput) : null;
    
    if (startVal !== null && !isNaN(startVal) && endVal !== null && !isNaN(endVal)) {
      const minYear = Math.min(startVal, endVal);
      const maxYear = Math.max(startVal, endVal);
      return pYear >= minYear && pYear <= maxYear;
    } else if (startVal !== null && !isNaN(startVal)) {
      return pYear >= startVal;
    } else if (endVal !== null && !isNaN(endVal)) {
      return pYear <= endVal;
    }
    
    return true;
  });

  const availableYears = Array.from(new Set(
    projects
      .map(p => getProjectYear(p))
      .filter(yr => yr && yr !== '')
  )).sort((a, b) => b - a);

  return (
    <div className="scrollable-view">
      <div className="view-header">
        <div className="view-title-group">
          <h2>Danh sách Dự án</h2>
          <p>Quản lý quy trình và theo dõi tiến độ của tất cả các dự án trong doanh nghiệp.</p>
        </div>
        <div className="view-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="text"
              list="year-suggestions"
              value={startYearFilter}
              onChange={(e) => setStartYearFilter(e.target.value)}
              placeholder="Từ năm"
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                backgroundColor: '#fff',
                color: '#334155',
                width: '100px',
                textAlign: 'center'
              }}
            />
            <span style={{ color: '#64748b', fontWeight: '600' }}>-</span>
            <input
              type="text"
              list="year-suggestions"
              value={endYearFilter}
              onChange={(e) => setEndYearFilter(e.target.value)}
              placeholder="Đến năm"
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                backgroundColor: '#fff',
                color: '#334155',
                width: '100px',
                textAlign: 'center'
              }}
            />
          </div>
          <datalist id="year-suggestions">
            {availableYears.map(yr => (
              <option key={yr} value={yr}>Năm {yr}</option>
            ))}
          </datalist>
          <button 
            className="btn btn-secondary" 
            onClick={handleJoinProjectClick}
            style={{ 
              backgroundColor: '#fff', 
              color: '#334155', 
              border: '1px solid #cbd5e1',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-right-to-bracket"></i> Tham gia dự án
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setIsCustomerModalOpen(true)}
            style={{ 
              backgroundColor: '#fff', 
              color: '#334155', 
              border: '1px solid #cbd5e1',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-user-tie"></i> Quản lý khách hàng
          </button>
          {showCreateBtn && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}>
              <i className="fa-solid fa-plus"></i> Tạo Dự Án
            </button>
          )}
        </div>
      </div>
      
      <div className="project-list-grid">
        {filteredByYearProjects.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--neutral-muted)', fontSize: '14px' }}>
            Không tìm thấy dự án nào trong năm đã chọn.
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
                <span className={`badge ${badgeClass}`}>{p.status}</span>
              </div>
              <div className="project-card-body">
                <p className="project-desc">{p.description || 'Không có mô tả.'}</p>
                
                <div className="project-progress-container">
                  <div className="progress-bar-wrapper">
                    <span>Tiến độ</span>
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
    </div>
  );
}
