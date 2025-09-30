import { User } from '@/types';
import { storage } from './storage';
import { authService } from './authService';

interface SyncMessage {
  type: 'status_update' | 'user_update' | 'activity_update' | 'settings_update';
  userId?: string;
  data: any;
  timestamp: number;
}

class RealtimeSync {
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, (data: any) => void> = new Map();
  private lastSyncTime = 0;
  private isActive = false;

  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.lastSyncTime = Date.now();
    
    // Синхронизация каждые 2 секунды
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, 2000);

    // Установить слушатели localStorage для кросс-табовой синхронизации
    this.setupCrossTabSync();
    
    console.log('Realtime sync started');
  }

  stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    window.removeEventListener('storage', this.handleStorageChange);
    console.log('Realtime sync stopped');
  }

  subscribe(event: string, callback: (data: any) => void) {
    this.listeners.set(event, callback);
  }

  unsubscribe(event: string) {
    this.listeners.delete(event);
  }

  private emit(event: string, data: any) {
    const callback = this.listeners.get(event);
    if (callback) {
      callback(data);
    }
  }

  private async performSync() {
    try {
      // Обновить активность текущего пользователя
      this.updateCurrentUserActivity();
      
      // Синхронизировать с базой данных
      await this.syncWithDatabase();
      
      // Обновить время последней синхронизации
      this.lastSyncTime = Date.now();
      
    } catch (error) {
      console.error('Sync error:', error);
    }
  }

  private updateCurrentUserActivity() {
    const currentUser = storage.getCurrentUser();
    if (!currentUser || currentUser.status === 'offline') return;

    const now = Date.now();
    const lastUpdate = localStorage.getItem('last_activity_update');
    const lastTime = lastUpdate ? parseInt(lastUpdate) : now;
    const timeDiff = now - lastTime;

    // Обновлять активность только если прошло больше 30 секунд
    if (timeDiff < 30000) return;

    // Обновить время активности
    const monthKey = new Date().toISOString().slice(0, 7);
    const updatedUser = { ...currentUser };

    if (currentUser.status === 'online') {
      updatedUser.totalOnlineTime = (currentUser.totalOnlineTime || 0) + timeDiff;
      updatedUser.monthlyOnlineTime = {
        ...(currentUser.monthlyOnlineTime || {}),
        [monthKey]: ((currentUser.monthlyOnlineTime || {})[monthKey] || 0) + timeDiff
      };
    } else if (currentUser.status === 'afk') {
      updatedUser.totalAfkTime = (currentUser.totalAfkTime || 0) + timeDiff;
      updatedUser.monthlyAfkTime = {
        ...(currentUser.monthlyAfkTime || {}),
        [monthKey]: ((currentUser.monthlyAfkTime || {})[monthKey] || 0) + timeDiff
      };
    }

    updatedUser.lastActivity = new Date().toISOString();
    updatedUser.lastStatusTimestamp = new Date().toISOString();

    // Сохранить в localStorage
    storage.setCurrentUser(updatedUser);
    storage.updateUser(currentUser.id, {
      totalOnlineTime: updatedUser.totalOnlineTime,
      totalAfkTime: updatedUser.totalAfkTime,
      monthlyOnlineTime: updatedUser.monthlyOnlineTime,
      monthlyAfkTime: updatedUser.monthlyAfkTime,
      lastActivity: updatedUser.lastActivity,
      lastStatusTimestamp: updatedUser.lastStatusTimestamp
    });

    localStorage.setItem('last_activity_update', now.toString());

    // Уведомить подписчиков
    this.emit('activity_updated', updatedUser);
  }

  private async syncWithDatabase() {
    try {
      // Получить обновленные данные из базы данных
      const dbUsers = await storage.getUsersAsync();
      const localUsers = storage.getUsers();

      // Мержить данные: использовать статус из БД, но сохранить локальные накопленные времена
      const mergedUsers = dbUsers.map(dbUser => {
        const localUser = localUsers.find(u => u.id === dbUser.id);
        if (!localUser) return dbUser;

        // Использовать накопленное время из localStorage (оно более актуально)
        // Но статус, admin_level и другие системные поля - из БД
        return {
          ...dbUser,
          totalOnlineTime: Math.max(localUser.totalOnlineTime || 0, dbUser.totalOnlineTime || 0),
          totalAfkTime: Math.max(localUser.totalAfkTime || 0, dbUser.totalAfkTime || 0),
          totalOfflineTime: Math.max(localUser.totalOfflineTime || 0, dbUser.totalOfflineTime || 0),
          monthlyOnlineTime: localUser.monthlyOnlineTime || dbUser.monthlyOnlineTime || {},
          monthlyAfkTime: localUser.monthlyAfkTime || dbUser.monthlyAfkTime || {},
          monthlyOfflineTime: localUser.monthlyOfflineTime || dbUser.monthlyOfflineTime || {}
        };
      });

      // Проверить изменения
      const hasChanges = this.compareUsers(mergedUsers, localUsers);
      
      if (hasChanges) {
        // Обновить локальные данные мерженными данными
        storage.saveUsers(mergedUsers);
        
        // Уведомить подписчиков
        this.emit('users_updated', mergedUsers);
        
        // Обновить текущего пользователя если нужно
        const currentUser = storage.getCurrentUser();
        if (currentUser) {
          const updatedCurrentUser = mergedUsers.find(u => u.id === currentUser.id);
          if (updatedCurrentUser && JSON.stringify(updatedCurrentUser) !== JSON.stringify(currentUser)) {
            storage.setCurrentUser(updatedCurrentUser);
            this.emit('current_user_updated', updatedCurrentUser);
          }
        }
      }

      // Синхронизировать накопленное время с backend каждую минуту
      await this.syncAccumulatedTime();
    } catch (error) {
      console.warn('Database sync failed, using localStorage only:', error);
    }
  }

  private lastTimeSyncTimestamp = 0;
  
  private async syncAccumulatedTime() {
    const now = Date.now();
    // Синхронизировать только раз в минуту
    if (now - this.lastTimeSyncTimestamp < 60000) return;
    
    this.lastTimeSyncTimestamp = now;
    
    try {
      const users = storage.getUsers();
      
      // Отправить обновления времени в backend для каждого пользователя
      for (const user of users) {
        if (!user.totalOnlineTime && !user.totalAfkTime && !user.totalOfflineTime) continue;
        
        try {
          await fetch('https://functions.poehali.dev/b4a4302a-7216-4d43-aeec-46293c611171', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_activity',
              user_id: user.id,
              total_online_time: user.totalOnlineTime || 0,
              total_afk_time: user.totalAfkTime || 0,
              total_offline_time: user.totalOfflineTime || 0,
              monthly_online_time: user.monthlyOnlineTime || {},
              monthly_afk_time: user.monthlyAfkTime || {},
              monthly_offline_time: user.monthlyOfflineTime || {}
            })
          });
        } catch (userSyncError) {
          console.warn(`Failed to sync time for user ${user.id}:`, userSyncError);
        }
      }
    } catch (error) {
      console.warn('Failed to sync accumulated time:', error);
    }
  }

  private compareUsers(dbUsers: User[], localUsers: User[]): boolean {
    if (dbUsers.length !== localUsers.length) return true;
    
    // Проверить изменения в статусах и времени активности
    for (const dbUser of dbUsers) {
      const localUser = localUsers.find(u => u.id === dbUser.id);
      if (!localUser) return true;
      
      if (dbUser.status !== localUser.status ||
          dbUser.lastActivity !== localUser.lastActivity ||
          dbUser.totalOnlineTime !== localUser.totalOnlineTime ||
          dbUser.adminLevel !== localUser.adminLevel) {
        return true;
      }
    }
    
    return false;
  }

  private setupCrossTabSync() {
    this.handleStorageChange = this.handleStorageChange.bind(this);
    window.addEventListener('storage', this.handleStorageChange);
  }

  private handleStorageChange = (e: StorageEvent) => {
    if (!e.key || !e.newValue) return;

    try {
      if (e.key === 'game_admin_users') {
        const users = JSON.parse(e.newValue);
        this.emit('users_updated', users);
      }
      
      if (e.key === 'game_admin_current_user') {
        const currentUser = JSON.parse(e.newValue);
        this.emit('current_user_updated', currentUser);
      }
      
      if (e.key === 'game_admin_settings') {
        const settings = JSON.parse(e.newValue);
        this.emit('settings_updated', settings);
      }
    } catch (error) {
      console.error('Error parsing storage change:', error);
    }
  }

  // Обновить статус пользователя
  async updateUserStatus(userId: string, newStatus: 'online' | 'afk' | 'offline') {
    const users = storage.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) return false;

    const user = users[userIndex];
    const now = new Date().toISOString();
    const currentTime = Date.now();
    
    // Рассчитать время в предыдущем статусе
    let timeInPreviousStatus = 0;
    if (user.lastStatusTimestamp) {
      timeInPreviousStatus = currentTime - new Date(user.lastStatusTimestamp).getTime();
    }

    // Обновить счетчики времени для предыдущего статуса
    const monthKey = new Date().toISOString().slice(0, 7);
    const updatedUser = { ...user };

    if (timeInPreviousStatus > 0) {
      switch (user.status) {
        case 'online':
          updatedUser.totalOnlineTime = (user.totalOnlineTime || 0) + timeInPreviousStatus;
          updatedUser.monthlyOnlineTime = {
            ...(user.monthlyOnlineTime || {}),
            [monthKey]: ((user.monthlyOnlineTime || {})[monthKey] || 0) + timeInPreviousStatus
          };
          break;
        case 'afk':
          updatedUser.totalAfkTime = (user.totalAfkTime || 0) + timeInPreviousStatus;
          updatedUser.monthlyAfkTime = {
            ...(user.monthlyAfkTime || {}),
            [monthKey]: ((user.monthlyAfkTime || {})[monthKey] || 0) + timeInPreviousStatus
          };
          break;
        case 'offline':
          updatedUser.totalOfflineTime = (user.totalOfflineTime || 0) + timeInPreviousStatus;
          updatedUser.monthlyOfflineTime = {
            ...(user.monthlyOfflineTime || {}),
            [monthKey]: ((user.monthlyOfflineTime || {})[monthKey] || 0) + timeInPreviousStatus
          };
          break;
      }
    }

    // Установить новый статус
    updatedUser.status = newStatus;
    updatedUser.lastActivity = now;
    updatedUser.lastStatusTimestamp = now;

    // Обновить в массиве
    users[userIndex] = updatedUser;
    storage.saveUsers(users);

    // Если это текущий пользователь, обновить и в currentUser
    const currentUser = storage.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      storage.setCurrentUser(updatedUser);
    }

    // Попытаться обновить в базе данных
    try {
      await storage.updateUser(userId, {
        status: newStatus,
        lastActivity: now,
        lastStatusTimestamp: now,
        totalOnlineTime: updatedUser.totalOnlineTime,
        totalAfkTime: updatedUser.totalAfkTime,
        totalOfflineTime: updatedUser.totalOfflineTime,
        monthlyOnlineTime: updatedUser.monthlyOnlineTime,
        monthlyAfkTime: updatedUser.monthlyAfkTime,
        monthlyOfflineTime: updatedUser.monthlyOfflineTime
      });
    } catch (error) {
      console.warn('Failed to update user in database:', error);
    }

    // Уведомить подписчиков
    this.emit('status_updated', { userId, status: newStatus, user: updatedUser });
    
    // Добавить запись активности
    storage.addActivity({
      id: Date.now().toString(),
      userId,
      status: newStatus,
      timestamp: now,
      duration: timeInPreviousStatus
    });

    return true;
  }

  // Получить текущую статистику активности
  getActivityStats(): { online: number; afk: number; offline: number } {
    const users = storage.getUsers();
    return {
      online: users.filter(u => u.status === 'online').length,
      afk: users.filter(u => u.status === 'afk').length,
      offline: users.filter(u => u.status === 'offline').length
    };
  }
}

export const realtimeSync = new RealtimeSync();