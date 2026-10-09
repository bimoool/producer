-- Producer OS: служебные триггеры и начальные данные. Существующие таблицы не изменяются.
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER workspaces_touch BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER workspace_members_touch BEFORE UPDATE ON workspace_members FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER users_log AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
CREATE TRIGGER workspaces_log AFTER INSERT OR UPDATE OR DELETE ON workspaces FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
CREATE TRIGGER workspace_members_log AFTER INSERT OR UPDATE OR DELETE ON workspace_members FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
-- Нельзя заблокировать, разжаловать или удалить последнего владельца.
CREATE OR REPLACE FUNCTION guard_last_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_owner AND OLD.disabled_at IS NULL AND (
       TG_OP = 'DELETE' OR NEW.is_owner = false OR NEW.disabled_at IS NOT NULL
  ) AND NOT EXISTS (
       SELECT 1 FROM users u WHERE u.id <> OLD.id AND u.is_owner AND u.disabled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LAST_OWNER: нельзя отключить единственного владельца' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER users_guard_last_owner BEFORE UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION guard_last_owner();
--> statement-breakpoint
INSERT INTO users (telegram_id, display_name, is_owner) VALUES (65107390, 'Владелец', true)
ON CONFLICT (telegram_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO workspaces (slug, title, kind) VALUES
  ('vera', 'Вера', 'client'),
  ('my-content', 'Мой контент', 'personal')
ON CONFLICT (slug) DO NOTHING;
