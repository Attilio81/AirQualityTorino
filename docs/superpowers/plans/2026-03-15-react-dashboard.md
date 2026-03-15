# React Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Streamlit dashboard with a public React+Vite app on Vercel backed by Supabase, with PM time-series charts, a station map, and PM↔weather scatter plots.

**Architecture:** Python scripts continue running locally and upsert to Supabase after each SQLite write. The React frontend reads Supabase directly via the public anon key (RLS restricts it to SELECT only). Vercel auto-deploys on every push to `main`.

**Tech Stack:** React 18 + Vite, MUI v6, Recharts, React Leaflet, @supabase/supabase-js, Vitest + React Testing Library. Python: supabase-py added to requirements.txt.

**Spec:** `docs/superpowers/specs/2026-03-15-react-dashboard-design.md`

---

## File Map

### New files (frontend — lives in `frontend/`)
```
frontend/
  package.json
  vite.config.js
  index.html
  .env.example
  src/
    main.jsx
    App.jsx
    lib/
      supabase.js          — Supabase anon client
      thresholds.js        — { PM10: 50, PM25: 25 }
    context/
      FilterContext.jsx    — Global filter state + provider
    hooks/
      useMeasurements.js   — Query measurements table
      useWeather.js        — Query weather table
    pages/
      Trend.jsx            — Time series page
      Map.jsx              — Station map page
      Weather.jsx          — Scatter plots page
    components/
      AppBar.jsx           — Title bar + theme toggle
      Sidebar.jsx          — Filter controls
      KpiCards.jsx         — Avg PM + days-over-limit cards
      EmptyState.jsx       — Zero-results placeholder
      ErrorBanner.jsx      — Error + retry UI
      charts/
        TimeSeriesChart.jsx
        ScatterChart.jsx
      StationMap.jsx       — Leaflet map wrapper
  src/__tests__/
    lib/thresholds.test.js
    hooks/useMeasurements.test.js
    hooks/useWeather.test.js
    components/KpiCards.test.jsx
    components/EmptyState.test.jsx
    components/ErrorBanner.test.jsx
    components/charts/TimeSeriesChart.test.jsx
    components/charts/ScatterChart.test.jsx
```

### Modified files (Python backend)
```
requirements.txt           — add supabase>=2.0.0
downloader.py              — add Supabase upsert after SQLite write
weather_downloader.py      — add Supabase upsert after SQLite write
.env.example               — SUPABASE_URL, SUPABASE_SERVICE_KEY
.gitignore                 — add .env
```

---

## Chunk 1: Supabase Setup

### Task 1: Create Supabase tables and RLS

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/001_initial_schema.sql

CREATE TABLE measurements (
  id            BIGSERIAL PRIMARY KEY,
  pollutant     TEXT    NOT NULL,
  station       TEXT    NOT NULL,
  date          DATE    NOT NULL,
  value         REAL,
  downloaded_at TIMESTAMPTZ NOT NULL,
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
  downloaded_at TIMESTAMPTZ NOT NULL,
  UNIQUE (city, date)
);

