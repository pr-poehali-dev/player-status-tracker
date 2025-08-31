import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';

interface ProtectedFeatureProps {
  requiredLevel: number;
  feature: string;
  children: React.ReactNode;
  showMessage?: boolean;
}

const ProtectedFeature: React.FC<ProtectedFeatureProps> = ({
  requiredLevel,
  feature,
  children,
  showMessage = true
}) => {
  const { user } = useAuth();

  if (!user || user.adminLevel < requiredLevel) {
    if (!showMessage) return null;
    
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Icon name="Lock" className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Для доступа к {feature} требуется уровень администратора {requiredLevel} или выше.</p>
          <p className="text-sm text-gray-400 mt-2">Ваш текущий уровень: {user?.adminLevel || 0}</p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};

export default ProtectedFeature;