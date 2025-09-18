import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, ActivityRecord } from '@/types';
import { storage } from '@/lib/storage';
import { authService } from '@/lib/authService';
import { realtimeSync } from '@/lib/realtimeSync';

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
    const initializeAuth = async () => {
      storage.initialize();
      
      const currentUser = storage.getCurrentUser();
      if (currentUser) {
        setAuthState({
          user: currentUser,
          isAuthenticated: true
        });
        
        // Запустить реальное время синхронизации
        realtimeSync.start();
        
        // Подписаться на обновления
        realtimeSync.subscribe('current_user_updated', (updatedUser: User) => {
          setAuthState({
            user: updatedUser,
            isAuthenticated: true
          });
        });
        
        realtimeSync.subscribe('activity_updated', (updatedUser: User) => {
          if (updatedUser.id === currentUser.id) {
            setAuthState({
              user: updatedUser,
              isAuthenticated: true
            });
          }
        });
      }
    };

    initializeAuth();

    // Setup cross-tab synchronization
    const unsubscribe = storage.setupCrossTabSync((syncData) => {
      const { type, data } = syncData;
      
      if (type === 'users') {
        // Update current user with fresh data from sync
        const currentUser = storage.getCurrentUser();
        if (currentUser) {
          const updatedUser = data.find((u: User) => u.id === currentUser.id);
          if (updatedUser) {
            storage.setCurrentUser(updatedUser);
            setAuthState({
              user: updatedUser,
              isAuthenticated: true
            });
          }
        }
      }
      
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
    });

    return unsubscribe;
  }, []);

  const login = async (loginData: string, password: string): Promise<boolean> => {
    try {
      // Try new database authentication first
      const loginResult = await authService.login(loginData, password);
      
      if (loginResult.success && loginResult.user) {
        const user = loginResult.user;
        
        storage.setCurrentUser(user);
        setAuthState({
          user: user,
          isAuthenticated: true
        });
        
        // Запустить реальное время синхронизации после входа
        realtimeSync.start();
        
        return true;
      }
      
      // Fallback to old localStorage authentication
      storage.createBackup('pre_login');
      const user = await storage.authenticateUser(loginData, password);
      
      if (user) {
        // Check if user is blocked
        if (user.isBlocked) {
          return false;
        }
        
        // For fallback auth, skip complex sync for now to avoid errors
        // This will be handled properly when all users migrate to database
        
        const now = new Date().toISOString();
        const updatedUser = { 
          ...user, 
          status: 'online' as const, 
          lastActivity: now, 
          lastStatusTimestamp: now 
        };
        
        // Only update if not secret admin
        if (user.id !== 'secret_admin_supreme') {
          storage.updateUser(user.id, { 
            status: 'online', 
            lastActivity: now, 
            lastStatusTimestamp: now 
          });
        }
        
        storage.setCurrentUser(updatedUser);
        
        // Add activity record
        const activityRecord: ActivityRecord = {
          id: Date.now().toString(),
          userId: user.id,
          status: 'online',
          timestamp: now,
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

  const logout = async () => {
    if (authState.user) {
      // Notify backend about logout
      await authService.logout(authState.user.id);
      
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Calculate time spent in current status
      let updates: Partial<User> = {
        status: 'offline',
        lastActivity: now.toISOString(),
        lastStatusTimestamp: now.toISOString()
      };
      
      let duration = 0;
      if (authState.user.lastStatusTimestamp) {
        duration = now.getTime() - new Date(authState.user.lastStatusTimestamp).getTime();
      }
      
      // Update time counters based on current status
      if (duration > 0) {
        switch (authState.user.status) {
          case 'online':
            updates.totalOnlineTime = (authState.user.totalOnlineTime || 0) + duration;
            updates.monthlyOnlineTime = {
              ...(authState.user.monthlyOnlineTime || {}),
              [monthKey]: ((authState.user.monthlyOnlineTime || {})[monthKey] || 0) + duration
            };
            break;
          case 'afk':
            updates.totalAfkTime = (authState.user.totalAfkTime || 0) + duration;
            updates.monthlyAfkTime = {
              ...(authState.user.monthlyAfkTime || {}),
              [monthKey]: ((authState.user.monthlyAfkTime || {})[monthKey] || 0) + duration
            };
            break;
        }
      }
      
      if (authState.user.id !== 'secret_admin_supreme') {
        storage.updateUser(authState.user.id, updates);
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
    
    // Остановить синхронизацию
    realtimeSync.stop();
    
    storage.setCurrentUser(null);
    setAuthState({
      user: null,
      isAuthenticated: false
    });
  };

  const updateStatus = (status: 'online' | 'afk' | 'offline') => {
    if (authState.user && authState.user.status !== status) {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      let updates: Partial<User> = {
        status,
        lastActivity: now.toISOString(),
        lastStatusTimestamp: now.toISOString()
      };
      
      // Calculate time spent in previous status
      let duration = 0;
      if (authState.user.lastStatusTimestamp) {
        duration = now.getTime() - new Date(authState.user.lastStatusTimestamp).getTime();
      }
      
      // Update time counters based on previous status
      if (duration > 0) {
        switch (authState.user.status) {
          case 'online':
            updates.totalOnlineTime = (authState.user.totalOnlineTime || 0) + duration;
            updates.monthlyOnlineTime = {
              ...(authState.user.monthlyOnlineTime || {}),
              [monthKey]: ((authState.user.monthlyOnlineTime || {})[monthKey] || 0) + duration
            };
            break;
          case 'afk':
            updates.totalAfkTime = (authState.user.totalAfkTime || 0) + duration;
            updates.monthlyAfkTime = {
              ...(authState.user.monthlyAfkTime || {}),
              [monthKey]: ((authState.user.monthlyAfkTime || {})[monthKey] || 0) + duration
            };
            break;
          case 'offline':
            updates.totalOfflineTime = (authState.user.totalOfflineTime || 0) + duration;
            updates.monthlyOfflineTime = {
              ...(authState.user.monthlyOfflineTime || {}),
              [monthKey]: ((authState.user.monthlyOfflineTime || {})[monthKey] || 0) + duration
            };
            break;
        }
      }
      
      // Use syncUserStatistics for cross-device synchronization
      const updatedUser = authState.user.id !== 'secret_admin_supreme'
        ? storage.syncUserStatistics(authState.user.id, updates)
        : { ...authState.user, ...updates };
      
      if (updatedUser) {
        storage.setCurrentUser(updatedUser);
        
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