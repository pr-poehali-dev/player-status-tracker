import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { dbStorage } from '@/lib/dbStorage';
import { SecurityManager } from '@/lib/security';
import { useAuth } from '@/contexts/AuthContext';

interface PasswordStrength {
  score: number;
  feedback: string[];
  valid: boolean;
}

const Register = () => {
  const [formData, setFormData] = useState({
    login: '',
    nickname: '',
    password: '',
    confirmPassword: ''
  });
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const validatePassword = (password: string) => {
    const validation = SecurityManager.validatePasswordStrength(password);
    setPasswordStrength({
      score: validation.score || 0,
      feedback: validation.feedback || [],
      valid: validation.valid
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
    
    if (field === 'password') {
      validatePassword(value);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    // Проверка логина
    if (!formData.login.trim()) {
      newErrors.push('Логин обязателен');
    } else if (formData.login.length < 3) {
      newErrors.push('Логин должен содержать минимум 3 символа');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.login)) {
      newErrors.push('Логин может содержать только буквы, цифры, _ и -');
    }

    // Проверка никнейма
    if (!formData.nickname.trim()) {
      newErrors.push('Никнейм обязателен');
    } else if (formData.nickname.length < 2) {
      newErrors.push('Никнейм должен содержать минимум 2 символа');
    }

    // Проверка пароля
    if (!formData.password) {
      newErrors.push('Пароль обязателен');
    } else if (!passwordStrength?.valid) {
      newErrors.push('Пароль не соответствует требованиям безопасности');
    }

    // Проверка подтверждения пароля
    if (formData.password !== formData.confirmPassword) {
      newErrors.push('Пароли не совпадают');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors([]);

    try {
      // Создание пользователя в базе данных
      const newUser = await dbStorage.addUser({
        login: formData.login.trim(),
        nickname: formData.nickname.trim(),
        password: formData.password
      });

      setSuccess(true);
      
      // Автоматический вход после регистрации
      setTimeout(async () => {
        try {
          await authLogin(formData.login, formData.password);
          navigate('/dashboard');
        } catch (loginError) {
          console.error('Auto-login failed:', loginError);
          navigate('/login');
        }
      }, 2000);

    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.message.includes('логином уже существует')) {
        setErrors(['Пользователь с таким логином уже зарегистрирован']);
      } else if (error.message.includes('никнеймом уже существует')) {
        setErrors(['Пользователь с таким никнеймом уже зарегистрирован']);
      } else {
        setErrors(['Ошибка регистрации. Попробуйте позже.']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrengthColor = (score: number) => {
    if (score < 2) return 'bg-red-500';
    if (score < 3) return 'bg-yellow-500';
    if (score < 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = (score: number) => {
    if (score < 2) return 'Слабый';
    if (score < 3) return 'Средний';
    if (score < 4) return 'Хороший';
    return 'Отличный';
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Icon name="CheckCircle" className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-green-600">Регистрация успешна!</h2>
              <p className="text-gray-600">
                Ваш аккаунт создан. Сейчас произойдет автоматический вход в систему...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Регистрация</CardTitle>
          <CardDescription className="text-center">
            Создайте новый аккаунт для доступа к системе
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Логин */}
            <div className="space-y-2">
              <Label htmlFor="login">Логин</Label>
              <Input
                id="login"
                type="text"
                value={formData.login}
                onChange={(e) => handleInputChange('login', e.target.value)}
                placeholder="Введите логин"
                disabled={isLoading}
                className={errors.some(e => e.includes('Логин')) ? 'border-red-500' : ''}
              />
              <p className="text-xs text-gray-500">
                Только буквы, цифры, _ и -, минимум 3 символа
              </p>
            </div>

            {/* Никнейм */}
            <div className="space-y-2">
              <Label htmlFor="nickname">Никнейм</Label>
              <Input
                id="nickname"
                type="text"
                value={formData.nickname}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                placeholder="Введите никнейм"
                disabled={isLoading}
                className={errors.some(e => e.includes('Никнейм')) ? 'border-red-500' : ''}
              />
              <p className="text-xs text-gray-500">
                Отображаемое имя, минимум 2 символа
              </p>
            </div>

            {/* Пароль */}
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Введите пароль"
                disabled={isLoading}
                className={errors.some(e => e.includes('Пароль')) ? 'border-red-500' : ''}
              />
              
              {/* Индикатор силы пароля */}
              {formData.password && passwordStrength && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Сила пароля:</span>
                    <Badge variant={passwordStrength.valid ? "default" : "destructive"} className="text-xs">
                      {getPasswordStrengthText(passwordStrength.score)}
                    </Badge>
                  </div>
                  <Progress 
                    value={passwordStrength.score * 25} 
                    className="h-2"
                  />
                  {passwordStrength.feedback.length > 0 && (
                    <ul className="text-xs text-gray-600 space-y-1">
                      {passwordStrength.feedback.map((feedback, index) => (
                        <li key={index} className="flex items-center space-x-1">
                          <Icon name="Info" className="w-3 h-3" />
                          <span>{feedback}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Подтверждение пароля */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="Повторите пароль"
                disabled={isLoading}
                className={errors.some(e => e.includes('совпадают')) ? 'border-red-500' : ''}
              />
            </div>

            {/* Ошибки */}
            {errors.length > 0 && (
              <Alert variant="destructive">
                <Icon name="AlertCircle" className="h-4 w-4" />
                <AlertDescription>
                  <ul className="space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Кнопка регистрации */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !passwordStrength?.valid}
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

            {/* Ссылка на вход */}
            <div className="text-center text-sm">
              <span className="text-gray-600">Уже есть аккаунт? </span>
              <Link to="/login" className="text-blue-600 hover:underline font-medium">
                Войти
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;