-- Migration: Create recurring_availability table for Doctor Availability feature

CREATE TABLE IF NOT EXISTS recurring_availability (
  id SERIAL PRIMARY KEY,
  "dayOfWeek" VARCHAR(20) NOT NULL,
  "startTime" VARCHAR(10) NOT NULL,
  "endTime" VARCHAR(10) NOT NULL,
  "doctorId" INT REFERENCES doctor("id") ON DELETE CASCADE
);