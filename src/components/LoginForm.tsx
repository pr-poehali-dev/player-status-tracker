import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import SecurityInfo from '@/components/SecurityInfo';
import Icon from '@/components/ui/icon';

const LoginForm = () => {
  const [loginData, setLoginData] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Icon name="Shield" className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Панель администратора</CardTitle>
          <CardDescription>
            Войдите в систему управления игроками
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login">Логин</Label>
              <Input
                id="login"
                type="text"
                value={loginData}
                onChange={(e) => setLoginData(e.target.value)}
                placeholder="Введите логин"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                disabled={isLoading}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
          <div className="mt-6 text-sm text-gray-500 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-800 mb-2">Информация о безопасности:</p>
              <div className="text-xs space-y-1">
                <p>• Пароли зашифрованы SHA-256</p>
                <p>• Ограничение попыток входа</p>
                <p>• Защита от XSS атак</p>
                <p>• Учетные данные получите у администратора</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="w-full max-w-4xl">
        <SecurityInfo />
      </div>
    </div>
  );
};

export default LoginForm;