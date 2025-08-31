import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { storage } from '@/lib/storage';
import { SecurityManager } from '@/lib/security';
import { User, SystemAction } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import CreateUserForm from '@/components/CreateUserForm';
import Icon from '@/components/ui/icon';

const AdminManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const allUsers = storage.getUsers();
    setUsers(allUsers);
  };

  const filteredUsers = users.filter(user =>
    user.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.login.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdminLevelChange = (userId: string, newLevel: number) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser || !currentUser || currentUser.adminLevel < 9) return;

    storage.updateUser(userId, { adminLevel: newLevel });

    // Log the action
    const action: SystemAction = {
      id: Date.now().toString(),
      adminId: currentUser.id,
      action: 'Изменен уровень администратора',
      target: targetUser.nickname,
      timestamp: new Date().toISOString(),
      details: `Новый уровень: ${newLevel} (был ${targetUser.adminLevel})`
    };
    storage.addAction(action);

    loadUsers();
  };

  const handlePasswordReset = async (userId: string, newPassword: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser || !currentUser || currentUser.adminLevel < 9) return;

    try {
      // Hash the new password before saving
      const passwordHash = await SecurityManager.hashPassword(newPassword);
      
      storage.updateUser(userId, { passwordHash });

      // Log the action
      const action: SystemAction = {
        id: Date.now().toString(),
        adminId: currentUser.id,
        action: 'Сброшен пароль пользователя',
        target: targetUser.nickname,
        timestamp: new Date().toISOString()
      };
      storage.addAction(action);

      loadUsers();
      setSelectedUser(null);
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  };

  const getPermissionsList = (level: number) => {
    const permissions = [
      { level: 1, text: 'Просмотр статистики, изменение своего статуса' },
      { level: 2, text: 'Базовый доступ к отчетам' },
      { level: 3, text: 'Расширенный доступ к отчетам' },
      { level: 4, text: 'Просмотр журнала действий' },
      { level: 5, text: 'Экспорт данных' },
      { level: 6, text: 'Управление статусами игроков' },
      { level: 7, text: 'Добавление новых игроков' },
      { level: 8, text: 'Редактирование данных игроков' },
      { level: 9, text: 'Управление правами администраторов' },
      { level: 10, text: 'Полный доступ к системе' }
    ];

    return permissions.filter(p => p.level <= level);
  };

  const formatTime = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ч ${minutes}м`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Управление администраторами</h1>
        <p className="text-gray-600 mt-2">Создание новых пользователей и настройка уровней доступа</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">Список администраторов</TabsTrigger>
          <TabsTrigger value="create">Создать пользователя</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <CreateUserForm onUserCreated={loadUsers} />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">



          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Icon name="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Поиск по имени или логину..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={currentUser && currentUser.adminLevel < 9}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle>Администраторы системы</CardTitle>
                <CardDescription>Список всех пользователей с правами</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedUser?.id === user.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{user.nickname}</h3>
                          <p className="text-sm text-gray-500">@{user.login}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Время онлайн: {formatTime(user.totalOnlineTime || 0)} | Норма: {user.monthlyNorm || 160}ч/мес
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={user.adminLevel >= 9 ? "destructive" : user.adminLevel >= 5 ? "default" : "secondary"}>
                            Уровень {user.adminLevel}
                          </Badge>
                          {user.id === currentUser?.id && (
                            <p className="text-xs text-blue-600 mt-1">Это вы</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* User Details */}
            {selectedUser && (
              <Card>
                <CardHeader>
                  <CardTitle>Детали администратора</CardTitle>
                  <CardDescription>{selectedUser.nickname}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Текущий уровень доступа</Label>
                    <Select
                      value={selectedUser.adminLevel.toString()}
                      onValueChange={(value) => handleAdminLevelChange(selectedUser.id, parseInt(value))}
                      disabled={!currentUser || currentUser.adminLevel < 9 || selectedUser.id === currentUser.id}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(10)].map((_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            Уровень {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Доступные права:</h4>
                    <div className="space-y-2">
                      {getPermissionsList(selectedUser.adminLevel).map((perm) => (
                        <div key={perm.level} className="flex items-start space-x-2">
                          <Icon name="Check" className="h-4 w-4 text-green-500 mt-0.5" />
                          <span className="text-sm">{perm.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Статистика:</h4>
                    <div className="space-y-2 text-sm">
                      <p>Дата регистрации: {new Date(selectedUser.createdAt).toLocaleDateString('ru-RU')}</p>
                      <p>Последняя активность: {new Date(selectedUser.lastActivity).toLocaleString('ru-RU')}</p>
                      <p>Общее время онлайн: {formatTime(selectedUser.totalOnlineTime || 0)}</p>
                    </div>
                  </div>

                  {currentUser && currentUser.adminLevel >= 9 && selectedUser.id !== currentUser.id && (
                    <div>
                      <h4 className="font-medium mb-3">Сброс пароля:</h4>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const newPassword = formData.get('password') as string;
                          if (newPassword) {
                            await handlePasswordReset(selectedUser.id, newPassword);
                          }
                        }}
                        className="space-y-3"
                      >
                        <Input
                          name="password"
                          type="password"
                          placeholder="Новый пароль"
                          required
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Сбросить пароль
                        </Button>
                      </form>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Permission Levels Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Справка по уровням доступа</CardTitle>
          <CardDescription>Описание прав для каждого уровня администратора</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {getPermissionsList(10).map((perm) => (
              <div key={perm.level} className="flex items-start space-x-3">
                <Badge variant="outline" className="min-w-[80px]">
                  Уровень {perm.level}
                </Badge>
                <span className="text-sm">{perm.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminManagement;