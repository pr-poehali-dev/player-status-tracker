import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { storage } from '@/lib/storage';
import { cloudSync } from '@/lib/cloudSync';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';

interface SyncData {
  lastSync: string;
  deviceCount: number;
  mergedUsers: number;
  hasBackup: boolean;
  cloudUsers: number;
  deviceId: string;
  syncInProgress: boolean;
}

const SyncStatus = () => {
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadSyncData();
  }, []);

  const loadSyncData = () => {
    try {
      const users = storage.getUsers();
      const backupTimestamp = localStorage.getItem('users_backup_timestamp');
      const hasBackup = !!localStorage.getItem('users_backup');
      const cloudStatus = cloudSync.getSyncStatus();
      
      setSyncData({
        lastSync: cloudStatus.lastSync ? new Date(cloudStatus.lastSync).toISOString() : (backupTimestamp || new Date().toISOString()),
        deviceCount: 1,
        mergedUsers: users.length,
        hasBackup,
        cloudUsers: cloudStatus.cloudUsers,
        deviceId: cloudStatus.deviceId,
        syncInProgress: cloudStatus.syncInProgress
      });
    } catch (error) {
      console.error('Error loading sync data:', error);
    }
  };

  const handleManualSync = async () => {
    if (!user || user.adminLevel < 5) return;
    
    setIsLoading(true);
    try {
      // Полная синхронизация через облачную систему
      await cloudSync.syncAllUsers();
      setLastSyncMessage('Облачная синхронизация завершена успешно');
      
      loadSyncData();
    } catch (error) {
      console.error('Manual sync error:', error);
      setLastSyncMessage('Ошибка синхронизации');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = () => {
    if (!user || user.adminLevel < 5) return;
    
    try {
      storage.createBackup('manual');
      setLastSyncMessage('Резервная копия создана');
      loadSyncData();
    } catch (error) {
      console.error('Backup creation error:', error);
      setLastSyncMessage('Ошибка создания резервной копии');
    }
  };

  const handleExportData = () => {
    if (!user || user.adminLevel < 8) return;
    
    try {
      const users = storage.getUsers();
      const exportData = {
        users: users.map(u => ({
          ...u,
          // Remove sensitive data for export
          passwordHash: undefined
        })),
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], 
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setLastSyncMessage('Данные экспортированы');
    } catch (error) {
      console.error('Export error:', error);
      setLastSyncMessage('Ошибка экспорта');
    }
  };

  if (!user || user.adminLevel < 5) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="RefreshCw" size={20} />
          Синхронизация устройств
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Локальных</div>
              <div className="text-2xl font-bold">{syncData.mergedUsers}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Облачных</div>
              <div className="text-2xl font-bold">{syncData.cloudUsers}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Резервная копия</div>
              <Badge variant={syncData.hasBackup ? "default" : "secondary"}>
                {syncData.hasBackup ? "Есть" : "Нет"}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Синхронизация</div>
              <Badge variant={syncData.syncInProgress ? "destructive" : "default"}>
                {syncData.syncInProgress ? "Идёт" : "Готово"}
              </Badge>
            </div>
          </div>
        )}

        {syncData && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-1">ID устройства:</div>
            <div className="text-xs font-mono text-muted-foreground">{syncData.deviceId}</div>
          </div>
        )}

        {lastSyncMessage && (
          <Alert>
            <AlertDescription>{lastSyncMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleManualSync} 
            disabled={isLoading}
            size="sm"
          >
            <Icon name="RefreshCw" size={16} className={isLoading ? "animate-spin" : ""} />
            Синхронизировать
          </Button>
          
          <Button 
            onClick={handleCreateBackup} 
            variant="outline" 
            size="sm"
          >
            <Icon name="Save" size={16} />
            Создать копию
          </Button>
          
          {user.adminLevel >= 8 && (
            <Button 
              onClick={handleExportData} 
              variant="outline" 
              size="sm"
            >
              <Icon name="Download" size={16} />
              Экспорт
            </Button>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          <p>• Автоматическая синхронизация при входе с разных устройств</p>
          <p>• Обновление статусов и активности в реальном времени</p>
          <p>• Облачное хранение с защищёнными паролями (SHA-256)</p>
          <p>• Синхронизация админ-прав и статистики между устройствами</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SyncStatus;