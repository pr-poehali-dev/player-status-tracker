import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Icon name="Shield" className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900">
            Панель администратора
          </h1>
          <p className="text-xl text-gray-600 max-w-lg mx-auto">
            Система управления пользователями с мощными возможностями администрирования
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Login Card */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="text-center">
              <Icon name="LogIn" className="h-12 w-12 text-blue-600 mx-auto mb-2" />
              <CardTitle>Войти в систему</CardTitle>
              <CardDescription>
                Уже есть аккаунт? Войдите для доступа к панели управления
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/login" className="block">
                <Button className="w-full h-12 text-lg">
                  <Icon name="LogIn" className="mr-2 h-5 w-5" />
                  Войти
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Register Card */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-green-200">
            <CardHeader className="text-center">
              <Icon name="UserPlus" className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <CardTitle className="text-green-700">Регистрация</CardTitle>
              <CardDescription>
                Новый пользователь? Создайте аккаунт для начала работы
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/register" className="block">
                <Button variant="outline" className="w-full h-12 text-lg border-green-300 text-green-700 hover:bg-green-50">
                  <Icon name="UserPlus" className="mr-2 h-5 w-5" />
                  Зарегистрироваться
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Возможности системы</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center space-y-2">
                <Icon name="Users" className="h-8 w-8 text-blue-600 mx-auto" />
                <h3 className="font-medium">Управление пользователями</h3>
                <p className="text-sm text-gray-600">Создание, редактирование и администрирование</p>
              </div>
              <div className="text-center space-y-2">
                <Icon name="BarChart" className="h-8 w-8 text-green-600 mx-auto" />
                <h3 className="font-medium">Статистика</h3>
                <p className="text-sm text-gray-600">Подробная аналитика активности</p>
              </div>
              <div className="text-center space-y-2">
                <Icon name="Shield" className="h-8 w-8 text-purple-600 mx-auto" />
                <h3 className="font-medium">Безопасность</h3>
                <p className="text-sm text-gray-600">Современная система защиты</p>
              </div>
              <div className="text-center space-y-2">
                <Icon name="Database" className="h-8 w-8 text-orange-600 mx-auto" />
                <h3 className="font-medium">База данных</h3>
                <p className="text-sm text-gray-600">Надежное хранение данных</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Современная система управления с базой данных PostgreSQL</p>
        </div>
      </div>
    </div>
  );
};

export default Home;