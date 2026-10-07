-- Display fields needed by the storefront and the initial admin editor.
ALTER TABLE categories
  ADD COLUMN image_url text,
  ADD COLUMN show_in_navigation boolean NOT NULL DEFAULT true,
  ADD COLUMN is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN seo_description text NOT NULL DEFAULT '';

ALTER TABLE products
  ADD COLUMN image_url text,
  ADD COLUMN badge text,
  ADD COLUMN brand text,
  ADD COLUMN unit text NOT NULL DEFAULT 'piece',
  ADD COLUMN cost_paise bigint CHECK (cost_paise IS NULL OR cost_paise >= 0),
  ADD COLUMN tax_rate_bps integer NOT NULL DEFAULT 0 CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  ADD COLUMN rating numeric(3, 2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  ADD COLUMN review_count integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  ADD COLUMN allow_backorder boolean NOT NULL DEFAULT false,
  ADD COLUMN seo_title text;

CREATE INDEX products_name_search_idx ON products USING gin (to_tsvector('simple', name || ' ' || short_description));
