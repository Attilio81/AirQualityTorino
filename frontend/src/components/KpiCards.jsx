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

  const stationCount = new Set(data.map(r => r.station)).size

  const dayCount = new Set(data.map(r => r.date)).size

  const overallAvg = average(data.map(r => r.value))

  // Group by date, compute daily avg across stations, count days over threshold
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
      <Grid item xs={6}>
        <Card>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
            <Typography color="text.secondary" variant="body2">Stazioni selezionate</Typography>
            <Typography variant="h4" sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>{stationCount}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6}>
        <Card>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
            <Typography color="text.secondary" variant="body2">Giorni coperti</Typography>
            <Typography variant="h4" sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>{dayCount}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6}>
        <Card>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
            <Typography color="text.secondary" variant="body2">Media {pollutant}</Typography>
            <Typography variant="h4" sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
              {overallAvg != null ? overallAvg.toFixed(1) : '—'} µg/m³
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6}>
        <Card>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
            <Typography color="text.secondary" variant="body2">Giorni oltre il limite</Typography>
            <Typography variant="h4" color={daysOver > 0 ? 'error' : 'inherit'} sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
              {daysOver}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
