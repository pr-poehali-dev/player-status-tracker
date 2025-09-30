import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { storage } from '@/lib/storage';
import { User, SystemAction, ActivityRecord } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { realtimeSync } from '@/lib/realtimeSync';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/ui/icon';
import NormProgress from '@/components/ui/norm-progress';

const Players = () => {
  const [players, setPlayers] = useState<User[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
    
    // Подписаться на обновления в реальном времени
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
  const canViewExtended = currentUser && currentUser.adminLevel >= 9;

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

    // Log the action
    const action: SystemAction = {
      id: Date.now().toString(),
      adminId: currentUser?.id || '',
      action: 'Добавлен новый пользователь',
      target: player.nickname,
      timestamp: new Date().toISOString(),
      details: `Уровень доступа: ${player.adminLevel}`
    };
    storage.addAction(action);

      setPlayers([...players, player]);
      setNewPlayer({ login: '', password: '', nickname: '', adminLevel: 1, monthlyNorm: 160 });
      setIsAddDialogOpen(false);
    } catch (error) {
      alert(`Ошибка создания пользователя: ${error.message}`);
    }
  };



  const handleDeletePlayer = (playerId: string) => {
    const playerToDelete = players.find(p => p.id === playerId);
    if (!playerToDelete || !canManageUsers) return;

    storage.deleteUser(playerId);
    setPlayers(players.filter(p => p.id !== playerId));

    // Log the action
    const action: SystemAction = {
      id: Date.now().toString(),
      adminId: currentUser?.id || '',
      action: 'Удален пользователь',
      target: playerToDelete.nickname,
      timestamp: new Date().toISOString()
    };
    storage.addAction(action);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Управление игроками</h1>
          <p className="text-gray-600 mt-2">Список всех игроков и их текущие статусы</p>
        </div>
        {canManageUsers && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Icon name="Plus" size={16} className="mr-2" />
                Добавить игрока
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить нового игрока</DialogTitle>
                <DialogDescription>
                  Создайте учетную запись для нового игрока
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="login">Логин</Label>
                  <Input
                    id="login"
                    value={newPlayer.login}
                    onChange={(e) => setNewPlayer({...newPlayer, login: e.target.value})}
                    placeholder="player_name"
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
                  <Label htmlFor="nickname">Никнейм</Label>
                  <Input
                    id="nickname"
                    value={newPlayer.nickname}
                    onChange={(e) => setNewPlayer({...newPlayer, nickname: e.target.value})}
                    placeholder="Отображаемое имя"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminLevel">Уровень администратора (1-10)</Label>
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
            placeholder="Поиск по никнейму или логину..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <span>Всего игроков: {filteredPlayers.length}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список игроков</CardTitle>
          <CardDescription>Управление статусами и информацией о игроках</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPlayers.map((player) => (
              <div key={player.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Icon name="User" className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{player.nickname}</h3>
                      <div className="text-xs text-gray-400">
                        Норма месяца
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <NormProgress user={player} size="sm" showDetails={false} />
                    </div>
                    
                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                      <span>@{player.login}</span>
                      <span>•</span>
                      <span>Уровень {player.adminLevel}</span>
                      <span>•</span>
                      <span>Активность: {formatDate(player.lastActivity)}</span>
                      {canViewExtended && (
                        <>
                          <span>•</span>
                          <span>Онлайн: {Math.floor((player.totalOnlineTime || 0) / 1000 / 60 / 60)}ч</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <StatusBadge 
                    userId={player.id} 
                    initialStatus={player.status} 
                    onStatusChange={setPlayers}
                    canEdit={canManageUsers || currentUser?.id === player.id}
                  />
                  
                  <Link to={`/players/${player.id}`}>
                    <Button size="sm" variant="outline">
                      <Icon name="BarChart3" className="mr-1 h-4 w-4" />
                      Статистика
                    </Button>
                  </Link>
                  


                  {canManageUsers && player.id !== currentUser?.id && (
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
              </div>
            ))}

            {filteredPlayers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Icon name="Users" className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>Игроки не найдены</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Players;