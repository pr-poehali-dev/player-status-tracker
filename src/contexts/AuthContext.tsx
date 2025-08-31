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
    const users = storage.getUsers();
    const user = users.find(u => u.login === loginData && u.password === password);
    
    if (user) {
      const updatedUser = { ...user, status: 'online' as const, lastActivity: new Date().toISOString() };
      storage.updateUser(user.id, { status: 'online', lastActivity: new Date().toISOString() });
      storage.setCurrentUser(updatedUser);
      
      // Add activity record
      const activityRecord: ActivityRecord = {
        id: Date.now().toString(),
        userId: user.id,
        status: 'online',
        timestamp: new Date().toISOString()
      };
      storage.addActivity(activityRecord);
      
      setAuthState({
        user: updatedUser,
        isAuthenticated: true
      });
      return true;
    }
    return false;
  };

  const logout = () => {
    if (authState.user) {
      // Update user status to offline
      storage.updateUser(authState.user.id, { status: 'offline', lastActivity: new Date().toISOString() });
      
      // Add activity record
      const activityRecord: ActivityRecord = {
        id: Date.now().toString(),
        userId: authState.user.id,
        status: 'offline',
        timestamp: new Date().toISOString()
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
      const updatedUser = { ...authState.user, status, lastActivity: new Date().toISOString() };
      storage.updateUser(authState.user.id, { status, lastActivity: new Date().toISOString() });
      storage.setCurrentUser(updatedUser);
      
      // Add activity record
      const activityRecord: ActivityRecord = {
        id: Date.now().toString(),
        userId: authState.user.id,
        status,
        timestamp: new Date().toISOString()
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