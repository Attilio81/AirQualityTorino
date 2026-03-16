// frontend/src/components/KpiCards.jsx
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { getThreshold } from '../lib/thresholds'

function average(arr) {
  const valid = arr.filter(v => v != null)
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

const CARDS = [
  {
    label: 'Stazioni selezionate',
    color: '#0284c7',
    Icon: LocationOnIcon,
    getValue: ({ stationCount }) => stationCount,
    format: v => v,
  },
  {
    label: 'Giorni coperti',
    color: '#0369a1',
    Icon: CalendarTodayIcon,
    getValue: ({ dayCount }) => dayCount,
    format: v => v,
  },
  {
    label: 'Media PM',
    color: '#059669',
    Icon: AnalyticsIcon,
    getValue: ({ overallAvg, pollutant }) => ({ avg: overallAvg, pollutant }),
    format: v => v.avg != null ? `${v.avg.toFixed(1)} µg/m³` : '—',
    labelDynamic: ({ pollutant }) => `Media ${pollutant}`,
  },
  {
    label: 'Giorni oltre il limite',
    color: '#ef4444',
    Icon: WarningAmberIcon,
    getValue: ({ daysOver }) => daysOver,
    format: v => v,
    isDanger: true,
  },
]

export default function KpiCards({ data, pollutant }) {
  const threshold = getThreshold(pollutant)

  const stationCount = new Set(data.map(r => r.station)).size
  const dayCount = new Set(data.map(r => r.date)).size
  const overallAvg = average(data.map(r => r.value))

  const byDate = {}
  for (const row of data) {
    if (!byDate[row.date]) byDate[row.date] = []
    if (row.value != null) byDate[row.date].push(row.value)
  }
  const daysOver = Object.values(byDate).filter(vals => {
    const avg = average(vals)
    return threshold != null && avg != null && avg > threshold
  }).length

  const context = { stationCount, dayCount, overallAvg, pollutant, daysOver }

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {CARDS.map(({ label, color, Icon, getValue, format, labelDynamic, isDanger }) => {
        const raw = getValue(context)
        const displayValue = format(raw)
        const accentColor = isDanger && daysOver > 0 ? '#ef4444' : color
        const cardLabel = labelDynamic ? labelDynamic(context) : label

        return (
          <Grid item xs={6} key={label}>
            <Card
              sx={{
                borderLeft: '4px solid',
                borderLeftColor: accentColor,
                height: '100%',
              }}
            >
              <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5 }}>
                      {cardLabel}
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontSize: { xs: '1.6rem', sm: '2rem' },
                        fontFamily: "'DM Mono', ui-monospace, monospace",
                        fontWeight: 500,
                        color: isDanger && daysOver > 0 ? 'error.main' : 'text.primary',
                        lineHeight: 1.2,
                      }}
                    >
                      {displayValue}
                    </Typography>
                  </Box>
                  <Icon
                    sx={{
                      fontSize: { xs: 28, sm: 36 },
                      color: accentColor,
                      opacity: 0.25,
                      mt: 0.5,
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )
      })}
    </Grid>
  )
}
