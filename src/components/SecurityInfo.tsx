import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const SecurityInfo = () => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Icon name="Shield" className="h-5 w-5 text-green-600" />
          <span>Система безопасности</span>
        </CardTitle>
        <CardDescription>Информация о мерах защиты данных</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert className="border-green-200 bg-green-50">
            <Icon name="CheckCircle" className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>Система защищена следующими мерами:</strong>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">🔐 Криптографическая защита</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• SHA-256 хеширование паролей</li>
                <li>• Соленое хеширование</li>
                <li>• Удаление демо-аккаунтов</li>
                <li>• Секретный спец-администратор</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">🛡️ Защита от атак</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Rate limiting (5 попыток/15мин)</li>
                <li>• XSS фильтрация ввода</li>
                <li>• Валидация силы паролей</li>
                <li>• Санитизация данных</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">👥 Управление доступом</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 10 уровней администрирования</li>
                <li>• Ролевая модель безопасности</li>
                <li>• Аудит всех действий</li>
                <li>• Защищенные функции</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">📊 Мониторинг</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Журналирование действий</li>
                <li>• Отслеживание активности</li>
                <li>• Экспорт данных безопасности</li>
                <li>• Резервное копирование</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <Icon name="AlertTriangle" className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Секретные данные доступа:</p>
                  <p className="text-yellow-700 mt-1">
                    Для получения учетных данных суперадминистратора обратитесь к системному администратору.
                    Все пароли генерируются с высокой степенью сложности и уникальны для каждого пользователя.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityInfo;