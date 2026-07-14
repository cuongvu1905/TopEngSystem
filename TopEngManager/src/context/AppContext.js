"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/utils/db';

// Patch window.performance.measure to prevent Next.js Turbopack crashes due to negative time stamp errors
if (typeof window !== 'undefined' && window.performance && window.performance.measure) {
  const originalMeasure = window.performance.measure;
  window.performance.measure = function (name, startMark, endMark) {
    try {
      return originalMeasure.apply(this, arguments);
    } catch (e) {
      console.warn("Performance measure error bypassed:", e);
      return null;
    }
  };
}

const AppContext = createContext();

export const AppContextProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentVersions, setDocumentVersions] = useState([]);
  const [documentCategories, setDocumentCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [chatRoomMembers, setChatRoomMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rolePermissions, setRolePermissions] = useState({});

  const reloadAll = async () => {
    if (!db.isEnabled()) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session } } = await db.client.auth.getSession();
      if (!session) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      } else {
        // Verify session token on startup for Single Device Login check
        if (session.token) {
          const check = await db.checkSession(session.user.id, session.token).catch(() => ({ valid: true }));
          if (check && !check.valid) {
            console.warn("Session token is invalid. Signing out...");
            await db.client.auth.signOut().catch(() => {});
            setCurrentUser(null);
            setIsLoading(false);
            return;
          }
        }
        // Fetch users list and find current user profile
        const usersList = await db.getUsers().catch(() => []);
        const profile = usersList.find(u => u.id === session.user.id);

        if (!profile) {
          console.warn("Session user không tồn tại trong database (DB đã bị reset). Thực hiện Clear Session...");
          if (db.isEnabled()) {
            await db.client.auth.signOut().catch(() => {});
          }
          setCurrentUser(null);
          setIsLoading(false);
          return;
        } else {
          setCurrentUser({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            system_role: profile.system_role || 'Nhân viên (Staff)',
            color: profile.color || '#1E40AF',
            department_id: profile.department_id || null,
            department_name: profile.department_name || 'Chưa phân phòng'
          });
        }
      }

      // Load rest of the database tables in parallel to optimize initial load speed (preventing waterfall delays)
      const [
        uList,
        projs,
        tks,
        subs,
        docs,
        vers,
        cats,
        pm,
        crm,
        rooms,
        nots,
        logs,
        rpConfig
      ] = await Promise.all([
        db.getUsers().catch(() => []),
        db.getProjects().catch(() => []),
        db.getTasks().catch(() => []),
        db.getSubtasks().catch(() => []),
        db.getDocuments().catch(() => []),
        db.getDocumentVersions().catch(() => []),
        db.getDocumentCategories().catch(() => []),
        db.getProjectMembers().catch(() => []),
        db.getChatRoomMembers().catch(() => []),
        db.getChatRooms().catch(() => []),
        db.getNotifications(session.user.id).catch(() => []),
        db.getActivityLogs().catch(() => []),
        db.getRolesPermissions().catch(() => ({}))
      ]);

      setUsers(uList);
      setProjects(projs);
      setTasks(tks);
      setSubtasks(subs);
      setDocuments(docs);
      setDocumentVersions(vers);
      setDocumentCategories(cats);
      setProjectMembers(pm);
      setChatRoomMembers(crm);
      setChatRooms(rooms);
      setNotifications(nots);
      setActivityLogs(logs);
      setRolePermissions(rpConfig?.role_permissions || {});

    } catch (e) {
      console.error("Context reload failed: ", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();

    // Listen for auth state changes
    if (db.isEnabled()) {
      const { data: { subscription } } = db.client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
          reloadAll();
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setProjects([]);
          setTasks([]);
          setSubtasks([]);
          setDocuments([]);
          setNotifications([]);
          setActivityLogs([]);
          setIsLoading(false);
        }
      });

      // Periodically check session for Single Device Login verification (every 5 seconds)
      const sessionInterval = setInterval(async () => {
        const sessionRes = await db.client.auth.getSession();
        const session = sessionRes?.data?.session;
        if (session && session.user && session.token) {
          try {
            const check = await db.checkSession(session.user.id, session.token);
            if (check && !check.valid) {
              clearInterval(sessionInterval);
              await db.client.auth.signOut();
              const Swal = (await import('sweetalert2')).default;
              Swal.fire({
                icon: 'warning',
                title: 'Phiên đăng nhập hết hạn',
                text: check.reason || 'Tài khoản của bạn đã được đăng nhập từ một thiết bị khác.',
                confirmButtonColor: 'var(--primary-color)',
                allowOutsideClick: false
              });
            }
          } catch (err) {
            console.error('Session check error:', err);
          }
        }
      }, 5000);

      // Periodically poll new notifications (every 4 seconds)
      const notificationInterval = setInterval(async () => {
        const sessionRes = await db.client.auth.getSession();
        const session = sessionRes?.data?.session;
        if (session && session.user) {
          try {
            const nots = await db.getNotifications(session.user.id).catch(() => []);
            setNotifications(nots);
          } catch (err) {
            console.error('Failed to poll notifications:', err);
          }
        }
      }, 4000);

      return () => {
        subscription.unsubscribe();
        clearInterval(sessionInterval);
        clearInterval(notificationInterval);
      };
    }
  }, []);

  const login = async (email, password) => {
    if (!db.isEnabled()) {
      throw new Error("Database Client chưa được khởi tạo. Vui lòng kiểm tra biến môi trường!");
    }
    setIsLoading(true);
    const { data, error } = await db.client.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
      throw error;
    }
    await reloadAll();
    return data;
  };

  const signup = async (email, password, fullName) => {
    if (!db.isEnabled()) {
      throw new Error("Database Client chưa được khởi tạo.");
    }
    setIsLoading(true);
    const { data, error } = await db.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    if (error) {
      setIsLoading(false);
      throw error;
    }
    
    // No manual synchronization needed as auth signUp handles table inserts automatically
    
    await reloadAll();
    return data;
  };

  const logout = async () => {
    if (db.isEnabled()) {
      await db.client.auth.signOut();
    }

   
    setCurrentUser(null);
    setProjects([]);
    setTasks([]);
    setSubtasks([]);
    setDocuments([]);
    setNotifications([]);
    setActivityLogs([]);
  };

  const hasPermission = (permissionName) => {
    if (!currentUser) return false;
    const role = currentUser.system_role;
    if (role?.includes("Admin") || role?.includes("Owner")) return true;
    const permissions = rolePermissions[role] || [];
    return permissions.includes(permissionName);
  };

  const value = {
    currentUser,
    users,
    projects,
    tasks,
    subtasks,
    documents,
    documentVersions,
    documentCategories,
    notifications,
    activityLogs,
    chatRooms,
    projectMembers,
    chatRoomMembers,
    isLoading,
    rolePermissions,
    hasPermission,
    login,
    signup,
    logout,
    reloadAll
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
