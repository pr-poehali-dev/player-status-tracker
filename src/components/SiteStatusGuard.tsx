import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { storage } from '@/lib/storage';
import { SystemSettings, SystemAction } from '@/types';
import Icon from '@/components/ui/icon';

interface SiteStatusGuardProps {
  children: React.ReactNode;
}

const SiteStatusGuard: React.FC<SiteStatusGuardProps> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(storage.getSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [emergencyCode, setEmergencyCode] = useState('');
  const [codeError, setCodeError] = useState('');

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

  const handleEmergencyAccess = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');

    if (!emergencyCode.trim()) {
      setCodeError('Введите код доступа');
      return;
    }

    if (settings.emergencyCode && emergencyCode === settings.emergencyCode) {
      // Temporarily enable site access
      const updatedSettings = { ...settings, isSiteOpen: true };
      storage.saveSettings(updatedSettings);
      setSettings(updatedSettings);

      // Log emergency access
      const action: SystemAction = {
        id: Date.now().toString(),
        adminId: 'emergency_access',
        action: 'Экстренное восстановление доступа к сайту',
        timestamp: new Date().toISOString(),
        details: 'Использован секретный код'
      };
      storage.addAction(action);

      setShowEmergencyForm(false);
      setEmergencyCode('');
    } else {
      setCodeError('Неверный код доступа');
      
      // Log failed attempt
      const action: SystemAction = {
        id: Date.now().toString(),
        adminId: 'emergency_access_failed',
        action: 'Неудачная попытка экстренного доступа',
        timestamp: new Date().toISOString(),
        details: `Неверный код: ${emergencyCode}`
      };
      storage.addAction(action);
    }
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
            
            <div className="space-y-3">
              <Button 
                onClick={handleRefresh}
                variant="outline"
                className="w-full"
              >
                <Icon name="RefreshCw" className="mr-2 h-4 w-4" />
                Проверить доступность
              </Button>

              {!showEmergencyForm ? (
                <Button 
                  onClick={() => setShowEmergencyForm(true)}
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-gray-500 hover:text-gray-700"
                >
                  <Icon name="Key" className="mr-1 h-3 w-3" />
                  Экстренный доступ
                </Button>
              ) : (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                  <form onSubmit={handleEmergencyAccess} className="space-y-3">
                    <div>
                      <Label htmlFor="emergencyCode" className="text-xs">Код восстановления</Label>
                      <Input
                        id="emergencyCode"
                        type="password"
                        value={emergencyCode}
                        onChange={(e) => setEmergencyCode(e.target.value)}
                        placeholder="Введите секретный код"
                        className="text-sm"
                      />
                      {codeError && (
                        <p className="text-xs text-red-600 mt-1">{codeError}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button type="submit" size="sm" className="flex-1">
                        <Icon name="Unlock" className="mr-1 h-3 w-3" />
                        Восстановить доступ
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setShowEmergencyForm(false);
                          setEmergencyCode('');
                          setCodeError('');
                        }}
                      >
                        <Icon name="X" className="h-3 w-3" />
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div className="text-xs text-gray-500 text-center">
              <p>Если у вас есть вопросы, обратитесь к администратору</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SiteStatusGuard;