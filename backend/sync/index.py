import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import psycopg2
import psycopg2.extras
from pydantic import BaseModel, Field, ValidationError

class StatusUpdateRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    status: str = Field(..., pattern='^(online|afk|offline)$')
    previous_status: Optional[str] = None
    time_in_previous_status: Optional[int] = 0

class ActivityUpdateRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    total_online_time: Optional[int] = 0
    total_afk_time: Optional[int] = 0
    total_offline_time: Optional[int] = 0
    monthly_online_time: Optional[Dict[str, int]] = {}
    monthly_afk_time: Optional[Dict[str, int]] = {}
    monthly_offline_time: Optional[Dict[str, int]] = {}

def get_db_connection():
    """Получить подключение к базе данных"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL не настроен')
    return psycopg2.connect(database_url)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    API для синхронизации статусов и активности пользователей
    Args: event с httpMethod, body, queryStringParameters
    Returns: HTTP response с результатом синхронизации
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
                
                if method == 'POST':
                    body_data = json.loads(event.get('body', '{}'))
                    action = body_data.get('action')
                    
                    if action == 'update_status':
                        # Обновление статуса пользователя
                        try:
                            status_update = StatusUpdateRequest(**body_data)
                        except ValidationError as e:
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': f'Ошибка валидации: {str(e)}'})
                            }
                        
                        # Обновить статус в базе данных
                        cur.execute("""
                            UPDATE users 
                            SET status = %s, last_activity = CURRENT_TIMESTAMP, last_status_timestamp = CURRENT_TIMESTAMP
                            WHERE id = %s
                        """, (status_update.status, status_update.user_id))
                        
                        if cur.rowcount == 0:
                            return {
                                'statusCode': 404,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Пользователь не найден'})
                            }
                        
                        # Добавить запись активности
                        if status_update.time_in_previous_status and status_update.time_in_previous_status > 0:
                            cur.execute("""
                                INSERT INTO activity_records (user_id, activity_type, duration, timestamp)
                                VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                            """, (
                                status_update.user_id,
                                status_update.previous_status or 'unknown',
                                status_update.time_in_previous_status
                            ))
                        
                        conn.commit()
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'success': True,
                                'message': 'Статус обновлен',
                                'timestamp': datetime.now(timezone.utc).isoformat()
                            })
                        }
                    
                    elif action == 'update_activity':
                        # Обновление времени активности
                        try:
                            activity_update = ActivityUpdateRequest(**body_data)
                        except ValidationError as e:
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': f'Ошибка валидации: {str(e)}'})
                            }
                        
                        # Обновить время активности в базе данных
                        cur.execute("""
                            UPDATE users 
                            SET total_online_time = %s, total_afk_time = %s, total_offline_time = %s,
                                last_activity = CURRENT_TIMESTAMP
                            WHERE id = %s
                        """, (
                            activity_update.total_online_time,
                            activity_update.total_afk_time,
                            activity_update.total_offline_time,
                            activity_update.user_id
                        ))
                        
                        if cur.rowcount == 0:
                            return {
                                'statusCode': 404,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Пользователь не найден'})
                            }
                        
                        # Обновить месячную статистику - собрать все месяцы
                        all_months = set()
                        all_months.update(activity_update.monthly_online_time.keys())
                        all_months.update(activity_update.monthly_afk_time.keys())
                        all_months.update(activity_update.monthly_offline_time.keys())
                        
                        for month in all_months:
                            online_time = activity_update.monthly_online_time.get(month, 0)
                            afk_time = activity_update.monthly_afk_time.get(month, 0)
                            offline_time = activity_update.monthly_offline_time.get(month, 0)
                            
                            cur.execute("""
                                INSERT INTO user_monthly_stats (user_id, month, online_time, afk_time, offline_time)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (user_id, month)
                                DO UPDATE SET 
                                    online_time = EXCLUDED.online_time,
                                    afk_time = EXCLUDED.afk_time,
                                    offline_time = EXCLUDED.offline_time
                            """, (activity_update.user_id, month, online_time, afk_time, offline_time))
                        
                        conn.commit()
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'success': True,
                                'message': 'Активность обновлена',
                                'timestamp': datetime.now(timezone.utc).isoformat()
                            })
                        }
                    
                    elif action == 'bulk_sync':
                        # Массовая синхронизация для нескольких пользователей
                        users_data = body_data.get('users', [])
                        
                        updated_count = 0
                        for user_data in users_data:
                            user_id = user_data.get('id')
                            status = user_data.get('status')
                            total_online_time = user_data.get('totalOnlineTime', 0)
                            
                            if user_id and status:
                                cur.execute("""
                                    UPDATE users 
                                    SET status = %s, total_online_time = %s, last_activity = CURRENT_TIMESTAMP
                                    WHERE id = %s
                                """, (status, total_online_time, user_id))
                                
                                if cur.rowcount > 0:
                                    updated_count += 1
                        
                        conn.commit()
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'success': True,
                                'message': f'Обновлено {updated_count} пользователей',
                                'updated_count': updated_count
                            })
                        }
                
                elif method == 'GET':
                    # Получить состояние всех пользователей для синхронизации
                    query_params = event.get('queryStringParameters', {}) or {}
                    
                    if 'since' in query_params:
                        # Получить изменения с определенного времени
                        since_timestamp = query_params['since']
                        cur.execute("""
                            SELECT id, login, nickname, status, last_activity, 
                                   total_online_time, total_afk_time, total_offline_time,
                                   admin_level, is_blocked
                            FROM users 
                            WHERE last_activity > %s OR updated_at > %s
                            ORDER BY last_activity DESC
                        """, (since_timestamp, since_timestamp))
                    else:
                        # Получить всех пользователей
                        cur.execute("""
                            SELECT id, login, nickname, status, last_activity, 
                                   total_online_time, total_afk_time, total_offline_time,
                                   admin_level, is_blocked
                            FROM users 
                            ORDER BY last_activity DESC
                        """)
                    
                    users = cur.fetchall()
                    
                    users_list = []
                    for user in users:
                        users_list.append({
                            'id': user[0],
                            'login': user[1],
                            'nickname': user[2],
                            'status': user[3],
                            'lastActivity': user[4].isoformat() if user[4] else None,
                            'totalOnlineTime': user[5] or 0,
                            'totalAfkTime': user[6] or 0,
                            'totalOfflineTime': user[7] or 0,
                            'adminLevel': user[8] or 0,
                            'isBlocked': user[9] or False
                        })
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'users': users_list,
                            'timestamp': datetime.now(timezone.utc).isoformat(),
                            'count': len(users_list)
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