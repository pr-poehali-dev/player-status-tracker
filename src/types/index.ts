export interface User {
  id: string;
  login: string;
  password?: string;
  nickname: string;
  adminLevel: number;
  status: 'online' | 'afk' | 'offline';
  lastActivity: string;
  createdAt: string;
  totalOnlineTime: number; // in milliseconds
  lastOnlineTimestamp?: string;
  monthlyOnlineTime?: { [key: string]: number }; // key: "YYYY-MM", value: milliseconds
}

export interface ActivityRecord {
  id: string;
  userId: string;
  status: 'online' | 'afk' | 'offline';
  timestamp: string;
  duration?: number; // in milliseconds
  previousStatus?: 'online' | 'afk' | 'offline';
}

export interface SystemAction {
  id: string;
  adminId: string;
  action: string;
  target?: string;
  timestamp: string;
  details?: string;
}

export interface Statistics {
  totalUsers: number;
  onlineUsers: number;
  afkUsers: number;
  offlineUsers: number;
  totalActivity: {
    online: number;
    afk: number;
    offline: number;
  };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface SystemSettings {
  siteName: string;
  isRegistrationOpen: boolean;
  isSiteOpen: boolean;
  maintenanceMessage?: string;
  sessionTimeout: number; // in minutes
  afkTimeout: number; // in minutes
}