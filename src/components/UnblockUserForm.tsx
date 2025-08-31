import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { storage } from '@/lib/storage';
import Icon from '@/components/ui/icon';

const UnblockUserForm = () => {
  const [unblockData, setUnblockData] = useState({ login: '', code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!unblockData.login.trim() || !unblockData.code.trim()) {
      setError('Заполните все поля');
      setIsLoading(false);
      return;
    }

    // Find user by login
    const users = storage.getUsers();
    const user = users.find(u => u.login === unblockData.login);

    if (!user) {
      setError('Пользователь с таким логином не найден');
      setIsLoading(false);
      return;
    }

    if (!user.isBlocked) {
      setError('Пользователь не заблокирован');
      setIsLoading(false);
      return;
    }

    // Try to use unblock code
    const success = storage.useUnblockCode(unblockData.code, user.id);

    if (success) {
      setSuccess(`Пользователь "${user.nickname}" успешно разблокирован`);
      setUnblockData({ login: '', code: '' });
    } else {
      setError('Неверный код разблокировки или код уже использован');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
            <Icon name="Unlock" className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Разблокировка пользователя</CardTitle>
          <CardDescription>
            Введите логин и код для разблокировки аккаунта
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login">Логин заблокированного пользователя</Label>
              <Input
                id="login"
                type="text"
                value={unblockData.login}
                onChange={(e) => setUnblockData({ ...unblockData, login: e.target.value })}
                placeholder="Введите логин"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Код разблокировки</Label>
              <Input
                id="code"
                type="text"
                value={unblockData.code}
                onChange={(e) => setUnblockData({ ...unblockData, code: e.target.value.toUpperCase() })}
                placeholder="Введите код восстановления"
                disabled={isLoading}
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
                  Разблокировка...
                </>
              ) : (
                <>
                  <Icon name="Unlock" className="mr-2 h-4 w-4" />
                  Разблокировать аккаунт
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Информация:</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Коды разблокировки выдаются администратором</p>
              <p>• Каждый код можно использовать только один раз</p>
              <p>• После разблокировки вы сможете войти в систему</p>
              <p>• Обратитесь к администратору за получением кода</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnblockUserForm;