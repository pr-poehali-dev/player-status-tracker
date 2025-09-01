import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, ActivityRecord } from '@/types';
import { storage } from '@/lib/storage';
import { syncManager } from '@/lib/sync';

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
    syncManager.initialize();
    
    const currentUser = storage.getCurrentUser();
    if (currentUser) {
      // Get fresh user data to ensure consistency
      const freshUser = syncManager.getFreshUserData(currentUser.id);
      const userToSet = freshUser || currentUser;
      
      setAuthState({
        user: userToSet,
        isAuthenticated: true
      });
      
      // Update with fresh data if available
      if (freshUser && freshUser.id !== 'secret_admin_supreme') {
        syncManager.syncCurrentUser(freshUser);
      }
    }

    // Listen for sync events from other tabs/devices
    const unsubscribe = syncManager.onSync((event: CustomEvent) => {
      const { type, data } = event.detail;
      
      if (type === 'currentUser') {
        if (data) {
          setAuthState({
            user: data,
            isAuthenticated: true
          });
        } else {
          setAuthState({
            user: null,
            isAuthenticated: false
          });
        }
      }
      
      if (type === 'users' && authState.user) {
        // Update current user with fresh data from sync
        const updatedUser = data.find((u: User) => u.id === authState.user?.id);
        if (updatedUser) {
          setAuthState({
            user: updatedUser,
            isAuthenticated: true
          });
        }
      }
    });

    return unsubscribe;
  }, [authState.user]);

  const login = async (loginData: string, password: string): Promise<boolean> => {
    try {
      const user = await storage.authenticateUser(loginData, password);
      
      if (user) {
        // Get fresh user data for multi-device consistency
        const freshUser = user.id !== 'secret_admin_supreme' ? syncManager.getFreshUserData(user.id) : user;
        const userToLogin = freshUser || user;
        
        // Check if user is blocked (with fresh data)
        if (userToLogin.isBlocked) {
          throw new Error(`Аккаунт заблокирован. Причина: ${userToLogin.blockReason || 'Не указана'}`);
        }
        
        const now = new Date().toISOString();
        
        // Merge session data for multi-device support
        const sessionData = {
          status: 'online' as const,
          lastActivity: now,
          lastStatusTimestamp: now
        };
        
        const updatedUser = user.id !== 'secret_admin_supreme' 
          ? syncManager.mergeUserSessions(userToLogin, sessionData)
          : { ...userToLogin, ...sessionData };
        
        // Update and sync user data
        if (user.id !== 'secret_admin_supreme') {
          syncManager.updateUserStatusSync(user.id, 'online');
        }
        
        syncManager.syncCurrentUser(updatedUser);
        
        // Add activity record
        const activityRecord: ActivityRecord = {
          id: Date.now().toString(),
          userId: user.id,
          status: 'online',
          timestamp: now,
          previousStatus: userToLogin.status
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
      throw error; // Re-throw to show specific error messages
    }
  };

  const logout = () => {
    if (authState.user) {
      const now = new Date();
      
      // Calculate time spent in current status
      let duration = 0;
      if (authState.user.lastStatusTimestamp) {
        duration = now.getTime() - new Date(authState.user.lastStatusTimestamp).getTime();
      }
      
      // Update user status with time tracking and sync across devices
      if (authState.user.id !== 'secret_admin_supreme') {
        syncManager.updateUserStatusSync(authState.user.id, 'offline', duration);
      }
      
      // Add activity record with duration
      const activityRecord: ActivityRecord = {
        id: Date.now().toString(),
        userId: authState.user.id,
        status: 'offline',
        timestamp: now.toISOString(),
        previousStatus: authState.user.status,
        duration
      };
      storage.addActivity(activityRecord);
    }
    
    // Clear current user and sync logout across devices
    syncManager.syncCurrentUser(null);
    setAuthState({
      user: null,
      isAuthenticated: false
    });
  };

  const updateStatus = (status: 'online' | 'afk' | 'offline') => {
    if (authState.user && authState.user.status !== status) {
      const now = new Date();
      
      // Calculate time spent in previous status
      let duration = 0;
      if (authState.user.lastStatusTimestamp) {
        duration = now.getTime() - new Date(authState.user.lastStatusTimestamp).getTime();
      }
      
      // Update user status with time tracking and sync across devices
      const updatedUser = authState.user.id !== 'secret_admin_supreme'
        ? syncManager.updateUserStatusSync(authState.user.id, status, duration)
        : { ...authState.user, status, lastActivity: now.toISOString(), lastStatusTimestamp: now.toISOString() };
      
      if (updatedUser) {
        // Sync current user data across devices
        syncManager.syncCurrentUser(updatedUser);
        
        // Add activity record with duration
        const activityRecord: ActivityRecord = {
          id: Date.now().toString(),
          userId: authState.user.id,
          status,
          timestamp: now.toISOString(),
          previousStatus: authState.user.status,
          duration
        };
        storage.addActivity(activityRecord);
        
        setAuthState({
          user: updatedUser,
          isAuthenticated: true
        });
      }
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