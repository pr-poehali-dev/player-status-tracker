import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, ActivityRecord } from '@/types';
import { storage } from '@/lib/storage';

interface AuthContextType extends AuthState {
  login: (loginData: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateStatus: (status: 'online' | 'afk' | 'offline') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false
  });

  useEffect(() => {
    storage.initialize();
    const currentUser = storage.getCurrentUser();
    if (currentUser) {
      setAuthState({
        user: currentUser,
        isAuthenticated: true
      });
    }
  }, []);

  const login = async (loginData: string, password: string): Promise<boolean> => {
    try {
      const user = await storage.authenticateUser(loginData, password);
      
      if (user) {
        const now = new Date().toISOString();
        const updatedUser = { ...user, status: 'online' as const, lastActivity: now, lastOnlineTimestamp: now };
        
        // Only update if not secret admin
        if (user.id !== 'secret_admin_supreme') {
          storage.updateUser(user.id, { status: 'online', lastActivity: now, lastOnlineTimestamp: now });
        }
        
        storage.setCurrentUser(updatedUser);
        
        // Add activity record
        const activityRecord: ActivityRecord = {
          id: Date.now().toString(),
          userId: user.id,
          status: 'online',
          timestamp: new Date().toISOString(),
          previousStatus: user.status
        };
        storage.addActivity(activityRecord);
        
        setAuthState({
          user: updatedUser,
          isAuthenticated: true
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    if (authState.user) {
      // Calculate online time if user was online
      const now = new Date();
      let totalOnlineTime = authState.user.totalOnlineTime || 0;
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      let monthlyOnlineTime = { ...(authState.user.monthlyOnlineTime || {}) };
      
      if (authState.user.status === 'online' && authState.user.lastOnlineTimestamp) {
        const onlineTime = now.getTime() - new Date(authState.user.lastOnlineTimestamp).getTime();
        totalOnlineTime += onlineTime;
        monthlyOnlineTime[monthKey] = (monthlyOnlineTime[monthKey] || 0) + onlineTime;
      }
      
      // Update user status to offline
      storage.updateUser(authState.user.id, { 
        status: 'offline', 
        lastActivity: now.toISOString(),
        totalOnlineTime,
        monthlyOnlineTime,
        lastOnlineTimestamp: undefined
      });
      
      // Add activity record with duration
      const activityRecord: ActivityRecord = {
        id: Date.now().toString(),
        userId: authState.user.id,
        status: 'offline',
        timestamp: now.toISOString(),
        previousStatus: authState.user.status,
        duration: authState.user.status === 'online' && authState.user.lastOnlineTimestamp
          ? now.getTime() - new Date(authState.user.lastOnlineTimestamp).getTime()
          : undefined
      };
      storage.addActivity(activityRecord);
    }
    
    storage.setCurrentUser(null);
    setAuthState({
      user: null,
      isAuthenticated: false
    });
  };

  const updateStatus = (status: 'online' | 'afk' | 'offline') => {
    if (authState.user) {
      const now = new Date();
      let updates: Partial<User> = { status, lastActivity: now.toISOString() };
      let totalOnlineTime = authState.user.totalOnlineTime || 0;
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      let monthlyOnlineTime = { ...(authState.user.monthlyOnlineTime || {}) };
      
      // Calculate online time when switching from online to another status
      if (authState.user.status === 'online' && status !== 'online' && authState.user.lastOnlineTimestamp) {
        const onlineTime = now.getTime() - new Date(authState.user.lastOnlineTimestamp).getTime();
        totalOnlineTime += onlineTime;
        monthlyOnlineTime[monthKey] = (monthlyOnlineTime[monthKey] || 0) + onlineTime;
        updates.totalOnlineTime = totalOnlineTime;
        updates.monthlyOnlineTime = monthlyOnlineTime;
        updates.lastOnlineTimestamp = undefined;
      }
      
      // Set timestamp when switching to online
      if (status === 'online' && authState.user.status !== 'online') {
        updates.lastOnlineTimestamp = now.toISOString();
      }
      
      const updatedUser = { ...authState.user, ...updates };
      storage.updateUser(authState.user.id, updates);
      storage.setCurrentUser(updatedUser);
      
      // Add activity record with duration
      const activityRecord: ActivityRecord = {
        id: Date.now().toString(),
        userId: authState.user.id,
        status,
        timestamp: now.toISOString(),
        previousStatus: authState.user.status,
        duration: authState.user.status === 'online' && authState.user.lastOnlineTimestamp && status !== 'online'
          ? now.getTime() - new Date(authState.user.lastOnlineTimestamp).getTime()
          : undefined
      };
      storage.addActivity(activityRecord);
      
      setAuthState({
        user: updatedUser,
        isAuthenticated: true
      });
    }
  };

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    updateStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};