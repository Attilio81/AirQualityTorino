import { useState, useEffect } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import OutlinedInput from '@mui/material/OutlinedInput'
import { useFilters } from '../context/FilterContext'
import { supabase } from '../lib/supabase'

const DRAWER_WIDTH = 240
const POLLUTANTS = ['PM10', 'PM25']

export default function Sidebar() {
  const { pollutant, setPollutant, stations, setStations, dateFrom, setDateFrom, dateTo, setDateTo } = useFilters()
  const [availableStations, setAvailableStations] = useState([])

  useEffect(() => {
    supabase
      .from('measurements')
      .select('station')
      .eq('pollutant', pollutant)
      .then(({ data }) => {
        if (!data) return
        const unique = [...new Set(data.map(r => r.station))].sort()
        setAvailableStations(unique)
        // Resetta selezione se stazioni cambiano con cambio inquinante
        setStations([])
      })
  }, [pollutant])

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
      }}
    >
      <Toolbar />
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">Filtri</Typography>

        <FormControl size="small" fullWidth>
          <InputLabel>Inquinante</InputLabel>
          <Select value={pollutant} label="Inquinante" onChange={e => setPollutant(e.target.value)}>
            {POLLUTANTS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>Stazioni</InputLabel>
          <Select
            multiple
            value={stations}
            onChange={e => setStations(e.target.value)}
            input={<OutlinedInput label="Stazioni" />}
            renderValue={selected =>
              selected.length === 0 ? 'Tutte' : selected.map(s => s.split(' - ')[1] || s).join(', ')
            }
          >
            {availableStations.map(s => (
              <MenuItem key={s} value={s} dense>
                <Checkbox checked={stations.includes(s)} size="small" />
                <ListItemText primary={s.split(' - ')[1] || s} secondary={null} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small" label="Da" type="date" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small" label="A" type="date" value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
    </Drawer>
  )
}
