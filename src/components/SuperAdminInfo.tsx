import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

const SuperAdminInfo: React.FC = () => {
  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg border-red-200">
      <CardHeader className="text-center space-y-3 pb-4 bg-red-50">
        <div className="mx-auto w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center shadow-md">
          <Icon name="Crown" className="h-8 w-8 text-white" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold text-red-700">Супер Администратор</CardTitle>
          <CardDescription className="text-red-600">
            Учетные данные для полного доступа к системе
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="border-red-200 bg-red-50">
          <Icon name="AlertTriangle" className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Внимание!</strong> Эти данные предоставляют полный контроль над системой. 
            Обязательно измените пароль после первого входа.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Логин:</label>
            <div className="p-3 bg-gray-100 rounded-lg font-mono text-lg">
              superadmin
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Пароль:</label>
            <div className="p-3 bg-gray-100 rounded-lg font-mono text-lg">
              Admin2024!SuperSecure
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Возможности супер-администратора:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Полный доступ к базе данных',
              'Управление всеми пользователями', 
              'Изменение системных настроек',
              'Просмотр всех логов и действий',
              'Блокировка/разблокировка пользователей',
              'Управление правами доступа',
              'Резервное копирование данных',
              'Миграция данных между системами'
            ].map((permission, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Icon name="Check" className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-700">{permission}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center space-x-2 pt-4">
          <Badge variant="destructive" className="text-lg px-4 py-2">
            <Icon name="Shield" className="h-4 w-4 mr-2" />
            Уровень доступа: 10
          </Badge>
        </div>

        <Alert className="border-yellow-200 bg-yellow-50">
          <Icon name="Info" className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Рекомендации:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Измените пароль сразу после первого входа</li>
              <li>Используйте сложный пароль (минимум 12 символов)</li>
              <li>Не передавайте эти данные третьим лицам</li>
              <li>Регулярно проверяйте журнал действий</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default SuperAdminInfo;