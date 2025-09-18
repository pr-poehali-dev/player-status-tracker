import json
import os
from typing import Dict, Any
import psycopg2
import psycopg2.extras
from pydantic import BaseModel

class SettingsUpdate(BaseModel):
    is_registration_open: bool = None
    site_name: str = None
    is_site_open: bool = None
    maintenance_message: str = None
    session_timeout: int = None
    afk_timeout: int = None
    minimum_monthly_norm: int = None

def get_db_connection():
    """Получить подключение к базе данных"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL не настроен')
    return psycopg2.connect(database_url)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    API для управления настройками системы
    Args: event с httpMethod, body
    Returns: HTTP response с настройками системы
    '''
    method: str = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS request
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                
                if method == 'GET':
                    # Получить настройки системы
                    cur.execute("SELECT * FROM system_settings ORDER BY id LIMIT 1")
                    settings = cur.fetchone()
                    
                    if settings:
                        settings_dict = dict(settings)
                        # Конвертируем snake_case в camelCase для frontend
                        result = {
                            'id': settings_dict['id'],
                            'siteName': settings_dict['site_name'],
                            'isRegistrationOpen': settings_dict['is_registration_open'],
                            'isSiteOpen': settings_dict['is_site_open'],
                            'maintenanceMessage': settings_dict['maintenance_message'],
                            'emergencyCode': settings_dict['emergency_code'],
                            'sessionTimeout': settings_dict['session_timeout'],
                            'afkTimeout': settings_dict['afk_timeout'],
                            'minimumMonthlyNorm': settings_dict['minimum_monthly_norm'],
                            'createdAt': settings_dict['created_at'].isoformat() if settings_dict['created_at'] else None,
                            'updatedAt': settings_dict['updated_at'].isoformat() if settings_dict['updated_at'] else None
                        }
                    else:
                        # Создать настройки по умолчанию
                        cur.execute("""
                            INSERT INTO system_settings (site_name, is_registration_open, is_site_open, minimum_monthly_norm)
                            VALUES (%s, %s, %s, %s)
                            RETURNING *
                        """, ('Панель администратора', True, True, 160))
                        settings = cur.fetchone()
                        conn.commit()
                        
                        settings_dict = dict(settings)
                        result = {
                            'id': settings_dict['id'],
                            'siteName': settings_dict['site_name'],
                            'isRegistrationOpen': settings_dict['is_registration_open'],
                            'isSiteOpen': settings_dict['is_site_open'],
                            'maintenanceMessage': settings_dict['maintenance_message'],
                            'emergencyCode': settings_dict['emergency_code'],
                            'sessionTimeout': settings_dict['session_timeout'],
                            'afkTimeout': settings_dict['afk_timeout'],
                            'minimumMonthlyNorm': settings_dict['minimum_monthly_norm'],
                            'createdAt': settings_dict['created_at'].isoformat() if settings_dict['created_at'] else None,
                            'updatedAt': settings_dict['updated_at'].isoformat() if settings_dict['updated_at'] else None
                        }
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps(result)
                    }
                
                elif method == 'PUT':
                    # Обновить настройки системы
                    body_data = json.loads(event.get('body', '{}'))
                    updates = SettingsUpdate(**body_data)
                    
                    # Построить динамический запрос на обновление
                    update_fields = []
                    update_values = []
                    
                    if updates.is_registration_open is not None:
                        update_fields.append('is_registration_open = %s')
                        update_values.append(updates.is_registration_open)
                    
                    if updates.site_name:
                        update_fields.append('site_name = %s')
                        update_values.append(updates.site_name)
                    
                    if updates.is_site_open is not None:
                        update_fields.append('is_site_open = %s')
                        update_values.append(updates.is_site_open)
                    
                    if updates.maintenance_message:
                        update_fields.append('maintenance_message = %s')
                        update_values.append(updates.maintenance_message)
                    
                    if updates.session_timeout is not None:
                        update_fields.append('session_timeout = %s')
                        update_values.append(updates.session_timeout)
                    
                    if updates.afk_timeout is not None:
                        update_fields.append('afk_timeout = %s')
                        update_values.append(updates.afk_timeout)
                    
                    if updates.minimum_monthly_norm is not None:
                        update_fields.append('minimum_monthly_norm = %s')
                        update_values.append(updates.minimum_monthly_norm)
                    
                    if update_fields:
                        # Добавляем обновление updated_at
                        update_fields.append('updated_at = CURRENT_TIMESTAMP')
                        
                        # Получаем ID настроек
                        cur.execute("SELECT id FROM system_settings ORDER BY id LIMIT 1")
                        settings_row = cur.fetchone()
                        
                        if settings_row:
                            settings_id = settings_row['id']
                            update_values.append(settings_id)
                            query = f"UPDATE system_settings SET {', '.join(update_fields)} WHERE id = %s RETURNING *"
                            cur.execute(query, update_values)
                        else:
                            # Создать новые настройки если не существуют
                            cur.execute("""
                                INSERT INTO system_settings (site_name, is_registration_open, is_site_open, minimum_monthly_norm)
                                VALUES (%s, %s, %s, %s)
                                RETURNING *
                            """, (
                                updates.site_name or 'Панель администратора',
                                updates.is_registration_open if updates.is_registration_open is not None else True,
                                updates.is_site_open if updates.is_site_open is not None else True,
                                updates.minimum_monthly_norm or 160
                            ))
                        
                        updated_settings = cur.fetchone()
                        conn.commit()
                        
                        # Добавить лог изменений
                        cur.execute("""
                            INSERT INTO system_logs (type, message)
                            VALUES (%s, %s)
                        """, ('system', f'Обновлены настройки системы: {", ".join(update_fields)}'))
                        conn.commit()
                        
                        settings_dict = dict(updated_settings)
                        result = {
                            'id': settings_dict['id'],
                            'siteName': settings_dict['site_name'],
                            'isRegistrationOpen': settings_dict['is_registration_open'],
                            'isSiteOpen': settings_dict['is_site_open'],
                            'maintenanceMessage': settings_dict['maintenance_message'],
                            'emergencyCode': settings_dict['emergency_code'],
                            'sessionTimeout': settings_dict['session_timeout'],
                            'afkTimeout': settings_dict['afk_timeout'],
                            'minimumMonthlyNorm': settings_dict['minimum_monthly_norm'],
                            'createdAt': settings_dict['created_at'].isoformat() if settings_dict['created_at'] else None,
                            'updatedAt': settings_dict['updated_at'].isoformat() if settings_dict['updated_at'] else None
                        }
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps(result)
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
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Внутренняя ошибка сервера: {str(e)}'})
        }