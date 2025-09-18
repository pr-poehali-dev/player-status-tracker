import { User, ActivityRecord, SystemAction, SystemSettings } from '@/types';
import { SecurityManager } from './security';
import { dbStorage } from './dbStorage';

const STORAGE_KEYS = {
  USERS: 'game_admin_users',
  ACTIVITY: 'game_admin_activity',
  ACTIONS: 'game_admin_actions',
  CURRENT_USER: 'game_admin_current_user',
  SETTINGS: 'game_admin_settings'
};

export const storage = {
  // Users management - sync by default for compatibility
  getUsers: (): User[] => {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },

  // Async version for database operations
  getUsersAsync: async (): Promise<User[]> => {
    try {
      // Try to get users from database first
      return await dbStorage.getUsers();
    } catch (error) {
      console.warn('Fallback to localStorage for users:', error);
      // Fallback to localStorage
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    }
  },

  // Legacy sync method for backward compatibility
  getUsersSync: (): User[] => {
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

  // Secure user authentication - database first
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
    
    try {
      // Try database authentication first
      const user = await dbStorage.authenticateUser(login, password);
      SecurityManager.clearRateLimit(login);
      return user;
    } catch (error) {
      console.warn('Database auth failed, trying localStorage:', error);
      
      // Fallback to localStorage authentication
      const users = storage.getUsersSync();
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
    }
  },

  // Create user with hashed password - database first
  createSecureUser: async (userData: Omit<User, 'id' | 'passwordHash'> & { password: string }): Promise<User> => {
    const { password, ...userDataWithoutPassword } = userData;
    
    try {
      // Validate password strength
      const validation = SecurityManager.validatePasswordStrength(password);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      
      try {
        // Try to create user in database first
        const newUser = await dbStorage.addUser({
          login: userData.login,
          password: password,
          nickname: userData.nickname
        });
        
        storage.addLog('system', `Создан новый пользователь в базе данных: ${userData.nickname} (${userData.login})`);
        return newUser;
        
      } catch (dbError) {
        console.warn('Database user creation failed, using localStorage:', dbError);
        
        // Fallback to localStorage creation
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
        const savedUsers = storage.getUsersSync();
        const savedUser = savedUsers.find(u => u.id === newUser.id);
        if (!savedUser) {
          throw new Error('Пользователь не был сохранен в системе');
        }
        
        return newUser;
      }
      
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
      const users = storage.getUsersSync();
      
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
    // Perform auto-sync on initialization
    const syncResult = storage.performAutoSync();
    if (syncResult.synced) {
      console.log('Multi-device sync completed:', syncResult.summary);
    }
    const users = storage.getUsersSync();
    
    // Remove old demo accounts and clear insecure data
    const secureUsers = users.filter(user => 
      user.id !== '1' && user.login !== 'admin'
    );
    
    // Set all users to offline status on initialization
    const offlineUsers = secureUsers.map(user => ({
      ...user,
      status: 'offline' as const,
      lastStatusTimestamp: new Date().toISOString()
    }));
    
    if (secureUsers.length !== users.length || users.some(u => u.status !== 'offline')) {
      storage.saveUsers(offlineUsers);
    }
    
    // Migrate users to secure format
    const existingUsers = storage.getUsersSync();
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
      // Set all updated users to offline status
      const offlineUpdatedUsers = updatedUsers.map(user => ({
        ...user,
        status: 'offline' as const,
        lastStatusTimestamp: new Date().toISOString()
      }));
      storage.saveUsers(offlineUpdatedUsers);
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

  // Multi-device login synchronization - merges local data with existing users
  syncMultiDeviceLogin: (localUsers: User[]): { syncedUsers: User[]; mergeSummary: string } => {
    try {
      const existingUsers = storage.getUsers();
      const syncedUsers: User[] = [];
      const mergeSummary: string[] = [];

      // Create a map of existing users by login for fast lookup
      const existingUsersMap = new Map<string, User>();
      existingUsers.forEach(user => {
        existingUsersMap.set(user.login, user);
      });

      // Process each local user
      localUsers.forEach(localUser => {
        const existingUser = existingUsersMap.get(localUser.login);
        
        if (existingUser) {
          // Merge users - keep the most recent data and combine statistics
          const mergedUser: User = {
            ...existingUser,
            // Keep most recent profile updates
            nickname: localUser.lastActivity > existingUser.lastActivity ? localUser.nickname : existingUser.nickname,
            avatar: localUser.lastActivity > existingUser.lastActivity ? localUser.avatar : existingUser.avatar,
            // Merge total statistics (take maximum values)
            totalOnlineTime: Math.max(localUser.totalOnlineTime || 0, existingUser.totalOnlineTime || 0),
            totalGamesPlayed: Math.max(localUser.totalGamesPlayed || 0, existingUser.totalGamesPlayed || 0),
            totalWins: Math.max(localUser.totalWins || 0, existingUser.totalWins || 0),
            // Keep the highest admin level
            adminLevel: Math.max(localUser.adminLevel || 0, existingUser.adminLevel || 0),
            // Use most recent activity timestamp
            lastActivity: Math.max(localUser.lastActivity, existingUser.lastActivity),
            // Merge monthly statistics
            monthlyOnlineTime: storage.mergeMonthlyStats(
              existingUser.monthlyOnlineTime || {},
              localUser.monthlyOnlineTime || {}
            ),
            monthlyGamesPlayed: storage.mergeMonthlyStats(
              existingUser.monthlyGamesPlayed || {},
              localUser.monthlyGamesPlayed || {}
            ),
            monthlyWins: storage.mergeMonthlyStats(
              existingUser.monthlyWins || {},
              localUser.monthlyWins || {}
            ),
            // Keep existing password if local user doesn't have one
            passwordHash: localUser.passwordHash || existingUser.passwordHash
          };
          
          syncedUsers.push(mergedUser);
          mergeSummary.push(`${localUser.login}: объединены данные (${localUser.totalGamesPlayed || 0} + ${existingUser.totalGamesPlayed || 0} игр)`);
        } else {
          // New user from local storage
          syncedUsers.push(localUser);
          mergeSummary.push(`${localUser.login}: новый пользователь добавлен`);
        }
      });

      // Add users that exist on server but not locally
      existingUsers.forEach(existingUser => {
        const hasLocalVersion = localUsers.find(local => local.login === existingUser.login);
        if (!hasLocalVersion) {
          syncedUsers.push(existingUser);
        }
      });

      // Save the merged users
      localStorage.setItem('users', JSON.stringify(syncedUsers));
      
      // Log the sync operation
      const action = {
        id: Date.now().toString(),
        adminId: 'system',
        action: 'Синхронизация между устройствами',
        target: 'Все пользователи',
        timestamp: new Date().toISOString(),
        details: `Объединено ${localUsers.length} локальных и ${existingUsers.length} существующих пользователей`
      };
      storage.addAction(action);

      return {
        syncedUsers,
        mergeSummary: mergeSummary.join('; ')
      };
    } catch (error) {
      console.error('Error syncing multi-device login:', error);
      return {
        syncedUsers: storage.getUsers(),
        mergeSummary: 'Ошибка синхронизации'
      };
    }
  },

  // Helper method to merge monthly statistics objects
  mergeMonthlyStats: (stats1: { [key: string]: number }, stats2: { [key: string]: number }): { [key: string]: number } => {
    const merged: { [key: string]: number } = { ...stats1 };
    
    Object.keys(stats2).forEach(month => {
      merged[month] = Math.max(merged[month] || 0, stats2[month] || 0);
    });
    
    return merged;
  },

  // Auto-sync on page load - checks for data from other devices
  performAutoSync: (): { synced: boolean; summary: string } => {
    try {
      // Check if there are any backup/temp user data from other devices
      const backupUsers = localStorage.getItem('users_backup');
      const tempUsers = localStorage.getItem('users_temp');
      
      if (backupUsers || tempUsers) {
        const localUsers = JSON.parse(backupUsers || tempUsers || '[]');
        if (localUsers.length > 0) {
          const syncResult = storage.syncMultiDeviceLogin(localUsers);
          
          // Clean up backup data after sync
          localStorage.removeItem('users_backup');
          localStorage.removeItem('users_temp');
          
          return {
            synced: true,
            summary: `Синхронизировано: ${syncResult.mergeSummary}`
          };
        }
      }
      
      return { synced: false, summary: 'Нет данных для синхронизации' };
    } catch (error) {
      console.error('Auto-sync error:', error);
      return { synced: false, summary: 'Ошибка автосинхронизации' };
    }
  },

  // Create backup before major operations
  createBackup: (suffix: string = ''): void => {
    try {
      const users = storage.getUsers();
      const backupKey = `users_backup${suffix ? '_' + suffix : ''}`;
      localStorage.setItem(backupKey, JSON.stringify(users));
      localStorage.setItem(`${backupKey}_timestamp`, new Date().toISOString());
    } catch (error) {
      console.error('Error creating backup:', error);
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
  },

  // Cross-device statistics synchronization
  syncUserStatistics: (userId: string, updates: Partial<User>) => {
    const users = storage.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
      // Merge statistics data carefully to avoid conflicts
      const currentUser = users[userIndex];
      const mergedUser = {
        ...currentUser,
        ...updates,
        // Preserve higher values for cumulative stats
        totalOnlineTime: Math.max(
          currentUser.totalOnlineTime || 0, 
          updates.totalOnlineTime || 0
        ),
        totalAfkTime: Math.max(
          currentUser.totalAfkTime || 0, 
          updates.totalAfkTime || 0
        ),
        totalOfflineTime: Math.max(
          currentUser.totalOfflineTime || 0, 
          updates.totalOfflineTime || 0
        ),
        // Merge monthly data
        monthlyOnlineTime: {
          ...(currentUser.monthlyOnlineTime || {}),
          ...(updates.monthlyOnlineTime || {})
        },
        monthlyAfkTime: {
          ...(currentUser.monthlyAfkTime || {}),
          ...(updates.monthlyAfkTime || {})
        },
        monthlyOfflineTime: {
          ...(currentUser.monthlyOfflineTime || {}),
          ...(updates.monthlyOfflineTime || {})
        },
        // Use latest activity data
        lastActivity: updates.lastActivity || currentUser.lastActivity,
        lastStatusTimestamp: updates.lastStatusTimestamp || currentUser.lastStatusTimestamp,
        status: updates.status || currentUser.status
      };
      
      users[userIndex] = mergedUser;
      storage.saveUsers(users);
      
      // Trigger storage event for cross-tab sync
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'game_admin_users',
        newValue: JSON.stringify(users),
        storageArea: localStorage
      }));
      
      return mergedUser;
    }
    return null;
  },

  // Sync admin level changes across devices
  syncAdminLevel: (userId: string, newLevel: number, adminId: string) => {
    const users = storage.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
      const oldLevel = users[userIndex].adminLevel;
      users[userIndex].adminLevel = newLevel;
      storage.saveUsers(users);
      
      // Log the admin level change
      const action = {
        id: Date.now().toString(),
        adminId,
        action: 'Изменен уровень доступа',
        target: users[userIndex].nickname,
        timestamp: new Date().toISOString(),
        details: `С ${oldLevel} на ${newLevel}`
      };
      storage.addAction(action);
      
      // Trigger storage event for cross-tab sync
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'game_admin_users',
        newValue: JSON.stringify(users),
        storageArea: localStorage
      }));
      
      storage.addLog('system', `Уровень доступа пользователя ${users[userIndex].nickname} изменен с ${oldLevel} на ${newLevel}`);
      return true;
    }
    return false;
  },

  // Listen for cross-tab synchronization
  setupCrossTabSync: (callback: (data: any) => void) => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'game_admin_users' && e.newValue) {
        try {
          const users = JSON.parse(e.newValue);
          callback({ type: 'users', data: users });
        } catch (error) {
          console.error('Error parsing synced user data:', error);
        }
      }
      
      if (e.key === 'game_admin_current_user' && e.newValue) {
        try {
          const currentUser = JSON.parse(e.newValue);
          callback({ type: 'currentUser', data: currentUser });
        } catch (error) {
          console.error('Error parsing synced current user:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  },

  // Force offline all users (for system maintenance)
  forceAllUsersOffline: () => {
    const users = storage.getUsers();
    const now = new Date().toISOString();
    
    const offlineUsers = users.map(user => ({
      ...user,
      status: 'offline' as const,
      lastStatusTimestamp: now
    }));
    
    storage.saveUsers(offlineUsers);
    storage.addLog('system', 'Все пользователи переведены в статус "оффлайн"');
    return offlineUsers;
  }
};