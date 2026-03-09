-- Add latitude and longitude columns to the bygder table
ALTER TABLE bygder 
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

-- Optional: Add a check constraint to ensure valid coordinates
-- ALTER TABLE bygder 
-- ADD CONSTRAINT valid_latitude CHECK (latitude BETWEEN -90 AND 90),
-- ADD CONSTRAINT valid_longitude CHECK (longitude BETWEEN -180 AND 180);

-- Example update for a bygd (You will need to update your existing bygder with real coordinates)
-- UPDATE bygder SET latitude = 62.37, longitude = 6.03 WHERE name = 'Hareid';
