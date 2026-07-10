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
            color: profile.color || '#1E40AF'
          });
        }
      }

      // Load rest of the database tables in parallel to optimize initial load speed (preventing waterfall delays)
      const [
        uList,
        projs,
        tks,
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
          setDocuments([]);
          setNotifications([]);
          setActivityLogs([]);
          setIsLoading(false);
        }
      });
      return () => {
        subscription.unsubscribe();
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
