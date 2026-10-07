-- Department -> category -> product. UUIDs keep relationships stable when slugs change.
CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text NOT NULL DEFAULT '',
  image_key text,
  color_hex char(7) CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT categories_id_department_unique UNIQUE (id, department_id),
  CONSTRAINT categories_parent_same_department FOREIGN KEY (parent_id, department_id)
    REFERENCES categories(id, department_id) ON DELETE RESTRICT
);
CREATE INDEX categories_department_order_idx ON categories(department_id, sort_order);
CREATE INDEX categories_parent_idx ON categories(parent_id);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sku text UNIQUE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  short_description text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(specifications) = 'object'),
  price_paise bigint NOT NULL CHECK (price_paise >= 0),
  mrp_paise bigint NOT NULL CHECK (mrp_paise >= price_paise),
  currency char(3) NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_status_idx ON products(category_id, status);
CREATE INDEX products_status_featured_idx ON products(status, is_featured);

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL CHECK (length(trim(storage_bucket)) > 0),
  object_key text NOT NULL CHECK (length(trim(object_key)) > 0),
  alt_text text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, object_key)
);
CREATE INDEX product_images_product_order_idx ON product_images(product_id, sort_order);
CREATE UNIQUE INDEX product_images_one_primary_idx ON product_images(product_id) WHERE is_primary;

CREATE TABLE inventory (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity_on_hand integer NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved integer NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  low_stock_threshold integer NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_reservations_within_stock CHECK (quantity_reserved <= quantity_on_hand)
);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL CHECK (reason IN ('restock', 'sale', 'return', 'correction', 'damage')),
  note text NOT NULL DEFAULT '',
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_movements_product_created_idx ON inventory_movements(product_id, created_at DESC);
