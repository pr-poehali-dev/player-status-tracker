import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { storage } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { SystemAction } from '@/types';
import Icon from '@/components/ui/icon';

interface CreateUserFormProps {
  onUserCreated?: () => void;
}

const CreateUserForm: React.FC<CreateUserFormProps> = ({ onUserCreated }) => {
  const [formData, setFormData] = useState({
    nickname: '',
    login: '',
    password: '',
    adminLevel: 1,
    monthlyNorm: 160,
    email: '',
    description: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user: currentUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!currentUser || currentUser.adminLevel < 7) {
      setError('У вас недостаточно прав для создания пользователей. Требуется уровень 7 или выше.');
      setIsLoading(false);
      return;
    }

    if (!formData.nickname.trim() || !formData.login.trim() || !formData.password.trim()) {
      setError('Заполните все обязательные поля');
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
      // Create user with secure password hashing
      const newUser = await storage.createSecureUser({
        nickname: formData.nickname,
        login: formData.login,
        password: formData.password,
        adminLevel: formData.adminLevel,
        monthlyNorm: formData.monthlyNorm,
        email: formData.email || undefined,
        description: formData.description || undefined,
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
        adminId: currentUser.id,
        action: 'Создан новый пользователь',
        target: newUser.nickname,
        timestamp: new Date().toISOString(),
        details: `Логин: ${newUser.login}, Уровень: ${newUser.adminLevel}`
      };
      storage.addAction(action);

      setSuccess(`Пользователь "${newUser.nickname}" успешно создан`);
      setFormData({
        nickname: '',
        login: '',
        password: '',
        adminLevel: 1,
        monthlyNorm: 160,
        email: '',
        description: ''
      });

      if (onUserCreated) {
        onUserCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании пользователя');
    }

    setIsLoading(false);
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!currentUser || currentUser.adminLevel < 7) {
    return (
      <Alert>
        <Icon name="AlertCircle" className="h-4 w-4" />
        <AlertDescription>
          У вас недостаточно прав для создания пользователей. Требуется уровень 7 или выше.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Создание нового пользователя</CardTitle>
        <CardDescription>
          Добавьте нового администратора в систему
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Имя пользователя *</Label>
              <Input
                id="nickname"
                type="text"
                value={formData.nickname}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
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
                onChange={(e) => handleInputChange('login', e.target.value)}
                placeholder="ivan_admin"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Пароль *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Минимум 6 символов"
                disabled={isLoading}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="ivan@example.com"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adminLevel">Уровень доступа</Label>
              <Select
                value={formData.adminLevel.toString()}
                onValueChange={(value) => handleInputChange('adminLevel', parseInt(value))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(Math.min(10, currentUser.adminLevel))].map((_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Уровень {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyNorm">Норма часов в месяц</Label>
              <Input
                id="monthlyNorm"
                type="number"
                min="1"
                max="744"
                value={formData.monthlyNorm}
                onChange={(e) => handleInputChange('monthlyNorm', parseInt(e.target.value) || 160)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание (необязательно)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Дополнительная информация о пользователе..."
              disabled={isLoading}
              rows={3}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <Icon name="AlertCircle" className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <Icon name="CheckCircle" className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                Создание пользователя...
              </>
            ) : (
              <>
                <Icon name="UserPlus" className="mr-2 h-4 w-4" />
                Создать пользователя
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Информация о безопасности:</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Пароли автоматически шифруются алгоритмом SHA-256</p>
            <p>• Логины должны быть уникальными в системе</p>
            <p>• Вы можете создавать пользователей только с уровнем доступа не выше вашего</p>
            <p>• Все действия записываются в журнал системы</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreateUserForm;