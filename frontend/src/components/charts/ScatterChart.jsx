import {
  ScatterChart as ReScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@mui/material/styles'

export default function PmScatterChart({ points, xLabel, yLabel }) {
  const theme = useTheme()
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ReScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis
          dataKey="x"
          name={xLabel}
          label={{ value: xLabel, position: 'insideBottom', offset: -5 }}
        />
        <YAxis
          dataKey="y"
          name={yLabel}
          label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
        />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={points} fill={theme.palette.primary.main} opacity={0.7} />
      </ReScatterChart>
    </ResponsiveContainer>
  )
}
