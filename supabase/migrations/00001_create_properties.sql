-- Core properties table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_lower TEXT GENERATED ALWAYS AS (lower(trim(name))) STORED,
  builder_name TEXT,
  locality TEXT,
  city TEXT DEFAULT 'Bangalore',
  price_min NUMERIC,
  price_max NUMERIC,
  price_display TEXT,
  property_type TEXT,           -- apartment, villa, plot, commercial
  bedrooms TEXT,                -- e.g. "2,3 BHK"
  area_min NUMERIC,
  area_max NUMERIC,
  area_unit TEXT DEFAULT 'sqft',
  rera_id TEXT,
  rera_status TEXT,             -- registered, not_registered, unknown
  status TEXT DEFAULT 'active', -- active, upcoming, completed
  possession_date TEXT,
  source_url TEXT,
  amenities TEXT[],
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Composite unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_unique
  ON properties (name_lower, COALESCE(builder_name, ''), COALESCE(locality, ''));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_properties_builder ON properties (builder_name);
CREATE INDEX IF NOT EXISTS idx_properties_locality ON properties (locality);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties (status);
