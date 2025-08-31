import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { storage } from '@/lib/storage';
import { User, ActivityRecord } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedFeature from '@/components/ProtectedFeature';
import Icon from '@/components/ui/icon';

const PlayerStatistics = () => {
  const { userId } = useParams<{ userId: string }>();
  const [player, setPlayer] = useState<User | null>(null);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!userId) return;
    
    const loadPlayerData = () => {
      const users = storage.getUsers();
      const foundPlayer = users.find(u => u.id === userId);
      setPlayer(foundPlayer || null);
      
      const allActivities = storage.getActivity();
      const playerActivities = allActivities.filter(a => a.userId === userId);
      setActivities(playerActivities);
    };

    loadPlayerData();
    const interval = setInterval(loadPlayerData, 5000);
    return () => clearInterval(interval);
  }, [userId]);

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
    if (!player) return [];
    
    const now = new Date();
    const months = [];
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      
      const onlineTime = player.monthlyOnlineTime?.[monthKey] || 0;
      const afkTime = player.monthlyAfkTime?.[monthKey] || 0;
      const offlineTime = player.monthlyOfflineTime?.[monthKey] || 0;
      
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
      .slice(0, 20);
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
    if (!player) return { progress: 0, current: 0, norm: 0 };
    
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const currentOnline = player.monthlyOnlineTime?.[monthKey] || 0;
    const currentAfk = player.monthlyAfkTime?.[monthKey] || 0;
    const currentHours = Math.floor((currentOnline + currentAfk) / (1000 * 60 * 60));
    const normHours = player.monthlyNorm || 160;
    const progress = Math.min((currentHours / normHours) * 100, 100);
    
    return {
      progress,
      current: currentHours,
      norm: normHours
    };
  };

  if (!player) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link to="/players">
            <Button variant="outline">
              <Icon name="ArrowLeft" className="mr-2 h-4 w-4" />
              Назад к игрокам
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Icon name="User" className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Игрок не найден</h3>
              <p className="text-gray-500">Возможно, игрок был удален или ID указан неверно</p>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/players">
            <Button variant="outline">
              <Icon name="ArrowLeft" className="mr-2 h-4 w-4" />
              Назад
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{player.nickname}</h1>
            <p className="text-gray-600 mt-1">Подробная статистика игрока</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {getStatusBadge(player.status)}
          <Badge variant="outline">Уровень {player.adminLevel}</Badge>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Время онлайн</CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatTime(player.totalOnlineTime || 0)}
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
              {formatTime(player.totalAfkTime || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Время офлайн</CardTitle>
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {formatTime(player.totalOfflineTime || 0)}
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
          <CardTitle>Прогресс текущего месяца</CardTitle>
          <CardDescription>
            Отработано {monthlyProgress.current}ч из {monthlyProgress.norm}ч нормы
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Прогресс выполнения нормы</span>
                <span>{Math.round(monthlyProgress.progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    monthlyProgress.progress >= 100 
                      ? 'bg-green-500' 
                      : monthlyProgress.progress >= 75
                      ? 'bg-blue-500'
                      : monthlyProgress.progress >= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(monthlyProgress.progress, 100)}%` }}
                ></div>
              </div>
            </div>
            {monthlyProgress.progress >= 100 && (
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
        <ProtectedFeature requiredLevel={5} feature="помесячной статистике">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>История по месяцам</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  <Icon name="Crown" size={12} className="mr-1" />
                  Уровень 5+
                </Badge>
              </CardTitle>
              <CardDescription>Активность за последние 12 месяцев</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {getMonthlyStats().slice(-6).map((month) => (
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
        </ProtectedFeature>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Последняя активность</CardTitle>
            <CardDescription>Недавние изменения статуса</CardDescription>
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Player Info */}
      <Card>
        <CardHeader>
          <CardTitle>Информация об игроке</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p><strong>Логин:</strong> @{player.login}</p>
              <p><strong>Уровень доступа:</strong> {player.adminLevel}</p>
              <p><strong>Месячная норма:</strong> {player.monthlyNorm || 160} часов</p>
            </div>
            <div className="space-y-2">
              <p><strong>Дата регистрации:</strong> {new Date(player.createdAt).toLocaleDateString('ru-RU')}</p>
              <p><strong>Последняя активность:</strong> {formatDate(player.lastActivity)}</p>
              <p><strong>Текущий статус:</strong> {getStatusBadge(player.status)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlayerStatistics;