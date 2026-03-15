import { useMemo, useCallback } from 'react'
import {
  ComposedChart, Bar, Line, BarChart, LineChart, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@mui/material/styles'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { useFilters } from '../context/FilterContext'
import { useMeasurements } from '../hooks/useMeasurements'
import { useWeather } from '../hooks/useWeather'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'

const TODAY = new Date().toISOString().slice(0, 10)
const ALL_HISTORY_FROM = '2020-01-01'

// PM value → color using yellow→orange→red scale relative to threshold
function pmColor(value, threshold) {
  if (value == null || threshold == null) return '#999'
  const ratio = Math.min(value / threshold, 1.5)
  if (ratio < 0.5) return '#4caf50'
  if (ratio < 1.0) return '#ff9800'
  return '#f44336'
}

// Thresholds per pollutant (EU daily limit values)
const PM_THRESHOLDS = {
  PM10: 50,
  PM2_5: 25,
  NO2: 200,
  default: 50,
}

function CustomScatterTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <Paper sx={{ p: 1, fontSize: 12 }}>
      <div><strong>Data:</strong> {d.date}</div>
      <div><strong>Meteo:</strong> {d.x != null ? d.x.toFixed(2) : '—'}</div>
      <div><strong>PM:</strong> {d.pm != null ? d.pm.toFixed(1) : '—'} µg/m³</div>
    </Paper>
  )
}

