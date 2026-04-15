-- Add detail_url and enrichment tracking to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS detail_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS enrichment_updated_at TIMESTAMPTZ;

-- Add detail_url to crawled_properties staging table
ALTER TABLE crawled_properties ADD COLUMN IF NOT EXISTS detail_url TEXT;

NOTIFY pgrst, 'reload schema';
