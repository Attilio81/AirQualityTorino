import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export default function EmptyState({ message = 'Nessun dato per i filtri selezionati' }) {
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  )
}
