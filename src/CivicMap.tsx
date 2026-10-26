import { useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import type { LeafletMouseEvent } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from './lib/supabase'
import './CivicMap.css'

type MapQuest = {
  id: string
  title: string
  category: string
  description: string
  location_name: string
  xp_reward: number
  latitude: number | null
  longitude: number | null
  area_id: string | null
  status: string
}

type Position = [number, number]

type CivicMapProps = {
  areaId?: string | null
}

function MapFocus({ position, zoom = 14 }: { position: Position | null; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, zoom, { duration: 0.7 })
  }, [map, position, zoom])
  return null
}

function CurrentLocationMarker({ position }: { position: Position }) {
  return (
    <Marker position={position}>
      <Popup>Your current location</Popup>
    </Marker>
  )
}

function MapClickHandler({ onChange }: { onChange: (position: Position) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onChange([event.latlng.lat, event.latlng.lng])
    },
  })
  return null
}

/** Interactive map picker used by admins when creating a quest. */
export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null
  longitude: number | null
  onChange: (latitude: number, longitude: number) => void
}) {
  const selectedPosition: Position | null =
    latitude !== null && longitude !== null ? [latitude, longitude] : null

  return (
    <div className="civic-map civic-map--picker">
      <MapContainer
        center={selectedPosition || [28.6139, 77.209]}
        zoom={selectedPosition ? 15 : 11}
        scrollWheelZoom
        className="civic-map__canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onChange={(position) => onChange(position[0], position[1])} />
        {selectedPosition && (
          <>
            <Marker position={selectedPosition}>
              <Popup>Selected quest location</Popup>
            </Marker>
            <MapFocus position={selectedPosition} />
          </>
        )}
      </MapContainer>
      <p className="civic-map__footnote">Click anywhere on the map to select the quest location. You can click again to move the pin.</p>
    </div>
  )
}

export default function CivicMap({ areaId = null }: CivicMapProps) {
  const [userPosition, setUserPosition] = useState<Position | null>(null)
  const [locationMessage, setLocationMessage] = useState('')
  const [quests, setQuests] = useState<MapQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadMapQuests() {
      setLoading(true)
      setLoadError('')

      let query = supabase
        .from('quests')
        .select('id, title, category, description, location_name, xp_reward, latitude, longitude, area_id, status')
        .eq('status', 'open')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (areaId) query = query.eq('area_id', areaId)

      const { data, error } = await query.order('created_at', { ascending: false })

      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setQuests([])
      } else {
        setQuests((data || []) as MapQuest[])
      }
      setLoading(false)
    }

    void loadMapQuests()
    return () => {
      cancelled = true
    }
  }, [areaId])

  const firstQuestPosition = useMemo<Position | null>(() => {
    const quest = quests.find(
      (item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude),
    )
    return quest?.latitude != null && quest.longitude != null
      ? [quest.latitude, quest.longitude]
      : null
  }, [quests])

  function findMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('GPS location is not supported by this browser.')
      return
    }

    setLocationMessage('Requesting your location…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: Position = [position.coords.latitude, position.coords.longitude]
        setUserPosition(coords)
        setLocationMessage('Your location is shown on the map.')
      },
      (error) => {
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Enable it in browser settings if you want to use GPS.'
            : 'Could not get your location. Please try again.',
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <section className="civic-map">
      <div className="civic-map__toolbar">
        <div>
          <h2>Civic Map</h2>
          <p>Explore active quests with a saved location.</p>
        </div>
        <button type="button" onClick={findMyLocation}>Use my location</button>
      </div>

      {locationMessage && <p className="civic-map__message" role="status">{locationMessage}</p>}
      {loadError && <p className="civic-map__message" role="alert">Could not load quests: {loadError}</p>}

      <div className="civic-map__legend">
        <span>{loading ? 'Loading quests…' : `${quests.length} mapped quest${quests.length === 1 ? '' : 's'}`}</span>
        <span>Map data © OpenStreetMap contributors</span>
      </div>

      <MapContainer
        center={firstQuestPosition || userPosition || [28.6139, 77.209]}
        zoom={firstQuestPosition || userPosition ? 13 : 11}
        scrollWheelZoom
        className="civic-map__canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {quests.map((quest) => {
          if (quest.latitude === null || quest.longitude === null) return null
          return (
            <Marker key={quest.id} position={[quest.latitude, quest.longitude]}>
              <Popup>
                <strong>{quest.title}</strong>
                <br />
                Category: {quest.category}
                <br />
                {quest.description}
                <br />
                <small>Location: {quest.location_name}</small>
                <br />
                <strong>{quest.xp_reward} XP</strong>
              </Popup>
            </Marker>
          )
        })}

        {userPosition && <CurrentLocationMarker position={userPosition} />}
        {userPosition && <MapFocus position={userPosition} zoom={14} />}
        {!userPosition && firstQuestPosition && <MapFocus position={firstQuestPosition} zoom={13} />}
      </MapContainer>

      {!loading && quests.length === 0 && !loadError && (
        <p className="civic-map__footnote">
          No open quests with map locations were found for this area yet. An admin must choose a pin when creating a quest.
        </p>
      )}
      <p className="civic-map__footnote">
        Your location is requested only when you press the location button.
      </p>
    </section>
  )
}
