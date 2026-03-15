import { useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import MuiAppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Paper from '@mui/material/Paper'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import CloudIcon from '@mui/icons-material/Cloud'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { ColorModeContext } from '../App'

const NAV_ITEMS = [
  { label: 'Andamento', path: '/trend', icon: <ShowChartIcon /> },
  { label: 'Meteo', path: '/weather', icon: <CloudIcon /> },
  { label: 'PM ↔ Meteo', path: '/correlation', icon: <ScatterPlotIcon /> },
]

export default function AppBar() {
  const theme = useTheme()
  const { toggle } = useContext(ColorModeContext)
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const currentTab = NAV_ITEMS.findIndex(item => item.path === location.pathname)

  return (
    <>
      <MuiAppBar position="fixed">
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: 0.5, flexGrow: 1 }}>
            AirQuality Torino
          </Typography>

          {!isMobile && (
            <Tabs
              value={currentTab === -1 ? false : currentTab}
              onChange={(_, i) => navigate(NAV_ITEMS[i].path)}
              textColor="inherit"
              TabIndicatorProps={{ style: { backgroundColor: 'white', height: 3 } }}
            >
              {NAV_ITEMS.map(({ label, path }) => (
                <Tab key={path} label={label} sx={{ fontWeight: 500, minWidth: 100 }} />
              ))}
            </Tabs>
          )}

          <IconButton color="inherit" onClick={toggle} aria-label="cambia tema">
            {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </MuiAppBar>

      {isMobile && (
        <Paper
          elevation={3}
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: theme.zIndex.appBar }}
        >
          <BottomNavigation
            value={currentTab === -1 ? 0 : currentTab}
            onChange={(_, i) => navigate(NAV_ITEMS[i].path)}
            showLabels
          >
            {NAV_ITEMS.map(({ label, path, icon }) => (
              <BottomNavigationAction key={path} label={label} icon={icon} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </>
  )
}
