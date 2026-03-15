import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

const COLORS = ['#2196f3','#4caf50','#ff9800','#e91e63','#9c27b0','#00bcd4']

export default function TimeSeriesChart({ data, pollutant, threshold }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const { stations, chartData } = useMemo(() => {
    const stationSet = [...new Set(data.map(r => r.station))]
    const byDate = {}
    for (const row of data) {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date }
      byDate[row.date][row.station] = row.value
    }
    return {
      stations: stationSet,
      chartData: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
    }
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 240 : 400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 12 }} />
        <YAxis unit=" µg/m³" tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 60 : 80} />
        <Tooltip />
        <Legend />
        {threshold != null && (
          <ReferenceLine
            y={threshold}
            stroke="red"
            strokeDasharray="6 3"
            label={{ value: `Limite ${pollutant}`, fill: 'red', fontSize: 12 }}
          />
        )}
        {stations.map((s, i) => (
          <Line
            key={s}
            type="monotone"
            dataKey={s}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
