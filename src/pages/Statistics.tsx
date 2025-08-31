import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { storage } from '@/lib/storage';
import { User, ActivityRecord } from '@/types';
import Icon from '@/components/ui/icon';

const Statistics = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');

  useEffect(() => {
    const loadData = () => {
      setUsers(storage.getUsers());
      setActivities(storage.getActivity());
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getFilteredActivities = () => {
    let filtered = activities;

    if (selectedUser !== 'all') {
      filtered = filtered.filter(activity => activity.userId === selectedUser);
    }

    const now = new Date();
    if (timeFilter !== 'all') {
      const hours = parseInt(timeFilter);
      const filterDate = new Date(now.getTime() - (hours * 60 * 60 * 1000));
      filtered = filtered.filter(activity => 
        new Date(activity.timestamp) >= filterDate
      );
    }

    return filtered;
  };

  const calculateUserStats = (userId?: string) => {
    const userActivities = userId 
      ? activities.filter(a => a.userId === userId)
      : activities;

    const stats = userActivities.reduce((acc, activity) => {
      acc[activity.status] = (acc[activity.status] || 0) + 1;
      return acc;
    }, { online: 0, afk: 0, offline: 0 });

    return stats;
  };

  const getUserActivityHistory = (userId: string) => {
    return activities
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  };

  const getTopActiveUsers = () => {
    const userActivityCount = users.map(user => ({
      ...user,
      activityCount: activities.filter(a => a.userId === user.id).length,
      onlineCount: activities.filter(a => a.userId === user.id && a.status === 'online').length
    })).sort((a, b) => b.onlineCount - a.onlineCount);

    return userActivityCount.slice(0, 5);
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

  const filteredActivities = getFilteredActivities();
  const generalStats = calculateUserStats();
  const topUsers = getTopActiveUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Статистика активности</h1>
        <p className="text-gray-600 mt-2">Подробная аналитика активности игроков</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Игрок:</label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Выберите игрока" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все игроки</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.nickname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Период:</label>
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все время</SelectItem>
              <SelectItem value="1">1 час</SelectItem>
              <SelectItem value="6">6 часов</SelectItem>
              <SelectItem value="24">24 часа</SelectItem>
              <SelectItem value="168">Неделя</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* General Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего событий</CardTitle>
            <Icon name="Activity" className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredActivities.length}</div>
            <p className="text-xs text-muted-foreground mt-1">За выбранный период</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Онлайн активность</CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredActivities.filter(a => a.status === 'online').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Входов в систему</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">АФК переходы</CardTitle>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {filteredActivities.filter(a => a.status === 'afk').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Переходов в АФК</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Active Users */}
        <Card>
          <CardHeader>
            <CardTitle>Наиболее активные игроки</CardTitle>
            <CardDescription>Рейтинг по количеству онлайн-сессий</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topUsers.map((user, index) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.nickname}</p>
                      <p className="text-xs text-gray-500">Уровень {user.adminLevel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{user.onlineCount} сессий</p>
                    <p className="text-xs text-gray-500">Всего: {user.activityCount}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Последние события</CardTitle>
            <CardDescription>Недавние изменения статусов</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredActivities.slice(0, 8).map((activity) => {
                const user = users.find(u => u.id === activity.userId);
                return (
                  <div key={activity.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <p className="text-sm">{user?.nickname || 'Неизвестный пользователь'}</p>
                        <p className="text-xs text-gray-500">{formatDate(activity.timestamp)}</p>
                      </div>
                    </div>
                    {getStatusBadge(activity.status)}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User-specific statistics */}
      {selectedUser !== 'all' && (
        <Card>
          <CardHeader>
            <CardTitle>
              Детальная статистика: {users.find(u => u.id === selectedUser)?.nickname}
            </CardTitle>
            <CardDescription>Полная история активности выбранного игрока</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {calculateUserStats(selectedUser).online}
                </div>
                <p className="text-sm text-gray-500">Онлайн сессий</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {calculateUserStats(selectedUser).afk}
                </div>
                <p className="text-sm text-gray-500">АФК переходов</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {calculateUserStats(selectedUser).offline}
                </div>
                <p className="text-sm text-gray-500">Выходов</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">История активности:</h4>
              {getUserActivityHistory(selectedUser).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(activity.status)}
                    <span className="text-sm">{formatDate(activity.timestamp)}</span>
                  </div>
                  <Icon name="Clock" className="h-4 w-4 text-gray-400" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Statistics;