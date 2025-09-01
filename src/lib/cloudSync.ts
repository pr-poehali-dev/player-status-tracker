/**
 * Облачная синхронизация пользователей между устройствами
 */

import { User, SystemAction } from '@/types';
import { storage } from './storage';

// Эмуляция облачного хранилища через localStorage с уникальными ключами
const CLOUD_STORAGE_KEY = 'poehali_cloud_users';
const SYNC_METADATA_KEY = 'poehali_sync_metadata';
const LAST_SYNC_KEY = 'poehali_last_sync';

interface CloudUser extends User {
  password: string;
  email?: string;
  cloudId: string; // Уникальный идентификатор в облаке
  devices: string[]; // Список устройств где был вход
  lastSyncTimestamp: number;
  syncVersion: number; // Версия для разрешения конфликтов
}

interface SyncMetadata {
  lastSyncTimestamp: number;
  deviceId: string;
  totalUsers: number;
  version: number;
}

class CloudSyncManager {
  private deviceId: string;
  private syncInProgress = false;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
  }

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  // Регистрация нового пользователя
  async registerUser(username: string, password: string, email?: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      // Проверяем доступность username в облаке
      const cloudUsers = this.getCloudUsers();
      const existingUser = cloudUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      
      if (existingUser) {
        return { success: false, error: 'Пользователь с таким именем уже существует' };
      }

      // Создаем нового пользователя
      const newUser: User = {
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        username,
        firstName: username,
        lastName: '',
        role: 'guest',
        adminLevel: 0,
        status: 'offline',
        isOnline: false,
        lastActivity: Date.now(),
        lastSeen: Date.now(),
        joinedAt: Date.now(),
        gamesPlayed: 0,
        gamesWon: 0,
        totalOnlineTime: 0,
        monthlyStats: {
          [new Date().toISOString().slice(0, 7)]: {
            gamesPlayed: 0,
            gamesWon: 0,
            onlineTime: 0
          }
        },
        isBlocked: false
      };

      // Создаем облачную версию пользователя
      const cloudUser: CloudUser = {
        ...newUser,
        password: await this.hashPassword(password),
        email,
        cloudId: newUser.id,
        devices: [this.deviceId],
        lastSyncTimestamp: Date.now(),
        syncVersion: 1
      };

      // Сохраняем в облако
      cloudUsers.push(cloudUser);
      this.setCloudUsers(cloudUsers);

      // Сохраняем локально (без пароля)
      storage.saveUser(newUser);

      // Логируем регистрацию
      const action: SystemAction = {
        id: 'action_' + Date.now(),
        type: 'user_registered',
        timestamp: Date.now(),
        performedBy: newUser.id,
        details: `Пользователь ${username} зарегистрирован с устройства ${this.deviceId}`,
        severity: 'info'
      };
      storage.logSystemAction(action);

      return { success: true, user: newUser };
    } catch (error) {
      return { success: false, error: 'Ошибка при регистрации' };
    }
  }

  // Вход по логину и паролю
  async loginUser(username: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const cloudUsers = this.getCloudUsers();
      const cloudUser = cloudUsers.find(u => u.username.toLowerCase() === username.toLowerCase());

      if (!cloudUser) {
        return { success: false, error: 'Неверный логин или пароль' };
      }

      // Проверяем пароль
      const passwordValid = await this.verifyPassword(password, cloudUser.password);
      if (!passwordValid) {
        return { success: false, error: 'Неверный логин или пароль' };
      }

      // Обновляем информацию об устройстве
      if (!cloudUser.devices.includes(this.deviceId)) {
        cloudUser.devices.push(this.deviceId);
      }
      
      cloudUser.lastActivity = Date.now();
      cloudUser.lastSeen = Date.now();
      cloudUser.status = 'online';
      cloudUser.isOnline = true;
      cloudUser.lastSyncTimestamp = Date.now();
      cloudUser.syncVersion += 1;

      // Сохраняем обновленные данные в облако
      const updatedCloudUsers = cloudUsers.map(u => u.cloudId === cloudUser.cloudId ? cloudUser : u);
      this.setCloudUsers(updatedCloudUsers);

      // Создаем локальную версию пользователя (без пароля)
      const localUser: User = {
        id: cloudUser.id,
        username: cloudUser.username,
        firstName: cloudUser.firstName,
        lastName: cloudUser.lastName,
        role: cloudUser.role,
        adminLevel: cloudUser.adminLevel,
        status: cloudUser.status,
        isOnline: cloudUser.isOnline,
        lastActivity: cloudUser.lastActivity,
        lastSeen: cloudUser.lastSeen,
        joinedAt: cloudUser.joinedAt,
        gamesPlayed: cloudUser.gamesPlayed,
        gamesWon: cloudUser.gamesWon,
        totalOnlineTime: cloudUser.totalOnlineTime,
        monthlyStats: cloudUser.monthlyStats,
        isBlocked: cloudUser.isBlocked,
        blockReason: cloudUser.blockReason,
        blockedAt: cloudUser.blockedAt
      };

      // Синхронизируем данные с устройством
      await this.syncUserData(localUser);

      // Логируем вход
      const action: SystemAction = {
        id: 'action_' + Date.now(),
        type: 'user_login',
        timestamp: Date.now(),
        performedBy: localUser.id,
        details: `Пользователь ${username} вошел с устройства ${this.deviceId}`,
        severity: 'info'
      };
      storage.logSystemAction(action);

      return { success: true, user: localUser };
    } catch (error) {
      return { success: false, error: 'Ошибка при входе' };
    }
  }

  // Синхронизация данных пользователя
  private async syncUserData(user: User): Promise<void> {
    try {
      this.syncInProgress = true;

      // Получаем текущих локальных пользователей
      const localUsers = storage.getAllUsers();
      const existingUser = localUsers.find(u => u.id === user.id);

      if (existingUser) {
        // Обновляем существующего пользователя
        const mergedUser = this.mergeUserData(existingUser, user);
        storage.updateUser(mergedUser.id, mergedUser);
      } else {
        // Добавляем нового пользователя
        storage.saveUser(user);
      }

      // Синхронизируем других пользователей с облаком
      await this.syncAllUsers();
      
    } finally {
      this.syncInProgress = false;
    }
  }

  // Полная синхронизация всех пользователей
  async syncAllUsers(): Promise<void> {
    if (this.syncInProgress) return;

    try {
      this.syncInProgress = true;
      const cloudUsers = this.getCloudUsers();
      const localUsers = storage.getAllUsers();

      // Синхронизируем каждого облачного пользователя
      for (const cloudUser of cloudUsers) {
        const localUser = localUsers.find(u => u.id === cloudUser.cloudId);
        
        if (!localUser) {
          // Добавляем нового пользователя локально
          const newLocalUser: User = this.cloudUserToLocal(cloudUser);
          storage.saveUser(newLocalUser);
        } else if (cloudUser.lastSyncTimestamp > localUser.lastActivity) {
          // Обновляем локального пользователя данными из облака
          const updatedUser = this.mergeUserData(localUser, this.cloudUserToLocal(cloudUser));
          storage.updateUser(updatedUser.id, updatedUser);
        }
      }

      // Обновляем метаданные синхронизации
      this.updateSyncMetadata();

    } finally {
      this.syncInProgress = false;
    }
  }

  // Автоматическое обновление статуса активности
  startActivitySync(): void {
    // Обновляем статус каждые 30 секунд
    setInterval(() => {
      this.syncUserActivity();
    }, 30000);

    // Обновляем при фокусе/потере фокуса окна
    document.addEventListener('visibilitychange', () => {
      this.syncUserActivity();
    });

    // Обновляем при активности пользователя
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        this.throttledActivityUpdate();
      }, { passive: true });
    });
  }

  private throttledActivityUpdate = this.throttle(() => {
    this.syncUserActivity();
  }, 10000); // Максимум раз в 10 секунд

  private async syncUserActivity(): Promise<void> {
    const currentUser = storage.getCurrentUser();
    if (!currentUser) return;

    const cloudUsers = this.getCloudUsers();
    const cloudUser = cloudUsers.find(u => u.cloudId === currentUser.id);
    
    if (cloudUser) {
      const isActive = !document.hidden;
      const now = Date.now();
      
      cloudUser.lastActivity = now;
      cloudUser.lastSeen = now;
      cloudUser.status = isActive ? 'online' : 'away';
      cloudUser.isOnline = isActive;
      cloudUser.lastSyncTimestamp = now;
      
      // Обновляем время онлайн
      if (isActive) {
        cloudUser.totalOnlineTime += 30; // 30 секунд
        
        // Обновляем месячную статистику
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (!cloudUser.monthlyStats[currentMonth]) {
          cloudUser.monthlyStats[currentMonth] = {
            gamesPlayed: 0,
            gamesWon: 0,
            onlineTime: 0
          };
        }
        cloudUser.monthlyStats[currentMonth].onlineTime += 30;
      }

      // Сохраняем в облако
      const updatedCloudUsers = cloudUsers.map(u => u.cloudId === cloudUser.cloudId ? cloudUser : u);
      this.setCloudUsers(updatedCloudUsers);

      // Обновляем локально
      const localUser = this.cloudUserToLocal(cloudUser);
      storage.updateUser(localUser.id, localUser);
    }
  }

  // Выход пользователя
  async logoutUser(userId: string): Promise<void> {
    const cloudUsers = this.getCloudUsers();
    const cloudUser = cloudUsers.find(u => u.cloudId === userId);
    
    if (cloudUser) {
      cloudUser.status = 'offline';
      cloudUser.isOnline = false;
      cloudUser.lastSeen = Date.now();
      cloudUser.lastSyncTimestamp = Date.now();
      
      const updatedCloudUsers = cloudUsers.map(u => u.cloudId === cloudUser.cloudId ? cloudUser : u);
      this.setCloudUsers(updatedCloudUsers);

      // Логируем выход
      const action: SystemAction = {
        id: 'action_' + Date.now(),
        type: 'user_logout',
        timestamp: Date.now(),
        performedBy: userId,
        details: `Пользователь вышел с устройства ${this.deviceId}`,
        severity: 'info'
      };
      storage.logSystemAction(action);
    }
  }

  // Получение статистики синхронизации
  getSyncStatus(): {
    lastSync: number | null;
    deviceId: string;
    cloudUsers: number;
    localUsers: number;
    syncInProgress: boolean;
  } {
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    const localUsers = storage.getAllUsers();
    const cloudUsers = this.getCloudUsers();

    return {
      lastSync: lastSync ? parseInt(lastSync) : null,
      deviceId: this.deviceId,
      cloudUsers: cloudUsers.length,
      localUsers: localUsers.length,
      syncInProgress: this.syncInProgress
    };
  }

  // Вспомогательные методы
  private getCloudUsers(): CloudUser[] {
    const data = localStorage.getItem(CLOUD_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  private setCloudUsers(users: CloudUser[]): void {
    localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(users));
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  }

  private cloudUserToLocal(cloudUser: CloudUser): User {
    return {
      id: cloudUser.id,
      username: cloudUser.username,
      firstName: cloudUser.firstName,
      lastName: cloudUser.lastName,
      role: cloudUser.role,
      adminLevel: cloudUser.adminLevel,
      status: cloudUser.status,
      isOnline: cloudUser.isOnline,
      lastActivity: cloudUser.lastActivity,
      lastSeen: cloudUser.lastSeen,
      joinedAt: cloudUser.joinedAt,
      gamesPlayed: cloudUser.gamesPlayed,
      gamesWon: cloudUser.gamesWon,
      totalOnlineTime: cloudUser.totalOnlineTime,
      monthlyStats: cloudUser.monthlyStats,
      isBlocked: cloudUser.isBlocked,
      blockReason: cloudUser.blockReason,
      blockedAt: cloudUser.blockedAt
    };
  }

  private mergeUserData(local: User, cloud: User): User {
    return {
      ...local,
      ...cloud,
      gamesPlayed: Math.max(local.gamesPlayed || 0, cloud.gamesPlayed || 0),
      gamesWon: Math.max(local.gamesWon || 0, cloud.gamesWon || 0),
      totalOnlineTime: Math.max(local.totalOnlineTime || 0, cloud.totalOnlineTime || 0),
      adminLevel: Math.max(local.adminLevel || 0, cloud.adminLevel || 0),
      lastActivity: Math.max(local.lastActivity || 0, cloud.lastActivity || 0),
      monthlyStats: {
        ...local.monthlyStats,
        ...cloud.monthlyStats
      }
    };
  }

  private updateSyncMetadata(): void {
    const metadata: SyncMetadata = {
      lastSyncTimestamp: Date.now(),
      deviceId: this.deviceId,
      totalUsers: this.getCloudUsers().length,
      version: 1
    };
    localStorage.setItem(SYNC_METADATA_KEY, JSON.stringify(metadata));
  }

  private async hashPassword(password: string): Promise<string> {
    // Простая имитация хеширования (в реальном приложении использовать bcrypt)
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'poehali_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const hashedInput = await this.hashPassword(password);
    return hashedInput === hashedPassword;
  }

  private throttle(func: Function, delay: number) {
    let timeoutId: NodeJS.Timeout;
    let lastExecTime = 0;
    
    return (...args: any[]) => {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func(...args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func(...args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }
}

export const cloudSync = new CloudSyncManager();