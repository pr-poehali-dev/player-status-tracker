export interface User {
  id: string;
  login: string;
  password?: string;
  nickname: string;
  adminLevel: number;
  status: 'online' | 'afk' | 'offline';
  lastActivity: string;
  createdAt: string;
}

export interface ActivityRecord {
  id: string;
  userId: string;
  status: 'online' | 'afk' | 'offline';
  timestamp: string;
  duration?: number;
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