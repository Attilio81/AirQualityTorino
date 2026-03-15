-- AirQuality Torino — initial schema
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query → Paste → Run

CREATE TABLE measurements (
  id            BIGSERIAL PRIMARY KEY,
  pollutant     TEXT    NOT NULL,
  station       TEXT    NOT NULL,
  date          DATE    NOT NULL,
  value         REAL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pollutant, station, date)
);

CREATE TABLE weather (
  id            BIGSERIAL PRIMARY KEY,
  city          TEXT    NOT NULL,
  date          DATE    NOT NULL,
  tmax          REAL,
  tmin          REAL,
  tmed          REAL,
  prec          REAL,
  sr_max        REAL,
  sr_tot        REAL,
  ur_med        REAL,
  v_med         REAL,
  v_max         REAL,
  p_max         REAL,
  p_min         REAL,
  p_med         REAL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, date)
);

CREATE TABLE stations (
  name       TEXT    PRIMARY KEY,
  lat        REAL    NOT NULL,
  lon        REAL    NOT NULL,
  pollutants TEXT[]  NOT NULL DEFAULT '{}'
);

-- Enable Row Level Security
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations     ENABLE ROW LEVEL SECURITY;

-- Public read-only (anon can SELECT, cannot INSERT/UPDATE/DELETE)
CREATE POLICY "public read" ON measurements FOR SELECT TO anon USING (true);
CREATE POLICY "public read" ON weather      FOR SELECT TO anon USING (true);
CREATE POLICY "public read" ON stations     FOR SELECT TO anon USING (true);
