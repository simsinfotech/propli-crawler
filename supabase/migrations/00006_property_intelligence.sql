-- Add intelligence columns to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS images_scraped JSONB DEFAULT '[]';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ai_project_research JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_intelligence JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_score INTEGER CHECK (location_score >= 0 AND location_score <= 100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS commute_data JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS nearby_schools JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS nearby_hospitals JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS nearby_metro JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS nearby_entertainment JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ai_buying_analysis JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS intelligence_updated_at TIMESTAMPTZ;

-- Index to prioritize properties without intelligence data
CREATE INDEX IF NOT EXISTS idx_properties_intelligence_updated
  ON properties (intelligence_updated_at NULLS FIRST);

-- Create storage bucket for property images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: anon can read images
DROP POLICY IF EXISTS "Public read access for property images" ON storage.objects;
CREATE POLICY "Public read access for property images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

-- RLS: service_role can insert images
DROP POLICY IF EXISTS "Service role insert for property images" ON storage.objects;
CREATE POLICY "Service role insert for property images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-images');

-- Reload schema cache so edge functions see new columns
NOTIFY pgrst, 'reload schema';
