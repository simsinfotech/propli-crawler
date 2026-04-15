-- Crawl run logs
CREATE TABLE IF NOT EXISTS scrape_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  total_sources INTEGER,
  successful_sources INTEGER,
  failed_sources INTEGER,
  total_properties_found INTEGER,
  new_properties INTEGER,
  updated_properties INTEGER,
  matched_properties INTEGER,
  source_details JSONB,          -- [{url, label, status, properties_found, error?}]
  notifications_sent JSONB,      -- {slack: bool, whatsapp: bool, email: bool}
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_started ON scrape_logs (started_at DESC);
