import { useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import MuiAppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import { useTheme } from '@mui/material/styles'
import { ColorModeContext } from '../App'

const NAV_ITEMS = [
  { label: 'Andamento', path: '/trend' },
  { label: 'Meteo', path: '/weather' },
  { label: 'PM ↔ Meteo', path: '/correlation' },
]

export default function AppBar() {
  const theme = useTheme()
  const { toggle } = useContext(ColorModeContext)
  const navigate = useNavigate()
  const location = useLocation()

  const currentTab = NAV_ITEMS.findIndex(item => item.path === location.pathname)

  return (
    <MuiAppBar position="fixed">
      <Toolbar sx={{ gap: 2 }}>
        <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>
          AirQuality Torino
        </Typography>

        <Tabs
          value={currentTab === -1 ? false : currentTab}
          onChange={(_, i) => navigate(NAV_ITEMS[i].path)}
          textColor="inherit"
          TabIndicatorProps={{ style: { backgroundColor: 'white', height: 3 } }}
          sx={{ flexGrow: 1 }}
        >
          {NAV_ITEMS.map(({ label, path }) => (
            <Tab key={path} label={label} sx={{ fontWeight: 500, minWidth: 100 }} />
          ))}
        </Tabs>

        <IconButton color="inherit" onClick={toggle} aria-label="toggle theme">
          {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Toolbar>
    </MuiAppBar>
  )
}
