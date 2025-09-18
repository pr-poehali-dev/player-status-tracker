import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/ui/icon';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, updateStatus } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', label: 'Дашборд', icon: 'BarChart3' },
    { path: '/my-statistics', label: 'Моя статистика', icon: 'User' },
    ...(user && user.adminLevel >= 3 ? [
      { path: '/players', label: 'Игроки', icon: 'Users' },
      { path: '/statistics', label: 'Статистика', icon: 'TrendingUp' },
    ] : []),
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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-white shadow-sm border-r border-gray-200 transition-transform duration-300 ease-in-out
      `}>
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
              onClick={() => setSidebarOpen(false)}
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
              {user && (
                <StatusBadge 
                  status={user.status as 'online' | 'afk' | 'offline'} 
                  userId={user.id}
                  nickname={user.nickname}
                  clickable={true}
                  showIcon={true}
                />
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {user && (
                <StatusBadge 
                  status={user.status as 'online' | 'afk' | 'offline'} 
                  userId={user.id}
                  nickname={user.nickname}
                  clickable={false}
                  showIcon={true}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.nickname}</p>
                <p className="text-xs text-gray-500">Уровень {user?.adminLevel}</p>
              </div>
            </div>
            
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              size="sm" 
              className="w-full"
            >
              <Icon name="LogOut" size={16} className="mr-2" />
              Выйти
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <Icon name="Menu" size={24} />
          </button>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(user?.status || 'offline')}`} />
            <span className="text-sm font-medium">{user?.nickname}</span>
          </div>
        </div>
        
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;