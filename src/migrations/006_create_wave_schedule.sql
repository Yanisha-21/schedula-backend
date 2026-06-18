CREATE TABLE IF NOT EXISTS wave_schedule (
  id SERIAL PRIMARY KEY,
  "dayOfWeek" VARCHAR(20) NOT NULL,
  "startTime" VARCHAR(10) NOT NULL,
  "endTime" VARCHAR(10) NOT NULL,
  "maxPatients" INT NOT NULL,
  "bookedCount" INT DEFAULT 0,
  "doctorId" INT REFERENCES doctor("id") ON DELETE CASCADE
);