-- Добавляем UNIQUE constraint на (user_id, month) для корректной работы ON CONFLICT
ALTER TABLE t_p3899424_player_status_tracke.user_monthly_stats 
ADD CONSTRAINT user_monthly_stats_user_month_key UNIQUE (user_id, month);