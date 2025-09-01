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
      // Get fresh user data to ensure admin level and stats are current
      const users = storage.getUsers();
      const freshUser = users.find(u => u.id === currentUser.id);
      const userToSet = freshUser || currentUser;
      
      setAuthState({
        user: userToSet,
        isAuthenticated: true
      });
      
      // Update current user with fresh data if needed
      if (freshUser && JSON.stringify(freshUser) !== JSON.stringify(currentUser)) {
        storage.setCurrentUser(freshUser);
      }
    }

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
      // Create backup of current users before login
      storage.createBackup('pre_login');
      
      const user = await storage.authenticateUser(loginData, password);
      
      if (user) {
        // Check if user is blocked
        if (user.isBlocked) {
          return false;
        }
        
        // Check for multi-device sync opportunities on login
        const currentUsers = storage.getUsers();
        const backupUsers = localStorage.getItem('users_backup_pre_login');
        
        if (backupUsers) {
          const parsedBackup = JSON.parse(backupUsers);
          // If user counts differ or this is a different device, sync data
          if (parsedBackup.length !== currentUsers.length || 
              !parsedBackup.find((u: User) => u.login === loginData)) {
            const syncResult = storage.syncMultiDeviceLogin(parsedBackup);
            console.log('Login sync completed:', syncResult.mergeSummary);
            
            // Get updated user after sync
            const syncedUsers = storage.getUsers();
            const syncedUser = syncedUsers.find(u => u.login === loginData);
            if (syncedUser) {
              const updatedUser = { ...syncedUser, status: 'online' as const };
              storage.setCurrentUser(updatedUser);
              setAuthState({
                user: updatedUser,
                isAuthenticated: true
              });
              return true;
            }
          }
        }
        
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

  const logout = () => {
    if (authState.user) {
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