import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';
import { storage } from '@/lib/storage';

interface SiteUnblockFormProps {
  onUnblock: () => void;
  onCancel: () => void;
}

const SiteUnblockForm: React.FC<SiteUnblockFormProps> = ({ onUnblock, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = storage.restoreSiteAccess(password);
      
      if (success) {
        // Small delay to show optimization process
        setTimeout(() => {
          // Force page reload to ensure all components update
          window.location.reload();
        }, 1500);
      } else {
        setError('Неверный пароль администратора');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Произошла ошибка при восстановлении доступа');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Icon name="Unlock" className="mr-2 h-5 w-5" />
            Восстановление доступа к сайту
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Icon name="Shield" className="h-4 w-4" />
            <AlertDescription>
              Для восстановления полного доступа к сайту введите пароль администратора.
              После этого доступ будет восстановлен для всех пользователей.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminPassword">
                Пароль администратора
              </Label>
              <Input
                id="adminPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль администратора"
                required
                disabled={isLoading}
                className="font-mono"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <Icon name="AlertCircle" className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex space-x-2">
              <Button
                type="submit"
                disabled={isLoading || !password}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                    Оптимизация данных...
                  </>
                ) : (
                  <>
                    <Icon name="Unlock" className="mr-2 h-4 w-4" />
                    Восстановить доступ
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Отмена
              </Button>
            </div>
          </form>

          <div className="text-xs text-gray-500 space-y-1">
            <p>• Пароль предоставляется только главными администраторами</p>
            <p>• После успешной разблокировки сайт станет доступен всем пользователям</p>
            <p>• Система автоматически оптимизирует все данные при восстановлении</p>
            <p>• Все попытки восстановления доступа записываются в журнал</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SiteUnblockForm;