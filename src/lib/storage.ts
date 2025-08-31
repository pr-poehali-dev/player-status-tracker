import { User, ActivityRecord, SystemAction, SystemSettings } from '@/types';

const STORAGE_KEYS = {
  USERS: 'game_admin_users',
  ACTIVITY: 'game_admin_activity',
  ACTIONS: 'game_admin_actions',
  CURRENT_USER: 'game_admin_current_user',
  SETTINGS: 'game_admin_settings'
};

export const storage = {
  // Users management
  getUsers: (): User[] => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },

  saveUsers: (users: User[]) => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  addUser: (user: User) => {
    const users = storage.getUsers();
    users.push(user);
    storage.saveUsers(users);
  },

  updateUser: (userId: string, updates: Partial<User>) => {
    const users = storage.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      storage.saveUsers(users);
    }
  },

  deleteUser: (userId: string) => {
    const users = storage.getUsers().filter(u => u.id !== userId);
    storage.saveUsers(users);
  },

  // Activity management
  getActivity: (): ActivityRecord[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
    return data ? JSON.parse(data) : [];
  },

  saveActivity: (activity: ActivityRecord[]) => {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(activity));
  },

  addActivity: (record: ActivityRecord) => {
    const activity = storage.getActivity();
    activity.push(record);
    storage.saveActivity(activity);
  },

  // System actions
  getActions: (): SystemAction[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIONS);
    return data ? JSON.parse(data) : [];
  },

  saveActions: (actions: SystemAction[]) => {
    localStorage.setItem(STORAGE_KEYS.ACTIONS, JSON.stringify(actions));
  },

  addAction: (action: SystemAction) => {
    const actions = storage.getActions();
    actions.push(action);
    storage.saveActions(actions);
  },

  // Authentication
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },

  // Settings management
  getSettings: (): SystemSettings => {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      siteName: 'Панель администратора',
      isRegistrationOpen: false,
      isSiteOpen: true,
      maintenanceMessage: 'Сайт на техническом обслуживании',
      sessionTimeout: 30,
      afkTimeout: 5
    };
  },

  saveSettings: (settings: SystemSettings) => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Initialize default data
  initialize: () => {
    const users = storage.getUsers();
    if (users.length === 0) {
      // Create default admin user
      const defaultAdmin: User = {
        id: '1',
        login: 'admin',
        password: 'admin123',
        nickname: 'Главный администратор',
        adminLevel: 10,
        status: 'offline',
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        totalOnlineTime: 0
      };
      storage.addUser(defaultAdmin);
    }
    
    // Migrate users without totalOnlineTime
    const existingUsers = storage.getUsers();
    let needsUpdate = false;
    const updatedUsers = existingUsers.map(user => {
      if (!('totalOnlineTime' in user)) {
        needsUpdate = true;
        return { ...user, totalOnlineTime: 0 };
      }
      return user;
    });
    if (needsUpdate) {
      storage.saveUsers(updatedUsers);
    }
  }
};