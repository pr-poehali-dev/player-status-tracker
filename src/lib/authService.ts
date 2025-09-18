import { User } from '@/types';

const AUTH_API_URL = 'https://functions.poehali.dev/0d0526fa-dd23-4e3e-b173-d74b5d3d14f1';

interface LoginResponse {
  success: boolean;
  user?: User;
  error?: string;
}

interface RegisterResponse {
  success: boolean;
  user?: {
    id: string;
    login: string;
    nickname: string;
    adminLevel: number;
  };
  message?: string;
  error?: string;
}

export const authService = {
  async login(login: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(AUTH_API_URL, {
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
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Ошибка входа'
        };
      }
      
      if (data.success && data.user) {
        return {
          success: true,
          user: data.user
        };
      }
      
      return {
        success: false,
        error: 'Неверный ответ сервера'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  async register(login: string, password: string, nickname: string, email?: string): Promise<RegisterResponse> {
    try {
      const response = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          login,
          password,
          nickname,
          email
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Ошибка регистрации'
        };
      }
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: 'Ошибка подключения к серверу'
      };
    }
  },

  async logout(userId: string): Promise<void> {
    try {
      await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'logout',
          userId
        }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  async getSystemInfo(): Promise<{totalUsers: number; onlineUsers: number; registrationEnabled: boolean} | null> {
    try {
      const response = await fetch(AUTH_API_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data.system || null;
    } catch (error) {
      console.error('Get system info error:', error);
      return null;
    }
  }
};