CREATE TABLE IF NOT EXISTS custom_availability (
  id SERIAL PRIMARY KEY,
  date VARCHAR(20) NOT NULL,
  "startTime" VARCHAR(10) NOT NULL,
  "endTime" VARCHAR(10) NOT NULL,
  "doctorId" INT REFERENCES doctor("id") ON DELETE CASCADE
);