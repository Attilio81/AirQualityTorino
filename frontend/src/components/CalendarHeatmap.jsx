import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import { useWeather } from '../hooks/useWeather'
import { getThreshold } from '../lib/thresholds'
import { useFilters } from '../context/FilterContext'

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

// PM thresholds as fraction of limit
const PM_COLORS = [
  { ratio: Infinity, bg: '#ef4444', text: '#fff', label: 'Oltre soglia' },
  { ratio: 1,        bg: '#f97316', text: '#fff', label: 'Alto (75–100%)' },
  { ratio: 0.75,     bg: '#eab308', text: '#000', label: 'Moderato (50–75%)' },
  { ratio: 0.5,      bg: '#22c55e', text: '#fff', label: 'Buono (< 50%)' },
]

function getCellColor(pm, threshold) {
  if (pm == null || threshold == null) return null
  const ratio = pm / threshold
  if (ratio > 1)    return PM_COLORS[0]
  if (ratio > 0.75) return PM_COLORS[1]
  if (ratio > 0.5)  return PM_COLORS[2]
  return PM_COLORS[3]
}

function getMonthsInRange(dateFrom, dateTo) {
  const months = []
  let [y, m] = dateFrom.split('-').map(Number)
  const [ey, em] = dateTo.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    months.push({ year: y, month: m })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

function toDateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Returns 0=Mon … 6=Sun
function firstDayOfWeek(year, month) {
  const dow = new Date(year, month - 1, 1).getDay()
  return dow === 0 ? 6 : dow - 1
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

export default function CalendarHeatmap({ measurementsData }) {
  const { pollutant, dateFrom, dateTo } = useFilters()
  const { data: weatherData } = useWeather({ dateFrom, dateTo })
  const threshold = getThreshold(pollutant)

  const months = useMemo(() => getMonthsInRange(dateFrom, dateTo), [dateFrom, dateTo])
  const [monthIdx, setMonthIdx] = useState(() => Math.max(0, months.length - 1))

  // Keep monthIdx in bounds when date range changes
  const safeIdx = Math.min(monthIdx, Math.max(0, months.length - 1))

  // Daily average PM across all selected stations
  const pmByDate = useMemo(() => {
    const acc = {}
    for (const row of measurementsData) {
      if (row.value == null) continue
      if (!acc[row.date]) acc[row.date] = []
      acc[row.date].push(row.value)
    }
    return Object.fromEntries(
      Object.entries(acc).map(([date, vals]) => [
        date,
        vals.reduce((a, b) => a + b, 0) / vals.length,
      ])
    )
  }, [measurementsData])

  const weatherByDate = useMemo(() => {
    const map = {}
    for (const row of weatherData) map[row.date] = row
    return map
  }, [weatherData])

  const { year, month } = months[safeIdx]
  const totalDays = daysInMonth(year, month)
  const offset = firstDayOfWeek(year, month)

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, mt: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <IconButton
          size="small"
          onClick={() => setMonthIdx(i => Math.max(0, i - 1))}
          disabled={safeIdx === 0}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ letterSpacing: 0.3, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {MONTH_NAMES[month - 1]} {year}
          {months.length > 1 && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({safeIdx + 1}/{months.length})
            </Typography>
          )}
        </Typography>
        <IconButton
          size="small"
          onClick={() => setMonthIdx(i => Math.min(months.length - 1, i + 1))}
          disabled={safeIdx === months.length - 1}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {/* Day-of-week headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: { xs: 0.5, sm: 0.75 }, mb: 0.75 }}>
        {DAY_LABELS.map(d => (
          <Typography
            key={d}
            variant="caption"
            align="center"
            sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.65rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {d}
          </Typography>
        ))}
      </Box>

      {/* Day cells */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: { xs: 0.5, sm: 0.75 }, maxWidth: 560, mx: 'auto' }}>
        {Array(offset).fill(null).map((_, i) => <Box key={`e${i}`} />)}

        {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
          const dateStr = toDateStr(year, month, day)
          const pm = pmByDate[dateStr]
          const weather = weatherByDate[dateStr]
          const color = getCellColor(pm, threshold)

          const hasRain = weather?.prec != null && weather.prec > 1
          const hasWind = weather?.v_med != null && weather.v_med > 3

          const tooltipLines = [
            pm != null ? `${pollutant}: ${pm.toFixed(1)} µg/m³` : 'Nessun dato PM',
            hasRain ? `Pioggia: ${weather.prec.toFixed(1)} mm` : null,
            hasWind ? `Vento: ${weather.v_med.toFixed(1)} m/s` : null,
          ].filter(Boolean).join('\n')

          return (
            <Tooltip
              key={dateStr}
              title={<span style={{ whiteSpace: 'pre-line' }}>{tooltipLines}</span>}
              arrow
              placement="top"
            >
              <Box
                sx={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  bgcolor: color ? color.bg : 'action.hover',
                  border: '1px solid',
                  borderColor: color ? `${color.bg}cc` : 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'default',
                  minHeight: { xs: 34, sm: 44 },
                  maxHeight: 68,
                  transition: 'transform 0.12s, opacity 0.12s',
                  '&:hover': { opacity: 0.8, transform: 'scale(1.06)' },
                  boxShadow: color ? `0 2px 6px ${color.bg}55` : 'none',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: { xs: '0.7rem', sm: '0.85rem' },
                    fontWeight: 700,
                    color: color ? color.text : 'text.primary',
                    lineHeight: 1,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {day}
                </Typography>

                {/* Bottom bars: rain (blue, left) / wind (gray, right) */}
                {(hasRain || hasWind) && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      height: { xs: 3, sm: 4 },
                    }}
                  >
                    {hasRain && (
                      <Box sx={{ flex: 1, bgcolor: '#3b82f6' }} />
                    )}
                    {hasWind && (
                      <Box sx={{ flex: 1, bgcolor: '#94a3b8' }} />
                    )}
                  </Box>
                )}
              </Box>
            </Tooltip>
          )
        })}
      </Box>

      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: { xs: 1, sm: 1.5 },
          mt: 2,
          pt: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          alignItems: 'center',
        }}
      >
        {PM_COLORS.slice().reverse().map(({ bg, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 11, height: 11, borderRadius: 0.5, bgcolor: bg, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
              {label}
            </Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 18, height: 4, borderRadius: 0.5, bgcolor: '#3b82f6', flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            Pioggia (&gt;1 mm)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 18, height: 4, borderRadius: 0.5, bgcolor: '#94a3b8', flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            Vento (&gt;3 m/s)
          </Typography>
        </Box>
      </Box>
    </Paper>
  )
}
