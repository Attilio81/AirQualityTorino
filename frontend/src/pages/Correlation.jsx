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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 1.5, borderRadius: 1, fontSize: 13 }}>
      <Typography variant="body2" fontWeight="bold" mb={0.5}>{label}</Typography>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value != null ? p.value.toFixed(1) : '—'} {p.unit}
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

  const pmColor = theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2'

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
          <ToggleButton key={v.key} value={v.key}>{v.label.split(' (')[0]}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={d => d.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="pm"
            orientation="left"
            label={{ value: `${pollutant} (µg/m³)`, angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }}
          />
          <YAxis
            yAxisId="wx"
            orientation="right"
            label={{ value: selectedVar.unit, angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 11 } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {threshold && (
            <ReferenceLine yAxisId="pm" y={threshold} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `Limite ${threshold}`, fill: '#ef4444', fontSize: 11 }} />
          )}
          <Bar
            yAxisId="pm"
            dataKey="pm"
            name={pollutant}
            fill={pmColor}
            opacity={0.7}
            unit=" µg/m³"
            maxBarSize={20}
          />
          <Line
            yAxisId="wx"
            dataKey="wx"
            name={selectedVar.label.split(' (')[0]}
            stroke={selectedVar.color}
            dot={false}
            strokeWidth={2}
            unit={` ${selectedVar.unit}`}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  )
}
