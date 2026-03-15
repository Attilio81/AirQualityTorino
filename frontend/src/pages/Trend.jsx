import { useCallback, useState } from 'react'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DownloadIcon from '@mui/icons-material/Download'
import { useTheme } from '@mui/material/styles'
import Divider from '@mui/material/Divider'
import { useFilters } from '../context/FilterContext'
import { useMeasurements } from '../hooks/useMeasurements'
import { getThreshold } from '../lib/thresholds'
import KpiCards from '../components/KpiCards'
import TimeSeriesChart from '../components/charts/TimeSeriesChart'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'

function downloadCsv(data, pollutant, dateFrom, dateTo) {
  const header = 'Data,Stazione,Valore (µg/m³)\n'
  const rows = data
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.station.localeCompare(b.station))
    .map(r => `${r.date},${r.station},${r.value ?? ''}`)
    .join('\n')
  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${pollutant}_${dateFrom}_${dateTo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Trend() {
  const { pollutant, stations, dateFrom, dateTo } = useFilters()
  const { data, loading, error } = useMeasurements({ pollutant, stations, dateFrom, dateTo })
  const threshold = getThreshold(pollutant)
  const theme = useTheme()

  const retry = useCallback(() => window.location.reload(), [])

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  )
  if (error) return <ErrorBanner message="Errore nel caricamento dei dati." onRetry={retry} />
  if (!data.length) return <EmptyState />

  const sortedRows = data
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.station.localeCompare(b.station))
    .slice(0, 500)

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Andamento {pollutant}</Typography>
      <KpiCards data={data} pollutant={pollutant} />
      <TimeSeriesChart data={data} pollutant={pollutant} threshold={threshold} />

      <Divider sx={{ my: 3 }} />

      <Accordion disableGutters elevation={1}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600}>Dati storici ({sortedRows.length} righe)</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Stazione</TableCell>
                  <TableCell>Valore (µg/m³)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.map((row, i) => {
                  const isOver = threshold != null && row.value != null && row.value > threshold
                  const rowBg = isOver
                    ? theme.palette.mode === 'dark' ? '#7f1d1d' : '#ffcccc'
                    : undefined
                  return (
                    <TableRow key={i} sx={{ backgroundColor: rowBg }}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.station}</TableCell>
                      <TableCell>{row.value ?? '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ p: 2 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => downloadCsv(data, pollutant, dateFrom, dateTo)}
            >
              Scarica CSV
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
