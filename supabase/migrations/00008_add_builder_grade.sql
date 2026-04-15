-- Add builder_grade column to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS builder_grade TEXT;

-- Index for filtering by grade
CREATE INDEX IF NOT EXISTS idx_properties_builder_grade ON properties (builder_grade);

-- Backfill existing properties based on builder_name
UPDATE properties
SET builder_grade = CASE
  -- Grade A: Premium builders
  WHEN builder_name ILIKE '%godrej%' THEN 'A'
  WHEN builder_name ILIKE '%prestige%' THEN 'A'
  WHEN builder_name ILIKE '%sobha%' THEN 'A'
  WHEN builder_name ILIKE '%brigade%' THEN 'A'
  WHEN builder_name ILIKE '%embassy%' THEN 'A'
  WHEN builder_name ILIKE '%tata%' THEN 'A'
  WHEN builder_name ILIKE '%birla%' THEN 'A'
  WHEN builder_name ILIKE '%dlf%' THEN 'A'
  WHEN builder_name ILIKE '%lodha%' THEN 'A'
  WHEN builder_name ILIKE '%mahindra%' THEN 'A'
  WHEN builder_name ILIKE '%l&t%' OR builder_name ILIKE '%l and t%' OR builder_name ILIKE '%larsen%' THEN 'A'
  WHEN builder_name ILIKE '%shapoorji%' OR builder_name ILIKE '%pallonji%' THEN 'A'
  -- Grade B: Reputable mid-tier builders
  WHEN builder_name ILIKE '%puravankara%' THEN 'B'
  WHEN builder_name ILIKE '%salarpuria%' THEN 'B'
  WHEN builder_name ILIKE '%shriram%' THEN 'B'
  WHEN builder_name ILIKE '%provident%' THEN 'B'
  WHEN builder_name ILIKE '%assetz%' THEN 'B'
  WHEN builder_name ILIKE '%bhartiya%' THEN 'B'
  WHEN builder_name ILIKE '%rohan%' THEN 'B'
  WHEN builder_name ILIKE '%tvs%' THEN 'B'
  WHEN builder_name ILIKE '%kolte%' OR builder_name ILIKE '%patil%' THEN 'B'
  WHEN builder_name ILIKE '%mantri%' THEN 'B'
  WHEN builder_name ILIKE '%sumadhura%' THEN 'B'
  WHEN builder_name ILIKE '%total environment%' THEN 'B'
  -- Grade C: Everything else
  ELSE 'C'
END
WHERE builder_grade IS NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
