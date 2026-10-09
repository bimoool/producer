-- Неизменяемость декларации: после фиксации (locked_at) содержательные поля менять нельзя.
CREATE OR REPLACE FUNCTION guard_declaration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'DECLARATION_LOCKED: зафиксированную декларацию нельзя удалить' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.locked_at IS NOT NULL AND (
       NEW.title IS DISTINCT FROM OLD.title
    OR NEW.declared_on IS DISTINCT FROM OLD.declared_on
    OR NEW.cycle_start IS DISTINCT FROM OLD.cycle_start
    OR NEW.price_of_word IS DISTINCT FROM OLD.price_of_word
    OR NEW.reward IS DISTINCT FROM OLD.reward
    OR NEW.financial_hypothesis IS DISTINCT FROM OLD.financial_hypothesis
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
  ) THEN
    RAISE EXCEPTION 'DECLARATION_LOCKED: зафиксированную декларацию нельзя изменить' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER declarations_guard BEFORE UPDATE OR DELETE ON declarations
  FOR EACH ROW EXECUTE FUNCTION guard_declaration();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_declaration_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'DECLARATION_LOCKED: зафиксированное обязательство нельзя удалить' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.locked_at IS NOT NULL AND (
       NEW.original_text IS DISTINCT FROM OLD.original_text
    OR NEW.short_title IS DISTINCT FROM OLD.short_title
    OR NEW.target_value IS DISTINCT FROM OLD.target_value
    OR NEW.unit IS DISTINCT FROM OLD.unit
    OR NEW.completion_criteria IS DISTINCT FROM OLD.completion_criteria
    OR NEW.declaration_id IS DISTINCT FROM OLD.declaration_id
    OR NEW.position IS DISTINCT FROM OLD.position
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
  ) THEN
    RAISE EXCEPTION 'DECLARATION_LOCKED: исходный текст, цель и критерий обязательства неизменяемы' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER declaration_items_guard BEFORE UPDATE OR DELETE ON declaration_items
  FOR EACH ROW EXECUTE FUNCTION guard_declaration_item();
--> statement-breakpoint
-- История прогресса только дополняется.
CREATE OR REPLACE FUNCTION guard_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: история прогресса не редактируется и не удаляется' USING ERRCODE = 'P0001';
END $$;
--> statement-breakpoint
CREATE TRIGGER progress_updates_append_only BEFORE UPDATE OR DELETE ON progress_updates
  FOR EACH ROW EXECUTE FUNCTION guard_append_only();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER projects_touch BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER goals_touch BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER tasks_touch BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER weekly_reports_touch BEFORE UPDATE ON weekly_reports FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
-- Журнал изменений: пишет изменённые поля (diff) для основных сущностей.
CREATE OR REPLACE FUNCTION log_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  diff jsonb;
  old_j jsonb;
  new_j jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_j := to_jsonb(NEW) - 'created_at' - 'updated_at';
    INSERT INTO activity_log(entity_type, entity_id, action, changes)
      VALUES (TG_TABLE_NAME, NEW.id, 'create', new_j);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_j := to_jsonb(OLD) - 'updated_at';
    new_j := to_jsonb(NEW) - 'updated_at';
    SELECT jsonb_object_agg(n.key, jsonb_build_object('from', old_j -> n.key, 'to', n.value))
      INTO diff
      FROM jsonb_each(new_j) n
      WHERE n.value IS DISTINCT FROM old_j -> n.key;
    IF diff IS NOT NULL THEN
      INSERT INTO activity_log(entity_type, entity_id, action, changes)
        VALUES (TG_TABLE_NAME, NEW.id, 'update', diff);
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO activity_log(entity_type, entity_id, action, changes)
      VALUES (TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END $$;
--> statement-breakpoint
CREATE TRIGGER declaration_items_log AFTER INSERT OR UPDATE OR DELETE ON declaration_items FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
CREATE TRIGGER projects_log AFTER INSERT OR UPDATE OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
CREATE TRIGGER goals_log AFTER INSERT OR UPDATE OR DELETE ON goals FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
CREATE TRIGGER tasks_log AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
CREATE TRIGGER task_comments_log AFTER INSERT OR DELETE ON task_comments FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
CREATE TRIGGER progress_updates_log AFTER INSERT ON progress_updates FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
CREATE TRIGGER weekly_reports_log AFTER INSERT OR UPDATE OR DELETE ON weekly_reports FOR EACH ROW EXECUTE FUNCTION log_activity();
--> statement-breakpoint
-- История задач (TASK_EVENT) — представление поверх общего журнала.
CREATE VIEW task_events AS
  SELECT id, entity_id AS task_id, action, changes, created_at
  FROM activity_log WHERE entity_type = 'tasks';
