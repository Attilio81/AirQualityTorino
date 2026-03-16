import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import { useTheme } from '@mui/material/styles'
import { useFilters } from '../context/FilterContext'
import { useMeasurements } from '../hooks/useMeasurements'
import { useWeather } from '../hooks/useWeather'
import { getThreshold } from '../lib/thresholds'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'

const WEATHER_VARS = [
  { key: 'tmed',   label: 'Temperatura media (°C)',  color: '#f97316', unit: '°C'  },
  { key: 'prec',   label: 'Precipitazioni (mm)',      color: '#3b82f6', unit: 'mm'  },
  { key: 'v_med',  label: 'Vento medio (m/s)',        color: '#8b5cf6', unit: 'm/s' },
  { key: 'ur_med', label: 'Umidità relativa (%)',     color: '#06b6d4', unit: '%'   },
]

function CustomTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{
      bgcolor: isDark ? '#0d1b2a' : '#fff',
      border: '1px solid',
      borderColor: isDark ? '#1e3a5f' : '#bae6fd',
      p: 1.5,
      borderRadius: 2,
      fontSize: 13,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      <Typography variant="body2" fontWeight={700} mb={0.5} sx={{ fontFamily: "'DM Mono', monospace" }}>{label}</Typography>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 500 }}>
          {p.name}: {p.value != null ? p.value.toFixed(1) : '—'}{p.unit}
        </div>
      ))}
    </Box>
  )
}

export default function Correlation() {
  const [weatherKey, setWeatherKey] = useState('tmed')
  const { pollutant, stations, dateFrom, dateTo } = useFilters()
  const theme = useTheme()

  const { data: pm, loading: pmLoading, error: pmError } = useMeasurements({ pollutant, stations, dateFrom, dateTo })
  const { data: wx, loading: wxLoading, error: wxError } = useWeather({ dateFrom, dateTo })

  const threshold = getThreshold(pollutant)
  const selectedVar = WEATHER_VARS.find(v => v.key === weatherKey)

  // Average PM per day across selected stations
  const pmByDate = useMemo(() => {
    const map = {}
    for (const r of pm) {
      if (!map[r.date]) map[r.date] = { sum: 0, count: 0 }
      if (r.value != null) { map[r.date].sum += r.value; map[r.date].count += 1 }
    }
    return map
  }, [pm])

  const wxByDate = useMemo(() => {
    const map = {}
    for (const r of wx) map[r.date] = r
    return map
  }, [wx])

  const chartData = useMemo(() => {
    const dates = [...new Set([...Object.keys(pmByDate), ...Object.keys(wxByDate)])].sort()
    return dates.map(date => {
      const pmEntry = pmByDate[date]
      const wxEntry = wxByDate[date]
      return {
        date,
        pm: pmEntry?.count > 0 ? +(pmEntry.sum / pmEntry.count).toFixed(1) : null,
        wx: wxEntry?.[weatherKey] ?? null,
      }
    })
  }, [pmByDate, wxByDate, weatherKey])

  const loading = pmLoading || wxLoading
  const error = pmError || wxError

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  )
  if (error) return <ErrorBanner message="Errore nel caricamento dei dati." />
  if (!chartData.length) return <EmptyState />

  const isDark = theme.palette.mode === 'dark'
  const pmColor = isDark ? '#38bdf8' : '#0284c7'
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const axisStyle = { fontSize: 11, fontFamily: "'DM Mono', monospace", fill: theme.palette.text.secondary }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Correlazione PM ↔ Meteo</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Valori medi giornalieri {pollutant} (barre) sovrapposti alla variabile meteo selezionata (linea).
        {stations.length > 0 && ` Media su ${stations.length} stazione/i selezionate.`}
      </Typography>

      <ToggleButtonGroup
        value={weatherKey}
        exclusive
        onChange={(_, v) => v && setWeatherKey(v)}
        size="small"
        sx={{ mb: 3, flexWrap: 'wrap', gap: 0.5 }}
      >
        {WEATHER_VARS.map(v => (
          <ToggleButton key={v.key} value={v.key} sx={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {v.label.split(' (')[0]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="date"
            tick={axisStyle}
            tickFormatter={d => d.slice(5)}
            interval="preserveStartEnd"
            axisLine={{ stroke: theme.palette.divider }}
            tickLine={false}
          />
          <YAxis
            yAxisId="pm"
            orientation="left"
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            label={{ value: `${pollutant} (µg/m³)`, angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fontFamily: "'DM Mono', monospace" } }}
          />
          <YAxis
            yAxisId="wx"
            orientation="right"
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            label={{ value: selectedVar.unit, angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 11, fontFamily: "'DM Mono', monospace" } }}
          />
          <Tooltip content={<CustomTooltip isDark={isDark} />} />
          <Legend wrapperStyle={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12 }} />
          {threshold && (
            <ReferenceLine
              yAxisId="pm"
              y={threshold}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `Limite ${threshold}`, fill: '#ef4444', fontSize: 11, fontFamily: "'DM Mono', monospace" }}
            />
          )}
          <Bar
            yAxisId="pm"
            dataKey="pm"
            name={pollutant}
            fill={pmColor}
            opacity={0.65}
            unit=" µg/m³"
            maxBarSize={20}
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="wx"
            dataKey="wx"
            name={selectedVar.label.split(' (')[0]}
            stroke={selectedVar.color}
            dot={false}
            strokeWidth={2.5}
            unit={` ${selectedVar.unit}`}
            connectNulls
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  )
}
