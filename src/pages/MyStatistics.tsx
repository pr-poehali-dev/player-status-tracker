import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { storage } from '@/lib/storage';
import { ActivityRecord } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';
import NormProgress from '@/components/ui/norm-progress';

const MyStatistics = () => {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;
    
    const loadMyData = () => {
      const allActivities = storage.getActivity();
      const myActivities = allActivities.filter(a => a.userId === currentUser.id);
      setActivities(myActivities);
    };

    loadMyData();
    const interval = setInterval(loadMyData, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const formatTime = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ч ${minutes}м`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      online: 'bg-green-100 text-green-800',
      afk: 'bg-yellow-100 text-yellow-800',
      offline: 'bg-gray-100 text-gray-800'
    };
    
    const labels = {
      online: 'Онлайн',
      afk: 'АФК',
      offline: 'Не в сети'
    };

    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getMonthlyStats = () => {
    if (!currentUser) return [];
    
    const now = new Date();
    const months = [];
    
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      
      const onlineTime = currentUser.monthlyOnlineTime?.[monthKey] || 0;
      const afkTime = currentUser.monthlyAfkTime?.[monthKey] || 0;
      const offlineTime = currentUser.monthlyOfflineTime?.[monthKey] || 0;
      
      months.unshift({
        key: monthKey,
        name: monthName,
        onlineTime,
        afkTime,
        offlineTime,
        total: onlineTime + afkTime + offlineTime
      });
    }
    
    return months;
  };

  const getRecentActivities = () => {
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  };

  const getStatusDistribution = () => {
    const total = activities.length;
    if (total === 0) return { online: 0, afk: 0, offline: 0 };

    const counts = activities.reduce((acc, activity) => {
      acc[activity.status] = (acc[activity.status] || 0) + 1;
      return acc;
    }, { online: 0, afk: 0, offline: 0 });

    return {
      online: Math.round((counts.online / total) * 100),
      afk: Math.round((counts.afk / total) * 100),
      offline: Math.round((counts.offline / total) * 100)
    };
  };

  const getCurrentMonthProgress = () => {
    if (!currentUser) return { progress: 0, current: 0, norm: 0 };
    
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const currentOnline = currentUser.monthlyOnlineTime?.[monthKey] || 0;
    const currentAfk = currentUser.monthlyAfkTime?.[monthKey] || 0;
    const currentHours = Math.floor((currentOnline + currentAfk) / (1000 * 60 * 60));
    const normHours = currentUser.monthlyNorm || 160;
    const progress = Math.min((currentHours / normHours) * 100, 100);
    
    return {
      progress,
      current: currentHours,
      norm: normHours
    };
  };

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Icon name="User" className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Пользователь не найден</h3>
              <p className="text-gray-500">Пожалуйста, войдите в систему</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusDistribution = getStatusDistribution();
  const monthlyProgress = getCurrentMonthProgress();
  const recentActivities = getRecentActivities();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Моя статистика</h1>
        <p className="text-gray-600 mt-2">Подробная информация о вашей активности</p>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{currentUser.nickname}</span>
            <div className="flex items-center space-x-3">
              {getStatusBadge(currentUser.status)}
              <Badge variant="outline">Уровень {currentUser.adminLevel}</Badge>
            </div>
          </CardTitle>
          <CardDescription>@{currentUser.login}</CardDescription>
        </CardHeader>
      </Card>

      {/* Basic Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Время онлайн</CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatTime(currentUser.totalOnlineTime || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Время AFK</CardTitle>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatTime(currentUser.totalAfkTime || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего активности</CardTitle>
            <Icon name="Activity" className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activities.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Прогресс выполнения месячной нормы</CardTitle>
          <CardDescription>
            Ваша рабочая активность за текущий месяц
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <NormProgress 
              user={currentUser} 
              size="lg" 
              showDetails={true}
              className="my-4"
            />
            
            {storage.checkMonthlyNorm(currentUser).meetsNorm && (
              <div className="flex items-center text-green-600 text-sm">
                <Icon name="CheckCircle" className="mr-2 h-4 w-4" />
                Месячная норма выполнена!
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Распределение активности</CardTitle>
          <CardDescription>Процентное соотношение времени по статусам</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{statusDistribution.online}%</div>
              <p className="text-sm text-gray-500">Онлайн</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{statusDistribution.afk}%</div>
              <p className="text-sm text-gray-500">AFK</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">{statusDistribution.offline}%</div>
              <p className="text-sm text-gray-500">Офлайн</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly History */}
        <Card>
          <CardHeader>
            <CardTitle>История по месяцам</CardTitle>
            <CardDescription>Ваша активность за последние 6 месяцев</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {getMonthlyStats().map((month) => (
                <div key={month.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">{month.name}</span>
                  <div className="text-right">
                    <div className="space-y-1">
                      <div className="text-sm space-x-4">
                        <span className="text-green-600">🟢 {formatTime(month.onlineTime)}</span>
                        <span className="text-yellow-600">🟡 {formatTime(month.afkTime)}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Всего: {formatTime(month.total)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Моя последняя активность</CardTitle>
            <CardDescription>Недавние изменения вашего статуса</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(activity.status)}
                    <div>
                      <p className="text-sm text-gray-600">
                        {activity.previousStatus && (
                          <>из <strong>{activity.previousStatus}</strong> в </>
                        )}
                        <strong>{activity.status}</strong>
                      </p>
                      {activity.duration && (
                        <p className="text-xs text-gray-400">
                          Длительность: {formatTime(activity.duration)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(activity.timestamp)}
                  </span>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Icon name="Activity" className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p>Пока нет записей активности</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Информация об аккаунте</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p><strong>Логин:</strong> @{currentUser.login}</p>
              <p><strong>Уровень доступа:</strong> {currentUser.adminLevel}</p>
              <p><strong>Месячная норма:</strong> {currentUser.monthlyNorm || 160} часов</p>
            </div>
            <div className="space-y-2">
              <p><strong>Дата регистрации:</strong> {new Date(currentUser.createdAt).toLocaleDateString('ru-RU')}</p>
              <p><strong>Последняя активность:</strong> {formatDate(currentUser.lastActivity)}</p>
              <p><strong>Текущий статус:</strong> {getStatusBadge(currentUser.status)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyStatistics;