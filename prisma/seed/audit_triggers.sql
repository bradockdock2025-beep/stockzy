-- Audit triggers for categories, orders, users, inventory, customers, addresses, customer_consents, shipments, shipment_events
-- Requires audit_logs table to exist.

CREATE SCHEMA IF NOT EXISTS audit;

CREATE OR REPLACE FUNCTION audit.log_change() RETURNS trigger AS $$
DECLARE
  actor_id uuid;
  actor_email text;
  actor_role text;
  ip_address text;
  user_agent text;
  entity_id text;
  before_state jsonb;
  after_state jsonb;
BEGIN
  BEGIN
    actor_id := nullif(current_setting('app.actor_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    actor_id := NULL;
  END;

  actor_email := nullif(current_setting('app.actor_email', true), '');
  actor_role := nullif(current_setting('app.actor_role', true), '');
  ip_address := nullif(current_setting('app.ip', true), '');
  user_agent := nullif(current_setting('app.user_agent', true), '');

  entity_id := COALESCE(NEW.id::text, OLD.id::text);

  IF TG_TABLE_NAME IN ('users', 'customers') THEN
    before_state := CASE WHEN OLD IS NULL THEN NULL ELSE to_jsonb(OLD) - 'password_hash' END;
    after_state := CASE WHEN NEW IS NULL THEN NULL ELSE to_jsonb(NEW) - 'password_hash' END;
  ELSE
    before_state := CASE WHEN OLD IS NULL THEN NULL ELSE to_jsonb(OLD) END;
    after_state := CASE WHEN NEW IS NULL THEN NULL ELSE to_jsonb(NEW) END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      actor_id, actor_email, actor_role, action, entity, entity_id,
      before_state, after_state, ip_address, user_agent, created_at
    ) VALUES (
      actor_id, actor_email, actor_role, 'create', TG_TABLE_NAME, entity_id,
      NULL, after_state, ip_address, user_agent, now()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      actor_id, actor_email, actor_role, action, entity, entity_id,
      before_state, after_state, ip_address, user_agent, created_at
    ) VALUES (
      actor_id, actor_email, actor_role, 'update', TG_TABLE_NAME, entity_id,
      before_state, after_state, ip_address, user_agent, now()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      actor_id, actor_email, actor_role, action, entity, entity_id,
      before_state, after_state, ip_address, user_agent, created_at
    ) VALUES (
      actor_id, actor_email, actor_role, 'delete', TG_TABLE_NAME, entity_id,
      before_state, NULL, ip_address, user_agent, now()
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_users_changes ON users;
CREATE TRIGGER audit_users_changes
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS audit_categories_changes ON categories;
CREATE TRIGGER audit_categories_changes
AFTER INSERT OR UPDATE OR DELETE ON categories
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS audit_orders_changes ON orders;
CREATE TRIGGER audit_orders_changes
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS audit_inventory_changes ON inventory;
CREATE TRIGGER audit_inventory_changes
AFTER INSERT OR UPDATE OR DELETE ON inventory
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS audit_customers_changes ON customers;
CREATE TRIGGER audit_customers_changes
AFTER INSERT OR UPDATE OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS audit_addresses_changes ON addresses;
CREATE TRIGGER audit_addresses_changes
AFTER INSERT OR UPDATE OR DELETE ON addresses
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS audit_customer_consents_changes ON customer_consents;
CREATE TRIGGER audit_customer_consents_changes
AFTER INSERT OR UPDATE OR DELETE ON customer_consents
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS audit_shipments_changes ON shipments;
CREATE TRIGGER audit_shipments_changes
AFTER INSERT OR UPDATE OR DELETE ON shipments
FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS audit_shipment_events_changes ON shipment_events;
CREATE TRIGGER audit_shipment_events_changes
AFTER INSERT OR UPDATE OR DELETE ON shipment_events
FOR EACH ROW EXECUTE FUNCTION audit.log_change();
