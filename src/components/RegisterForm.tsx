import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { storage } from '@/lib/storage';
import { SystemAction } from '@/types';
import Icon from '@/components/ui/icon';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    nickname: '',
    login: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Check if registration is enabled
    const settings = storage.getSettings();
    if (!settings.isRegistrationOpen) {
      setError('Регистрация новых пользователей временно закрыта');
      setIsLoading(false);
      return;
    }

    // Validate form
    if (!formData.nickname.trim() || !formData.login.trim() || !formData.password.trim()) {
      setError('Заполните все обязательные поля');
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      setIsLoading(false);
      return;
    }

    // Check if login already exists
    const existingUsers = storage.getUsers();
    if (existingUsers.some(user => user.login === formData.login)) {
      setError('Пользователь с таким логином уже существует');
      setIsLoading(false);
      return;
    }

    try {
      // Create user with default admin level 1
      const newUser = await storage.createSecureUser({
        nickname: formData.nickname,
        login: formData.login,
        password: formData.password,
        adminLevel: 1, // Default level for self-registered users
        monthlyNorm: 160, // Default 160 hours per month
        email: formData.email || undefined,
        status: 'offline',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        totalOnlineTime: 0,
        totalAfkTime: 0,
        totalOfflineTime: 0,
        monthlyOnlineTime: {},
        monthlyAfkTime: {},
        monthlyOfflineTime: {},
        lastStatusTimestamp: new Date().toISOString()
      });

      // Log the action
      const action: SystemAction = {
        id: Date.now().toString(),
        adminId: 'system',
        action: 'Самостоятельная регистрация пользователя',
        target: newUser.nickname,
        timestamp: new Date().toISOString(),
        details: `Логин: ${newUser.login}, Email: ${formData.email || 'не указан'}`
      };
      storage.addAction(action);

      // Switch to login form
      onSwitchToLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при регистрации');
    }

    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
          <Icon name="UserPlus" className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-2xl">Регистрация</CardTitle>
        <CardDescription>
          Создайте новый аккаунт в системе
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Имя пользователя *</Label>
            <Input
              id="nickname"
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              placeholder="Иван Иванов"
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login">Логин *</Label>
            <Input
              id="login"
              type="text"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              placeholder="ivan_user"
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ivan@example.com"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Минимум 6 символов"
              disabled={isLoading}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Подтверждение пароля *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Повторите пароль"
              disabled={isLoading}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <Icon name="AlertCircle" className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                Создание аккаунта...
              </>
            ) : (
              <>
                <Icon name="UserPlus" className="mr-2 h-4 w-4" />
                Зарегистрироваться
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:underline font-medium"
            >
              Войти
            </button>
          </p>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800 text-center">
            <Icon name="Info" className="inline mr-1 h-3 w-3" />
            Новые пользователи получают базовый уровень доступа (1). 
            Для получения дополнительных прав обратитесь к администратору.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegisterForm;