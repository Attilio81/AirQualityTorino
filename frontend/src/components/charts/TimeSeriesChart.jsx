import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6']

export default function TimeSeriesChart({ data, pollutant, threshold }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'

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
      <AreaChart data={chartData}>
        <defs>
          {stations.map((s, i) => (
            <linearGradient key={s} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={isDark ? 0.35 : 0.25} />
              <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: isMobile ? 10 : 12, fontFamily: "'DM Mono', monospace" }}
          axisLine={{ stroke: theme.palette.divider }}
          tickLine={false}
        />
        <YAxis
          unit=" µg/m³"
          tick={{ fontSize: isMobile ? 10 : 12, fontFamily: "'DM Mono', monospace" }}
          width={isMobile ? 60 : 80}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: isDark ? '#0d1b2a' : '#fff',
            border: `1px solid ${isDark ? '#1e3a5f' : '#bae6fd'}`,
            borderRadius: 8,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 13,
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
        />
        <Legend
          wrapperStyle={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 12,
          }}
        />
        {threshold != null && (
          <ReferenceLine
            y={threshold}
            stroke="#ef4444"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: `Limite ${pollutant}`, fill: '#ef4444', fontSize: 11, fontFamily: "'DM Mono', monospace" }}
          />
        )}
        {stations.map((s, i) => (
          <Area
            key={s}
            type="monotone"
            dataKey={s}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            fill={`url(#grad-${i})`}
            dot={false}
            connectNulls={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
