import { useMemo } from 'react'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import { useTheme } from '@mui/material/styles'
import { useFilters } from '../context/FilterContext'
import { useMeasurements } from '../hooks/useMeasurements'
import { useStations } from '../hooks/useStations'
import { getThreshold } from '../lib/thresholds'
import StationMap from '../components/StationMap'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'

export default function Stazioni() {
  const { pollutant, stations, dateFrom, dateTo } = useFilters()
  const { data: stationList, loading: sLoading, error: sError } = useStations()
  const { data: measurements, loading: mLoading, error: mError } = useMeasurements({ pollutant, stations, dateFrom, dateTo })
  const threshold = getThreshold(pollutant)
  const theme = useTheme()

  const measurementsByStation = useMemo(() => {
    const map = {}
    for (const r of measurements) {
      if (!map[r.station]) map[r.station] = []
      map[r.station].push(r)
    }
    return map
  }, [measurements])

  const loading = sLoading || mLoading
  const error = sError || mError

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  )
  if (error) return <ErrorBanner message="Errore nel caricamento delle stazioni." />
  if (!stationList.length) return <EmptyState message="Nessuna stazione disponibile." />

  const stationsWithPm = stationList.filter(s => s.pollutants?.includes(pollutant))

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Mappa stazioni {pollutant}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {stationsWithPm.length} stazioni attive per {pollutant} a Torino.
        I colori indicano la media {pollutant} nel periodo selezionato.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Chip size="small" label="Oltre soglia" sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 600 }} />
        <Chip size="small" label="Moderato (50–100%)" sx={{ bgcolor: '#f59e0b', color: '#fff', fontWeight: 600 }} />
        <Chip size="small" label="Buono (< 50%)" sx={{ bgcolor: '#10b981', color: '#fff', fontWeight: 600 }} />
        <Chip size="small" label="Nessun dato" sx={{ bgcolor: theme.palette.action.selected, fontWeight: 600 }} />
      </Box>

      <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <StationMap
          stations={stationsWithPm}
          measurementsByStation={measurementsByStation}
          pollutant={pollutant}
        />
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Soglia {pollutant}: {threshold} µg/m³ · Periodo: {dateFrom} → {dateTo}
        </Typography>
      </Box>
    </Box>
  )
}
