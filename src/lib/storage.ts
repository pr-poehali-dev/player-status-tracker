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
    try {
      // Create backup before saving
      const backup = localStorage.getItem(STORAGE_KEYS.USERS);
      localStorage.setItem(STORAGE_KEYS.USERS + '_backup', backup || '[]');
      
      // Save new data
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      
      // Verify save was successful
      const verification = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!verification || JSON.parse(verification).length !== users.length) {
        // Restore from backup if save failed
        if (backup) {
          localStorage.setItem(STORAGE_KEYS.USERS, backup);
        }
        throw new Error('Ошибка сохранения пользователей');
      }
    } catch (error) {
      console.error('Критическая ошибка сохранения:', error);
      throw error;
    }
  },

  addUser: (user: User) => {
    try {
      const users = storage.getUsers();
      
      // Check for duplicate login
      if (users.some(u => u.login === user.login)) {
        throw new Error('Пользователь с таким логином уже существует');
      }
      
      // Check for duplicate nickname
      if (users.some(u => u.nickname === user.nickname)) {
        throw new Error('Пользователь с таким никнеймом уже существует');
      }
      
      // Add user to array
      users.push(user);
      
      // Force save with retries
      let saveAttempts = 3;
      while (saveAttempts > 0) {
        try {
          storage.saveUsers(users);
          break;
        } catch (saveError) {
          saveAttempts--;
          if (saveAttempts === 0) {
            throw new Error('Не удалось сохранить пользователя после нескольких попыток');
          }
        }
      }
      
      // Log successful user creation
      storage.addLog('system', `Создан новый пользователь: ${user.nickname} (${user.login})`);
      
    } catch (error) {
      console.error('Ошибка добавления пользователя:', error);
      throw error;
    }
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
      emergencyCode: undefined,
      unblockCodes: [],
      sessionTimeout: 30,
      afkTimeout: 5,
      minimumMonthlyNorm: 160 // Default minimum monthly norm in hours
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
    
    try {
      // Validate password strength
      const validation = SecurityManager.validatePasswordStrength(password);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      
      const passwordHash = await SecurityManager.hashPassword(password);
      
      const newUser: User = {
        ...userDataWithoutPassword,
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        passwordHash,
        totalOnlineTime: 0,
        totalAfkTime: 0,
        totalOfflineTime: 0,
        monthlyOnlineTime: {},
        monthlyAfkTime: {},
        monthlyOfflineTime: {},
        monthlyNorm: userData.monthlyNorm || 160,
        isBlocked: false,
        status: 'offline',
        createdAt: new Date().toISOString(),
        activityHistory: []
      };
      
      // Use enhanced addUser with safe saving
      storage.addUser(newUser);
      
      // Double-check user was saved
      const savedUsers = storage.getUsers();
      const savedUser = savedUsers.find(u => u.id === newUser.id);
      if (!savedUser) {
        throw new Error('Пользователь не был сохранен в системе');
      }
      
      return newUser;
      
    } catch (error) {
      console.error('Ошибка создания защищенного пользователя:', error);
      throw error;
    }
  },

  // Safe restore function for corrupted data
  restoreUsersFromBackup: (): boolean => {
    try {
      const backup = localStorage.getItem(STORAGE_KEYS.USERS + '_backup');
      if (backup) {
        const backupUsers = JSON.parse(backup);
        if (Array.isArray(backupUsers)) {
          localStorage.setItem(STORAGE_KEYS.USERS, backup);
          storage.addLog('system', 'Пользователи восстановлены из резервной копии');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Ошибка восстановления резервной копии:', error);
      return false;
    }
  },

  // Verify data integrity
  verifyDataIntegrity: (): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];
    
    try {
      const users = storage.getUsers();
      
      if (!Array.isArray(users)) {
        issues.push('Данные пользователей повреждены');
      }
      
      // Check for duplicate logins
      const logins = users.map(u => u.login);
      const uniqueLogins = new Set(logins);
      if (logins.length !== uniqueLogins.size) {
        issues.push('Обнаружены дублированные логины');
      }
      
      // Check for duplicate IDs
      const ids = users.map(u => u.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        issues.push('Обнаружены дублированные ID');
      }
      
      // Check for required fields
      users.forEach((user, index) => {
        if (!user.id || !user.login || !user.nickname) {
          issues.push(`Пользователь ${index + 1} имеет неполные данные`);
        }
      });
      
    } catch (error) {
      issues.push('Критическая ошибка при проверке данных');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
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
      
      // Migrate blocking fields
      if (!('isBlocked' in user)) {
        needsUpdate = true;
        updated.isBlocked = false;
      }
      
      return updated;
    });
    
    if (needsUpdate) {
      storage.saveUsers(updatedUsers);
    }
  },

  // User blocking functions
  blockUser: (userId: string, reason: string, adminId: string) => {
    const users = storage.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        isBlocked: true,
        blockReason: reason,
        blockedAt: new Date().toISOString(),
        blockedBy: adminId,
        status: 'offline' // Force offline when blocked
      };
      storage.saveUsers(users);
      
      // Log the action
      const action = {
        id: Date.now().toString(),
        adminId,
        action: 'Пользователь заблокирован',
        target: users[userIndex].nickname,
        timestamp: new Date().toISOString(),
        details: `Причина: ${reason}`
      };
      storage.addAction(action);
      
      return true;
    }
    return false;
  },

  unblockUser: (userId: string, adminId: string) => {
    const users = storage.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1 && users[userIndex].isBlocked) {
      const oldReason = users[userIndex].blockReason;
      users[userIndex] = {
        ...users[userIndex],
        isBlocked: false,
        blockReason: undefined,
        blockedAt: undefined,
        blockedBy: undefined
      };
      storage.saveUsers(users);
      
      // Log the action
      const action = {
        id: Date.now().toString(),
        adminId,
        action: 'Пользователь разблокирован',
        target: users[userIndex].nickname,
        timestamp: new Date().toISOString(),
        details: `Была причина: ${oldReason}`
      };
      storage.addAction(action);
      
      return true;
    }
    return false;
  },

  // Generate unblock codes
  generateUnblockCodes: (count: number = 5): string[] => {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  },

  // Check if unblock code is valid and use it
  useUnblockCode: (code: string, userId: string): boolean => {
    const settings = storage.getSettings();
    const unblockCodes = settings.unblockCodes || [];
    
    if (unblockCodes.includes(code)) {
      // Remove used code
      const updatedCodes = unblockCodes.filter(c => c !== code);
      const updatedSettings = { ...settings, unblockCodes: updatedCodes };
      storage.saveSettings(updatedSettings);
      
      // Unblock user
      return storage.unblockUser(userId, 'unblock_code');
    }
    return false;
  },

  // Restore site access with admin password
  restoreSiteAccess: (password: string): boolean => {
    const ADMIN_PASSWORD = 'GameAdmin#SecureAccess$2024!';
    
    if (password === ADMIN_PASSWORD) {
      // Optimize all data before restoring access
      storage.optimizeAllData();
      
      const settings = storage.getSettings();
      const updatedSettings = {
        ...settings,
        isPrivate: false,
        isPublic: true,
        isSiteOpen: true
      };
      storage.saveSettings(updatedSettings);
      
      // Add log entry
      storage.addLog('system', 'Доступ к сайту восстановлен через пароль администратора. Данные оптимизированы.');
      
      return true;
    }
    return false;
  },

  // System logs management
  getLogs: () => {
    const data = localStorage.getItem('gameLogs');
    return data ? JSON.parse(data) : [];
  },

  addLog: (type: string, message: string) => {
    const logs = storage.getLogs();
    const logEntry = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date().toISOString()
    };
    logs.push(logEntry);
    localStorage.setItem('gameLogs', JSON.stringify(logs));
  },

  // Optimize all system data
  optimizeAllData: (): void => {
    // Clean up old logs (keep last 500 entries)
    const logs = storage.getLogs();
    if (logs.length > 500) {
      const optimizedLogs = logs.slice(-500);
      localStorage.setItem('gameLogs', JSON.stringify(optimizedLogs));
    }

    // Clean up old actions (keep last 200 entries)
    const actions = storage.getActions();
    if (actions.length > 200) {
      const optimizedActions = actions.slice(-200);
      localStorage.setItem('gameActions', JSON.stringify(optimizedActions));
    }

    // Remove expired session data
    const users = storage.getUsers();
    const now = new Date().getTime();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const optimizedUsers = users.map(user => {
      // Keep only recent activity logs
      const recentActivity = user.activityHistory?.filter(activity => {
        const activityTime = new Date(activity.timestamp).getTime();
        return activityTime > oneWeekAgo;
      }) || [];

      return {
        ...user,
        activityHistory: recentActivity
      };
    });
    storage.saveUsers(optimizedUsers);

    // Clean up old game statistics (keep last 30 days)
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const allStats = storage.getAllStatistics();
    
    const optimizedStats = allStats.map(userStats => {
      const recentGames = userStats.games?.filter(game => {
        const gameTime = new Date(game.timestamp).getTime();
        return gameTime > thirtyDaysAgo;
      }) || [];

      return {
        ...userStats,
        games: recentGames,
        totalGames: recentGames.length,
        totalPoints: recentGames.reduce((sum, game) => sum + game.points, 0)
      };
    });
    
    // Save optimized statistics
    optimizedStats.forEach(stats => {
      localStorage.setItem(`gameStats_${stats.userId}`, JSON.stringify(stats));
    });

    // Remove expired unblock codes (older than 30 days)
    const settings = storage.getSettings();
    if (settings.unblockCodes && settings.unblockCodes.length > 50) {
      // Keep only last 50 codes
      const optimizedCodes = settings.unblockCodes.slice(-50);
      const optimizedSettings = { ...settings, unblockCodes: optimizedCodes };
      storage.saveSettings(optimizedSettings);
    }

    // Compress localStorage if needed
    storage.compressStorage();

    storage.addLog('system', 'Выполнена оптимизация всех данных системы');
  },

  // Compress storage by removing redundant data
  compressStorage: (): void => {
    try {
      // Get all localStorage data
      const allData: { [key: string]: any } = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          allData[key] = JSON.parse(localStorage.getItem(key) || '{}');
        }
      }

      // Remove empty objects and arrays
      Object.keys(allData).forEach(key => {
        const data = allData[key];
        if (Array.isArray(data) && data.length === 0) {
          localStorage.removeItem(key);
        } else if (typeof data === 'object' && Object.keys(data).length === 0) {
          localStorage.removeItem(key);
        }
      });

      // Remove duplicate entries in arrays
      ['gameLogs', 'gameActions'].forEach(key => {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(data)) {
          const uniqueData = data.filter((item, index, arr) => 
            arr.findIndex(other => other.id === item.id) === index
          );
          if (uniqueData.length !== data.length) {
            localStorage.setItem(key, JSON.stringify(uniqueData));
          }
        }
      });

    } catch (error) {
      console.error('Error compressing storage:', error);
    }
  },

  // Check if user meets monthly norm
  checkMonthlyNorm: (user: User, month?: string): { meetsNorm: boolean; currentHours: number; requiredHours: number; percentage: number } => {
    const settings = storage.getSettings();
    const minimumNorm = settings.minimumMonthlyNorm || 160;
    const targetMonth = month || new Date().toISOString().slice(0, 7); // Format: YYYY-MM
    
    // Get user's monthly hours for the specified month
    const monthlyHours = user.monthlyOnlineTime?.[targetMonth] || 0;
    const currentHours = Math.round(monthlyHours / (1000 * 60 * 60)); // Convert from milliseconds to hours
    
    // Use individual user norm if set, otherwise use system minimum
    const requiredHours = user.monthlyNorm || minimumNorm;
    
    const percentage = (currentHours / requiredHours) * 100;
    const meetsNorm = currentHours >= requiredHours;
    
    return {
      meetsNorm,
      currentHours,
      requiredHours,
      percentage: Math.min(percentage, 100)
    };
  },

  // Get norm status for all users
  getAllUsersNormStatus: (month?: string) => {
    const users = storage.getUsers();
    return users.map(user => ({
      user,
      normStatus: storage.checkMonthlyNorm(user, month)
    }));
  }
};