CREATE TABLE stations (
  name      TEXT PRIMARY KEY,
  lat       REAL NOT NULL,
  lon       REAL NOT NULL,
  pollutants TEXT[] NOT NULL DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations     ENABLE ROW LEVEL SECURITY;

-- Public read-only
CREATE POLICY "public read" ON measurements FOR SELECT TO anon USING (true);
CREATE POLICY "public read" ON weather      FOR SELECT TO anon USING (true);
CREATE POLICY "public read" ON stations     FOR SELECT TO anon USING (true);
```

- [ ] **Step 2: Run migration via Supabase SQL editor**

Go to your Supabase project dashboard → SQL Editor → New query. Paste the full SQL from Step 1 and click **Run**.

Success: the query returns "Success. No rows returned." Go to Table Editor — confirm three tables appear: `measurements`, `weather`, `stations`, each with a shield icon (RLS enabled).

- [ ] **Step 3: Copy anon key and URL**

Go to Supabase dashboard → Settings → API. Note:
- `Project URL` → `SUPABASE_URL`
- `anon public` key → `SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_KEY` (keep secret)

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add Supabase schema with RLS"
```

---

## Chunk 2: Python Supabase Integration

### Task 2: Add supabase-py dependency

**Files:**
- Modify: `requirements.txt`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Update requirements.txt**

Add to `requirements.txt`:
```
supabase>=2.0.0
python-dotenv>=1.0.0
```

- [ ] **Step 2: Create .env.example**

```bash
# .env.example
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

- [ ] **Step 3: Update .gitignore**

Add to `.gitignore` (create if missing):
```
.env
pm_data.db
log.txt
downloads/
__pycache__/
*.pyc
```

- [ ] **Step 4: Install dependencies**

```bash
pip install -r requirements.txt
```

Expected: installs supabase, python-dotenv, and dependencies.

- [ ] **Step 5: Commit**

```bash
git add requirements.txt .env.example .gitignore
git commit -m "feat: add supabase-py dependency"
```

---

### Task 3: Supabase upsert in downloader.py

**Files:**
- Modify: `downloader.py`

- [ ] **Step 1: Create .env file (not committed)**

```bash
# .env  (never commit this)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-role-key...
```

- [ ] **Step 2: Add Supabase client initialization to downloader.py**

At the top of `downloader.py`, after existing imports:

```python
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def _get_supabase() -> Client | None:
    """Return Supabase client if credentials are configured, else None."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        logging.warning("Supabase credentials not set — skipping cloud sync")
        return None
    return create_client(url, key)
```

- [ ] **Step 3: Add upsert function for measurements**

Add this function to `downloader.py`:

```python
def _upsert_measurements(records: list[dict], supabase: Client) -> None:
    """Upsert records to Supabase measurements table."""
    if not records:
        return
    rows = [
        {
            "pollutant": r["pollutant"],
            "station":   r["station"],
            "date":      r["date"],
            "value":     r["value"],
            "downloaded_at": r["downloaded_at"],
        }
        for r in records
    ]
    supabase.table("measurements").upsert(
        rows, on_conflict="pollutant,station,date"
    ).execute()
    logging.info("Supabase: upserted %d measurement rows", len(rows))
```

- [ ] **Step 4: Add upsert function for stations**

The Arpa Piemonte JSON response contains per-station fields including `lat`, `lon`, and `nome_stazione`. One row per station is maintained in the `stations` table (keyed by `name`). The `pollutants` field is a TEXT[] array listing all pollutants measured by that station — e.g. `['PM10', 'PM25']`. Each downloader run only knows about one pollutant, so merging is done in Python by reading existing pollutants from Supabase first, then writing the union.

```python
def _upsert_stations(api_records: list[dict], pollutant: str, supabase: Client) -> None:
    """Upsert station coordinates from Arpa API JSON records.
    One row per station; pollutants[] is merged with existing values.
    Coordinates come from the lat/lon/nome_stazione fields in the Arpa JSON.
    """
    seen: dict[str, dict] = {}
    for r in api_records:
        name = r.get("nome_stazione") or r.get("station")
        lat  = r.get("lat")
        lon  = r.get("lon")
        if not name or lat is None or lon is None:
            continue
        if name not in seen:
            seen[name] = {"name": name, "lat": lat, "lon": lon, "pollutants": [pollutant]}
        elif pollutant not in seen[name]["pollutants"]:
            seen[name]["pollutants"].append(pollutant)

    if not seen:
        return

    # Read existing pollutants to merge without duplicates
    existing = (
        supabase.table("stations")
        .select("name,pollutants")
        .in_("name", list(seen.keys()))
        .execute()
        .data or []
    )
    existing_map = {row["name"]: set(row["pollutants"] or []) for row in existing}

    rows = []
    for name, info in seen.items():
        merged = existing_map.get(name, set()) | set(info["pollutants"])
        rows.append({**info, "pollutants": sorted(merged)})

    supabase.table("stations").upsert(rows, on_conflict="name").execute()
    logging.info("Supabase: upserted %d station rows", len(rows))
```

- [ ] **Step 5: Call upserts after each successful SQLite write**

In `downloader.py`, find the section that calls `store_new_records()` (or equivalent). After the SQLite write succeeds, add:

```python
supabase = _get_supabase()
if supabase:
    try:
        _upsert_measurements(new_records, supabase)
        _upsert_stations(raw_api_records, pollutant.name, supabase)
    except Exception as exc:
        logging.error("Supabase upsert failed: %s", exc)
        # Non-fatal: SQLite is source of truth
```

- [ ] **Step 6: Manual smoke test**

```bash
python downloader.py
```

Expected: log shows "Supabase: upserted N measurement rows" and "Supabase: upserted N station rows". Verify in Supabase dashboard → Table Editor → `measurements`.

- [ ] **Step 7: Commit**

```bash
git add downloader.py
git commit -m "feat: upsert PM measurements and stations to Supabase"
```

---

### Task 4: Supabase upsert in weather_downloader.py

**Files:**
- Modify: `weather_downloader.py`

- [ ] **Step 1: Add Supabase client initialization (same pattern)**

At the top of `weather_downloader.py`, after existing imports:

```python
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def _get_supabase() -> Client | None:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        logging.warning("Supabase credentials not set — skipping cloud sync")
        return None
    return create_client(url, key)
```

- [ ] **Step 2: Add upsert function for weather**

```python
def _upsert_weather(records: list[dict], supabase: Client) -> None:
    """Upsert records to Supabase weather table."""
    if not records:
        return
    supabase.table("weather").upsert(
        records, on_conflict="city,date"
    ).execute()
    logging.info("Supabase: upserted %d weather rows", len(records))
```

- [ ] **Step 3: Call upsert after each successful SQLite write**

After the existing SQLite INSERT OR REPLACE, add:

```python
supabase = _get_supabase()
if supabase:
    try:
        _upsert_weather(weather_records, supabase)
    except Exception as exc:
        logging.error("Supabase weather upsert failed: %s", exc)
```

- [ ] **Step 4: Manual smoke test**

```bash
python weather_downloader.py
```

Expected: log shows "Supabase: upserted N weather rows". Verify in Supabase dashboard → `weather` table.

- [ ] **Step 5: Commit**

```bash
git add weather_downloader.py
git commit -m "feat: upsert weather data to Supabase"
```

---

## Chunk 3: React Project Scaffold

### Task 5: Scaffold Vite + React + MUI project

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`
- Create: `frontend/.env.example`
- Create: `frontend/src/main.jsx`, `frontend/src/App.jsx`

- [ ] **Step 1: Create frontend project**

```bash
cd C:\Users\attil\OneDrive\Documenti\GitHub\InstagramClaw
npm create vite@latest frontend -- --template react
cd frontend
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
npm install @supabase/supabase-js
npm install recharts
npm install react-leaflet leaflet
npm install react-router-dom
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Configure vite.config.js**

```js
// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/__tests__/setup.js',
  },
})
```

- [ ] **Step 4: Create test setup file**

```js
// frontend/src/__tests__/setup.js
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create .env.example**

```bash
# frontend/.env.example
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Copy to `.env.local` and fill in real values (`.env.local` is gitignored by Vite by default).

- [ ] **Step 6: Run tests (expect 0 tests, no failures)**

```bash
cd frontend
npx vitest run
```

Expected: "No test files found" or "0 tests passed".

- [ ] **Step 7: Commit scaffold**

```bash
cd ..
git add frontend/
git commit -m "chore: scaffold React+Vite frontend with MUI and test setup"
```

---

### Task 6: Theming and routing shell

**Files:**
- Create: `frontend/src/lib/thresholds.js`
- Create: `frontend/src/lib/supabase.js`
- Create: `frontend/src/App.jsx` (replace scaffold)
- Create: `frontend/src/__tests__/lib/thresholds.test.js`

- [ ] **Step 1: Write thresholds test**

```js
// frontend/src/__tests__/lib/thresholds.test.js
import { describe, it, expect } from 'vitest'
import { THRESHOLDS, getThreshold } from '../../lib/thresholds'

describe('thresholds', () => {
  it('has PM10 threshold of 50', () => {
    expect(THRESHOLDS.PM10).toBe(50)
  })
  it('has PM25 threshold of 25', () => {
    expect(THRESHOLDS.PM25).toBe(25)
  })
  it('getThreshold returns correct value', () => {
    expect(getThreshold('PM10')).toBe(50)
    expect(getThreshold('PM25')).toBe(25)
  })
  it('getThreshold returns null for unknown pollutant', () => {
    expect(getThreshold('NO2')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && npx vitest run src/__tests__/lib/thresholds.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement thresholds.js**

```js
// frontend/src/lib/thresholds.js
export const THRESHOLDS = { PM10: 50, PM25: 25 }

export function getThreshold(pollutant) {
  return THRESHOLDS[pollutant] ?? null
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/lib/thresholds.test.js
```

- [ ] **Step 5: Implement supabase.js**

```js
// frontend/src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log at module load time but do NOT throw — hooks handle errors via error state.
// Hooks will receive a Supabase error response when env is missing/wrong.
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — Supabase calls will fail')
}

export const supabase = createClient(url || 'http://localhost', key || 'anon')
```

- [ ] **Step 6: Implement App.jsx with theming and routing**

```jsx
// frontend/src/App.jsx
import { useState, useMemo, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import AppBar from './components/AppBar'
import Sidebar from './components/Sidebar'
import Trend from './pages/Trend'
import Map from './pages/Map'
import Weather from './pages/Weather'
import { FilterProvider } from './context/FilterContext'
import Box from '@mui/material/Box'

export const ColorModeContext = createContext({ toggle: () => {} })

export default function App() {
  const stored = localStorage.getItem('colorMode')
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const [mode, setMode] = useState(stored ?? (systemDark ? 'dark' : 'light'))

  const colorMode = useMemo(() => ({
    toggle: () => setMode(m => {
      const next = m === 'light' ? 'dark' : 'light'
      localStorage.setItem('colorMode', next)
      return next
    })
  }), [])

  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <FilterProvider>
          <BrowserRouter>
            <AppBar />
            <Box sx={{ display: 'flex' }}>
              <Sidebar />
              <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
                <Routes>
                  <Route path="/" element={<Navigate to="/trend" replace />} />
                  <Route path="/trend" element={<Trend />} />
                  <Route path="/map" element={<Map />} />
                  <Route path="/weather" element={<Weather />} />
                </Routes>
              </Box>
            </Box>
          </BrowserRouter>
        </FilterProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/ frontend/src/App.jsx frontend/src/__tests__/lib/
git commit -m "feat: add theme switching, routing shell, and thresholds"
```

---

## Chunk 4: Data Layer

### Task 7: FilterContext

**Files:**
- Create: `frontend/src/context/FilterContext.jsx`

- [ ] **Step 1: Implement FilterContext**

Note: `defaultDateFrom` and `defaultDateTo` produce `YYYY-MM-DD` strings via `.toISOString().slice(0,10)`. These are computed once at context initialization (app boot) using `new Date()` — the 90-day window is relative to when the app first loads. FilterContext itself always holds normalized `YYYY-MM-DD` strings; hooks receive clean strings and never need to normalize filter parameters.

```jsx
// frontend/src/context/FilterContext.jsx
import { createContext, useContext, useState } from 'react'

const FilterContext = createContext(null)

function defaultDateFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)  // YYYY-MM-DD
}

function defaultDateTo() {
  return new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
}

export function FilterProvider({ children }) {
  const [pollutant, setPollutant] = useState('PM10')
  const [stations, setStations] = useState([])   // [] = all stations
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)

  return (
    <FilterContext.Provider value={{
      pollutant, setPollutant,
      stations, setStations,
      dateFrom, setDateFrom,
      dateTo, setDateTo,
    }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be used inside FilterProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/context/
git commit -m "feat: add global FilterContext"
```

---

### Task 8: useMeasurements hook

**Files:**
- Create: `frontend/src/hooks/useMeasurements.js`
- Create: `frontend/src/__tests__/hooks/useMeasurements.test.js`

- [ ] **Step 1: Write failing test**

```js
// frontend/src/__tests__/hooks/useMeasurements.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMeasurements } from '../../hooks/useMeasurements'

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  }
}))

import { supabase } from '../../lib/supabase'

const mockRows = [
  { station: 'Torino - Rebaudengo', date: '2024-01-15', value: 42.5 },
  { station: 'Torino - Consolata', date: '2024-01-15', value: 38.0 },
]

function makeChain(data, error = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}

describe('useMeasurements', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns data on success', async () => {
    supabase.from.mockReturnValue(makeChain(mockRows))
    const { result } = renderHook(() =>
      useMeasurements({ pollutant: 'PM10', stations: [], dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(mockRows)
    expect(result.current.error).toBeNull()
  })

  it('returns error on failure', async () => {
    supabase.from.mockReturnValue(makeChain(null, new Error('network error')))
    const { result } = renderHook(() =>
      useMeasurements({ pollutant: 'PM10', stations: [], dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toEqual([])
  })

  it('normalizes date to YYYY-MM-DD string', async () => {
    const rows = [{ station: 'A', date: '2024-01-15T00:00:00', value: 10 }]
    supabase.from.mockReturnValue(makeChain(rows))
    const { result } = renderHook(() =>
      useMeasurements({ pollutant: 'PM10', stations: [], dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data[0].date).toBe('2024-01-15')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && npx vitest run src/__tests__/hooks/useMeasurements.test.js
```

- [ ] **Step 3: Implement useMeasurements.js**

```js
// frontend/src/hooks/useMeasurements.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function normalizeDate(dateStr) {
  if (!dateStr) return dateStr
  return dateStr.slice(0, 10)  // ensures YYYY-MM-DD
}

export function useMeasurements({ pollutant, stations, dateFrom, dateTo }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetch() {
      let query = supabase
        .from('measurements')
        .select('station,date,value')
        .eq('pollutant', pollutant)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true })

      if (stations && stations.length > 0) {
        query = query.in('station', stations)
      }

      const { data: rows, error: err } = await query

      if (cancelled) return
      if (err) {
        setError(err)
        setData([])
      } else {
        setData((rows || []).map(r => ({ ...r, date: normalizeDate(r.date) })))
      }
      setLoading(false)
    }

    fetch()
    return () => { cancelled = true }
  }, [pollutant, stations, dateFrom, dateTo])

  return { data, loading, error }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/hooks/useMeasurements.test.js
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useMeasurements.js frontend/src/__tests__/hooks/
git commit -m "feat: add useMeasurements hook with Supabase query"
```

---

### Task 9: useWeather hook

**Files:**
- Create: `frontend/src/hooks/useWeather.js`
- Create: `frontend/src/__tests__/hooks/useWeather.test.js`

- [ ] **Step 1: Write failing test**

```js
// frontend/src/__tests__/hooks/useWeather.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWeather } from '../../hooks/useWeather'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() }
}))

import { supabase } from '../../lib/supabase'

const mockWeather = [
  { date: '2024-01-15', tmed: 5.2, prec: 0, v_med: 2.1, ur_med: 70 },
]

function makeChain(data, error = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  }
}

describe('useWeather', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns data on success', async () => {
    supabase.from.mockReturnValue(makeChain(mockWeather))
    const { result } = renderHook(() =>
      useWeather({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(mockWeather)
    expect(result.current.error).toBeNull()
  })

  it('normalizes date to YYYY-MM-DD', async () => {
    const rows = [{ date: '2024-01-15T00:00:00', tmed: 5, prec: 0, v_med: 1, ur_med: 60 }]
    supabase.from.mockReturnValue(makeChain(rows))
    const { result } = renderHook(() =>
      useWeather({ dateFrom: '2024-01-01', dateTo: '2024-01-31' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data[0].date).toBe('2024-01-15')
  })

  it('always queries city Torino', async () => {
    supabase.from.mockReturnValue(makeChain([]))
    renderHook(() => useWeather({ dateFrom: '2024-01-01', dateTo: '2024-01-31' }))
    await waitFor(() => {})
    const chain = supabase.from.mock.results[0].value
    expect(chain.eq).toHaveBeenCalledWith('city', 'Torino')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/__tests__/hooks/useWeather.test.js
```

- [ ] **Step 3: Implement useWeather.js**

```js
// frontend/src/hooks/useWeather.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function normalizeDate(d) { return d ? d.slice(0, 10) : d }

export function useWeather({ dateFrom, dateTo }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function fetch() {
      const { data: rows, error: err } = await supabase
        .from('weather')
        .select('date,tmed,prec,v_med,ur_med')
        .eq('city', 'Torino')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true })

      if (cancelled) return
      if (err) {
        setError(err)
        setData([])
      } else {
        setData((rows || []).map(r => ({ ...r, date: normalizeDate(r.date) })))
      }
      setLoading(false)
    }

    fetch()
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  return { data, loading, error }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/hooks/useWeather.test.js
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useWeather.js frontend/src/__tests__/hooks/useWeather.test.js
git commit -m "feat: add useWeather hook"
```

---

## Chunk 5: Shared Components

### Task 10: AppBar, Sidebar, EmptyState, ErrorBanner

**Files:**
- Create: `frontend/src/components/AppBar.jsx`
- Create: `frontend/src/components/Sidebar.jsx`
- Create: `frontend/src/components/EmptyState.jsx`
- Create: `frontend/src/components/ErrorBanner.jsx`
- Create: `frontend/src/__tests__/components/EmptyState.test.jsx`
- Create: `frontend/src/__tests__/components/ErrorBanner.test.jsx`

- [ ] **Step 1: Write EmptyState test**

```jsx
// frontend/src/__tests__/components/EmptyState.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from '../../components/EmptyState'

describe('EmptyState', () => {
  it('shows default message', () => {
    render(<EmptyState />)
    expect(screen.getByText(/nessun dato/i)).toBeInTheDocument()
  })
  it('shows custom message', () => {
    render(<EmptyState message="Nessun dato nel periodo selezionato" />)
    expect(screen.getByText('Nessun dato nel periodo selezionato')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write ErrorBanner test**

```jsx
// frontend/src/__tests__/components/ErrorBanner.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBanner from '../../components/ErrorBanner'

describe('ErrorBanner', () => {
  it('shows error message', () => {
    render(<ErrorBanner message="Errore di connessione" onRetry={() => {}} />)
    expect(screen.getByText(/errore di connessione/i)).toBeInTheDocument()
  })
  it('calls onRetry when button clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorBanner message="Errore" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /riprova/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npx vitest run src/__tests__/components/EmptyState.test.jsx src/__tests__/components/ErrorBanner.test.jsx
```

- [ ] **Step 4: Implement EmptyState.jsx**

```jsx
// frontend/src/components/EmptyState.jsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export default function EmptyState({ message = 'Nessun dato per i filtri selezionati' }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  )
}
```

- [ ] **Step 5: Implement ErrorBanner.jsx**

```jsx
// frontend/src/components/ErrorBanner.jsx
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

export default function ErrorBanner({ message, onRetry }) {
  return (
    <Alert
      severity="error"
      action={<Button color="inherit" size="small" onClick={onRetry}>Riprova</Button>}
      sx={{ mb: 2 }}
    >
      {message}
    </Alert>
  )
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npx vitest run src/__tests__/components/EmptyState.test.jsx src/__tests__/components/ErrorBanner.test.jsx
```

- [ ] **Step 7: Implement AppBar.jsx**

```jsx
// frontend/src/components/AppBar.jsx
import { useContext } from 'react'
import MuiAppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import { useTheme } from '@mui/material/styles'
import { ColorModeContext } from '../App'

export default function AppBar() {
  const theme = useTheme()
  const { toggle } = useContext(ColorModeContext)

  return (
    <MuiAppBar position="fixed">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          AirQuality Torino
        </Typography>
        <IconButton color="inherit" onClick={toggle}>
          {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Toolbar>
    </MuiAppBar>
  )
}
```

- [ ] **Step 8: Implement Sidebar.jsx**

```jsx
// frontend/src/components/Sidebar.jsx
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useFilters } from '../context/FilterContext'

const DRAWER_WIDTH = 240
const POLLUTANTS = ['PM10', 'PM25']

export default function Sidebar() {
  const { pollutant, setPollutant, dateFrom, setDateFrom, dateTo, setDateTo } = useFilters()

  return (
    <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0,
      '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>
      <Toolbar />
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Filtri</Typography>

        <FormControl size="small" fullWidth>
          <InputLabel>Inquinante</InputLabel>
          <Select value={pollutant} label="Inquinante" onChange={e => setPollutant(e.target.value)}>
            {POLLUTANTS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </Select>
        </FormControl>

        <TextField size="small" label="Da" type="date" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="A" type="date" value={dateTo}
          onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
      </Box>
    </Drawer>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ frontend/src/__tests__/components/
git commit -m "feat: add AppBar, Sidebar, EmptyState, ErrorBanner components"
```

---

### Task 11: KpiCards

**Files:**
- Create: `frontend/src/components/KpiCards.jsx`
- Create: `frontend/src/__tests__/components/KpiCards.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
// frontend/src/__tests__/components/KpiCards.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import KpiCards from '../../components/KpiCards'

const data = [
  { station: 'A', date: '2024-01-01', value: 60 },  // over PM10 limit (50)
  { station: 'A', date: '2024-01-02', value: 30 },
  { station: 'B', date: '2024-01-01', value: 55 },  // over limit
]

describe('KpiCards', () => {
  it('shows correct average', () => {
    render(<KpiCards data={data} pollutant="PM10" />)
    const avg = (60 + 30 + 55) / 3  // 48.33
    expect(screen.getByText(/48\.3/)).toBeInTheDocument()
  })

  it('counts days over limit correctly', () => {
    render(<KpiCards data={data} pollutant="PM10" />)
    // Days (unique dates) where avg across stations > 50:
    // 2024-01-01: avg(60,55)=57.5 > 50 ✓
    // 2024-01-02: avg(30)=30 ✗
    // → 1 day over limit
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows 0 days over limit when all below threshold', () => {
    const safe = [{ station: 'A', date: '2024-01-01', value: 20 }]
    render(<KpiCards data={safe} pollutant="PM10" />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/__tests__/components/KpiCards.test.jsx
```

- [ ] **Step 3: Implement KpiCards.jsx**

```jsx
// frontend/src/components/KpiCards.jsx
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { getThreshold } from '../lib/thresholds'

function average(arr) {
  const valid = arr.filter(v => v != null)
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

export default function KpiCards({ data, pollutant }) {
  const threshold = getThreshold(pollutant)

  const overallAvg = average(data.map(r => r.value))

  // Group by date, compute daily avg, count days over threshold
  const byDate = {}
  for (const row of data) {
    if (!byDate[row.date]) byDate[row.date] = []
    if (row.value != null) byDate[row.date].push(row.value)
  }
  const daysOver = Object.values(byDate).filter(vals => {
    const avg = average(vals)
    return threshold != null && avg != null && avg > threshold
  }).length

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid item xs={12} sm={6}>
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="body2">Media {pollutant}</Typography>
            <Typography variant="h4">
              {overallAvg != null ? overallAvg.toFixed(1) : '—'} µg/m³
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="body2">Giorni oltre il limite</Typography>
            <Typography variant="h4" color={daysOver > 0 ? 'error' : 'inherit'}>
              {daysOver}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/components/KpiCards.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/KpiCards.jsx frontend/src/__tests__/components/KpiCards.test.jsx
git commit -m "feat: add KpiCards component"
```

---

## Chunk 6: Charts and Trend Page

### Task 12: TimeSeriesChart

**Files:**
- Create: `frontend/src/components/charts/TimeSeriesChart.jsx`
- Create: `frontend/src/__tests__/components/charts/TimeSeriesChart.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
// frontend/src/__tests__/components/charts/TimeSeriesChart.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TimeSeriesChart from '../../../components/charts/TimeSeriesChart'

const data = [
  { station: 'Rebaudengo', date: '2024-01-01', value: 45 },
  { station: 'Rebaudengo', date: '2024-01-02', value: 55 },
  { station: 'Consolata',  date: '2024-01-01', value: 30 },
]

describe('TimeSeriesChart', () => {
  it('renders without crashing', () => {
    render(<TimeSeriesChart data={data} pollutant="PM10" threshold={50} />)
    // Recharts renders an svg
    expect(document.querySelector('svg')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/__tests__/components/charts/TimeSeriesChart.test.jsx
```

- [ ] **Step 3: Implement TimeSeriesChart.jsx**

```jsx
// frontend/src/components/charts/TimeSeriesChart.jsx
import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts'
import { useTheme } from '@mui/material/styles'

const COLORS = ['#2196f3','#4caf50','#ff9800','#e91e63','#9c27b0','#00bcd4']

export default function TimeSeriesChart({ data, pollutant, threshold }) {
  const theme = useTheme()

  const { stations, chartData } = useMemo(() => {
    const stationSet = [...new Set(data.map(r => r.station))]
    // Build rows keyed by date
    const byDate = {}
    for (const row of data) {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date }
      byDate[row.date][row.station] = row.value
    }
    return { stations: stationSet, chartData: Object.values(byDate).sort((a,b) => a.date.localeCompare(b.date)) }
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis unit=" µg/m³" />
        <Tooltip />
        <Legend />
        {threshold != null && (
          <ReferenceLine y={threshold} stroke="red" strokeDasharray="6 3"
            label={{ value: `Limite ${pollutant}`, fill: 'red', fontSize: 12 }} />
        )}
        {stations.map((s, i) => (
          <Line key={s} type="monotone" dataKey={s}
            stroke={COLORS[i % COLORS.length]} dot={false} connectNulls={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/components/charts/TimeSeriesChart.test.jsx
```

- [ ] **Step 5: Implement Trend.jsx page**

```jsx
// frontend/src/pages/Trend.jsx
import { useCallback } from 'react'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import { useFilters } from '../context/FilterContext'
import { useMeasurements } from '../hooks/useMeasurements'
import { getThreshold } from '../lib/thresholds'
import KpiCards from '../components/KpiCards'
import TimeSeriesChart from '../components/charts/TimeSeriesChart'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'

export default function Trend() {
  const { pollutant, stations, dateFrom, dateTo } = useFilters()
  const { data, loading, error, refetch } = useMeasurements({ pollutant, stations, dateFrom, dateTo })
  const threshold = getThreshold(pollutant)

  // expose refetch for retry
  const retry = useCallback(() => window.location.reload(), [])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  if (error) return <ErrorBanner message="Errore nel caricamento dei dati." onRetry={retry} />
  if (!data.length) return <EmptyState />

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Andamento {pollutant}</Typography>
      <KpiCards data={data} pollutant={pollutant} />
      <TimeSeriesChart data={data} pollutant={pollutant} threshold={threshold} />
    </Box>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/charts/TimeSeriesChart.jsx frontend/src/pages/Trend.jsx \
        frontend/src/__tests__/components/charts/
git commit -m "feat: add TimeSeriesChart and Trend page"
```

---

## Chunk 7: Map Page

### Task 13: StationMap and Map page

**Files:**
- Create: `frontend/src/components/StationMap.jsx`
- Create: `frontend/src/pages/Map.jsx`

- [ ] **Step 1: Add Leaflet CSS to index.html**

In `frontend/index.html`, add inside `<head>`:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

- [ ] **Step 2: Implement StationMap.jsx**

```jsx
// frontend/src/components/StationMap.jsx
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getThreshold } from '../lib/thresholds'

function markerColor(avg, threshold) {
  if (threshold == null || avg == null) return 'grey'
  if (avg > threshold) return '#f44336'          // red
  if (avg > threshold * 0.5) return '#ff9800'    // yellow/orange
  return '#4caf50'                                // green
}

export default function StationMap({ stations, measurementsByStation, pollutant }) {
  const threshold = getThreshold(pollutant)

  return (
    <MapContainer center={[45.07, 7.68]} zoom={11} style={{ height: 500, width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stations.map(station => {
        const measurements = measurementsByStation[station.name] || []
        const values = measurements.map(r => r.value).filter(v => v != null)
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
        const color = markerColor(avg, threshold)
        const popupText = avg != null
          ? `${avg.toFixed(1)} µg/m³ (${values.length} giorni)`
          : 'Nessun dato nel periodo selezionato'

        return (
          <CircleMarker key={station.name} center={[station.lat, station.lon]}
            radius={10} fillColor={color} color={color} fillOpacity={0.8}>
            <Popup>
              <strong>{station.name}</strong><br />
              {pollutant}: {popupText}
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
```

- [ ] **Step 3: Implement Map.jsx page**

```jsx
// frontend/src/pages/Map.jsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import { supabase } from '../lib/supabase'
import { useFilters } from '../context/FilterContext'
import { useMeasurements } from '../hooks/useMeasurements'
import StationMap from '../components/StationMap'
import ErrorBanner from '../components/ErrorBanner'

export default function Map() {
  const { pollutant, dateFrom, dateTo } = useFilters()
  const [stations, setStations] = useState([])
  const [stationsLoading, setStationsLoading] = useState(true)
  const [stationsError, setStationsError] = useState(null)

  // Map page always loads ALL stations regardless of sidebar station filter
  const { data: measurements, loading: measLoading, error: measError } =
    useMeasurements({ pollutant, stations: [], dateFrom, dateTo })

  useEffect(() => {
    supabase.from('stations').select('name,lat,lon,pollutants')
      .then(({ data, error }) => {
        setStationsLoading(false)
        if (error) setStationsError(error)
        else setStations(data || [])
      })
  }, [])

  const measurementsByStation = useMemo(() => {
    const map = {}
    for (const row of measurements) {
      if (!map[row.station]) map[row.station] = []
      map[row.station].push(row)
    }
    return map
  }, [measurements])

  const retry = useCallback(() => window.location.reload(), [])

  if (stationsLoading || measLoading)
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  if (stationsError || measError)
    return <ErrorBanner message="Errore nel caricamento della mappa." onRetry={retry} />

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Mappa stazioni — {pollutant}</Typography>
      <StationMap stations={stations} measurementsByStation={measurementsByStation} pollutant={pollutant} />
    </Box>
  )
}
```

- [ ] **Step 4: Start dev server and verify map renders**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/map` — verify map tiles load and markers appear.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StationMap.jsx frontend/src/pages/Map.jsx
git commit -m "feat: add station map with threshold color coding"
```

---

## Chunk 8: Weather Page

### Task 14: ScatterChart and Weather page

**Files:**
- Create: `frontend/src/components/charts/ScatterChart.jsx`
- Create: `frontend/src/pages/Weather.jsx`
- Create: `frontend/src/__tests__/components/charts/ScatterChart.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
// frontend/src/__tests__/components/charts/ScatterChart.test.jsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PmScatterChart from '../../../components/charts/ScatterChart'

const points = [
  { x: 5.2, y: 42 },
  { x: 10.1, y: 55 },
]

describe('ScatterChart', () => {
  it('renders without crashing', () => {
    render(<PmScatterChart points={points} xLabel="Temperatura (°C)" yLabel="PM10 µg/m³" />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/__tests__/components/charts/ScatterChart.test.jsx
```

- [ ] **Step 3: Implement ScatterChart.jsx**

```jsx
// frontend/src/components/charts/ScatterChart.jsx
import {
  ScatterChart as ReScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useTheme } from '@mui/material/styles'

export default function PmScatterChart({ points, xLabel, yLabel }) {
  const theme = useTheme()
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ReScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis dataKey="x" name={xLabel} label={{ value: xLabel, position: 'insideBottom', offset: -5 }} />
        <YAxis dataKey="y" name={yLabel} label={{ value: yLabel, angle: -90, position: 'insideLeft' }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={points} fill={theme.palette.primary.main} opacity={0.7} />
      </ReScatterChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/components/charts/ScatterChart.test.jsx
```

- [ ] **Step 5: Implement Weather.jsx page**

```jsx
// frontend/src/pages/Weather.jsx
import { useMemo, useCallback } from 'react'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import { useFilters } from '../context/FilterContext'
import { useMeasurements } from '../hooks/useMeasurements'
import { useWeather } from '../hooks/useWeather'
import PmScatterChart from '../components/charts/ScatterChart'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'

export default function Weather() {
  const { pollutant, stations, dateFrom, dateTo } = useFilters()
  const { data: measurements, loading: mLoading, error: mError } =
    useMeasurements({ pollutant, stations, dateFrom, dateTo })
  const { data: weather, loading: wLoading, error: wError } =
    useWeather({ dateFrom, dateTo })

  const retry = useCallback(() => window.location.reload(), [])

  // Daily average of PM across selected stations
  const dailyPm = useMemo(() => {
    const byDate = {}
    for (const row of measurements) {
      if (row.value == null) continue
      if (!byDate[row.date]) byDate[row.date] = []
      byDate[row.date].push(row.value)
    }
    const result = {}
    for (const [date, vals] of Object.entries(byDate)) {
      result[date] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    return result
  }, [measurements])

  // Join PM with weather on date
  const joined = useMemo(() =>
    weather
      .filter(w => dailyPm[w.date] != null)
      .map(w => ({ ...w, pm: dailyPm[w.date] }))
  , [weather, dailyPm])

  if (mLoading || wLoading)
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  if (mError || wError)
    return <ErrorBanner message="Errore nel caricamento dei dati meteo." onRetry={retry} />
  if (!joined.length)
    return <EmptyState message="Nessun dato meteo per il periodo selezionato" />

  const charts = [
    { key: 'tmed',  label: 'Temperatura media (°C)' },
    { key: 'prec',  label: 'Precipitazioni (mm)' },
    { key: 'v_med', label: 'Vento medio (m/s)' },
    { key: 'ur_med',label: 'Umidità media (%)' },
  ]

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Correlazione {pollutant} ↔ Meteo</Typography>
      <Grid container spacing={3}>
        {charts.map(({ key, label }) => (
          <Grid item xs={12} md={6} key={key}>
            <Typography variant="subtitle2" align="center">{label}</Typography>
            <PmScatterChart
              points={joined.filter(r => r[key] != null).map(r => ({ x: r[key], y: r.pm }))}
              xLabel={label}
              yLabel={`${pollutant} µg/m³`}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
cd frontend && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/charts/ScatterChart.jsx frontend/src/pages/Weather.jsx \
        frontend/src/__tests__/components/charts/ScatterChart.test.jsx
git commit -m "feat: add scatter charts and Weather correlation page"
```

---

## Chunk 9: Deployment

### Task 15: Deploy to Vercel

**Files:**
- Create: `frontend/vercel.json`

- [ ] **Step 1: Create vercel.json for SPA routing**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Push frontend to GitHub**

```bash
git push origin main
```

- [ ] **Step 3: Create Vercel project**

1. Go to vercel.com → New Project → Import from GitHub → select this repo
2. Set **Root Directory** to `frontend`
3. Framework preset: Vite
4. Add environment variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click Deploy

- [ ] **Step 4: Verify deployment**

Open the Vercel URL. Navigate to `/trend`, `/map`, `/weather`. Confirm data loads.

- [ ] **Step 5: Commit vercel.json**

```bash
git add frontend/vercel.json
git commit -m "chore: add Vercel SPA routing config"
git push origin main
```

---

## Run All Tests

```bash
cd frontend && npx vitest run
```

Expected: all tests pass with no failures.
