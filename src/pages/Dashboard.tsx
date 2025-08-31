import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { storage } from '@/lib/storage';
import { User, Statistics } from '@/types';
import Icon from '@/components/ui/icon';

const Dashboard = () => {
  const [stats, setStats] = useState<Statistics>({
    totalUsers: 0,
    onlineUsers: 0,
    afkUsers: 0,
    offlineUsers: 0,
    totalActivity: { online: 0, afk: 0, offline: 0 }
  });
  const [recentUsers, setRecentUsers] = useState<User[]>([]);

  useEffect(() => {
    const loadData = () => {
      const users = storage.getUsers();
      const activity = storage.getActivity();
      
      // Calculate statistics
      const onlineUsers = users.filter(u => u.status === 'online').length;
      const afkUsers = users.filter(u => u.status === 'afk').length;
      const offlineUsers = users.filter(u => u.status === 'offline').length;

      // Calculate activity durations
      const activityStats = activity.reduce((acc, record) => {
        acc[record.status] = (acc[record.status] || 0) + (record.duration || 1);
        return acc;
      }, { online: 0, afk: 0, offline: 0 });

      setStats({
        totalUsers: users.length,
        onlineUsers,
        afkUsers,
        offlineUsers,
        totalActivity: activityStats
      });

      // Get recent users (last 5 active)
      const sortedUsers = users
        .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
        .slice(0, 5);
      setRecentUsers(sortedUsers);
    };

    loadData();
    const interval = setInterval(loadData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Дашборд</h1>
        <p className="text-gray-600 mt-2">Обзор активности игроков и системной статистики</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего игроков</CardTitle>
            <Icon name="Users" className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Зарегистрированных пользователей</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Онлайн</CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.onlineUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Активных сейчас</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">АФК</CardTitle>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.afkUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Отошли от игры</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Не в сети</CardTitle>
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.offlineUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Вышли из игры</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Последняя активность</CardTitle>
            <CardDescription>Недавно активные игроки</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">{user.nickname}</p>
                      <p className="text-xs text-gray-500">Уровень {user.adminLevel} • Онлайн: {Math.floor((user.totalOnlineTime || 0) / 1000 / 60)}м</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(user.status)}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(user.lastActivity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Общее время активности</CardTitle>
            <CardDescription>Суммарная статистика по всем игрокам</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Время онлайн</span>
                </div>
                <span className="font-medium">{Math.floor((stats.totalActivity.online || 0) / 1000 / 60)} мин</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm">Время АФК</span>
                </div>
                <span className="font-medium">{Math.floor((stats.totalActivity.afk || 0) / 1000 / 60)} мин</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm">Время офлайн</span>
                </div>
                <span className="font-medium">{Math.floor((stats.totalActivity.offline || 0) / 1000 / 60)} мин</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Icon name="Activity" className="h-5 w-5 text-green-500" />
            <span>Статус системы</span>
          </CardTitle>
          <CardDescription>Информация о работе системы мониторинга</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Система активна и работает нормально</span>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Онлайн
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;