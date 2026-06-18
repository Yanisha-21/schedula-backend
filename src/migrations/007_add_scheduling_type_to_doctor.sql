CREATE TYPE scheduling_type_enum AS ENUM ('STREAM', 'WAVE');

ALTER TABLE doctor 
ADD COLUMN IF NOT EXISTS "schedulingType" scheduling_type_enum DEFAULT 'STREAM';