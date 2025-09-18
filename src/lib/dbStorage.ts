import { User, ActivityRecord, SystemAction, SystemSettings } from '@/types';

const API_BASE_URL = 'https://functions.poehali.dev/82159b36-f18d-4b29-acc5-1cf566125032';

class DatabaseStorage {
  // Users management
  async getUsers(): Promise<User[]> {
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async addUser(userData: { login: string; password: string; nickname: string }): Promise<User> {
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          ...userData
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Получить полные данные пользователя после создания
      const userResponse = await fetch(`${API_BASE_URL}?id=${result.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (userResponse.ok) {
        return await userResponse.json();
      }
      
      // Если не удалось получить полные данные, вернуть базовую информацию
      return {
        id: result.id,
        login: result.login,
        nickname: result.nickname,
        adminLevel: 0,
        status: 'offline',
        totalOnlineTime: 0,
        totalAfkTime: 0,
        totalOfflineTime: 0,
        monthlyNorm: 160,
        isBlocked: false,
        createdAt: new Date().toISOString(),
        activityHistory: [],
        monthlyOnlineTime: {},
        monthlyAfkTime: {},
        monthlyOfflineTime: {}
      } as User;
    } catch (error) {
      console.error('Error adding user:', error);
      throw error;
    }
  }

  async authenticateUser(login: string, password: string): Promise<User | null> {
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          login,
          password
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка аутентификации');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error authenticating user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...updates
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Fallback methods for compatibility with existing code
  // These will use localStorage as temporary storage until full migration

  saveUsers(users: User[]): void {
    localStorage.setItem('game_admin_users', JSON.stringify(users));
  }

  deleteUser(userId: string): void {
    const users = this.getUsersFromLocalStorage();
    const filteredUsers = users.filter(u => u.id !== userId);
    this.saveUsers(filteredUsers);
  }

  // Activity management (temporarily using localStorage)
  getActivity(): ActivityRecord[] {
    const data = localStorage.getItem('game_admin_activity');
    return data ? JSON.parse(data) : [];
  }

  saveActivity(activity: ActivityRecord[]): void {
    localStorage.setItem('game_admin_activity', JSON.stringify(activity));
  }

  addActivity(record: ActivityRecord): void {
    const activity = this.getActivity();
    activity.push(record);
    this.saveActivity(activity);
  }

  // System actions (temporarily using localStorage)
  getActions(): SystemAction[] {
    const data = localStorage.getItem('game_admin_actions');
    return data ? JSON.parse(data) : [];
  }

  saveActions(actions: SystemAction[]): void {
    localStorage.setItem('game_admin_actions', JSON.stringify(actions));
  }

  addAction(action: SystemAction): void {
    const actions = this.getActions();
    actions.push(action);
    this.saveActions(actions);
  }

  // Authentication (hybrid approach)
  getCurrentUser(): User | null {
    const data = localStorage.getItem('game_admin_current_user');
    return data ? JSON.parse(data) : null;
  }

  setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem('game_admin_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('game_admin_current_user');
    }
  }

  // Settings management (temporarily using localStorage)
  getSettings(): SystemSettings {
    const data = localStorage.getItem('game_admin_settings');
    return data ? JSON.parse(data) : {
      siteName: 'Панель администратора',
      isRegistrationOpen: false,
      isSiteOpen: true,
      maintenanceMessage: 'Сайт на техническом обслуживании',
      emergencyCode: undefined,
      unblockCodes: [],
      sessionTimeout: 30,
      afkTimeout: 5,
      minimumMonthlyNorm: 160
    };
  }

  saveSettings(settings: SystemSettings): void {
    localStorage.setItem('game_admin_settings', JSON.stringify(settings));
  }

  // Helper method to get users from localStorage (for migration/fallback)
  private getUsersFromLocalStorage(): User[] {
    const data = localStorage.getItem('game_admin_users');
    return data ? JSON.parse(data) : [];
  }

  // Migration helper - sync localStorage users to database
  async migrateToDatabase(): Promise<{ success: boolean; message: string }> {
    try {
      const localUsers = this.getUsersFromLocalStorage();
      const dbUsers = await this.getUsers();
      
      let migratedCount = 0;
      let errors: string[] = [];
      
      for (const localUser of localUsers) {
        // Check if user already exists in database
        const existsInDb = dbUsers.find(u => u.login === localUser.login);
        
        if (!existsInDb && 'password' in localUser) {
          try {
            await this.addUser({
              login: localUser.login,
              password: (localUser as any).password || 'defaultpass123',
              nickname: localUser.nickname
            });
            migratedCount++;
          } catch (error) {
            errors.push(`${localUser.login}: ${error}`);
          }
        }
      }
      
      return {
        success: true,
        message: `Мигрировано ${migratedCount} пользователей. Ошибки: ${errors.length}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Ошибка миграции: ${error}`
      };
    }
  }

  // Logging (temporarily using localStorage)
  addLog(type: string, message: string): void {
    const logs = this.getLogs();
    const logEntry = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date().toISOString()
    };
    logs.push(logEntry);
    localStorage.setItem('gameLogs', JSON.stringify(logs));
  }

  getLogs() {
    const data = localStorage.getItem('gameLogs');
    return data ? JSON.parse(data) : [];
  }

  // Methods that will be implemented later for full database support
  blockUser(userId: string, reason: string, adminId: string): boolean {
    // TODO: Implement database version
    return false;
  }

  unblockUser(userId: string, adminId: string): boolean {
    // TODO: Implement database version  
    return false;
  }

  initialize(): void {
    // Database initialization will be handled by the backend
    console.log('Database storage initialized');
  }
}

export const dbStorage = new DatabaseStorage();