import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { storage } from '@/lib/storage';
import { SystemAction, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';

const SystemLogs = () => {
  const [actions, setActions] = useState<SystemAction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredActions, setFilteredActions] = useState<SystemAction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAdmin, setFilterAdmin] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterActions();
  }, [actions, searchTerm, filterType, filterAdmin, timeFilter]);

  const loadData = () => {
    const allActions = storage.getActions().sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setActions(allActions);
    setUsers(storage.getUsers());
  };

  const filterActions = () => {
    let filtered = [...actions];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(action =>
        action.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        action.target?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        action.details?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(action => {
        switch (filterType) {
          case 'user': return action.action.includes('пользовател');
          case 'status': return action.action.includes('статус');
          case 'admin': return action.action.includes('администратор') || action.action.includes('уровень');
          case 'password': return action.action.includes('пароль');
          default: return true;
        }
      });
    }

    // Admin filter
    if (filterAdmin !== 'all') {
      filtered = filtered.filter(action => action.adminId === filterAdmin);
    }

    // Time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      const hours = parseInt(timeFilter);
      const filterDate = new Date(now.getTime() - (hours * 60 * 60 * 1000));
      filtered = filtered.filter(action =>
        new Date(action.timestamp) >= filterDate
      );
    }

    setFilteredActions(filtered);
  };

  const getActionIcon = (action: string) => {
    if (action.includes('пользовател')) return 'UserPlus';
    if (action.includes('статус')) return 'Activity';
    if (action.includes('администратор') || action.includes('уровень')) return 'Shield';
    if (action.includes('пароль')) return 'Key';
    if (action.includes('Удален')) return 'UserX';
    return 'FileText';
  };

  const getActionColor = (action: string) => {
    if (action.includes('Добавлен')) return 'text-green-600';
    if (action.includes('Удален')) return 'text-red-600';
    if (action.includes('Изменен')) return 'text-blue-600';
    if (action.includes('Сброшен')) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const exportLogs = () => {
    const data = filteredActions.map(action => {
      const admin = users.find(u => u.id === action.adminId);
      return {
        'Дата и время': formatDate(action.timestamp),
        'Администратор': admin?.nickname || 'Неизвестный',
        'Действие': action.action,
        'Цель': action.target || '-',
        'Детали': action.details || '-'
      };
    });

    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `system_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const canViewLogs = currentUser && currentUser.adminLevel >= 9;
  const canExportLogs = currentUser && currentUser.adminLevel >= 9;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Журнал действий</h1>
          <p className="text-gray-600 mt-2">История всех административных действий в системе</p>
        </div>
        {canExportLogs && filteredActions.length > 0 && (
          <Button onClick={exportLogs} variant="outline">
            <Icon name="Download" size={16} className="mr-2" />
            Экспорт в CSV
          </Button>
        )}
      </div>

      {!canViewLogs ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon name="Lock" className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">У вас недостаточно прав для просмотра журнала действий.</p>
            <p className="text-sm text-gray-400 mt-2">Требуется уровень администратора 9 или выше.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Фильтры</CardTitle>
              <CardDescription>Настройте параметры отображения журнала</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Поиск</label>
                  <Input
                    placeholder="Поиск по действиям..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Тип действия</label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все действия</SelectItem>
                      <SelectItem value="user">Пользователи</SelectItem>
                      <SelectItem value="status">Статусы</SelectItem>
                      <SelectItem value="admin">Права админов</SelectItem>
                      <SelectItem value="password">Пароли</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Администратор</label>
                  <Select value={filterAdmin} onValueChange={setFilterAdmin}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все администраторы</SelectItem>
                      {users.filter(u => u.adminLevel >= 6).map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.nickname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Период</label>
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все время</SelectItem>
                      <SelectItem value="1">Последний час</SelectItem>
                      <SelectItem value="24">Последние 24 часа</SelectItem>
                      <SelectItem value="168">Последняя неделя</SelectItem>
                      <SelectItem value="720">Последний месяц</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions List */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Журнал действий</CardTitle>
                <Badge variant="outline">
                  {filteredActions.length} записей
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {filteredActions.length === 0 ? (
                <div className="text-center py-8">
                  <Icon name="FileText" className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">Нет записей для отображения</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredActions.slice(0, 50).map((action) => {
                    const admin = users.find(u => u.id === action.adminId);
                    return (
                      <div key={action.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                        <div className={`mt-1 ${getActionColor(action.action)}`}>
                          <Icon name={getActionIcon(action.action)} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900">{action.action}</p>
                            <time className="text-sm text-gray-500">{formatDate(action.timestamp)}</time>
                          </div>
                          <div className="mt-1 space-y-1">
                            <p className="text-sm text-gray-600">
                              Администратор: <span className="font-medium">{admin?.nickname || 'Неизвестный'}</span>
                              {admin && <Badge variant="outline" className="ml-2 text-xs">Уровень {admin.adminLevel}</Badge>}
                            </p>
                            {action.target && (
                              <p className="text-sm text-gray-600">
                                Цель: <span className="font-medium">{action.target}</span>
                              </p>
                            )}
                            {action.details && (
                              <p className="text-sm text-gray-500">{action.details}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {filteredActions.length > 50 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">
                        Показаны первые 50 записей из {filteredActions.length}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SystemLogs;