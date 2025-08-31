import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import SecurityInfo from '@/components/SecurityInfo';
import RegisterForm from '@/components/RegisterForm';
import UnblockUserForm from '@/components/UnblockUserForm';
import Icon from '@/components/ui/icon';

const LoginForm = () => {
  const [loginData, setLoginData] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showUnblock, setShowUnblock] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!loginData.trim() || !password.trim()) {
      setError('Заполните все поля');
      setIsLoading(false);
      return;
    }

    const success = await login(loginData, password);
    if (!success) {
      setError('Неверные данные для входа или слишком много попыток');
    }
    setIsLoading(false);
  };

  const settings = storage.getSettings();

  if (showRegister) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <RegisterForm onSwitchToLogin={() => setShowRegister(false)} />
      </div>
    );
  }

  if (showUnblock) {
    return <UnblockUserForm onBack={() => setShowUnblock(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-md space-y-4">
      <Card className="w-full shadow-lg">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="mx-auto w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <Icon name="Shield" className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl sm:text-2xl font-bold">Панель администратора</CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-600">
              Войдите в систему управления игроками
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-3">
              <Label htmlFor="login" className="text-sm font-medium">Логин</Label>
              <Input
                id="login"
                type="text"
                value={loginData}
                onChange={(e) => setLoginData(e.target.value)}
                placeholder="Введите логин"
                disabled={isLoading}
                className="h-12 text-base"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-medium">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                disabled={isLoading}
                className="h-12 text-base"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 shadow-md" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                  Вход...
                </>
              ) : (
                'Войти'
              )}
            </Button>
          </form>

          {settings.isRegistrationOpen && (
            <div className="mt-6 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-500">или</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={() => setShowRegister(true)}
                  className="w-full h-11 text-sm font-medium border-2 hover:bg-gray-50"
                >
                  <Icon name="UserPlus" className="mr-2 h-4 w-4" />
                  Зарегистрироваться
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => setShowUnblock(true)}
                  className="w-full h-9 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                >
                  <Icon name="Unlock" className="mr-2 h-3 w-3" />
                  Разблокировать аккаунт
                </Button>
              </div>
            </div>
          )}

          <div className="mt-8">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="flex items-start space-x-3">
                <Icon name="Shield" className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 text-sm mb-2">Безопасность:</p>
                  <div className="text-xs space-y-1 text-blue-700">
                    <p>• Пароли зашифрованы SHA-256</p>
                    <p>• Ограничение попыток входа</p>
                    <p>• Защита от XSS атак</p>
                    <p>• {settings.isRegistrationOpen ? 'Доступна самостоятельная регистрация' : 'Учетные данные получите у администратора'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Security Info - Hidden on mobile, visible on desktop */}
      <div className="hidden lg:block">
        <SecurityInfo />
      </div>
      </div>
    </div>
  );
};

export default LoginForm;