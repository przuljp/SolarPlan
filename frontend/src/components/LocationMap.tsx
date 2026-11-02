import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

type LocationMapProps = {
  position: Coordinates | null;
  onPositionChange: (position: Coordinates) => void;
};

const BOSNIA_AND_HERZEGOVINA_CENTER: [number, number] = [44.15, 17.75];
const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function MapClickHandler({
  onPositionChange,
}: Pick<LocationMapProps, "onPositionChange">) {
  useMapEvents({
    click(event) {
      onPositionChange({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });
  return null;
}

function MapPosition({ position }: Pick<LocationMapProps, "position">) {
  const map = useMap();
  const latitude = position?.latitude;
  const longitude = position?.longitude;

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    map.setView([latitude, longitude], 16);
  }, [latitude, longitude, map]);

  return null;
}

export function LocationMap({
  position,
  onPositionChange,
}: LocationMapProps) {
  const initialCenter: [number, number] = position
    ? [position.latitude, position.longitude]
    : BOSNIA_AND_HERZEGOVINA_CENTER;

  return (
    <div className="map-shell">
      <MapContainer
        aria-label="Map for choosing the property location"
        center={initialCenter}
        className="location-map"
        scrollWheelZoom
        zoom={position ? 16 : 7}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url={TILE_URL}
        />
        <MapClickHandler onPositionChange={onPositionChange} />
        <MapPosition position={position} />
        {position && (
          <Marker position={[position.latitude, position.longitude]} />
        )}
      </MapContainer>
      <p className="map-caption">
        Click the map to move the calculation point. Use the fields below for
        exact coordinate corrections.
      </p>
    </div>
  );
}
