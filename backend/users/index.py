import json
import os
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import psycopg2
import psycopg2.extras
from pydantic import BaseModel, Field, ValidationError

class UserRequest(BaseModel):
    login: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6)
    nickname: str = Field(..., min_length=1, max_length=100)

class LoginRequest(BaseModel):
    login: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)

class UserUpdateRequest(BaseModel):
    nickname: Optional[str] = None
    admin_level: Optional[int] = None
    monthly_norm: Optional[int] = None
    status: Optional[str] = None

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

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    API для управления пользователями в базе данных
    Args: event с httpMethod, body, queryStringParameters
    Returns: HTTP response с данными пользователей
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
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                
                if method == 'GET':
                    # Получить всех пользователей
                    query_params = event.get('queryStringParameters', {}) or {}
                    
                    if 'id' in query_params:
                        # Получить конкретного пользователя
                        cur.execute("""
                            SELECT id, login, nickname, admin_level, status, 
                                   total_online_time, total_afk_time, total_offline_time,
                                   monthly_norm, is_blocked, block_reason, 
                                   last_activity, created_at
                            FROM users WHERE id = %s
                        """, (query_params['id'],))
                        user = cur.fetchone()
                        
                        if user:
                            user_dict = {
                                'id': user[0], 'login': user[1], 'nickname': user[2],
                                'adminLevel': user[3], 'status': user[4],
                                'totalOnlineTime': user[5], 'totalAfkTime': user[6],
                                'totalOfflineTime': user[7], 'monthlyNorm': user[8],
                                'isBlocked': user[9], 'blockReason': user[10],
                                'lastActivity': user[11].isoformat() if user[11] else None,
                                'createdAt': user[12].isoformat() if user[12] else None
                            }
                            
                            # Получить месячную статистику
                            cur.execute("""
                                SELECT month, online_time, afk_time, offline_time
                                FROM user_monthly_stats WHERE user_id = %s
                            """, (user[0],))
                            monthly_stats = cur.fetchall()
                            
                            user_dict['monthlyOnlineTime'] = {stat[0]: stat[1] for stat in monthly_stats}
                            user_dict['monthlyAfkTime'] = {stat[0]: stat[2] for stat in monthly_stats}
                            user_dict['monthlyOfflineTime'] = {stat[0]: stat[3] for stat in monthly_stats}
                            
                            return {
                                'statusCode': 200,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps(user_dict)
                            }
                        else:
                            return {
                                'statusCode': 404,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Пользователь не найден'})
                            }
                    else:
                        # Получить всех пользователей
                        cur.execute("""
                            SELECT id, login, nickname, admin_level, status, 
                                   total_online_time, total_afk_time, total_offline_time,
                                   monthly_norm, is_blocked, block_reason, 
                                   last_activity, created_at
                            FROM users ORDER BY created_at DESC
                        """)
                        users = cur.fetchall()
                        
                        users_list = []
                        for user in users:
                            user_dict = {
                                'id': user[0], 'login': user[1], 'nickname': user[2],
                                'adminLevel': user[3], 'status': user[4],
                                'totalOnlineTime': user[5], 'totalAfkTime': user[6],
                                'totalOfflineTime': user[7], 'monthlyNorm': user[8],
                                'isBlocked': user[9], 'blockReason': user[10],
                                'lastActivity': user[11].isoformat() if user[11] else None,
                                'createdAt': user[12].isoformat() if user[12] else None
                            }
                            users_list.append(user_dict)
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps(users_list)
                        }
                
                elif method == 'POST':
                    body_data = json.loads(event.get('body', '{}'))
                    action = body_data.get('action')
                    
                    if action == 'register':
                        # Регистрация нового пользователя
                        user_data = UserRequest(**body_data)
                        
                        # Проверка уникальности логина
                        cur.execute("SELECT id FROM users WHERE login = %s", (user_data.login,))
                        if cur.fetchone():
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Пользователь с таким логином уже существует'})
                            }
                        
                        # Проверка уникальности никнейма
                        cur.execute("SELECT id FROM users WHERE nickname = %s", (user_data.nickname,))
                        if cur.fetchone():
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Пользователь с таким никнеймом уже существует'})
                            }
                        
                        # Создание пользователя
                        user_id = f"{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(8)}"
                        password_hash = hash_password(user_data.password)
                        
                        cur.execute("""
                            INSERT INTO users (id, login, nickname, password_hash, admin_level, status)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (user_id, user_data.login, user_data.nickname, password_hash, 0, 'offline'))
                        
                        # Добавить запись в системные логи
                        cur.execute("""
                            INSERT INTO system_logs (type, message)
                            VALUES (%s, %s)
                        """, ('system', f'Создан новый пользователь: {user_data.nickname} ({user_data.login})'))
                        
                        conn.commit()
                        
                        return {
                            'statusCode': 201,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'id': user_id,
                                'login': user_data.login,
                                'nickname': user_data.nickname,
                                'message': 'Пользователь успешно создан'
                            })
                        }
                    
                    elif action == 'login':
                        # Аутентификация пользователя
                        login_data = LoginRequest(**body_data)
                        
                        cur.execute("""
                            SELECT id, login, nickname, password_hash, admin_level, 
                                   status, is_blocked, block_reason
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
                        
                        # Обновить статус на онлайн
                        cur.execute("""
                            UPDATE users SET status = 'online', last_activity = CURRENT_TIMESTAMP
                            WHERE id = %s
                        """, (user[0],))
                        
                        # Добавить запись в логи активности
                        cur.execute("""
                            INSERT INTO activity_records (user_id, activity_type)
                            VALUES (%s, %s)
                        """, (user[0], 'login'))
                        
                        conn.commit()
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'id': user[0],
                                'login': user[1],
                                'nickname': user[2],
                                'adminLevel': user[4],
                                'status': 'online'
                            })
                        }
                
                elif method == 'PUT':
                    # Обновление пользователя
                    body_data = json.loads(event.get('body', '{}'))
                    user_id = body_data.get('userId')
                    
                    if not user_id:
                        return {
                            'statusCode': 400,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Не указан ID пользователя'})
                        }
                    
                    update_data = UserUpdateRequest(**body_data)
                    
                    # Построить динамический запрос на обновление
                    update_fields = []
                    update_values = []
                    
                    if update_data.nickname:
                        update_fields.append('nickname = %s')
                        update_values.append(update_data.nickname)
                    
                    if update_data.admin_level is not None:
                        update_fields.append('admin_level = %s')
                        update_values.append(update_data.admin_level)
                    
                    if update_data.monthly_norm is not None:
                        update_fields.append('monthly_norm = %s')
                        update_values.append(update_data.monthly_norm)
                    
                    if update_data.status:
                        update_fields.append('status = %s')
                        update_values.append(update_data.status)
                    
                    if update_fields:
                        update_values.append(user_id)
                        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
                        cur.execute(query, update_values)
                        conn.commit()
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'message': 'Пользователь обновлен'})
                        }
                    else:
                        return {
                            'statusCode': 400,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Нет данных для обновления'})
                        }
                
                else:
                    return {
                        'statusCode': 405,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Метод не поддерживается'})
                    }
    
    except ValidationError as e:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Ошибка валидации: {str(e)}'})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Внутренняя ошибка сервера: {str(e)}'})
        }