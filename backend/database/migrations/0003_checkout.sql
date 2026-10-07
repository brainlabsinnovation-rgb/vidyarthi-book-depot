-- Customer authentication identities will be linked by a later auth migration.
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone text UNIQUE,
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  recipient_name text NOT NULL CHECK (length(trim(recipient_name)) > 0),
  phone text NOT NULL CHECK (length(trim(phone)) > 0),
  line_1 text NOT NULL CHECK (length(trim(line_1)) > 0),
  line_2 text NOT NULL DEFAULT '',
  city text NOT NULL CHECK (length(trim(city)) > 0),
  state text NOT NULL CHECK (length(trim(state)) > 0),
  postal_code text NOT NULL CHECK (length(trim(postal_code)) > 0),
  country_code char(2) NOT NULL DEFAULT 'IN',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_customer_idx ON customer_addresses(customer_id);
CREATE UNIQUE INDEX customer_addresses_one_default_idx ON customer_addresses(customer_id) WHERE is_default;

CREATE TABLE carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  session_key text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT carts_owner_required CHECK (customer_id IS NOT NULL OR session_key IS NOT NULL)
);
CREATE INDEX carts_customer_status_idx ON carts(customer_id, status);

CREATE TABLE cart_items (
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  cart_id uuid UNIQUE REFERENCES carts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled', 'refunded')),
  fulfillment_type text NOT NULL CHECK (fulfillment_type IN ('pickup', 'delivery')),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal_paise bigint NOT NULL CHECK (subtotal_paise >= 0),
  discount_paise bigint NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  delivery_paise bigint NOT NULL DEFAULT 0 CHECK (delivery_paise >= 0),
  tax_paise bigint NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
  total_paise bigint GENERATED ALWAYS AS (subtotal_paise - discount_paise + delivery_paise + tax_paise) STORED,
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  customer_name text NOT NULL CHECK (length(trim(customer_name)) > 0),
  customer_email text,
  customer_phone text NOT NULL CHECK (length(trim(customer_phone)) > 0),
  notes text NOT NULL DEFAULT '',
  placed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_discount_within_subtotal CHECK (discount_paise <= subtotal_paise)
);
CREATE INDEX orders_customer_placed_idx ON orders(customer_id, placed_at DESC);
CREATE INDEX orders_status_placed_idx ON orders(status, placed_at DESC);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_sku text,
  product_image_key text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_paise bigint NOT NULL CHECK (unit_price_paise >= 0),
  unit_mrp_paise bigint NOT NULL CHECK (unit_mrp_paise >= unit_price_paise),
  discount_paise bigint NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  line_total_paise bigint GENERATED ALWAYS AS (quantity::bigint * unit_price_paise - discount_paise) STORED,
  CONSTRAINT order_items_discount_within_line CHECK (discount_paise <= quantity::bigint * unit_price_paise)
);
CREATE INDEX order_items_order_idx ON order_items(order_id);

CREATE TABLE order_addresses (
  order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  phone text NOT NULL,
  line_1 text NOT NULL,
  line_2 text NOT NULL DEFAULT '',
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'IN'
);

CREATE TABLE order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text NOT NULL DEFAULT '',
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_time_idx ON order_status_history(order_id, changed_at);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_order_id text,
  provider_payment_id text,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_order_id),
  UNIQUE (provider, provider_payment_id)
);
CREATE INDEX payments_order_idx ON payments(order_id);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_event_id)
);
