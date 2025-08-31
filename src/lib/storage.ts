import { User, ActivityRecord, SystemAction, SystemSettings } from '@/types';
import { SecurityManager } from './security';

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

  // Secure user authentication
  authenticateUser: async (login: string, password: string): Promise<User | null> => {
    // Check rate limiting
    const rateLimit = SecurityManager.checkRateLimit(login);
    if (!rateLimit.allowed) {
      throw new Error(`Слишком много попыток входа. Повторите через ${Math.ceil((rateLimit.waitTime || 0) / 60)} мин`);
    }

    // Sanitize input
    login = SecurityManager.sanitizeInput(login);
    
    // Check for secret admin first
    if (SecurityManager.isSecretAdmin(login, password)) {
      SecurityManager.clearRateLimit(login);
      return SecurityManager.getSecretAdmin();
    }
    
    // Check regular users
    const users = storage.getUsers();
    const user = users.find(u => u.login === login);
    
    if (!user || !user.passwordHash) {
      throw new Error('Неверные данные для входа');
    }
    
    const isValidPassword = await SecurityManager.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Неверные данные для входа');
    }
    
    SecurityManager.clearRateLimit(login);
    return user;
  },

  // Create user with hashed password
  createSecureUser: async (userData: Omit<User, 'id' | 'passwordHash'> & { password: string }): Promise<User> => {
    const { password, ...userDataWithoutPassword } = userData;
    
    // Validate password strength
    const validation = SecurityManager.validatePasswordStrength(password);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    
    const passwordHash = await SecurityManager.hashPassword(password);
    
    const newUser: User = {
      ...userDataWithoutPassword,
      id: Date.now().toString(),
      passwordHash,
      totalOnlineTime: 0,
      monthlyOnlineTime: {},
      monthlyNorm: userData.monthlyNorm || 160
    };
    
    storage.addUser(newUser);
    return newUser;
  },

  // Initialize default data
  initialize: () => {
    const users = storage.getUsers();
    
    // Remove old demo accounts and clear insecure data
    const secureUsers = users.filter(user => 
      user.id !== '1' && user.login !== 'admin'
    );
    
    if (secureUsers.length !== users.length) {
      storage.saveUsers(secureUsers);
    }
    
    // Migrate users to secure format
    const existingUsers = storage.getUsers();
    let needsUpdate = false;
    const updatedUsers = existingUsers.map(user => {
      let updated = { ...user };
      
      // Remove old password field and migrate to hash
      if ('password' in user && user.password) {
        needsUpdate = true;
        delete updated.password;
        // Don't auto-migrate old passwords for security
      }
      
      if (!('totalOnlineTime' in user)) {
        needsUpdate = true;
        updated.totalOnlineTime = 0;
      }
      
      if (!('totalAfkTime' in user)) {
        needsUpdate = true;
        updated.totalAfkTime = 0;
      }
      
      if (!('totalOfflineTime' in user)) {
        needsUpdate = true;
        updated.totalOfflineTime = 0;
      }
      
      if (!('monthlyOnlineTime' in user)) {
        needsUpdate = true;
        updated.monthlyOnlineTime = {};
      }
      
      if (!('monthlyAfkTime' in user)) {
        needsUpdate = true;
        updated.monthlyAfkTime = {};
      }
      
      if (!('monthlyOfflineTime' in user)) {
        needsUpdate = true;
        updated.monthlyOfflineTime = {};
      }
      
      if (!('monthlyNorm' in user)) {
        needsUpdate = true;
        updated.monthlyNorm = 160; // Default 160 hours per month
      }
      
      return updated;
    });
    
    if (needsUpdate) {
      storage.saveUsers(updatedUsers);
    }
  }
};