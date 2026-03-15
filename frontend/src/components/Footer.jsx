import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'

const SOURCES = [
  {
    label: 'Dati PM10 / PM2.5',
    name: 'ARPA Piemonte – Open Data',
    url: 'https://www.arpa.piemonte.it/opendata',
  },
  {
    label: 'Dati meteorologici',
    name: 'Osservatorio Meteorologico UniTo',
    url: 'https://www.meteo.dfg.unito.it',
  },
]

export default function Footer() {
  return (
    <Box component="footer" sx={{ mt: 6 }}>
      <Divider />
      <Box sx={{ py: 2, px: 0, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Fonti:
        </Typography>
        {SOURCES.map(({ label, name, url }) => (
          <Typography key={label} variant="caption" color="text.secondary">
            {label}:{' '}
            <Link href={url} target="_blank" rel="noopener" underline="hover" color="text.secondary">
              {name}
            </Link>
          </Typography>
        ))}
      </Box>
    </Box>
  )
}
