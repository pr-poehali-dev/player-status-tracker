import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';

const AUTH_API_URL = 'https://functions.poehali.dev/0d0526fa-dd23-4e3e-b173-d74b5d3d14f1';

interface RegisterFormProps {
  onSuccess: (user: any) => void;
  onSwitchToLogin: () => void;
}

const NewRegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    email: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Очистить ошибки при вводе
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.login.trim()) {
      setError('Введите логин');
      return false;
    }
    
    if (formData.login.length < 3) {
      setError('Логин должен содержать минимум 3 символа');
      return false;
    }
    
    if (!formData.nickname.trim()) {
      setError('Введите никнейм');
      return false;
    }
    
    if (formData.nickname.length < 2) {
      setError('Никнейм должен содержать минимум 2 символа');
      return false;
    }
    
    if (!formData.password) {
      setError('Введите пароль');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch(AUTH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          login: formData.login.trim(),
          password: formData.password,
          nickname: formData.nickname.trim(),
          email: formData.email.trim() || undefined
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка регистрации');
      }
      
      if (data.success) {
        setSuccess('Регистрация успешна! Теперь вы можете войти в систему.');
        
        // Вызвать callback успеха
        onSuccess(data.user);
        
        // Автоматически переключиться на форму входа через 2 секунды
        setTimeout(() => {
          onSwitchToLogin();
        }, 2000);
        
        // Очистить форму
        setFormData({
          login: '',
          password: '',
          confirmPassword: '',
          nickname: '',
          email: ''
        });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Произошла ошибка при регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { level: 0, text: '', color: '' };
    if (password.length < 6) return { level: 1, text: 'Слабый', color: 'text-red-500' };
    if (password.length < 8) return { level: 2, text: 'Средний', color: 'text-yellow-500' };
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { level: 3, text: 'Сильный', color: 'text-green-500' };
    }
    return { level: 2, text: 'Средний', color: 'text-yellow-500' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center shadow-md mb-4">
          <Icon name="UserPlus" className="h-7 w-7 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold">Регистрация</CardTitle>
        <CardDescription>
          Создайте новый аккаунт в системе
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login">Логин *</Label>
            <Input
              id="login"
              name="login"
              type="text"
              placeholder="Введите логин"
              value={formData.login}
              onChange={handleInputChange}
              required
              disabled={isLoading}
              className="w-full"
              autoComplete="username"
            />
            <p className="text-xs text-gray-500">Минимум 3 символа</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">Никнейм *</Label>
            <Input
              id="nickname"
              name="nickname"
              type="text"
              placeholder="Ваше отображаемое имя"
              value={formData.nickname}
              onChange={handleInputChange}
              required
              disabled={isLoading}
              className="w-full"
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (необязательно)</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isLoading}
              className="w-full"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль *</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Введите пароль"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={isLoading}
              className="w-full"
              autoComplete="new-password"
            />
            {formData.password && (
              <p className={`text-xs ${passwordStrength.color}`}>
                Сила пароля: {passwordStrength.text}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Подтвердите пароль *</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Повторите пароль"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              disabled={isLoading}
              className="w-full"
              autoComplete="new-password"
            />
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-500">Пароли не совпадают</p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <Icon name="AlertCircle" className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <Icon name="CheckCircle" className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full h-11"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                Регистрация...
              </>
            ) : (
              'Зарегистрироваться'
            )}
          </Button>

          <div className="text-center pt-4">
            <Button
              type="button"
              variant="link"
              onClick={onSwitchToLogin}
              disabled={isLoading}
              className="text-sm"
            >
              Уже есть аккаунт? Войти
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default NewRegisterForm;