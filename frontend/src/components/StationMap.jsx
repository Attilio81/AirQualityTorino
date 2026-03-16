// frontend/src/components/StationMap.jsx
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getThreshold } from '../lib/thresholds'

function markerColor(avg, threshold) {
  if (threshold == null || avg == null) return '#6b7280'
  if (avg > threshold)          return '#ef4444'  // red — oltre soglia
  if (avg > threshold * 0.75)   return '#f59e0b'  // amber — alto
  if (avg > threshold * 0.5)    return '#eab308'  // yellow — moderato
  return '#10b981'                                 // green — buono
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
            radius={11}
            fillColor={color}
            color="#fff"
            weight={2}
            fillOpacity={0.85}
          >
            <Popup>
              <strong style={{ fontSize: 14 }}>{station.name}</strong><br />
              <span style={{ color, fontWeight: 600 }}>{pollutant}: {popupText}</span>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
