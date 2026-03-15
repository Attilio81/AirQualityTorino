# React Dashboard Design — AirQuality Torino

**Date:** 2026-03-15
**Status:** Approved

## Overview

Replace the current Streamlit dashboard with a React web application hosted on Vercel, reading air quality and weather data from Supabase (PostgreSQL). The Python downloader scripts continue running locally on a schedule, writing to both the existing SQLite file and Supabase via upsert.

## Goals

- Modern, interactive dashboard accessible publicly via Vercel
- Dark/light mode toggle
- Map of monitoring stations with PM color coding
- PM↔weather correlation charts
- No backend server to manage (frontend reads Supabase directly)

## Architecture

```
Python scripts (local, scheduled daily)
  downloader.py        → SQLite (existing) + Supabase upsert (new)
  weather_downloader.py → SQLite (existing) + Supabase upsert (new)

Supabase (PostgreSQL, hosted)
  measurements, weather, stations tables (see schema below)
  Row Level Security: public SELECT, no INSERT/UPDATE/DELETE for anon role

React + Vite (hosted on Vercel)
  └── @supabase/supabase-js  — reads data directly from Supabase
  └── Material UI (MUI v6)   — component library + theming
  └── Recharts               — time series and scatter plots
  └── React Leaflet          — station map
```

## Supabase Schema

```sql
-- Air quality measurements
CREATE TABLE measurements (
  id            BIGSERIAL PRIMARY KEY,
  pollutant     TEXT    NOT NULL,          -- 'PM10' or 'PM25'
  station       TEXT    NOT NULL,          -- e.g. 'Torino - Rebaudengo'
  date          DATE    NOT NULL,          -- YYYY-MM-DD
  value         REAL,                      -- µg/m³, NULL if missing
  downloaded_at TIMESTAMPTZ NOT NULL,
  UNIQUE (pollutant, station, date)
);

-- Weather data from UniTo observatory
CREATE TABLE weather (
  id            BIGSERIAL PRIMARY KEY,
  city          TEXT    NOT NULL,          -- 'Torino'
  date          DATE    NOT NULL,          -- YYYY-MM-DD
  tmax          REAL,                      -- °C
  tmin          REAL,                      -- °C
  tmed          REAL,                      -- °C
  prec          REAL,                      -- mm
  sr_max        REAL,                      -- W/m²
  sr_tot        REAL,                      -- MJ/m²
  ur_med        REAL,                      -- humidity %
  v_med         REAL,                      -- wind m/s avg
  v_max         REAL,                      -- wind m/s max
  p_max         REAL,                      -- pressure hPa
  p_min         REAL,                      -- pressure hPa
  p_med         REAL,                      -- pressure hPa
  downloaded_at TIMESTAMPTZ NOT NULL,
  UNIQUE (city, date)
);

-- Station metadata with coordinates (populated by downloader from Arpa API)
CREATE TABLE stations (
  name      TEXT PRIMARY KEY,              -- matches measurements.station
  lat       REAL NOT NULL,
  lon       REAL NOT NULL,
  pollutants TEXT[]                        -- e.g. ['PM10', 'PM25']
);
```

**RLS Policies (all three tables):**
```sql
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- Allow public read, no writes
CREATE POLICY "public read" ON measurements FOR SELECT TO anon USING (true);
CREATE POLICY "public read" ON weather      FOR SELECT TO anon USING (true);
CREATE POLICY "public read" ON stations     FOR SELECT TO anon USING (true);
```

The Supabase `anon` key is safe to embed in the frontend because RLS is explicitly enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) and no INSERT/UPDATE/DELETE policy exists for the anon role — requests without a matching policy are denied by default in Supabase.

## Legal Limit Thresholds

EU Directive 2008/50/EC daily limits used throughout the app:
- **PM10**: 50 µg/m³ (daily mean)
- **PM2.5**: 25 µg/m³ (daily mean, annual average target — used as daily reference)

These are hardcoded constants in `src/lib/thresholds.js`. The Trend page renders a red dashed horizontal line at these values. KPI cards count days where `value > threshold` for the selected pollutant. The app only handles PM10 and PM25 — no other pollutants are in scope. Map markers for any station/pollutant combination without a defined threshold are shown in grey and excluded from the color legend.

## Python Backend Changes

