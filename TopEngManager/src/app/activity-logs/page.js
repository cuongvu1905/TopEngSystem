"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';

function translateLogDescription(desc, currentLang) {
  if (!desc) return '';
  if (currentLang === 'vi') return desc;

  let text = desc;

  const patterns = [
    {
      regex: /đã cấp tài khoản mới cho nhân viên '(.*?)' \((.*?)\)/g,
      en: "issued new account for employee '$1' ($2)",
      ko: "직원 '$1' ($2)에게 새 계정을 발급했습니다",
      zh: "为员工 '$1' ($2) 发放了新账号",
      ja: "従業員 '$1' ($2) に新しいアカウントを発行しました"
    },
    {
      regex: /đã gửi báo cáo mới cho dự án/g,
      en: 'submitted a new project report',
      ko: '새 프로젝트 보고서를 제출했습니다',
      zh: '提交了新的项目汇报',
      ja: '新しいプロジェクトレポートを提出しました'
    },
    {
      regex: /đã gửi báo cáo ngày mới/g,
      en: 'submitted a new daily report',
      ko: '새 일일 보고서를 제출했습니다',
      zh: '提交了新的每日汇报',
      ja: '新しい日次レポートを提出しました'
    },
    {
      regex: /Người dùng '(.*?)' \((.*?)\) đăng nhập thành công\./g,
      en: "User '$1' ($2) logged in successfully.",
      ko: "사용자 '$1' ($2) 님이 성공적으로 로그인했습니다.",
      zh: "用户 '$1' ($2) 登录成功。",
      ja: "ユーザー '$1' ($2) が正常にログインしました。"
    },
    {
      regex: /Người dùng '(.*?)' \((.*?)\) đăng nhập thất bại\./g,
      en: "User '$1' ($2) login failed.",
      ko: "사용자 '$1' ($2) 님의 로그인에 실패했습니다.",
      zh: "用户 '$1' ($2) 登录失败。",
      ja: "ユーザー '$1' ($2) のログインに失敗しました。"
    },
    {
      regex: /Đăng nhập thất bại: sai mật khẩu cho tài khoản (.*?)\./g,
      en: "Login failed: incorrect password for account $1.",
      ko: "로그인 실패: $1 계정의 비밀번호가 올바르지 않습니다.",
      zh: "登录失败: 账号 $1 密码错误。",
      ja: "ログイン失敗: アカウント $1 のパスワードが違います。"
    },
    {
      regex: /Đăng nhập thất bại: (.*?)\./g,
      en: "Login failed: $1.",
      ko: "로그인 실패: $1.",
      zh: "登录失败: $1。",
      ja: "ログイン失敗: $1。"
    },
    {
      regex: /đã tạo dự án mới '(.*?)'/g,
      en: "created new project '$1'",
      ko: "새 프로젝트 '$1'을(를) 생성했습니다",
      zh: "创建了新项目 '$1'",
      ja: "新しいプロジェクト '$1' を作成しました"
    },
    {
      regex: /đã cập nhật thông tin dự án '(.*?)'/g,
      en: "updated project details '$1'",
      ko: "프로젝트 '$1' 정보를 업데이트했습니다",
      zh: "更新了项目 '$1' 的信息",
      ja: "プロジェクト '$1' の情報を更新しました"
    },
    {
      regex: /đã tự tham gia vào dự án '(.*?)' ((.*?))/g,
      en: "joined project '$1' ($2)",
      ko: "프로젝트 '$1' ($2)에 참여했습니다",
      zh: "加入了项目 '$1' ($2)",
      ja: "プロジェクト '$1' ($2) に参加しました"
    },
    {
      regex: /đã tự tham gia vào dự án '(.*?)'/g,
      en: "joined project '$1'",
      ko: "프로젝트 '$1'에 참여했습니다",
      zh: "Joined project '$1'",
      ja: "프로젝트 '$1' に参加しました"
    },
    {
      regex: /đã đồng ý điều khoản và tham gia dự án '(.*?)'/g,
      en: "accepted terms and joined project '$1'",
      ko: "약관에 동의하고 프로젝트 '$1'에 참여했습니다",
      zh: "同意条款并加入了项目 '$1'",
      ja: "利用規約に同意し、プロジェクト '$1' に参加しました"
    },
    {
      regex: /đã từ chối tham gia dự án '(.*?)'/g,
      en: "declined to join project '$1'",
      ko: "프로젝트 '$1' 참여를 거절했습니다",
      zh: "拒绝了加入项目 '$1'",
      ja: "プロジェクト '$1' への参加を辞退しました"
    },
    {
      regex: /đã giao công việc mới '(.*?)'/g,
      en: "assigned new task '$1'",
      ko: "새 업무 '$1'을(를) 할당했습니다",
      zh: "指派了新任务 '$1'",
      ja: "新しいタスク '$1' を割り当てました"
    },
    {
      regex: /đã cập nhật công việc '(.*?)'/g,
      en: "updated task '$1'",
      ko: "업무 '$1'을(를) 업데이트했습니다",
      zh: "更新了任务 '$1'",
      ja: "タスク '$1' を更新しました"
    },
    {
      regex: /đã chuyển trạng thái công việc '(.*?)' từ '(.*?)' sang '(.*?)'/g,
      en: "changed status of task '$1' from '$2' to '$3'",
      ko: "업무 '$1'의 상태를 '$2'에서 '$3'(으)로 변경했습니다",
      zh: "将任务 '$1' 的状态从 '$2' 更改为 '$3'",
      ja: "タスク '$1' のステータスを '$2' から '$3' に変更しました"
    },
    {
      regex: /đã bình luận trong công việc '(.*?)'/g,
      en: "commented on task '$1'",
      ko: "업무 '$1'에 댓글을 남겼습니다",
      zh: "在任务 '$1' 中发表了评论",
      ja: "タスク '$1' にコメントしました"
    },
    {
      regex: /đã đính kèm tệp tin '(.*?)' vào công việc '(.*?)'/g,
      en: "attached file '$1' to task '$2'",
      ko: "업무 '$2'에 파일 '$1'을(를) 첨부했습니다",
      zh: "为任务 '$2' 附加了文件 '$1'",
      ja: "タスク '$2' にファイル '$1' を添付しました"
    },
    {
      regex: /đã tải lên tài liệu mới '(.*?)'/g,
      en: "uploaded new document '$1'",
      ko: "새 문서 '$1'을(를) 업로드했습니다",
      zh: "上传了新文档 '$1'",
      ja: "新しいドキュメント '$1' をアップロードしました"
    },
    {
      regex: /đã tải lên phiên bản (.*?) cho tài liệu '(.*?)'/g,
      en: "uploaded version $1 for document '$2'",
      ko: "문서 '$2'의 $1 버전을 업로드했습니다",
      zh: "上传了文档 '$2' 的 $1 版本",
      ja: "ドキュメント '$2' のバージョン $1 をアップロードしました"
    },
    {
      regex: /đã tạo danh mục tài liệu '(.*?)'/g,
      en: "created document category '$1'",
      ko: "문서 카테고리 '$1'을(를) 생성했습니다",
      zh: "创建了文档分类 '$1'",
      ja: "ドキュメントカテゴリ '$1' を作成しました"
    },
    {
      regex: /đã gửi lời mời tham gia dự án cho thành viên '(.*?)' với vai trò (.*?)/g,
      en: "sent project invitation to member '$1' with role $2",
      ko: "멤버 '$1'에게 역할 $2(으)로 프로젝트 초대장을 전송했습니다",
      zh: "向成员 '$1' 发送了角色为 $2 的项目邀请",
      ja: "メンバー '$1' に役職 $2 でプロジェクト招待を送信しました"
    },
    {
      regex: /đã thêm thành viên '(.*?)' với vai trò (.*?)/g,
      en: "added member '$1' with role $2",
      ko: "역할 $2(으)로 멤버 '$1'을(를) 추가했습니다",
      zh: "添加了角色为 $2 的成员 '$1'",
      ja: "役職 $2 でメンバー '$1' を追加しました"
    },
    {
      regex: /đã thêm thành viên '(.*?)' vào dự án/g,
      en: "added member '$1' to project",
      ko: "프로젝트에 멤버 '$1'을(를) 추가했습니다",
      zh: "为项目添加了成员 '$1'",
      ja: "プロジェクトにメンバー '$1' を追加しました"
    },
    {
      regex: /đã xóa thành viên '(.*?)' khỏi dự án/g,
      en: "removed member '$1' from project",
      ko: "프로젝트에서 멤버 '$1'을(를) 제거했습니다",
      zh: "从项目中解雇/删除了成员 '$1'",
      ja: "プロジェクトからメンバー '$1' を削除しました"
    },
    {
      regex: /đã báo cáo issue mới '(.*?)'/g,
      en: "reported new issue '$1'",
      ko: "새 이슈 '$1'을(를) 보고했습니다",
      zh: "汇报了新问题 '$1'",
      ja: "新しい課題 '$1' を報告しました"
    },
    {
      regex: /Đã chuyển đổi quyền đăng nhập sang tài khoản '(.*?)'/g,
      en: "Switched login session to account '$1'",
      ko: "계정 '$1'(으)로 로그인 세션을 전환했습니다",
      zh: "已切换登录会话至账号 '$1'",
      ja: "アカウント '$1' へログインセッション를 切り替えました"
    },
    {
      regex: /đã thêm nhân viên mới '(.*?)'/g,
      en: "added new employee '$1'",
      ko: "새 직원 '$1'을(를) 추가했습니다",
      zh: "添加了新员工 '$1'",
      ja: "新しい従業員 '$1' を追加しました"
    },
    {
      regex: /đã cập nhật thông tin nhân viên '(.*?)'/g,
      en: "updated employee information '$1'",
      ko: "직원 '$1' 정보를 업데이트했습니다",
      zh: "更新了员工 '$1' 的信息",
      ja: "従業員 '$1' の情報を更新しました"
    },
    {
      regex: /đã xóa nhân viên '(.*?)'/g,
      en: "deleted employee '$1'",
      ko: "직원 '$1'을(를) 삭제했습니다",
      zh: "删除了员工 '$1'",
      ja: "従業員 '$1' を削除しました"
    },
    {
      regex: /đã tạo phòng ban '(.*?)' \((.*?)\)/g,
      en: "created department '$1' ($2)",
      ko: "부서 '$1' ($2)을(를) 생성했습니다",
      zh: "创建了部门 '$1' ($2)",
      ja: "部署 '$1' ($2) を作成しました"
    },
    {
      regex: /đã tạo phòng ban '(.*?)'/g,
      en: "created department '$1'",
      ko: "부서 '$1'을(를) 생성했습니다",
      zh: "创建了部门 '$1'",
      ja: "部署 '$1' を作成しました"
    },
    {
      regex: /đã thêm phòng ban mới '(.*?)'/g,
      en: "added new department '$1'",
      ko: "새 부서 '$1'을(를) 추가했습니다",
      zh: "添加了新部门 '$1'",
      ja: "新しい部署 '$1' を追加しました"
    },
    {
      regex: /đã cập nhật phòng ban '(.*?)'/g,
      en: "updated department '$1'",
      ko: "부서 '$1'을(를) 업데이트했습니다",
      zh: "更新了部门 '$1'",
      ja: "部署 '$1' を更新しました"
    },
    {
      regex: /đã xóa phòng ban '(.*?)'/g,
      en: "deleted department '$1'",
      ko: "부서 '$1'을(를) 삭제했습니다",
      zh: "删除了部门 '$1'",
      ja: "部署 '$1' を削除しました"
    },
    {
      regex: /đã thêm chức danh mới '(.*?)'/g,
      en: "added new job position '$1'",
      ko: "새 직책 '$1'을(를) 추가했습니다",
      zh: "添加了新职位 '$1'",
      ja: "新しい役職 '$1' を追加しました"
    },
    {
      regex: /đã cập nhật chức danh '(.*?)'/g,
      en: "updated job position '$1'",
      ko: "직책 '$1'을(를) 업데이트했습니다",
      zh: "更新了职位 '$1'",
      ja: "役職 '$1' を更新しました"
    },
    {
      regex: /đã xóa chức danh '(.*?)'/g,
      en: "deleted job position '$1'",
      ko: "직책 '$1'을(를) 삭제했습니다",
      zh: "删除了职位 '$1'",
      ja: "役職 '$1' を削除しました"
    },
    {
      regex: /đã thêm khách hàng '(.*?)' ((.*?))/g,
      en: "added customer '$1' ($2)",
      ko: "고객 '$1' ($2)을(를) 추가했습니다",
      zh: "添加了客户 '$1' ($2)",
      ja: "顧客 '$1' ($2) を追加しました"
    },
    {
      regex: /đã cập nhật khách hàng '(.*?)' ((.*?))/g,
      en: "updated customer '$1' ($2)",
      ko: "고객 '$1' ($2) 정보를 업데이트했습니다",
      zh: "更新了客户 '$1' ($2) 的信息",
      ja: "顧客 '$1' ($2) の情報を更新しました"
    },
    {
      regex: /đã đổi mật khẩu cá nhân/g,
      en: "changed personal password",
      ko: "개인 비밀번호를 변경했습니다",
      zh: "修改了个人密码",
      ja: "個人パスワードを変更しました"
    },
    {
      regex: /Cảnh báo đăng nhập từ thiết bị lạ \/ IP mới/g,
      en: "Security Alert: Login from unrecognized device / new IP",
      ko: "보안 경고: 알 수 없는 기기 / 새 IP에서 로그인",
      zh: "安全警告: 未知设备 / 新 IP 登录",
      ja: "セキュリティ警告: 未認識のデバイス / 新しい IP からのログイン"
    },
    {
      regex: /Tài khoản bị khóa tạm thời do nhập sai mật khẩu quá 5 lần/g,
      en: "Account temporarily locked due to 5 consecutive failed login attempts",
      ko: "비밀번호 5회 오류로 인해 계정이 임시 잠금 처리되었습니다",
      zh: "因连续 5 次输入错误密码，账号已被临时锁定",
      ja: "パスワードを5回連続で間違えたため、アカウントが一時的にロックされました"
    }
  ];

  for (const p of patterns) {
    if (p.regex.test(text)) {
      p.regex.lastIndex = 0;
      const replacement = p[currentLang] || p.en;
      text = text.replace(p.regex, replacement);
    }
  }

  return text;
}

