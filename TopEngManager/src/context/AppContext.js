"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/utils/db';

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
          console.warn("Chưa tìm thấy thông tin cá nhân của user: ", session.user.id);
          const fallbackUser = {
            id: session.user.id,
            name: session.user.full_name || session.user.email.split('@')[0],
            email: session.user.email,
            system_role: session.user.role_name || 'Nhân viên (Staff)',
            color: '#1E40AF'
          };
          setCurrentUser(fallbackUser);
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

      // Load rest of the database tables
      const uList = await db.getUsers().catch(() => []);
      setUsers(uList);

      const projs = await db.getProjects().catch(() => []);
      setProjects(projs);

      const tks = await db.getTasks().catch(() => []);
      setTasks(tks);

      const docs = await db.getDocuments().catch(() => []);
      setDocuments(docs);

      const vers = await db.getDocumentVersions().catch(() => []);
      setDocumentVersions(vers);

      const cats = await db.getDocumentCategories().catch(() => []);
      setDocumentCategories(cats);

      const pm = await db.getProjectMembers().catch(() => []);
      setProjectMembers(pm);

      const crm = await db.getChatRoomMembers().catch(() => []);
      setChatRoomMembers(crm);

      const rooms = await db.getChatRooms().catch(() => []);
      setChatRooms(rooms);

      const nots = await db.getNotifications(session.user.id).catch(() => []);
      setNotifications(nots);

      const logs = await db.getActivityLogs().catch(() => []);
      setActivityLogs(logs);

      // Load roles & permissions mapping
      try {
        const rpConfig = await db.getRolesPermissions();
        setRolePermissions(rpConfig.role_permissions || {});
      } catch (err) {
        console.error("Failed to load role permissions:", err);
      }

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
