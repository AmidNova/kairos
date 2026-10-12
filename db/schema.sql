-- Schéma Kairos. Idempotent : `npm run db:init` peut être relancé sans risque.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  name VARCHAR(255),
  image TEXT,
  current_price DECIMAL,
  in_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL NOT NULL,
  in_stock BOOLEAN,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_history_product_checked_idx
  ON price_history (product_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  target_price DECIMAL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations pour les bases créées avec l'ancien schéma
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_url_key') THEN
    ALTER TABLE products ADD CONSTRAINT products_url_key UNIQUE (url);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_user_product_key') THEN
    -- Garde l'alerte la plus récente avant de poser la contrainte
    DELETE FROM alerts a USING alerts b
      WHERE a.user_id = b.user_id AND a.product_id = b.product_id AND a.id < b.id;
    ALTER TABLE alerts ADD CONSTRAINT alerts_user_product_key UNIQUE (user_id, product_id);
  END IF;
END$$;

-- Les anciennes colonnes TIMESTAMP (sans fuseau) étaient relues dans le fuseau
-- local par node-postgres : l'historique était décalé. NOW() écrivait en UTC.
DO $$
DECLARE col RECORD;
BEGIN
  FOR col IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('users', 'products', 'price_history', 'alerts')
      AND data_type = 'timestamp without time zone'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
      col.table_name, col.column_name, col.column_name
    );
  END LOOP;
END$$;
