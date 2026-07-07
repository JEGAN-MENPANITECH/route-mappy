import { useRef, useState, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getDynamicSunProfile } from '../utils/sunProfile';
import { loadPoiImages } from '../data/pois';
import {
  normalizeCoordinate,
  isValidCoordinate,
  calculateDistance,
  calculateBearing,
  calculateMidpoint,
  calculateOptimalZoom,
} from '../utils/helpers';

const MAX_ZOOM_LEVEL = 21.99;
const MIN_ZOOM_LEVEL = 1;
const REGULAR_ANIMATION_DURATION = 1500;
const CAMERA_PITCH = 0;
const SUN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const CAMERA_PADDING_HOME = { top: 200, bottom: 100, left: 100, right: 100 };

const MapView = forwardRef(({
  initialRegion,
  pickupLocation,
  dropLocation,
  routeCoordinates,
  tripRouteCoordinates,
  driverLocation,
  liveDrivers,
  driverBearing,
  screen = 'home',
  tripData,
  trip_type,
  color = '#4285F4',
  zoom: defaultZoom = 16,
  onMapReady,
  onRegionChangeComplete,
  onRegionIsChanging,
  styleUrl,
  children,
}, ref) => {
  const BASE = import.meta.env.BASE_URL || '/';
  const resolvedStyleUrl = styleUrl || `${BASE}style.json`;

  const mapContainerRef = useRef(null);
  const overlayRef = useRef(null);
  const mapRef = useRef(null);
  const isMapReadyRef = useRef(false);
  const isStyleLoadedRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const hasInitialCameraFocusedRef = useRef(false);
  const hasManuallyFocusedRef = useRef(false);
  const shouldAutoCameraUpdateRef = useRef(true);
  const lastAutoCameraKeyRef = useRef(null);
  const lastInitialFocusKeyRef = useRef(null);
  const mountedRef = useRef(false);
  const pendingCameraActionRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [sunProfile, setSunProfile] = useState(() => getDynamicSunProfile());

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const updateSunProfile = () => setSunProfile(getDynamicSunProfile());
    updateSunProfile();
    const timer = setInterval(updateSunProfile, SUN_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: resolvedStyleUrl,
      center: [78.4867, 17.3850],
      zoom: 4,
      attributionControl: false,
      logoPosition: undefined,
      fadeDuration: 350,
    });

    mapRef.current = map;

    function handleStyleLoad() {
      if (isStyleLoadedRef.current) return;
      isStyleLoadedRef.current = true;
      loadPoiImages(map);

      if (!isMapReadyRef.current) {
        isMapReadyRef.current = true;
        setMapReady(true);
        onMapReady?.();
      }

      if (pendingCameraActionRef.current) {
        runCameraAction(pendingCameraActionRef.current);
        pendingCameraActionRef.current = null;
      }
    }

    map.on('load', handleStyleLoad);

    map.on('styledata', () => {
      if (map.isStyleLoaded()) handleStyleLoad();
    });

    map.on('movestart', () => {
      isUserInteractingRef.current = true;
      onRegionIsChanging?.(true);
    });

    map.on('moveend', () => {
      isUserInteractingRef.current = false;
      if (mapRef.current && onRegionChangeComplete) {
        const center = mapRef.current.getCenter();
        onRegionChangeComplete({
          latitude: center.lat,
          longitude: center.lng,
        });
      }
      onRegionIsChanging?.(false);
    });

    map.on('click', () => {
      shouldAutoCameraUpdateRef.current = false;
      hasManuallyFocusedRef.current = true;
    });

    return () => {
      map.remove();
      mapRef.current = null;
      isMapReadyRef.current = false;
      isStyleLoadedRef.current = false;
    };
  }, []);

  const runCameraAction = useCallback((action, attempt = 0) => {
    const map = mapRef.current;
    if (!map || !mountedRef.current) {
      if (attempt < 5) {
        pendingCameraActionRef.current = action;
        setTimeout(() => runCameraAction(action, attempt + 1), 120);
      }
      return;
    }

    pendingCameraActionRef.current = null;

    try {
      if (action.type === 'bounds') {
        map.fitBounds(
          [[action.bounds.sw[0], action.bounds.sw[1]], [action.bounds.ne[0], action.bounds.ne[1]]],
          {
            padding: action.padding || CAMERA_PADDING_HOME,
            duration: action.animationDuration || 800,
            pitch: action.pitch ?? CAMERA_PITCH,
          }
        );
      } else if (action.type === 'flyTo') {
        map.flyTo({
          center: action.centerCoordinate,
          zoom: action.zoomLevel || 16,
          bearing: action.heading,
          pitch: action.pitch ?? CAMERA_PITCH,
          duration: action.animationDuration || 1000,
        });
      }
    } catch (e) {
      if (attempt < 3) {
        setTimeout(() => runCameraAction(action, attempt + 1), 160);
      }
    }
  }, []);

  const cameraConfig = useMemo(() => {
    if (hasManuallyFocusedRef.current || isUserInteractingRef.current || !shouldAutoCameraUpdateRef.current) return null;

    const pickup = normalizeCoordinate(pickupLocation);
    const drop = normalizeCoordinate(dropLocation);
    const driver = normalizeCoordinate(driverLocation);

    if (screen === 'home' && trip_type !== 2 && pickup && drop) {
      return {
        type: 'bounds',
        bounds: {
          ne: [
            Math.max(pickup.longitude, drop.longitude),
            Math.max(pickup.latitude, drop.latitude),
          ],
          sw: [
            Math.min(pickup.longitude, drop.longitude),
            Math.min(pickup.latitude, drop.latitude),
          ],
        },
        padding: CAMERA_PADDING_HOME,
        animationDuration: REGULAR_ANIMATION_DURATION,
      };
    }

    if (screen === 'trip') {
      const status = Number(tripData?.trip?.status ?? 0);
      const isPickupPhase = status <= 2;
      const targetLocation = isPickupPhase ? pickup : (drop || pickup);

      if (driver && targetLocation) {
        const dist = calculateDistance(driver, targetLocation);
        const midpoint = calculateMidpoint(driver, targetLocation);
        const bearing = calculateBearing(driver.latitude, driver.longitude, targetLocation.latitude, targetLocation.longitude);
        const zoom = Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, calculateOptimalZoom(dist)));
        return {
          type: 'flyTo',
          centerCoordinate: [midpoint.longitude, midpoint.latitude],
          heading: bearing,
          zoomLevel: zoom,
          padding: CAMERA_PADDING_HOME,
          animationDuration: REGULAR_ANIMATION_DURATION,
        };
      }

      const fallback = driver || pickup || drop;
      if (fallback) {
        return {
          type: 'flyTo',
          centerCoordinate: [fallback.longitude, fallback.latitude],
          zoomLevel: driver ? 16 : 15,
          animationDuration: REGULAR_ANIMATION_DURATION,
        };
      }
    }
    return null;
  }, [pickupLocation, dropLocation, driverLocation, screen, tripData, trip_type]);

  useEffect(() => {
    if (!cameraConfig || !mapReady || !shouldAutoCameraUpdateRef.current) return;
    const key = JSON.stringify(cameraConfig);
    if (lastAutoCameraKeyRef.current === key) return;
    lastAutoCameraKeyRef.current = key;
    runCameraAction(cameraConfig);
  }, [cameraConfig, mapReady, runCameraAction]);

  useEffect(() => {
    if (!mapReady || !initialRegion || hasInitialCameraFocusedRef.current) return;
    const parsed = normalizeCoordinate(initialRegion);
    if (!parsed) return;

    const key = `${parsed.latitude.toFixed(6)}|${parsed.longitude.toFixed(6)}`;
    if (lastInitialFocusKeyRef.current === key) return;
    lastInitialFocusKeyRef.current = key;
    hasInitialCameraFocusedRef.current = true;

    runCameraAction({
      type: 'flyTo',
      centerCoordinate: [parsed.longitude, parsed.latitude],
      zoomLevel: defaultZoom,
      animationDuration: 500,
    });
  }, [initialRegion, mapReady, defaultZoom, runCameraAction]);

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    flyTo: (location, zoom = 15, duration = 1000) => {
      const parsed = normalizeCoordinate(location);
      if (!parsed) return;
      hasManuallyFocusedRef.current = true;
      shouldAutoCameraUpdateRef.current = false;
      runCameraAction({
        type: 'flyTo',
        centerCoordinate: [parsed.longitude, parsed.latitude],
        zoomLevel: zoom,
        animationDuration: duration,
      });
    },
    fitBounds: (bounds, padding = CAMERA_PADDING_HOME) => {
      if (!bounds) return;
      hasManuallyFocusedRef.current = true;
      shouldAutoCameraUpdateRef.current = false;
      runCameraAction({
        type: 'bounds',
        bounds,
        padding,
        animationDuration: 800,
      });
    },
    enableAutoCamera: (enable) => {
      shouldAutoCameraUpdateRef.current = enable;
      if (enable) {
        hasManuallyFocusedRef.current = false;
        lastAutoCameraKeyRef.current = null;
        lastInitialFocusKeyRef.current = null;
      }
    },
  }), [runCameraAction]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !sunProfile) return;
    map.setLight(sunProfile.light);
  }, [sunProfile, mapReady]);

  return (
    <div className="map-container">
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
      <div ref={overlayRef} className="map-overlay">
        {children}
      </div>
    </div>
  );
});

MapView.displayName = 'MapView';
export default MapView;
