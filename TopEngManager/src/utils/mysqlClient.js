// MySQL Frontend client adapter for Next.js (Communicates with API Routes)

let authListeners = [];

const callApi = async (action, payload = {}) => {
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'MySQL API error');
    return data;
  } catch (e) {
    console.error(`API Call [${action}] failed:`, e);
    throw e;
  }
};

export const MySQLAdapter = {
  // Client mock to satisfy existing Auth calls in AppContext
  client: {
    auth: {
      getSession: async () => {
        if (typeof window === 'undefined') return { data: { session: null } };
        const sessionStr = localStorage.getItem('ems_mysql_session');
        if (!sessionStr) return { data: { session: null } };
        try {
          const session = JSON.parse(sessionStr);
          return { data: { session } };
        } catch (e) {
          return { data: { session: null } };
        }
      },
      signInWithPassword: async ({ email, password }) => {
        try {
          const sessionData = await callApi('login', { email, password });
          localStorage.setItem('ems_mysql_session', JSON.stringify(sessionData.session));
          
          authListeners.forEach(cb => cb('SIGNED_IN', sessionData.session));
          return { data: sessionData, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      signUp: async ({ email, password, options }) => {
        try {
          const fullName = options?.data?.full_name || email.split('@')[0];
          const userResult = await callApi('signup', { email, password, fullName });
          
          // Auto login
          const sessionData = await callApi('login', { email, password });
          localStorage.setItem('ems_mysql_session', JSON.stringify(sessionData.session));
          
          authListeners.forEach(cb => cb('SIGNED_IN', sessionData.session));
          return { data: { user: userResult.user }, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      signOut: async () => {
        localStorage.removeItem('ems_mysql_session');
        authListeners.forEach(cb => cb('SIGNED_OUT', null));
        return { error: null };
      },
      onAuthStateChange: (cb) => {
        authListeners.push(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authListeners = authListeners.filter(l => l !== cb);
              }
            }
          }
        };
      }
    }
  },

  isEnabled: function() {
    // MySQL API routes are always available in server/client local context
    return true;
  },

  getUsers: async function() {
    return await callApi('getUsers');
  },

  getProjects: async function() {
    return await callApi('getProjects');
  },

  getProjectMembers: async function() {
    return await callApi('getProjectMembers');
  },

  getTasks: async function(projectId = null) {
    return await callApi('getTasks', { projectId });
  },

  getSubtasks: async function(taskId = null) {
    return await callApi('getSubtasks', { taskId });
  },

  getComments: async function(taskId = null) {
    return await callApi('getComments', { taskId });
  },

  getChatRooms: async function() {
    return await callApi('getChatRooms');
  },

  getChatRoomMembers: async function() {
    return await callApi('getChatRoomMembers');
  },

  getMessages: async function(roomId = null) {
    return await callApi('getMessages', { roomId });
  },

  getDocumentCategories: async function() {
    return await callApi('getDocumentCategories');
  },

  getDocuments: async function() {
    return await callApi('getDocuments');
  },

  getDocumentVersions: async function() {
    return await callApi('getDocumentVersions');
  },

  getActivityLogs: async function() {
    return await callApi('getActivityLogs');
  },

  getNotifications: async function(userId) {
    return await callApi('getNotifications', { userId });
  },

  saveProject: async function(proj, membersList = []) {
    return await callApi('saveProject', { proj, membersList });
  },

  saveTask: async function(task) {
    return await callApi('saveTask', { task });
  },

  updateTaskStatus: async function(taskId, status) {
    return await callApi('updateTaskStatus', { taskId, status });
  },

  saveSubtask: async function(subtask) {
    return await callApi('saveSubtask', { subtask });
  },

  deleteSubtask: async function(subId) {
    return await callApi('deleteSubtask', { subId });
  },

  addComment: async function(comment) {
    return await callApi('addComment', { comment });
  },

  sendMessage: async function(msg) {
    return await callApi('sendMessage', { msg });
  },

  addMessageReaction: async function(messageId, emoji, userId) {
    return true;
  },

  saveDocument: async function(doc, version) {
    return await callApi('saveDocument', { doc, version });
  },

  logActivity: async function(userId, actionType, entityType, entityId, description, metadata = {}) {
    return await callApi('logActivity', { userId, actionType, entityType, entityId, description, metadata });
  },

  createNotification: async function(userId, title, content, linkUrl) {
    return await callApi('createNotification', { userId, title, content, linkUrl });
  },

  markAllNotificationsRead: async function(userId) {
    return await callApi('markAllNotificationsRead', { userId });
  },

  addProjectMember: async function(projectId, userId, projectRole) {
    return await callApi('addProjectMember', { projectId, userId, projectRole });
  },

  removeProjectMember: async function(projectId, userId) {
    return await callApi('removeProjectMember', { projectId, userId });
  },

  // --- NEW ISSUES MODULE METHODS ---
  getIssues: async function(projectId, searchQuery = '', assigneeId = '', priority = '', type = '') {
    return await callApi('getIssues', { projectId, searchQuery, assigneeId, priority, type });
  },

  getIssueDetail: async function(issueId) {
    return await callApi('getIssueDetail', { issueId });
  },

  createIssue: async function(issue) {
    return await callApi('createIssue', issue);
  },

  updateIssue: async function(issue, userId) {
    return await callApi('updateIssue', { ...issue, userId });
  },

  updateIssueStatus: async function(issueId, status, userId) {
    return await callApi('updateIssueStatus', { issueId, status, userId });
  },

  deleteIssue: async function(issueId) {
    return await callApi('deleteIssue', { issueId });
  },

  addComment: async function(issueId, userId, content) {
    return await callApi('addComment', { issueId, userId, content });
  },

  deleteComment: async function(commentId) {
    return await callApi('deleteComment', { commentId });
  },

  getIssueTags: async function(issueId = null) {
    return await callApi('getIssueTags', { issueId });
  },

  saveIssue: async function(issue, taggedUserIds = []) {
    return await callApi('saveIssue', { issue, taggedUserIds });
  },

  // --- NEW TASK CHATS METHODS ---
  getTaskChats: async function(taskId) {
    return await callApi('getTaskChats', { taskId });
  },

  sendTaskChat: async function(chat) {
    return await callApi('sendTaskChat', { chat });
  },

  // --- CUSTOM ADAPTER UTILITIES ---
  markNotificationRead: async function(notificationId) {
    return await callApi('markNotificationRead', { notificationId });
  },

  createDirectChatRoom: async function(userId1, userId2, roomName) {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createDirectChat',
          payload: { userId1, userId2, name: roomName }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.roomId;
    } catch (e) {
      console.warn("Direct chat creation failed, using mock", e);
      return `room-direct-${Date.now()}`;
    }
  },

  getRoles: async function() {
    return await callApi('getRoles');
  },

  createUser: async function(email, password, fullName, roleId) {
    return await callApi('createUser', { email, password, fullName, roleId });
  },

  testConnection: async function() {
    return await callApi('testConnection');
  },

  getCustomers: async function() {
    return await callApi('getCustomers');
  },

  getDepartments: async function() {
    return await callApi('getDepartments');
  },

  uploadFile: async function(file) {
    const formData = new FormData();
    formData.append('file', file);
    const backendUrl = 'http://localhost:5000/api';
    const res = await fetch(`${backendUrl}/uploadFile`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload error');
    return data;
  },

  getDailyReports: async function(userId, userRole) {
    return await callApi('getDailyReports', { userId, userRole });
  },

  createDailyReport: async function(report) {
    return await callApi('createDailyReport', report);
  },

  updateDailyReportStatus: async function(reportId, status, comment) {
    return await callApi('updateDailyReportStatus', { reportId, status, comment });
  },

  getRolesPermissions: async function() {
    return await callApi('getRolesPermissions');
  },

  saveRolesPermissions: async function(roles, rolePermissions) {
    return await callApi('saveRolesPermissions', { roles, role_permissions: rolePermissions });
  }
};
