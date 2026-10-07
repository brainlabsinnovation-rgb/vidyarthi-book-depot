-- Eligibility and stacking rules are enforced by the checkout service later.
CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text NOT NULL DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  max_discount_paise bigint CHECK (max_discount_paise IS NULL OR max_discount_paise > 0),
  minimum_order_paise bigint NOT NULL DEFAULT 0 CHECK (minimum_order_paise >= 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_valid_window CHECK (ends_at > starts_at),
  CONSTRAINT offers_valid_discount CHECK (
    (discount_type = 'percentage' AND discount_value <= 10000) OR
    (discount_type = 'fixed' AND max_discount_paise IS NULL)
  )
);
-- Percentage values use basis points: 10000 = 100%; fixed values use paise.
CREATE INDEX offers_active_window_idx ON offers(is_active, starts_at, ends_at);

CREATE TABLE offer_products (
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, product_id)
);
CREATE INDEX offer_products_product_idx ON offer_products(product_id);

CREATE TABLE offer_categories (
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, category_id)
);
CREATE INDEX offer_categories_category_idx ON offer_categories(category_id);
