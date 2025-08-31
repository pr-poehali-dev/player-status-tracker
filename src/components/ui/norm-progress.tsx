import React from 'react';
import { cn } from '@/lib/utils';
import { storage } from '@/lib/storage';
import { User } from '@/types/index';

interface NormProgressProps {
  user: User;
  month?: string;
  className?: string;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const NormProgress: React.FC<NormProgressProps> = ({ 
  user, 
  month, 
  className, 
  showDetails = false,
  size = 'md'
}) => {
  const normStatus = storage.checkMonthlyNorm(user, month);
  const { meetsNorm, currentHours, requiredHours, percentage } = normStatus;

  // Color scheme based on norm completion
  const getColorClasses = () => {
    if (meetsNorm) {
      return {
        bg: 'bg-green-100',
        progressBg: 'bg-green-500',
        text: 'text-green-800',
        border: 'border-green-200'
      };
    } else {
      return {
        bg: 'bg-red-100',
        progressBg: 'bg-red-500',
        text: 'text-red-800',
        border: 'border-red-200'
      };
    }
  };

  const colors = getColorClasses();

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={cn('space-y-1', className)}>
      {showDetails && (
        <div className={cn('flex justify-between items-center', textSizeClasses[size], colors.text)}>
          <span className="font-medium">
            {currentHours}ч / {requiredHours}ч
          </span>
          <span className={cn('font-bold', meetsNorm ? 'text-green-600' : 'text-red-600')}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
      
      <div className={cn(
        'relative w-full rounded-full overflow-hidden',
        colors.bg,
        colors.border,
        'border',
        sizeClasses[size]
      )}>
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out rounded-full',
            colors.progressBg,
            meetsNorm ? 'animate-pulse' : ''
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        
        {/* Glow effect for completed norms */}
        {meetsNorm && (
          <div
            className="absolute inset-0 bg-green-400 opacity-20 rounded-full animate-pulse"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        )}
      </div>

      {!showDetails && size !== 'sm' && (
        <div className={cn('text-center', textSizeClasses[size], colors.text, 'font-medium')}>
          {currentHours}ч / {requiredHours}ч ({percentage.toFixed(0)}%)
        </div>
      )}
    </div>
  );
};

export default NormProgress;