import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { storage } from '@/lib/storage';
import { User } from '@/types';
import Icon from '@/components/ui/icon';

interface StatusSelectorProps {
  userId: string;
  currentStatus: 'online' | 'afk' | 'offline';
  disabled?: boolean;
  onStatusChange?: (newStatus: 'online' | 'afk' | 'offline') => void;
  adminChange?: boolean;
}

const StatusSelector: React.FC<StatusSelectorProps> = ({ 
  userId, 
  currentStatus, 
  disabled = false,
  onStatusChange,
  adminChange = false
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = (newStatus: 'online' | 'afk' | 'offline') => {
    if (newStatus === currentStatus || isUpdating) return;
    
    setIsUpdating(true);
    
    try {
      const users = storage.getUsers();
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) return;

      const user = users[userIndex];
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      let timeInPreviousStatus = 0;
      if (user.lastStatusTimestamp) {
        timeInPreviousStatus = now.getTime() - new Date(user.lastStatusTimestamp).getTime();
      }

      const updatedUser = { ...user };

      if (timeInPreviousStatus > 0) {
        switch (user.status) {
          case 'online':
            updatedUser.totalOnlineTime = (user.totalOnlineTime || 0) + timeInPreviousStatus;
            updatedUser.monthlyOnlineTime = {
              ...(user.monthlyOnlineTime || {}),
              [monthKey]: ((user.monthlyOnlineTime || {})[monthKey] || 0) + timeInPreviousStatus
            };
            break;
          case 'afk':
            updatedUser.totalAfkTime = (user.totalAfkTime || 0) + timeInPreviousStatus;
            updatedUser.monthlyAfkTime = {
              ...(user.monthlyAfkTime || {}),
              [monthKey]: ((user.monthlyAfkTime || {})[monthKey] || 0) + timeInPreviousStatus
            };
            break;
          case 'offline':
            updatedUser.totalOfflineTime = (user.totalOfflineTime || 0) + timeInPreviousStatus;
            updatedUser.monthlyOfflineTime = {
              ...(user.monthlyOfflineTime || {}),
              [monthKey]: ((user.monthlyOfflineTime || {})[monthKey] || 0) + timeInPreviousStatus
            };
            break;
        }
      }

      updatedUser.status = newStatus;
      updatedUser.lastActivity = now.toISOString();
      updatedUser.lastStatusTimestamp = now.toISOString();

      users[userIndex] = updatedUser;
      storage.saveUsers(users);

      const currentUser = storage.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        storage.setCurrentUser(updatedUser);
        
        localStorage.setItem('game_admin_current_user', JSON.stringify(updatedUser));
      }

      storage.addActivity({
        id: Date.now().toString(),
        userId,
        status: newStatus,
        timestamp: now.toISOString(),
        previousStatus: user.status,
        duration: timeInPreviousStatus
      });

      // Логирование изменения статуса администратором
      if (adminChange) {
        const currentUser = storage.getCurrentUser();
        if (currentUser && currentUser.id !== userId) {
          storage.addAction({
            id: Date.now().toString(),
            adminId: currentUser.id,
            action: 'Изменён статус участника',
            target: user.nickname,
            timestamp: now.toISOString(),
            details: `С "${user.status}" на "${newStatus}"`
          });
        }
      }

      window.dispatchEvent(new CustomEvent('status-changed', { 
        detail: { userId, status: newStatus, user: updatedUser } 
      }));
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'game_admin_current_user',
        newValue: JSON.stringify(updatedUser),
        oldValue: currentUser ? JSON.stringify(currentUser) : null,
        storageArea: localStorage,
        url: window.location.href
      }));

      if (onStatusChange) {
        onStatusChange(newStatus);
      }
      
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const statusConfig = {
    online: {
      label: 'Онлайн',
      color: 'bg-green-500',
      icon: 'Circle'
    },
    afk: {
      label: 'АФК',
      color: 'bg-yellow-500',
      icon: 'Clock'
    },
    offline: {
      label: 'Не в сети',
      color: 'bg-gray-400',
      icon: 'CircleOff'
    }
  };

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={disabled || isUpdating}
    >
      <SelectTrigger className="w-[140px] h-8">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusConfig[currentStatus].color}`} />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="online">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Онлайн</span>
          </div>
        </SelectItem>
        <SelectItem value="afk">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>АФК</span>
          </div>
        </SelectItem>
        <SelectItem value="offline">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            <span>Не в сети</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

export default StatusSelector;