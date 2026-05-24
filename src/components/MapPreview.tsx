import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type Props = {
  destLat: number;
  destLng: number;
  width?: string;
  height?: string;
};

const cafeLat = 14.6498;
const cafeLng = 121.0509;

const MapPreview: React.FC<Props> = ({ destLat, destLng, width = '100%', height = '200px' }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const token = process.env.REACT_APP_MAPBOX_TOKEN;

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!token) return; // nothing to show without token

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [(cafeLng + destLng) / 2, (cafeLat + destLat) / 2],
      zoom: 12,
    });

    mapRef.current = map;

    const cafeMarker = new mapboxgl.Marker({ color: '#ffb400' }).setLngLat([cafeLng, cafeLat]).addTo(map);
    const destMarker = new mapboxgl.Marker({ color: '#67e8f9' }).setLngLat([destLng, destLat]).addTo(map);

    map.on('load', () => {
      const line: any = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[cafeLng, cafeLat], [destLng, destLat]] },
      };

      if (map.getSource('route')) {
        (map.getSource('route') as any).setData(line);
      } else {
        map.addSource('route', { type: 'geojson', data: line });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: {}, paint: { 'line-color': '#f59e0b', 'line-width': 4 } });
      }

      map.fitBounds([
        [Math.min(cafeLng, destLng), Math.min(cafeLat, destLat)],
        [Math.max(cafeLng, destLng), Math.max(cafeLat, destLat)],
      ], { padding: 40 });
    });

    return () => {
      cafeMarker.remove();
      destMarker.remove();
      map.remove();
    };
  }, [destLat, destLng, token]);

  if (!token) {
    return <div className="rounded-2xl border border-white/10 bg-black/10 p-3 text-sm text-cream/60">Map preview disabled — set REACT_APP_MAPBOX_TOKEN to enable.</div>;
  }

  return <div ref={mapContainer} style={{ width, height }} className="rounded-2xl overflow-hidden" />;
};

export default MapPreview;
