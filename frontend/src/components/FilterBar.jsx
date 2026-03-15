import { useState, useEffect } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import OutlinedInput from '@mui/material/OutlinedInput'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useFilters } from '../context/FilterContext'
import { supabase } from '../lib/supabase'

const POLLUTANTS = ['PM10', 'PM25']

export default function FilterBar() {
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
        setStations([])
      })
  }, [pollutant])

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
      <ToggleButtonGroup
        value={pollutant}
        exclusive
        onChange={(_, v) => v && setPollutant(v)}
        size="small"
      >
        {POLLUTANTS.map(p => (
          <ToggleButton key={p} value={p} sx={{ px: 2, fontWeight: 600 }}>{p}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      <FormControl size="small" sx={{ minWidth: 200 }}>
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
              <ListItemText primary={s.split(' - ')[1] || s} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <TextField
          size="small" label="Da" type="date" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 145 }}
        />
        <TextField
          size="small" label="A" type="date" value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 145 }}
        />
      </Box>
    </Paper>
  )
}
