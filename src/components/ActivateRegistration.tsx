import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';

const ActivateRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('https://functions.poehali.dev/1b850f5c-45f7-4740-be51-ce806bc60d2c', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(data.message);
        setSuccess(true);
        
        // Перезагрузить страницу через 2 секунды
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || 'Ошибка активации');
        setSuccess(false);
      }
    } catch (error) {
      setMessage('Ошибка подключения к серверу');
      setSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <Icon name="Settings" className="h-12 w-12 text-blue-600 mx-auto mb-2" />
        <CardTitle>Активация регистрации</CardTitle>
        <CardDescription>
          Нажмите кнопку для включения системы регистрации новых пользователей
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleActivate}
          disabled={isLoading || success}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
              Активация...
            </>
          ) : success ? (
            <>
              <Icon name="CheckCircle" className="mr-2 h-4 w-4" />
              Активировано!
            </>
          ) : (
            <>
              <Icon name="Power" className="mr-2 h-4 w-4" />
              Активировать регистрацию
            </>
          )}
        </Button>

        {message && (
          <Alert variant={success ? "default" : "destructive"}>
            <Icon name={success ? "CheckCircle" : "AlertCircle"} className="h-4 w-4" />
            <AlertDescription>
              {message}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>Это действие:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Откроет регистрацию новых пользователей</li>
            <li>Обновит настройки в базе данных</li>
            <li>Добавит запись в системные логи</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivateRegistration;