import { useContext, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import MuiAppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import MenuIcon from '@mui/icons-material/Menu'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [drawerOpen, setDrawerOpen] = useState(false)

  const currentTab = NAV_ITEMS.findIndex(item => item.path === location.pathname)

  const handleNavClick = (path) => {
    navigate(path)
    setDrawerOpen(false)
  }

  return (
    <>
      <MuiAppBar position="fixed">
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="apri menu"
              edge="start"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: 0.5, flexShrink: 0, flexGrow: isMobile ? 1 : 0 }}>
            AirQuality Torino
          </Typography>

          {!isMobile && (
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
          )}

          <IconButton color="inherit" onClick={toggle} aria-label="cambia tema">
            {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </MuiAppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 220 }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Navigazione</Typography>
          </Box>
          <Divider />
          <List>
            {NAV_ITEMS.map(({ label, path }) => (
              <ListItem key={path} disablePadding>
                <ListItemButton
                  selected={location.pathname === path}
                  onClick={() => handleNavClick(path)}
                >
                  <ListItemText primary={label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </>
  )
}
