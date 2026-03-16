import { useMemo, useCallback } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  ComposedChart, Bar, Line, BarChart, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@mui/material/styles'
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

  const { data: weatherFiltered, loading: wLoading, error: wError } = useWeather({ dateFrom, dateTo })
  const { data: measurementsFiltered, loading: mLoading, error: mError } = useMeasurements({ pollutant, stations, dateFrom, dateTo })

  const retry = useCallback(() => window.location.reload(), [])

  // Daily PM avg
  const dailyPm = useMemo(() => {
    const byDate = {}
    for (const row of measurementsFiltered) {
      if (row.value == null) continue
      if (!byDate[row.date]) byDate[row.date] = []
      byDate[row.date].push(row.value)
    }
    return Object.fromEntries(
      Object.entries(byDate).map(([date, vals]) => [
        date,
        vals.reduce((a, b) => a + b, 0) / vals.length,
      ])
    )
  }, [measurementsFiltered])

  // Joined PM + meteo
  const joined = useMemo(() =>
    weatherFiltered
      .filter(w => dailyPm[w.date] != null)
      .map(w => ({ ...w, pm: dailyPm[w.date] }))
  , [weatherFiltered, dailyPm])

  if (wLoading || mLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (wError || mError) {
    return <ErrorBanner message="Errore nel caricamento dei dati meteo." onRetry={retry} />
  }

  const isDark = theme.palette.mode === 'dark'
  const axisStyle = { fill: theme.palette.text.secondary, fontSize: 11, fontFamily: "'DM Mono', monospace" }
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const tooltipStyle = {
    background: isDark ? '#0d1b2a' : '#fff',
    border: `1px solid ${isDark ? '#1e3a5f' : '#bae6fd'}`,
    borderRadius: 8,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 13,
  }

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
                <XAxis dataKey="date" tick={axisStyle} tickFormatter={d => d.slice(5)} axisLine={{ stroke: theme.palette.divider }} tickLine={false} />
                <YAxis tick={axisStyle} unit="°C" width={45} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${v?.toFixed(1)} °C`, name]} />
                <Legend wrapperStyle={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12 }} />
                <Line type="monotone" dataKey="tmin" name="T min" stroke="#38bdf8" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="tmax" name="T max" stroke="#f43f5e" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="tmed" name="T med" stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Precipitazioni */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Precipitazioni (mm)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weatherFiltered} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={axisStyle} tickFormatter={d => d.slice(5)} axisLine={{ stroke: theme.palette.divider }} tickLine={false} />
                <YAxis tick={axisStyle} unit="mm" width={45} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v?.toFixed(1)} mm`, 'Prec.']} />
                <Bar dataKey="prec" name="Prec." fill="#0ea5e9" opacity={0.8} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {/* Vento */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Vento (m/s)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weatherFiltered} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={axisStyle} tickFormatter={d => d.slice(5)} axisLine={{ stroke: theme.palette.divider }} tickLine={false} />
                <YAxis tick={axisStyle} unit=" m/s" width={50} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${v?.toFixed(1)} m/s`, name]} />
                <Legend wrapperStyle={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12 }} />
                <Line type="monotone" dataKey="v_med" name="V med" stroke="#10b981" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="v_max" name="V max" stroke="#6b7280" dot={false} strokeWidth={1.5} strokeDasharray="5 3" />
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

      {joined.length === 0 ? (
        <EmptyState message="Nessun dato combinato PM + meteo per il periodo selezionato" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={joined} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="date" tick={axisStyle} tickFormatter={d => d.slice(5)} axisLine={{ stroke: theme.palette.divider }} tickLine={false} />
            <YAxis yAxisId="left" tick={axisStyle} unit=" µg/m³" width={60} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={axisStyle} width={50} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [v != null ? v.toFixed(1) : '—', name]} />
            <Legend wrapperStyle={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="pm" name={`${pollutant} µg/m³`} fill="#0284c7" opacity={0.65} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="tmed" name="T med °C" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="v_med" name="V med m/s" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="prec" name="Pioggia mm" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      <Divider sx={{ my: 3 }} />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3: Data table + CSV download
      ══════════════════════════════════════════════════════════════ */}
      {joined.length === 0 ? (
        <EmptyState message="Nessun dato da mostrare per il periodo selezionato" />
      ) : (
        <Accordion disableGutters elevation={1}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Dati PM + meteo nel periodo selezionato ({joined.length} righe)</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <TableContainer sx={{ maxHeight: 400 }}>
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
                  {joined.map((row) => (
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
            <Box sx={{ p: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => downloadCSV(joined, pollutant, dateFrom, dateTo)}
              >
                Scarica CSV
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  )
}
