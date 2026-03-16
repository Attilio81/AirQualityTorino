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
import MapIcon from '@mui/icons-material/Map'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { ColorModeContext } from '../App'

const NAV_ITEMS = [
  { label: 'Andamento', path: '/trend', icon: <ShowChartIcon /> },
  { label: 'Meteo', path: '/weather', icon: <CloudIcon /> },
  { label: 'PM ↔ Meteo', path: '/correlation', icon: <ScatterPlotIcon /> },
  { label: 'Mappa', path: '/stazioni', icon: <MapIcon /> },
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
      <MuiAppBar
        position="fixed"
        elevation={0}
        sx={{
          background: theme.palette.mode === 'dark'
            ? 'rgba(7, 13, 24, 0.88)'
            : 'rgba(2, 52, 80, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid',
          borderColor: theme.palette.mode === 'dark'
            ? 'rgba(56, 189, 248, 0.15)'
            : 'rgba(56, 189, 248, 0.25)',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight: 700,
              letterSpacing: 0.5,
              flexGrow: 1,
              background: 'linear-gradient(135deg, #38bdf8 0%, #7dd3fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            AirQuality Torino
          </Typography>

          {!isMobile && (
            <Tabs
              value={currentTab === -1 ? false : currentTab}
              onChange={(_, i) => navigate(NAV_ITEMS[i].path)}
              textColor="inherit"
              TabIndicatorProps={{
                style: {
                  background: 'linear-gradient(90deg, #38bdf8, #7dd3fc)',
                  height: 3,
                  borderRadius: 2,
                },
              }}
            >
              {NAV_ITEMS.map(({ label, path }) => (
                <Tab
                  key={path}
                  label={label}
                  sx={{
                    fontWeight: 500,
                    minWidth: 100,
                    color: 'rgba(255,255,255,0.75)',
                    '&.Mui-selected': { color: '#fff' },
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                />
              ))}
            </Tabs>
          )}

          <IconButton
            color="inherit"
            onClick={toggle}
            aria-label="cambia tema"
            sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff' } }}
          >
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