Add `supabase-py` to `requirements.txt`. Credentials from `.env` (never committed — add to `.gitignore`):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   # service_role key for write access
```

In `downloader.py`, after each successful SQLite write, upsert to Supabase:
```python
# On conflict (pollutant, station, date): update value and downloaded_at
supabase.table("measurements").upsert(records, on_conflict="pollutant,station,date").execute()
```

In `weather_downloader.py`, same pattern on `(city, date)` conflict.

In `downloader.py`, also upsert station coordinates extracted from the Arpa Piemonte API JSON response (fields: `lat`, `lon`, `nome_stazione`) into the `stations` table. The `pollutants` array is derived from which pollutant downloader is currently processing (e.g. `['PM10']` when downloading PM10) and merged with any existing value on conflict: `ON CONFLICT (name) DO UPDATE SET pollutants = stations.pollutants || EXCLUDED.pollutants` (duplicates removed in Python before upsert).

**Conflict resolution:** On conflict, always overwrite `value` and `downloaded_at` (corrected readings from Arpa may differ from earlier downloads).

## Frontend Structure

```
src/
  main.jsx
  App.jsx                  — ThemeProvider, Router, global filter state (Context)
  lib/
    supabase.js            — Supabase client (anon key from env)
    thresholds.js          — { PM10: 50, PM25: 25 }
  pages/
    Trend.jsx
    Map.jsx
    Weather.jsx
  components/
    AppBar.jsx             — Title + theme toggle
    Sidebar.jsx            — Global filters (pollutant, stations, date range)
    KpiCards.jsx           — Avg PM card + days-over-limit card
    charts/
      TimeSeriesChart.jsx
      ScatterChart.jsx
    StationMap.jsx
    EmptyState.jsx         — Shown when query returns zero rows
    ErrorBanner.jsx        — Shown on Supabase query failure
  hooks/
    useMeasurements.js
    useWeather.js
  context/
    FilterContext.jsx      — Global filter state shared across all pages
```

## Hook Interfaces

```ts
// useMeasurements({ pollutant, stations, dateFrom, dateTo })
// Returns:
{
  data: Array<{ station: string, date: string, value: number | null }>,
  loading: boolean,
  error: Error | null
}

// useWeather({ dateFrom, dateTo })
// Returns:
{
  data: Array<{ date: string, tmed: number, prec: number, v_med: number, ur_med: number }>,
  loading: boolean,
  error: Error | null
}
```

Hooks use `useEffect` + Supabase JS client. Queries re-run when filter params change. Both hooks normalize `date` fields to ISO string format `YYYY-MM-DD` before returning, ensuring the client-side join on `date` between measurements and weather always matches.

## Filter Behavior

- **Scope**: filters are global (FilterContext), shared across all pages via sidebar
- **Default on load**: last 90 days, all stations, PM10
- **Date range**: min = earliest date in `measurements`, max = today
- **Loading state**: MUI Skeleton components shown while queries are in flight
- **Zero results**: `EmptyState` component with message "Nessun dato per i filtri selezionati"
- **Error state**: `ErrorBanner` at top of page with message and retry button

## UI Layout

```
┌─────────────────────────────────────────────────┐
│ AppBar: "AirQuality Torino"        [🌙/☀️ toggle]│
├──────────┬──────────────────────────────────────┤
│ Sidebar  │  Filtri: Inquinante | Stazione | Date │
│          ├──────────────────────────────────────┤
│ 📊 Trend │  KPI cards: Media PM | Giorni >limite │
│ 🗺️ Mappa │  ──────────────────────────────────── │
│ 🌡️ Meteo │  Grafico principale (linee nel tempo) │
│          │  ──────────────────────────────────── │
│          │  [tab: Correlazione] [tab: Tabella]   │
└──────────┴──────────────────────────────────────┘
```

**Trend page:** Line chart, one line per station. Red dashed horizontal line = legal limit for selected pollutant. X axis = date, Y axis = µg/m³.

**Map page:** React Leaflet. One marker per station from `stations` table. Marker color based on average `value` in filtered date range:
- Green: avg < 50% of threshold
- Yellow: avg 50–100% of threshold
- Red: avg > threshold

Marker color is always based on the **globally selected pollutant** — if a station has no data for the selected pollutant in the filtered date range, its marker is shown grey. The Map page calls `useMeasurements` with `stations = all` (ignoring the sidebar station filter, which applies only to Trend/Weather) so all markers always have data to render. Click marker → popup showing: station name, selected pollutant, average value over the filtered date range (µg/m³, rounded to 1 decimal), and number of days with data. If no data for that station: popup shows "Nessun dato nel periodo selezionato".

**Weather page:** Four scatter plots (2×2 grid): PM vs tmed, PM vs prec, PM vs v_med, PM vs ur_med. Each point = one day. Pollutant = global filter selection. Aggregation: daily average of `value` across all selected stations from `measurements`, joined with `weather` on `date` (city = 'Torino' hardcoded — only one city is ever present). The `useWeather` hook does not accept a city parameter; it always queries `WHERE city = 'Torino'`.

## Theming

MUI `ThemeProvider` with two palettes (`light` / `dark`). Toggle button in AppBar. Preference persisted in `localStorage` under key `colorMode`. Default: `window.matchMedia('(prefers-color-scheme: dark)')`.

## Deployment

- **Frontend**: Vercel, auto-deploy on push to `main`. Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Supabase**: Free tier sufficient.
- **Python scripts**: unchanged scheduling. `.env` file with `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`. Add `.env` to `.gitignore`.

## Out of Scope

- User authentication
- Real-time subscriptions (daily batch is sufficient)
- Mobile-native app
- Hourly or sub-daily data granularity
