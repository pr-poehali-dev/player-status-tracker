import { storage } from './storage';
import { User } from '@/types';

class SyncManager {
  private listeners: Set<(event: CustomEvent) => void> = new Set();
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) return;
    
    // Listen for localStorage changes from other tabs/devices
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    
    // Listen for custom sync events
    window.addEventListener('userDataSync', this.handleCustomSync.bind(this));
    
    this.isInitialized = true;
  }

  private handleStorageChange(e: StorageEvent) {
    if (!e.key || !e.newValue) return;

    // Handle user data changes
    if (e.key === 'game_admin_users') {
      this.broadcastSync('users', JSON.parse(e.newValue));
    }
    
    // Handle current user changes
    if (e.key === 'game_admin_current_user') {
      const newUser = e.newValue ? JSON.parse(e.newValue) : null;
      this.broadcastSync('currentUser', newUser);
    }
    
    // Handle settings changes
    if (e.key === 'game_admin_settings') {
      this.broadcastSync('settings', JSON.parse(e.newValue));
    }
  }

  private handleCustomSync(e: CustomEvent) {
    // Forward sync events to registered listeners
    this.listeners.forEach(listener => listener(e));
  }

  broadcastSync(type: string, data: any) {
    const syncEvent = new CustomEvent('userDataSync', {
      detail: { type, data, timestamp: Date.now() }
    });
    window.dispatchEvent(syncEvent);
  }

  onSync(listener: (event: CustomEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Force sync current user data across all sessions
  syncCurrentUser(user: User | null) {
    storage.setCurrentUser(user);
    this.broadcastSync('currentUser', user);
  }

  // Force sync all users data
  syncUsers(users: User[]) {
    storage.saveUsers(users);
    this.broadcastSync('users', users);
  }

  // Get fresh user data for multi-device consistency
  getFreshUserData(userId: string): User | null {
    const users = storage.getUsers();
    return users.find(u => u.id === userId) || null;
  }

  // Check if user is currently active in another session
  checkUserActiveStatus(userId: string): boolean {
    const users = storage.getUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user || !user.lastActivity) return false;
    
    // Consider user active if last activity was within 5 minutes
    const lastActivity = new Date(user.lastActivity).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    return (now - lastActivity) < fiveMinutes;
  }

  // Merge user sessions when logging in from multiple devices
  mergeUserSessions(existingUser: User, newSessionData: Partial<User>): User {
    const now = new Date().toISOString();
    
    return {
      ...existingUser,
      ...newSessionData,
      lastActivity: now,
      lastStatusTimestamp: now,
      // Keep existing time data and settings
      totalOnlineTime: existingUser.totalOnlineTime || 0,
      totalAfkTime: existingUser.totalAfkTime || 0,
      totalOfflineTime: existingUser.totalOfflineTime || 0,
      monthlyOnlineTime: existingUser.monthlyOnlineTime || {},
      monthlyAfkTime: existingUser.monthlyAfkTime || {},
      monthlyOfflineTime: existingUser.monthlyOfflineTime || {},
    };
  }

  // Update user status with cross-device sync
  updateUserStatusSync(userId: string, status: 'online' | 'afk' | 'offline', duration?: number) {
    const users = storage.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) return;
    
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let updates: Partial<User> = {
      status,
      lastActivity: now.toISOString(),
      lastStatusTimestamp: now.toISOString()
    };
    
    // Add time tracking if duration provided
    if (duration && duration > 0) {
      switch (users[userIndex].status) {
        case 'online':
          updates.totalOnlineTime = (users[userIndex].totalOnlineTime || 0) + duration;
          updates.monthlyOnlineTime = {
            ...(users[userIndex].monthlyOnlineTime || {}),
            [monthKey]: ((users[userIndex].monthlyOnlineTime || {})[monthKey] || 0) + duration
          };
          break;
        case 'afk':
          updates.totalAfkTime = (users[userIndex].totalAfkTime || 0) + duration;
          updates.monthlyAfkTime = {
            ...(users[userIndex].monthlyAfkTime || {}),
            [monthKey]: ((users[userIndex].monthlyAfkTime || {})[monthKey] || 0) + duration
          };
          break;
        case 'offline':
          updates.totalOfflineTime = (users[userIndex].totalOfflineTime || 0) + duration;
          updates.monthlyOfflineTime = {
            ...(users[userIndex].monthlyOfflineTime || {}),
            [monthKey]: ((users[userIndex].monthlyOfflineTime || {})[monthKey] || 0) + duration
          };
          break;
      }
    }
    
    users[userIndex] = { ...users[userIndex], ...updates };
    
    // Save and broadcast changes
    this.syncUsers(users);
    
    return users[userIndex];
  }
}

export const syncManager = new SyncManager();