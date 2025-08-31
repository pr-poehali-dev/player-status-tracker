import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { storage } from '@/lib/storage';
import { SystemSettings, SystemAction } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';

const Settings = () => {
  const [settings, setSettings] = useState<SystemSettings>(storage.getSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { user: currentUser } = useAuth();

  const canEditSettings = currentUser && currentUser.adminLevel >= 9;

  const handleSave = () => {
    if (!canEditSettings) return;

    setIsSaving(true);
    storage.saveSettings(settings);

    // Log the action
    const action: SystemAction = {
      id: Date.now().toString(),
      adminId: currentUser.id,
      action: 'Изменены системные настройки',
      timestamp: new Date().toISOString(),
      details: 'Обновлены параметры системы'
    };
    storage.addAction(action);

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 500);
  };

  const handleExportData = () => {
    const data = {
      users: storage.getUsers(),
      activity: storage.getActivity(),
      actions: storage.getActions(),
      settings: storage.getSettings(),
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `game_admin_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    // Log the action
    const action: SystemAction = {
      id: Date.now().toString(),
      adminId: currentUser?.id || '',
      action: 'Экспортированы данные системы',
      timestamp: new Date().toISOString()
    };
    storage.addAction(action);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canEditSettings) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.users) storage.saveUsers(data.users);
        if (data.activity) storage.saveActivity(data.activity);
        if (data.actions) storage.saveActions(data.actions);
        if (data.settings) {
          storage.saveSettings(data.settings);
          setSettings(data.settings);
        }

        // Log the action
        const action: SystemAction = {
          id: Date.now().toString(),
          adminId: currentUser.id,
          action: 'Импортированы данные системы',
          timestamp: new Date().toISOString(),
          details: `Из файла: ${file.name}`
        };
        storage.addAction(action);

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (error) {
        alert('Ошибка при импорте данных. Проверьте формат файла.');
      }
    };
    reader.readAsText(file);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}ч ${mins}мин` : `${hours}ч`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Системные настройки</h1>
        <p className="text-gray-600 mt-2">Управление параметрами и конфигурацией системы</p>
      </div>

      {saveSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <Icon name="CheckCircle" className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Настройки успешно сохранены
          </AlertDescription>
        </Alert>
      )}

      {!canEditSettings && (
        <Alert>
          <Icon name="AlertCircle" className="h-4 w-4" />
          <AlertDescription>
            У вас недостаточно прав для изменения системных настроек. Требуется уровень 9 или выше.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Основные настройки</CardTitle>
            <CardDescription>Базовые параметры системы</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="siteName">Название системы</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                disabled={!canEditSettings}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Регистрация новых пользователей</Label>
                <p className="text-sm text-gray-500">Разрешить самостоятельную регистрацию</p>
              </div>
              <Switch
                checked={settings.isRegistrationOpen}
                onCheckedChange={(checked) => setSettings({ ...settings, isRegistrationOpen: checked })}
                disabled={!canEditSettings}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Доступ к системе</Label>
                <p className="text-sm text-gray-500">Открыть доступ к сайту</p>
              </div>
              <Switch
                checked={settings.isSiteOpen}
                onCheckedChange={(checked) => setSettings({ ...settings, isSiteOpen: checked })}
                disabled={!canEditSettings}
              />
            </div>

            {!settings.isSiteOpen && (
              <div className="space-y-2">
                <Label htmlFor="maintenanceMessage">Сообщение при закрытом доступе</Label>
                <Textarea
                  id="maintenanceMessage"
                  value={settings.maintenanceMessage}
                  onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                  disabled={!canEditSettings}
                  rows={3}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Настройки сессий</CardTitle>
            <CardDescription>Параметры активности пользователей</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Таймаут сессии</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="sessionTimeout"
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.sessionTimeout}
                  onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 30 })}
                  disabled={!canEditSettings}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">минут</span>
              </div>
              <p className="text-xs text-gray-500">
                Время бездействия до автоматического выхода ({formatTime(settings.sessionTimeout)})
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="afkTimeout">Переход в АФК</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="afkTimeout"
                  type="number"
                  min="1"
                  max="60"
                  value={settings.afkTimeout}
                  onChange={(e) => setSettings({ ...settings, afkTimeout: parseInt(e.target.value) || 5 })}
                  disabled={!canEditSettings}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">минут</span>
              </div>
              <p className="text-xs text-gray-500">
                Время бездействия до автоматического перехода в АФК ({formatTime(settings.afkTimeout)})
              </p>
            </div>

            <Alert>
              <Icon name="Info" className="h-4 w-4" />
              <AlertDescription>
                Эти настройки применяются ко всем пользователям системы и вступают в силу при следующем входе.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle>Управление данными</CardTitle>
            <CardDescription>Резервное копирование и восстановление</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button onClick={handleExportData} variant="outline" className="w-full">
                <Icon name="Download" size={16} className="mr-2" />
                Экспортировать все данные
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Скачать полную резервную копию системы в формате JSON
              </p>
            </div>

            {canEditSettings && (
              <div>
                <Label htmlFor="import" className="cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                    <Icon name="Upload" className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Нажмите для импорта данных</p>
                    <p className="text-xs text-gray-500 mt-1">Поддерживается только JSON формат</p>
                  </div>
                </Label>
                <Input
                  id="import"
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle>Информация о системе</CardTitle>
            <CardDescription>Статистика использования</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Всего пользователей</span>
                <span className="font-medium">{storage.getUsers().length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Записей активности</span>
                <span className="font-medium">{storage.getActivity().length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Действий в журнале</span>
                <span className="font-medium">{storage.getActions().length}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Размер данных</span>
                <span className="font-medium">
                  {((JSON.stringify(localStorage).length * 2) / 1024 / 1024).toFixed(2)} МБ
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {canEditSettings && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
          >
            {isSaving ? (
              <>
                <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Icon name="Save" className="mr-2 h-4 w-4" />
                Сохранить настройки
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Settings;