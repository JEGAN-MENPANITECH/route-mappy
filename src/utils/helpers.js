export const normalizeCoordinate = (coord) => {
  if (!coord) return null;
  const lat = Number(coord.latitude ?? coord.lat ?? coord[1]);
  const lng = Number(coord.longitude ?? coord.lng ?? coord[0]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { latitude: lat, longitude: lng };
};

export const isValidCoordinate = (coord) => {
  const parsed = normalizeCoordinate(coord);
  return !!parsed && Math.abs(parsed.latitude) > 0.000001 && Math.abs(parsed.longitude) > 0.000001;
};

export const calculateDistance = (coord1, coord2) => {
  if (!isValidCoordinate(coord1) || !isValidCoordinate(coord2)) return 0;
  const R = 6371;
  const dLat = (coord2.latitude - coord1.latitude) * (Math.PI / 180);
  const dLon = (coord2.longitude - coord1.longitude) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.latitude * (Math.PI / 180)) *
    Math.cos(coord2.latitude * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const degToRad = Math.PI / 180;
  const φ1 = lat1 * degToRad;
  const φ2 = lat2 * degToRad;
  const Δλ = (lon2 - lon1) * degToRad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
};

export const calculateMidpoint = (coord1, coord2) => ({
  latitude: (coord1.latitude + coord2.latitude) / 2,
  longitude: (coord1.longitude + coord2.longitude) / 2,
});

export const calculateOptimalZoom = (distance) => {
  if (distance < 0.05) return 15;
  if (distance < 0.1) return 15;
  if (distance < 0.2) return 14.5;
  if (distance < 0.5) return 14;
  if (distance < 1) return 13.5;
  if (distance < 2) return 13;
  if (distance < 5) return 12;
  return 11;
};
