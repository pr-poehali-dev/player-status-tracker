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
      // Verify data integrity before registration
      const integrity = storage.verifyDataIntegrity();
      if (!integrity.valid) {
        console.warn('Проблемы с целостностью данных:', integrity.issues);
        // Try to restore from backup if needed
        storage.restoreUsersFromBackup();
      }

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
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center space-y-3 pb-4">
        <div className="mx-auto w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center shadow-md">
          <Icon name="UserPlus" className="h-7 w-7 text-white" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl sm:text-2xl font-bold">Регистрация</CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-600">
            Создайте новый аккаунт в системе
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nickname" className="text-sm font-medium">Имя пользователя *</Label>
              <Input
                id="nickname"
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="Иван Иванов"
                disabled={isLoading}
                required
                className="h-11 text-base"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login" className="text-sm font-medium">Логин *</Label>
              <Input
                id="login"
                type="text"
                value={formData.login}
                onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                placeholder="ivan_user"
                disabled={isLoading}
                required
                className="h-11 text-base"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="ivan@example.com"
                disabled={isLoading}
                className="h-11 text-base"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Пароль *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Минимум 6 символов"
                disabled={isLoading}
                required
                minLength={6}
                className="h-11 text-base"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Подтверждение *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Повторите пароль"
                disabled={isLoading}
                required
                className="h-11 text-base"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <Icon name="AlertCircle" className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium bg-green-600 hover:bg-green-700 shadow-md mt-6" 
            disabled={isLoading}
          >
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

        <div className="mt-6 space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-gray-500">уже есть аккаунт?</span>
            </div>
          </div>
          
          <Button
            type="button"
            variant="outline"
            onClick={onSwitchToLogin}
            className="w-full h-11 text-sm font-medium border-2 hover:bg-gray-50"
          >
            <Icon name="LogIn" className="mr-2 h-4 w-4" />
            Войти
          </Button>
        </div>

        <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
          <div className="flex items-start space-x-3">
            <Icon name="Info" className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-900 mb-1">О регистрации:</p>
              <p className="text-xs text-green-700">
                Новые пользователи получают базовый уровень доступа (1). Для получения дополнительных прав обратитесь к администратору.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegisterForm;