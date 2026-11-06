-- Shelfie schema (spec §6). Money is integer cents. Timestamps are ISO-8601 UTC strings.
-- Applied idempotently on every connection open.

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  about TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'food' CHECK (kind IN ('food','goods','services')),
  fulfillment TEXT NOT NULL DEFAULT 'pickup' CHECK (fulfillment IN ('pickup','shipping','both')),
  pickup_notes TEXT NOT NULL DEFAULT '',
  shipping_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_fee_cents >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','paused')),
  order_cap_cents INTEGER NOT NULL DEFAULT 50000,
  owner_token_hash TEXT NOT NULL,
  menu_photo_paths TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS extractions (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running','done','failed')),
  model TEXT NOT NULL,
  raw_json TEXT,
  image_quality TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  skipped_lines_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS extractions_shop ON extractions(shop_id, created_at);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  section TEXT,
  name TEXT NOT NULL,
  description TEXT,
  source_text TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high','medium','low')),
  issues_json TEXT NOT NULL DEFAULT '[]',
  issue_detail TEXT,
  kind TEXT NOT NULL DEFAULT 'PHYSICAL' CHECK (kind IN ('PHYSICAL','SERVICE')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','in_person','removed')),
  sold_out INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  paypal_product_id TEXT UNIQUE,
  published_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_shop ON items(shop_id, sort);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  label TEXT,
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS variants_item ON variants(item_id, sort);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('awaiting_approval','approved','paid','payment_pending','failed','cancelled','expired','fulfilled')),
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('pickup','shipping')),
  buyer_name TEXT,
  buyer_note TEXT,
  agent_name TEXT,
  client_request_id TEXT,
  items_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  paypal_order_id TEXT NOT NULL UNIQUE,
  approval_url TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  capture_claimed_at TEXT,
  capture_id TEXT,
  payer_name TEXT,
  payer_email TEXT,
  ship_to_json TEXT,
  brief_json TEXT,
  brief_source TEXT CHECK (brief_source IS NULL OR brief_source IN ('agent','template')),
  paid_at TEXT,
  fulfilled_at TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  client_key TEXT, -- hashed caller identity (rate-limit key) for the per-client unpaid-order cap; added by applySchema on older databases
  UNIQUE (shop_id, client_request_id)
);
CREATE INDEX IF NOT EXISTS orders_shop ON orders(shop_id, created_at);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  label TEXT,
  unit_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  paypal_product_id TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id, sort);

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('mcp','return_url','cancel_url','webhook','poller','seller')),
  detail_json TEXT,
  created_at TEXT NOT NULL,
  seq INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS order_events_order ON order_events(order_id, seq);

CREATE TABLE IF NOT EXISTS trackers (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  paypal_status TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (order_id, tracking_number)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  verified INTEGER NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assistant_sessions (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  messages_json TEXT NOT NULL DEFAULT '[]',
  events_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
