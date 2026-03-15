// frontend/src/components/StationMap.jsx
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getThreshold } from '../lib/thresholds'

function markerColor(avg, threshold) {
  if (threshold == null || avg == null) return 'grey'
  if (avg > threshold) return '#f44336'         // red
  if (avg > threshold * 0.5) return '#ff9800'   // yellow/orange
  return '#4caf50'                               // green
}

export default function StationMap({ stations, measurementsByStation, pollutant }) {
  const threshold = getThreshold(pollutant)

  return (
    <MapContainer center={[45.07, 7.68]} zoom={11} style={{ height: 500, width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stations.map(station => {
        const measurements = measurementsByStation[station.name] || []
        const values = measurements.map(r => r.value).filter(v => v != null)
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
        const color = markerColor(avg, threshold)
        const popupText = avg != null
          ? `${avg.toFixed(1)} µg/m³ (${values.length} giorni)`
          : 'Nessun dato nel periodo selezionato'

        return (
          <CircleMarker
            key={station.name}
            center={[station.lat, station.lon]}
            radius={10}
            fillColor={color}
            color={color}
            fillOpacity={0.8}
          >
            <Popup>
              <strong>{station.name}</strong><br />
              {pollutant}: {popupText}
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