export default function ActivityLogs() {
  const { currentUser, activityLogs, users, projects, tasks, documents, projectMembers } = useApp();
  const { t, currentLang } = useLanguage();
  
  const [logUserFilter, setLogUserFilter] = useState('all');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [logProjectFilter, setLogProjectFilter] = useState('all');

  if (!currentUser) return null;

  const isAdmin = currentUser.system_role.includes("Admin");
  
  if (!isAdmin) {
    return (
      <div className="scrollable-view" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '32px' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '48px', color: 'var(--danger-color)', marginBottom: '16px' }}></i>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>{t('common.noAccess', 'Không có quyền truy cập')}</h2>
          <p className="text-muted" style={{ fontSize: '13px' }}>{t('logs.noAccessDesc', 'Chỉ Quản trị viên (Admin) mới có quyền truy cập xem Nhật ký hệ thống.')}</p>
        </div>
      </div>
    );
  }

  const isMemberOfProject = (projId) => {
    return projectMembers.some(m => m.project_id === projId && m.user_id === currentUser.id);
  };

  // Projects list the current user participates in
  const myProjects = projects.filter(p => isMemberOfProject(p.id));
  const myProjectIds = myProjects.map(p => p.id);

  // Resolve project ID and project name for each log
  const resolvedLogs = activityLogs.map(l => {
    let projId = null;
    if (l.entity_type === 'Project') {
      projId = l.entity_id;
    } else if (l.metadata?.project_id) {
      projId = l.metadata.project_id;
    } else if (l.entity_type === 'Task') {
      const tItem = tasks.find(item => item.id === l.entity_id);
      if (tItem) projId = tItem.project_id;
    } else if (l.entity_type === 'Document') {
      const d = documents.find(item => item.id === l.entity_id);
      if (d) projId = d.project_id;
    }
    
    const proj = projects.find(p => p.id === projId);
    return {
      ...l,
      project_id: projId,
      project_name: proj ? proj.name : t('logs.systemGeneral', 'Hệ thống (Chung)')
    };
  });

  // Filter logs visibility: members only see logs belonging to their projects
  const visibleLogs = resolvedLogs.filter(l => {
    if (isAdmin) return true;
    return l.project_id && myProjectIds.includes(l.project_id);
  });

  // Apply filters
  const filteredLogs = visibleLogs.filter(l => {
    const matchUser = logUserFilter === 'all' || l.user_id === logUserFilter;
    const matchAction = logActionFilter === 'all' || l.action_type === logActionFilter;
    const matchProject = logProjectFilter === 'all' || l.project_id === logProjectFilter;
    return matchUser && matchAction && matchProject;
  });

  return (
    <div className="scrollable-view">
      <div className="view-header">
        <div className="view-title-group">
          <h2>{t('logs.title', 'Nhật ký Hoạt động')}</h2>
          <p>{t('logs.subtitle', 'Ghi nhận mọi thay đổi, phục vụ mục đích kiểm soát bảo mật và tính toán tiến độ làm việc.')}</p>
        </div>
      </div>

      <div className="doc-filters" style={{ marginBottom: '20px' }}>
        <div className="log-filters-bar" style={{ width: '100%' }}>
          <div className="log-filter-item">
            <label>{t('common.projectLabel', 'Dự án:')}</label>
            <select value={logProjectFilter} onChange={(e) => setLogProjectFilter(e.target.value)} className="doc-select-filter">
              <option value="all">{t('logs.allProjects', 'Tất cả dự án')}</option>
              {myProjects.map(p => (
                <option value={p.id} key={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div className="log-filter-item">
            <label>{t('logs.memberLabel', 'Thành viên:')}</label>
            <select value={logUserFilter} onChange={(e) => setLogUserFilter(e.target.value)} className="doc-select-filter">
              <option value="all">{t('logs.allMembers', 'Tất cả thành viên')}</option>
              {users.map(u => (
                <option value={u.id} key={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          
          <div className="log-filter-item">
            <label>{t('logs.actionLabel', 'Hành động:')}</label>
            <select value={logActionFilter} onChange={(e) => setLogActionFilter(e.target.value)} className="doc-select-filter">
              <option value="all">{t('logs.allActions', 'Tất cả hành động')}</option>
              <option value="CREATE">CREATE ({t('logs.actionCreate', 'Tạo mới')})</option>
              <option value="UPDATE">UPDATE ({t('logs.actionUpdate', 'Cập nhật')})</option>
              <option value="UPDATE_STATUS">UPDATE_STATUS ({t('logs.actionUpdateStatus', 'Đổi trạng thái')})</option>
              <option value="UPLOAD">UPLOAD ({t('logs.actionUpload', 'Tải tài liệu')})</option>
              <option value="COMMENT">COMMENT ({t('logs.actionComment', 'Bình luận')})</option>
              <option value="SWITCH_USER">SWITCH_USER ({t('logs.actionSwitchUser', 'Đổi tài khoản')})</option>
              <option value="ADD_MEMBER">ADD_MEMBER ({t('logs.actionAddMember', 'Thêm thành viên')})</option>
              <option value="REMOVE_MEMBER">REMOVE_MEMBER ({t('logs.actionRemoveMember', 'Xóa thành viên')})</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS ({t('logs.actionLoginSuccess', 'Đăng nhập thành công')})</option>
              <option value="LOGIN_FAILURE">LOGIN_FAILURE ({t('logs.actionLoginFailure', 'Đăng nhập thất bại')})</option>
              <option value="SECURITY_ALERT">SECURITY_ALERT ({t('logs.actionSecurityAlert', 'Cảnh báo bảo mật')})</option>
            </select>
          </div>
        </div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('logs.timeCol', 'Thời gian')}</th>
              <th>{t('logs.memberCol', 'Thành viên')}</th>
              <th>{t('logs.actionCol', 'Hành động')}</th>
              <th>{t('common.projectLabel', 'Dự án')}</th>
              <th>{t('logs.descCol', 'Mô tả hoạt động')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--neutral-muted)' }}>
                  {t('logs.noLogsFound', 'Không tìm thấy nhật ký hoạt động nào phù hợp.')}
                </td>
              </tr>
            ) : (
              filteredLogs.map(l => {
                const u = users.find(usr => usr.id === l.user_id) || { name: 'Hệ thống', color: '#6b7280' };
                const date = new Date(l.created_at);
                const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')} - ${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
                
                let badgeClass = "badge-info";
                if (l.action_type === "CREATE") badgeClass = "badge-success";
                else if (l.action_type === "UPDATE_STATUS" || l.action_type === "UPDATE") badgeClass = "badge-warning";
                else if (l.action_type === "SWITCH_USER" || l.action_type === "REMOVE_MEMBER" || l.action_type === "SECURITY_ALERT" || l.action_type === "LOGIN_FAILURE") badgeClass = "badge-danger";

                const translatedDesc = translateLogDescription(l.description, currentLang);

                return (
                  <tr key={l.id}>
                    <td>{timeStr}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: u.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '600' }}>
                          {u.name.split(" ").pop().charAt(0)}
                        </div>
                        <span>{u.name}</span>
                      </div>
                    </td>
                    <td><span className={`badge ${badgeClass}`}>{l.action_type}</span></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.project_name}>
                      <strong>{l.project_name}</strong>
                    </td>
                    <td style={l.action_type === "SECURITY_ALERT" ? { color: 'var(--danger-color)', fontWeight: '600' } : {}}>
                      {l.action_type === "SECURITY_ALERT" && <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>}
                      {translatedDesc}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
