import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { storage } from '@/lib/storage';
import { SystemSettings } from '@/types';
import Icon from '@/components/ui/icon';

interface SiteStatusGuardProps {
  children: React.ReactNode;
}

const SiteStatusGuard: React.FC<SiteStatusGuardProps> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(storage.getSettings());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSettings = () => {
      const currentSettings = storage.getSettings();
      setSettings(currentSettings);
      setIsLoading(false);
    };

    checkSettings();
    
    // Check settings every 30 seconds
    const interval = setInterval(checkSettings, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      const currentSettings = storage.getSettings();
      setSettings(currentSettings);
      setIsLoading(false);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="Loader2" className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Проверка доступности системы...</p>
        </div>
      </div>
    );
  }

  // If site is open, render children normally
  if (settings.isSiteOpen) {
    return <>{children}</>;
  }

  // If site is closed, show maintenance page
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Icon name="AlertTriangle" className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-800">Доступ ограничен</CardTitle>
          <CardDescription className="text-red-600">
            Сайт временно недоступен для входа
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <Icon name="Info" className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              {settings.maintenanceMessage || 
               'Сайт находится на техническом обслуживании. Пожалуйста, попробуйте позже.'}
            </AlertDescription>
          </Alert>

          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Администратор системы временно ограничил доступ к панели управления.
            </p>
            
            <Button 
              onClick={handleRefresh}
              variant="outline"
              className="w-full"
            >
              <Icon name="RefreshCw" className="mr-2 h-4 w-4" />
              Проверить доступность
            </Button>

            <div className="text-xs text-gray-500">
              <p>Если у вас есть вопросы, обратитесь к администратору</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SiteStatusGuard;