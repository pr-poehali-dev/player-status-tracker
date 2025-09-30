import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { storage } from '@/lib/storage';
import { User, SystemAction } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { realtimeSync } from '@/lib/realtimeSync';
import Icon from '@/components/ui/icon';

const Players = () => {
  const [players, setPlayers] = useState<User[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<User | null>(null);
  const [newPlayer, setNewPlayer] = useState({
    login: '',
    password: '',
    nickname: '',
    adminLevel: 1,
    monthlyNorm: 160
  });
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const loadPlayers = () => {
      try {
        const allPlayers = storage.getUsers();
        if (Array.isArray(allPlayers)) {
          setPlayers(allPlayers);
          setFilteredPlayers(allPlayers);
        }
      } catch (error) {
        console.error('Error loading players:', error);
        setPlayers([]);
        setFilteredPlayers([]);
      }
    };

    loadPlayers();
    
    realtimeSync.subscribe('users_updated', (updatedUsers: User[]) => {
      if (Array.isArray(updatedUsers)) {
        setPlayers(updatedUsers);
        setFilteredPlayers(updatedUsers.filter(player => 
          player.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
          player.login.toLowerCase().includes(searchTerm.toLowerCase())
        ));
      }
    });
    
    const interval = setInterval(loadPlayers, 30000);
    return () => {
      clearInterval(interval);
      realtimeSync.unsubscribe('users_updated');
    };
  }, []);

  useEffect(() => {
    const filtered = players.filter(player => 
      player.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.login.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPlayers(filtered);
  }, [searchTerm, players]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const canManageUsers = currentUser && currentUser.adminLevel >= 9;

  const handleAddPlayer = async () => {
    if (!newPlayer.login || !newPlayer.password || !newPlayer.nickname) return;

    try {
      const player = await storage.createSecureUser({
        login: newPlayer.login,
        password: newPlayer.password,
        nickname: newPlayer.nickname,
        adminLevel: newPlayer.adminLevel,
        status: 'offline',
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        monthlyNorm: newPlayer.monthlyNorm
      });

      const action: SystemAction = {
        id: Date.now().toString(),
        adminId: currentUser?.id || '',
        action: 'Добавлен новый участник',
        target: player.nickname,
        timestamp: new Date().toISOString(),
        details: `Уровень доступа: ${player.adminLevel}`
      };
      storage.addAction(action);

      setPlayers([...players, player]);
      setNewPlayer({ login: '', password: '', nickname: '', adminLevel: 1, monthlyNorm: 160 });
      setIsAddDialogOpen(false);
    } catch (error: any) {
      alert(`Ошибка создания участника: ${error.message}`);
    }
  };

  const handleDeletePlayer = (playerId: string) => {
    const playerToDelete = players.find(p => p.id === playerId);
    if (!playerToDelete || !canManageUsers) return;

    if (!confirm(`Вы уверены, что хотите удалить участника ${playerToDelete.nickname}?`)) return;

    storage.deleteUser(playerId);
    setPlayers(players.filter(p => p.id !== playerId));

    const action: SystemAction = {
      id: Date.now().toString(),
      adminId: currentUser?.id || '',
      action: 'Удален участник',
      target: playerToDelete.nickname,
      timestamp: new Date().toISOString()
    };
    storage.addAction(action);
  };

  const handleStatusChange = async (playerId: string, newStatus: 'online' | 'afk' | 'offline') => {
    try {
      const success = await realtimeSync.updateUserStatus(playerId, newStatus);
      if (success) {
        const updatedPlayers = players.map(p => 
          p.id === playerId ? { ...p, status: newStatus } : p
        );
        setPlayers(updatedPlayers);
        storage.saveUsers(updatedPlayers);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleUpdatePlayer = () => {
    if (!editingPlayer) return;

    const updatedPlayers = players.map(p => 
      p.id === editingPlayer.id ? editingPlayer : p
    );
    
    setPlayers(updatedPlayers);
    storage.saveUsers(updatedPlayers);

    const action: SystemAction = {
      id: Date.now().toString(),
      adminId: currentUser?.id || '',
      action: 'Обновлены данные участника',
      target: editingPlayer.nickname,
      timestamp: new Date().toISOString()
    };
    storage.addAction(action);

    setEditingPlayer(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'afk': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'Онлайн';
      case 'afk': return 'АФК';
      default: return 'Не в сети';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Управление участниками</h1>
          <p className="text-gray-600 mt-2">Список всех участников команды</p>
        </div>
        {canManageUsers && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Icon name="UserPlus" size={16} className="mr-2" />
                Добавить участника
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить нового участника</DialogTitle>
                <DialogDescription>
                  Создайте учетную запись для нового участника команды
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="login">Логин</Label>
                  <Input
                    id="login"
                    value={newPlayer.login}
                    onChange={(e) => setNewPlayer({...newPlayer, login: e.target.value})}
                    placeholder="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newPlayer.password}
                    onChange={(e) => setNewPlayer({...newPlayer, password: e.target.value})}
                    placeholder="Введите пароль"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Имя</Label>
                  <Input
                    id="nickname"
                    value={newPlayer.nickname}
                    onChange={(e) => setNewPlayer({...newPlayer, nickname: e.target.value})}
                    placeholder="Отображаемое имя"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminLevel">Уровень прав (1-10)</Label>
                  <Input
                    id="adminLevel"
                    type="number"
                    min="1"
                    max="10"
                    value={newPlayer.adminLevel}
                    onChange={(e) => setNewPlayer({...newPlayer, adminLevel: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyNorm">Месячная норма (часы)</Label>
                  <Input
                    id="monthlyNorm"
                    type="number"
                    min="40"
                    max="320"
                    value={newPlayer.monthlyNorm}
                    onChange={(e) => setNewPlayer({...newPlayer, monthlyNorm: parseInt(e.target.value) || 160})}
                    placeholder="160"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleAddPlayer}>
                  Создать
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Icon name="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск по имени или логину..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <span>Всего участников: {filteredPlayers.length}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlayers.map((player) => (
          <Card key={player.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {player.nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(player.status)}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{player.nickname}</CardTitle>
                    <p className="text-sm text-gray-500">@{player.login}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Статус:</span>
                <Select
                  value={player.status}
                  onValueChange={(value: 'online' | 'afk' | 'offline') => handleStatusChange(player.id, value)}
                  disabled={!canManageUsers && currentUser?.id !== player.id}
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Онлайн
                      </div>
                    </SelectItem>
                    <SelectItem value="afk">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        АФК
                      </div>
                    </SelectItem>
                    <SelectItem value="offline">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        Не в сети
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Уровень прав:</span>
                <Badge variant="outline">{player.adminLevel}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Месячная норма:</span>
                <span className="text-sm font-medium">{player.monthlyNorm}ч</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Активность:</span>
                <span className="text-xs text-gray-500">
                  {formatDate(player.lastActivity)}
                </span>
              </div>

              {canManageUsers && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditingPlayer(player)}
                  >
                    <Icon name="Edit" className="mr-1 h-4 w-4" />
                    Изменить
                  </Button>
                  {player.id !== currentUser?.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeletePlayer(player.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Icon name="Trash2" size={14} />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPlayers.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Icon name="Users" className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <p className="text-gray-500 text-lg">Участники не найдены</p>
            <p className="text-gray-400 text-sm mt-2">
              {canManageUsers ? 'Добавьте первого участника команды' : 'Пока нет участников'}
            </p>
          </CardContent>
        </Card>
      )}

      {editingPlayer && (
        <Dialog open={!!editingPlayer} onOpenChange={() => setEditingPlayer(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Редактировать участника</DialogTitle>
              <DialogDescription>
                Изменение данных участника {editingPlayer.nickname}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nickname">Имя</Label>
                <Input
                  id="edit-nickname"
                  value={editingPlayer.nickname}
                  onChange={(e) => setEditingPlayer({...editingPlayer, nickname: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-adminLevel">Уровень прав (1-10)</Label>
                <Input
                  id="edit-adminLevel"
                  type="number"
                  min="1"
                  max="10"
                  value={editingPlayer.adminLevel}
                  onChange={(e) => setEditingPlayer({...editingPlayer, adminLevel: parseInt(e.target.value) || 1})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-monthlyNorm">Месячная норма (часы)</Label>
                <Input
                  id="edit-monthlyNorm"
                  type="number"
                  min="40"
                  max="320"
                  value={editingPlayer.monthlyNorm}
                  onChange={(e) => setEditingPlayer({...editingPlayer, monthlyNorm: parseInt(e.target.value) || 160})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPlayer(null)}>
                Отмена
              </Button>
              <Button onClick={handleUpdatePlayer}>
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Players;