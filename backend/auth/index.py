import json
import os
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import psycopg2
import psycopg2.extras
from pydantic import BaseModel, Field, ValidationError

class RegisterRequest(BaseModel):
    login: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    nickname: str = Field(..., min_length=2, max_length=50)
    email: Optional[str] = Field(None, max_length=100)

class LoginRequest(BaseModel):
    login: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)

def get_db_connection():
    """Получить подключение к базе данных"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL не настроен')
    return psycopg2.connect(database_url)

def hash_password(password: str) -> str:
    """Хешировать пароль с солью"""
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{password_hash}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Проверить пароль"""
    try:
        salt, hash_value = stored_hash.split(':')
        password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return password_hash == hash_value
    except:
        return False

def create_super_admin():
    """Создать супер-админа если его нет"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Проверить существует ли супер-админ
                cur.execute("SELECT id FROM users WHERE login = %s", ('superadmin',))
                if cur.fetchone():
                    return False  # Уже существует
                
                # Создать супер-админа
                super_admin_password = 'Admin2024!SuperSecure'
                password_hash = hash_password(super_admin_password)
                
                cur.execute("""
                    INSERT INTO users (id, login, nickname, password_hash, admin_level, status, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                """, (
                    'superadmin_001',
                    'superadmin', 
                    'Супер Администратор',
                    password_hash,
                    10,
                    'offline'
                ))
                
                # Добавить запись в логи
                cur.execute("""
                    INSERT INTO system_logs (type, message)
                    VALUES (%s, %s)
                """, ('system', f'Создан супер-администратор с логином: superadmin'))
                
                conn.commit()
                return True
    except Exception as e:
        print(f"Error creating super admin: {e}")
        return False

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Система аутентификации и регистрации пользователей
    Args: event с httpMethod, body, queryStringParameters
    Returns: HTTP response с результатом операции
    '''
    method: str = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS request
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    # Инициализация - создать супер-админа при первом запуске
    create_super_admin()
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                
                if method == 'POST':
                    body_data = json.loads(event.get('body', '{}'))
                    action = body_data.get('action')
                    
                    if action == 'register':
                        # Регистрация нового пользователя
                        try:
                            register_data = RegisterRequest(**body_data)
                        except ValidationError as e:
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': f'Ошибка валидации: {str(e)}'})
                            }
                        
                        # Проверка уникальности логина
                        cur.execute("SELECT id FROM users WHERE login = %s", (register_data.login,))
                        if cur.fetchone():
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Пользователь с таким логином уже существует'})
                            }
                        
                        # Проверка уникальности никнейма
                        cur.execute("SELECT id FROM users WHERE nickname = %s", (register_data.nickname,))
                        if cur.fetchone():
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Пользователь с таким никнеймом уже существует'})
                            }
                        
                        # Проверка силы пароля
                        if len(register_data.password) < 6:
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Пароль должен содержать минимум 6 символов'})
                            }
                        
                        # Создание пользователя
                        user_id = f"user_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(4)}"
                        password_hash = hash_password(register_data.password)
                        
                        cur.execute("""
                            INSERT INTO users (id, login, nickname, password_hash, admin_level, status, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                        """, (
                            user_id, 
                            register_data.login, 
                            register_data.nickname, 
                            password_hash, 
                            1,  # Базовый уровень доступа
                            'offline'
                        ))
                        
                        # Добавить запись в системные логи
                        cur.execute("""
                            INSERT INTO system_logs (type, message)
                            VALUES (%s, %s)
                        """, ('registration', f'Зарегистрирован новый пользователь: {register_data.nickname} ({register_data.login})'))
                        
                        # Добавить запись в системные действия
                        cur.execute("""
                            INSERT INTO system_actions (id, admin_id, action, target, timestamp)
                            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                        """, (
                            f"action_{int(datetime.now().timestamp() * 1000)}",
                            'system',
                            'Регистрация пользователя',
                            register_data.nickname
                        ))
                        
                        conn.commit()
                        
                        return {
                            'statusCode': 201,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'success': True,
                                'message': 'Пользователь успешно зарегистрирован',
                                'user': {
                                    'id': user_id,
                                    'login': register_data.login,
                                    'nickname': register_data.nickname,
                                    'adminLevel': 1
                                }
                            })
                        }
                    
                    elif action == 'login':
                        # Аутентификация пользователя
                        try:
                            login_data = LoginRequest(**body_data)
                        except ValidationError as e:
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': f'Ошибка валидации: {str(e)}'})
                            }
                        
                        cur.execute("""
                            SELECT id, login, nickname, password_hash, admin_level, 
                                   status, is_blocked, block_reason, total_online_time,
                                   total_afk_time, total_offline_time, monthly_norm
                            FROM users WHERE login = %s
                        """, (login_data.login,))
                        user = cur.fetchone()
                        
                        if not user:
                            return {
                                'statusCode': 401,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Неверные данные для входа'})
                            }
                        
                        if user[6]:  # is_blocked
                            return {
                                'statusCode': 403,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': f'Аккаунт заблокирован: {user[7]}'})
                            }
                        
                        if not verify_password(login_data.password, user[3]):
                            return {
                                'statusCode': 401,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Неверные данные для входа'})
                            }
                        
                        # Обновить статус на онлайн и время последней активности
                        cur.execute("""
                            UPDATE users SET status = 'online', last_activity = CURRENT_TIMESTAMP,
                                           last_status_timestamp = CURRENT_TIMESTAMP
                            WHERE id = %s
                        """, (user[0],))
                        
                        # Добавить запись в логи активности
                        cur.execute("""
                            INSERT INTO activity_records (user_id, activity_type, timestamp)
                            VALUES (%s, %s, CURRENT_TIMESTAMP)
                        """, (user[0], 'login'))
                        
                        # Получить месячную статистику
                        cur.execute("""
                            SELECT month, online_time, afk_time, offline_time
                            FROM user_monthly_stats WHERE user_id = %s
                        """, (user[0],))
                        monthly_stats = cur.fetchall()
                        
                        monthly_online = {stat[0]: stat[1] for stat in monthly_stats}
                        monthly_afk = {stat[0]: stat[2] for stat in monthly_stats}
                        monthly_offline = {stat[0]: stat[3] for stat in monthly_stats}
                        
                        conn.commit()
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'success': True,
                                'user': {
                                    'id': user[0],
                                    'login': user[1],
                                    'nickname': user[2],
                                    'adminLevel': user[4],
                                    'status': 'online',
                                    'totalOnlineTime': user[8] or 0,
                                    'totalAfkTime': user[9] or 0,
                                    'totalOfflineTime': user[10] or 0,
                                    'monthlyNorm': user[11] or 160,
                                    'isBlocked': user[6],
                                    'monthlyOnlineTime': monthly_online,
                                    'monthlyAfkTime': monthly_afk,
                                    'monthlyOfflineTime': monthly_offline,
                                    'createdAt': datetime.now().isoformat(),
                                    'activityHistory': []
                                }
                            })
                        }
                    
                    elif action == 'logout':
                        # Выход пользователя
                        user_id = body_data.get('userId')
                        if user_id:
                            cur.execute("""
                                UPDATE users SET status = 'offline', last_activity = CURRENT_TIMESTAMP
                                WHERE id = %s
                            """, (user_id,))
                            
                            cur.execute("""
                                INSERT INTO activity_records (user_id, activity_type, timestamp)
                                VALUES (%s, %s, CURRENT_TIMESTAMP)
                            """, (user_id, 'logout'))
                            
                            conn.commit()
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'success': True, 'message': 'Выход выполнен'})
                        }
                
                elif method == 'GET':
                    # Получить информацию о системе
                    cur.execute("SELECT COUNT(*) FROM users")
                    total_users = cur.fetchone()[0]
                    
                    cur.execute("SELECT COUNT(*) FROM users WHERE status = 'online'")
                    online_users = cur.fetchone()[0]
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'system': {
                                'totalUsers': total_users,
                                'onlineUsers': online_users,
                                'registrationEnabled': True
                            }
                        })
                    }
                
                else:
                    return {
                        'statusCode': 405,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Метод не поддерживается'})
                    }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Внутренняя ошибка сервера: {str(e)}'})
        }