-- Staging table for raw crawl data
CREATE TABLE IF NOT EXISTS crawled_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID,
  source_url TEXT NOT NULL,
  source_label TEXT,
  name TEXT,
  builder_name TEXT,
  locality TEXT,
  city TEXT DEFAULT 'Bangalore',
  price_min NUMERIC,
  price_max NUMERIC,
  price_display TEXT,
  property_type TEXT,
  bedrooms TEXT,
  area_min NUMERIC,
  area_max NUMERIC,
  area_unit TEXT DEFAULT 'sqft',
  rera_id TEXT,
  rera_status TEXT,
  status TEXT,
  possession_date TEXT,
  amenities TEXT[],
  raw_extracted JSONB,
  match_status TEXT DEFAULT 'pending'
    CHECK (match_status IN ('pending', 'new', 'matched', 'updated', 'rejected')),
  matched_property_id UUID REFERENCES properties(id),
  changes_detected JSONB,       -- {field: {old, new}} for updates
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crawled_match_status ON crawled_properties (match_status);
CREATE INDEX IF NOT EXISTS idx_crawled_run_id ON crawled_properties (crawl_run_id);
CREATE INDEX IF NOT EXISTS idx_crawled_reviewed ON crawled_properties (reviewed) WHERE NOT reviewed;
