-- Enable Row Level Security on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawled_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon (public) read access for dashboard
CREATE POLICY "Allow anon select on properties"
  ON properties FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon select on crawled_properties"
  ON crawled_properties FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon select on scrape_logs"
  ON scrape_logs FOR SELECT
  TO anon
  USING (true);
