import React from 'react';
import { User } from '@/types';

interface StatusTimeDisplayProps {
  user: User;
  compact?: boolean;
}

const StatusTimeDisplay: React.FC<StatusTimeDisplayProps> = ({ user, compact = false }) => {
  const formatTime = (milliseconds: number): string => {
    if (!milliseconds || milliseconds === 0) return '0ч 0м';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (compact) {
      return `${hours}ч ${minutes}м`;
    }
    
    return `${hours} ч ${minutes} мин`;
  };

  const onlineTime = user.totalOnlineTime || 0;
  const afkTime = user.totalAfkTime || 0;
  const offlineTime = user.totalOfflineTime || 0;

  if (compact) {
    return (
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-600">{formatTime(onlineTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-gray-600">{formatTime(afkTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-gray-600">{formatTime(offlineTime)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-gray-600">Онлайн:</span>
        </div>
        <span className="text-sm font-medium">{formatTime(onlineTime)}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-sm text-gray-600">АФК:</span>
        </div>
        <span className="text-sm font-medium">{formatTime(afkTime)}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-sm text-gray-600">Не в сети:</span>
        </div>
        <span className="text-sm font-medium">{formatTime(offlineTime)}</span>
      </div>
      <div className="pt-2 border-t">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Всего:</span>
          <span className="text-sm font-bold">{formatTime(onlineTime + afkTime + offlineTime)}</span>
        </div>
      </div>
    </div>
  );
};

export default StatusTimeDisplay;