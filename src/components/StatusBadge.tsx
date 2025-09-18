import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { realtimeSync } from '@/lib/realtimeSync';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';

interface StatusBadgeProps {
  status: 'online' | 'afk' | 'offline';
  userId: string;
  nickname?: string;
  clickable?: boolean;
  showIcon?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  userId, 
  nickname, 
  clickable = false,
  showIcon = true 
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { user: currentUser } = useAuth();

  const statusConfig = {
    online: {
      label: 'Онлайн',
      variant: 'bg-green-100 text-green-800 border-green-200',
      icon: 'Circle',
      iconColor: 'text-green-600'
    },
    afk: {
      label: 'АФК',
      variant: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: 'Clock',
      iconColor: 'text-yellow-600'
    },
    offline: {
      label: 'Не в сети',
      variant: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: 'CircleOff',
      iconColor: 'text-gray-600'
    }
  };

  const config = statusConfig[status];

  const handleStatusChange = async (newStatus: 'online' | 'afk' | 'offline') => {
    if (!currentUser || newStatus === status || isUpdating) return;
    
    // Проверить права доступа
    if (userId !== currentUser.id && currentUser.adminLevel < 6) {
      return; // Нет прав менять статус других пользователей
    }

    setIsUpdating(true);
    
    try {
      const success = await realtimeSync.updateUserStatus(userId, newStatus);
      if (!success) {
        console.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Если статус не кликабельный, просто показать badge
  if (!clickable || (!currentUser) || (userId !== currentUser.id && currentUser.adminLevel < 6)) {
    return (
      <Badge className={`${config.variant} border flex items-center gap-1`}>
        {showIcon && <Icon name={config.icon} className={`h-3 w-3 ${config.iconColor}`} />}
        {config.label}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`${config.variant} border flex items-center gap-1 h-auto px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity`}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <Icon name="Loader2" className="h-3 w-3 animate-spin" />
          ) : (
            showIcon && <Icon name={config.icon} className={`h-3 w-3 ${config.iconColor}`} />
          )}
          {config.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem
          onClick={() => handleStatusChange('online')}
          disabled={status === 'online' || isUpdating}
          className="flex items-center gap-2"
        >
          <Icon name="Circle" className="h-3 w-3 text-green-600" />
          <span>Онлайн</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleStatusChange('afk')}
          disabled={status === 'afk' || isUpdating}
          className="flex items-center gap-2"
        >
          <Icon name="Clock" className="h-3 w-3 text-yellow-600" />
          <span>АФК</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleStatusChange('offline')}
          disabled={status === 'offline' || isUpdating}
          className="flex items-center gap-2"
        >
          <Icon name="CircleOff" className="h-3 w-3 text-gray-600" />
          <span>Не в сети</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StatusBadge;