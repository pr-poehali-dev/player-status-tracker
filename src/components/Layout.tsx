import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/icon';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, updateStatus } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', label: 'Дашборд', icon: 'BarChart3' },
    { path: '/players', label: 'Игроки', icon: 'Users' },
    { path: '/statistics', label: 'Статистика', icon: 'TrendingUp' },
    ...(user && user.adminLevel >= 9 ? [
      { path: '/admin-management', label: 'Управление правами', icon: 'Shield' },
      { path: '/system-logs', label: 'Журнал действий', icon: 'FileText' },
      { path: '/settings', label: 'Настройки', icon: 'Settings' }
    ] : [])
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'afk': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="w-64 bg-white shadow-sm border-r border-gray-200">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Icon name="Shield" className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-500">Управление игроками</p>
            </div>
          </div>
        </div>

        <nav className="px-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-gray-200 bg-white">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Статус:</span>
              <div className="flex space-x-1">
                {(['online', 'afk', 'offline'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus(status)}
                    className={`w-3 h-3 rounded-full border-2 transition-all ${
                      user?.status === status 
                        ? `${getStatusColor(status)} border-white` 
                        : 'bg-gray-200 border-gray-300 hover:border-gray-400'
                    }`}
                    title={status}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(user?.status || 'offline')}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.nickname}</p>
                <p className="text-xs text-gray-500">Уровень {user?.adminLevel}</p>
              </div>
            </div>
            
            <Button onClick={handleLogout} variant="outline" size="sm" className="w-full">
              <Icon name="LogOut" size={16} className="mr-2" />
              Выйти
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;