function downloadCSV(rows, pollutant, dateFrom, dateTo) {
  const header = ['Data', `PM µg/m³`, 'T med °C', 'T min °C', 'T max °C', 'Pioggia mm', 'Vento m/s', 'Umidità %']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([
      r.date,
      r.pm != null ? r.pm.toFixed(2) : '',
      r.tmed != null ? r.tmed.toFixed(1) : '',
      r.tmin != null ? r.tmin.toFixed(1) : '',
      r.tmax != null ? r.tmax.toFixed(1) : '',
      r.prec != null ? r.prec.toFixed(1) : '',
      r.v_med != null ? r.v_med.toFixed(1) : '',
      r.ur_med != null ? r.ur_med.toFixed(1) : '',
    ].join(','))
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${pollutant}_meteo_${dateFrom}_${dateTo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Weather() {
  const theme = useTheme()
  const { pollutant, stations, dateFrom, dateTo } = useFilters()

  const threshold = PM_THRESHOLDS[pollutant] ?? PM_THRESHOLDS.default

  // ── Section 1 & 2 & 4: sidebar date filter ─────────────────────────────────
  const {
    data: weatherFiltered,
    loading: wFilteredLoading,
    error: wFilteredError,
  } = useWeather({ dateFrom, dateTo })

  const {
    data: measurementsFiltered,
    loading: mFilteredLoading,
    error: mFilteredError,
  } = useMeasurements({ pollutant, stations, dateFrom, dateTo })

  // ── Section 3: all history ──────────────────────────────────────────────────
  const {
    data: weatherAll,
    loading: wAllLoading,
    error: wAllError,
  } = useWeather({ dateFrom: ALL_HISTORY_FROM, dateTo: TODAY })

  const {
    data: measurementsAll,
    loading: mAllLoading,
    error: mAllError,
  } = useMeasurements({ pollutant, stations, dateFrom: ALL_HISTORY_FROM, dateTo: TODAY })

  const retry = useCallback(() => window.location.reload(), [])

  const anyLoading = wFilteredLoading || mFilteredLoading || wAllLoading || mAllLoading
  const anyError   = wFilteredError  || mFilteredError  || wAllError  || mAllError

  // ── Daily PM avg (filtered) ─────────────────────────────────────────────────
  const dailyPmFiltered = useMemo(() => {
    const byDate = {}
    for (const row of measurementsFiltered) {
      if (row.value == null) continue
      if (!byDate[row.date]) byDate[row.date] = []
      byDate[row.date].push(row.value)
    }
    const result = {}
    for (const [date, vals] of Object.entries(byDate)) {
      result[date] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    return result
  }, [measurementsFiltered])

  // ── Daily PM avg (all history) ──────────────────────────────────────────────
  const dailyPmAll = useMemo(() => {
    const byDate = {}
    for (const row of measurementsAll) {
      if (row.value == null) continue
      if (!byDate[row.date]) byDate[row.date] = []
      byDate[row.date].push(row.value)
    }
    const result = {}
    for (const [date, vals] of Object.entries(byDate)) {
      result[date] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    return result
  }, [measurementsAll])

  // ── Joined filtered (Sections 2 & 4) ───────────────────────────────────────
  const joinedFiltered = useMemo(() =>
    weatherFiltered
      .filter(w => dailyPmFiltered[w.date] != null)
      .map(w => ({ ...w, pm: dailyPmFiltered[w.date] }))
  , [weatherFiltered, dailyPmFiltered])

  // ── Joined all (Section 3) ──────────────────────────────────────────────────
  const joinedAll = useMemo(() =>
    weatherAll
      .filter(w => dailyPmAll[w.date] != null)
      .map(w => ({ ...w, pm: dailyPmAll[w.date] }))
  , [weatherAll, dailyPmAll])

  if (anyLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (anyError) {
    return <ErrorBanner message="Errore nel caricamento dei dati meteo." onRetry={retry} />
  }

  // ── Recharts common props ───────────────────────────────────────────────────
  const axisStyle  = { fill: theme.palette.text.secondary, fontSize: 11 }
  const gridColor  = theme.palette.divider

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Meteo &amp; {pollutant}
      </Typography>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1: Weather charts for selected period
      ══════════════════════════════════════════════════════════════ */}
      <Typography variant="h6" gutterBottom>
        Andamento meteo nel periodo selezionato
      </Typography>

      {weatherFiltered.length === 0 ? (
        <EmptyState message="Nessun dato meteo per il periodo selezionato" />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Temperatura */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Temperatura (°C)</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weatherFiltered} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={axisStyle} tickFormatter={d => d.slice(5)} />
                <YAxis tick={axisStyle} unit="°C" width={45} />
                <Tooltip formatter={(v, name) => [`${v?.toFixed(1)} °C`, name]} />
                <Legend />
                <Line type="monotone" dataKey="tmin" name="T min" stroke="#2196f3" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="tmax" name="T max" stroke="#f44336" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="tmed" name="T med" stroke="#ff9800" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Precipitazioni */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Precipitazioni (mm)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weatherFiltered} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={axisStyle} tickFormatter={d => d.slice(5)} />
                <YAxis tick={axisStyle} unit="mm" width={45} />
                <Tooltip formatter={(v) => [`${v?.toFixed(1)} mm`, 'Prec.']} />
                <Bar dataKey="prec" name="Prec." fill="#5b9bd5" />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {/* Vento */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Vento (m/s)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weatherFiltered} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={axisStyle} tickFormatter={d => d.slice(5)} />
                <YAxis tick={axisStyle} unit=" m/s" width={50} />
                <Tooltip formatter={(v, name) => [`${v?.toFixed(1)} m/s`, name]} />
                <Legend />
                <Line type="monotone" dataKey="v_med" name="V med" stroke="#4caf50" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="v_max" name="V max" stroke="#9e9e9e" dot={false} strokeWidth={1.5} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2: Dual-axis PM + meteo time series
      ══════════════════════════════════════════════════════════════ */}
      <Typography variant="h6" gutterBottom>
        Serie temporale: {pollutant} e variabili meteo
      </Typography>

      {joinedFiltered.length === 0 ? (
        <EmptyState message="Nessun dato combinato PM + meteo per il periodo selezionato" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={joinedFiltered} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="date" tick={axisStyle} tickFormatter={d => d.slice(5)} />
            <YAxis yAxisId="left" tick={axisStyle} unit=" µg/m³" width={60} />
            <YAxis yAxisId="right" orientation="right" tick={axisStyle} width={50} />
            <Tooltip formatter={(v, name) => [v != null ? v.toFixed(1) : '—', name]} />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="pm"
              name={`${pollutant} µg/m³`}
              fill="steelblue"
              opacity={0.75}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="tmed"
              name="T med °C"
              stroke="tomato"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="v_med"
              name="V med m/s"
              stroke="seagreen"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="prec"
              name="Pioggia mm"
              stroke="cornflowerblue"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      <Divider sx={{ my: 3 }} />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3: Scatter plots PM vs meteo (all history)
      ══════════════════════════════════════════════════════════════ */}
      <Typography variant="h6" gutterBottom>
        Correlazione {pollutant} vs. meteo (storico completo)
      </Typography>

      {joinedAll.length === 0 ? (
        <EmptyState message="Nessun dato storico combinato PM + meteo disponibile" />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[
            { key: 'tmed',   label: 'Temperatura media (°C)' },
            { key: 'v_med',  label: 'Vento medio (m/s)' },
            { key: 'ur_med', label: 'Umidità relativa (%)' },
            { key: 'prec',   label: 'Precipitazioni (mm)' },
          ].map(({ key, label }) => {
            const points = joinedAll
              .filter(r => r[key] != null && r.pm != null)
              .map(r => ({ x: r[key], pm: r.pm, date: r.date }))

            return (
              <Box key={key}>
                <Typography variant="subtitle2" gutterBottom>
                  {pollutant} vs. {label}
                </Typography>
                {points.length === 0 ? (
                  <EmptyState message={`Nessun dato per ${label}`} />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="x" name={label} tick={axisStyle} label={{ value: label, position: 'insideBottom', offset: -10, style: { fontSize: 11 } }} />
                      <YAxis dataKey="pm" name={`${pollutant} µg/m³`} tick={axisStyle} unit=" µg" width={50} />
                      <Tooltip content={<CustomScatterTooltip />} />
                      <Scatter
                        data={points}
                        shape={(props) => {
                          const { cx, cy, payload } = props
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill={pmColor(payload.pm, threshold)}
                              fillOpacity={0.75}
                              stroke="none"
                            />
                          )
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
              </Box>
            )
          })}
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4: Data table + CSV download
      ══════════════════════════════════════════════════════════════ */}
      <Typography variant="h6" gutterBottom>
        Dati PM + meteo nel periodo selezionato
      </Typography>

      {joinedFiltered.length === 0 ? (
        <EmptyState message="Nessun dato da mostrare per il periodo selezionato" />
      ) : (
        <>
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell align="right">PM µg/m³</TableCell>
                  <TableCell align="right">T med °C</TableCell>
                  <TableCell align="right">T min °C</TableCell>
                  <TableCell align="right">T max °C</TableCell>
                  <TableCell align="right">Pioggia mm</TableCell>
                  <TableCell align="right">Vento m/s</TableCell>
                  <TableCell align="right">Umidità %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {joinedFiltered.map((row) => (
                  <TableRow key={row.date} hover>
                    <TableCell>{row.date}</TableCell>
                    <TableCell align="right">{row.pm != null ? row.pm.toFixed(1) : '—'}</TableCell>
                    <TableCell align="right">{row.tmed != null ? row.tmed.toFixed(1) : '—'}</TableCell>
                    <TableCell align="right">{row.tmin != null ? row.tmin.toFixed(1) : '—'}</TableCell>
                    <TableCell align="right">{row.tmax != null ? row.tmax.toFixed(1) : '—'}</TableCell>
                    <TableCell align="right">{row.prec != null ? row.prec.toFixed(1) : '—'}</TableCell>
                    <TableCell align="right">{row.v_med != null ? row.v_med.toFixed(1) : '—'}</TableCell>
                    <TableCell align="right">{row.ur_med != null ? row.ur_med.toFixed(1) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => downloadCSV(joinedFiltered, pollutant, dateFrom, dateTo)}
            >
              Scarica CSV
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}
