import json
import os
import psycopg2

def get_db_connection():
    """Получить подключение к базе данных"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL не настроен')
    return psycopg2.connect(database_url)

def handler(event, context):
    '''
    Активация регистрации - разовая функция для включения регистрации
    '''
    
    # Handle CORS OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                
                # Обновить настройки для открытия регистрации
                cur.execute("""
                    UPDATE system_settings 
                    SET is_registration_open = true, updated_at = CURRENT_TIMESTAMP
                    WHERE id = 1
                """)
                
                # Если настроек нет, создать их
                cur.execute("SELECT COUNT(*) FROM system_settings")
                count = cur.fetchone()[0]
                
                if count == 0:
                    cur.execute("""
                        INSERT INTO system_settings (site_name, is_registration_open, is_site_open, minimum_monthly_norm)
                        VALUES (%s, %s, %s, %s)
                    """, ('Панель администратора', True, True, 160))
                
                # Добавить лог
                cur.execute("""
                    INSERT INTO system_logs (type, message)
                    VALUES (%s, %s)
                """, ('system', 'Регистрация активирована через API'))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'Регистрация успешно активирована!'})
                }
                
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Ошибка: {str(e)}'})
        }