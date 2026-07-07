const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, amount) => start + (end - start) * amount;

const getShadowTranslate = (azimuth, length) => {
  const angle = (azimuth + 180) * Math.PI / 180;
  return [
    Number((Math.sin(angle) * length).toFixed(2)),
    Number((-Math.cos(angle) * length).toFixed(2)),
  ];
};

export const getDynamicSunProfile = (date = new Date()) => {
  const hour = date.getHours() + date.getMinutes() / 60;

  if (hour < 5.5 || hour >= 19) {
    const azimuth = 315;
    return {
      light: {
        anchor: 'map',
        position: [1.45, azimuth, 48],
        color: '#A9C4FF',
        intensity: 0.26,
      },
      shadowTranslate: getShadowTranslate(azimuth, 2.2),
      shadowOpacity: 0.55,
      waterShimmerTranslate: [-0.4, 0.2],
    };
  }

  if (hour < 8) {
    const progress = clamp((hour - 5.5) / 2.5, 0, 1);
    const azimuth = lerp(88, 118, progress);
    const shadowLength = lerp(7.5, 4.2, progress);
    return {
      light: {
        anchor: 'map',
        position: [1.42, azimuth, lerp(68, 48, progress)],
        color: '#FFF2D7',
        intensity: lerp(0.28, 0.36, progress),
      },
      shadowTranslate: getShadowTranslate(azimuth, shadowLength),
      shadowOpacity: lerp(0.95, 0.72, progress),
      waterShimmerTranslate: [lerp(-1.2, -0.6, progress), lerp(0.4, 0.2, progress)],
    };
  }

  if (hour < 16.5) {
    const progress = clamp((hour - 8) / 8.5, 0, 1);
    const noonStrength = 1 - Math.abs(progress - 0.5) / 0.5;
    const azimuth = lerp(118, 244, progress);
    const shadowLength = lerp(4.2, 1.2, noonStrength);
    return {
      light: {
        anchor: 'map',
        position: [1.55, azimuth, lerp(48, 18, noonStrength)],
        color: noonStrength > 0.65 ? '#FFFFFF' : '#FFF2D7',
        intensity: lerp(0.36, 0.46, noonStrength),
      },
      shadowTranslate: getShadowTranslate(azimuth, shadowLength),
      shadowOpacity: lerp(0.72, 0.38, noonStrength),
      waterShimmerTranslate: [lerp(-0.4, 0.4, progress), 0],
    };
  }

  const progress = clamp((hour - 16.5) / 2.5, 0, 1);
  const azimuth = lerp(244, 282, progress);
  const shadowLength = lerp(4.2, 8.2, progress);
  return {
    light: {
      anchor: 'map',
      position: [1.48, azimuth, lerp(48, 70, progress)],
      color: progress > 0.5 ? '#FFB07A' : '#FFE3AE',
      intensity: lerp(0.34, 0.28, progress),
    },
    shadowTranslate: getShadowTranslate(azimuth, shadowLength),
    shadowOpacity: lerp(0.72, 1, progress),
    waterShimmerTranslate: [lerp(0.6, 1.4, progress), lerp(0.2, 0.5, progress)],
  };
};

const scaledTranslate = ([x, y], scale) => [
  Number((x * scale).toFixed(2)),
  Number((y * scale).toFixed(2)),
];

export const prepareMapStyle = (style, sunProfile) => {
  if (!style) return style;
  const shadowTranslate = sunProfile?.shadowTranslate || [2, 2];
  const shadowOpacity = sunProfile?.shadowOpacity ?? 0.7;
  const shimmerTranslate = sunProfile?.waterShimmerTranslate || [0, 0];

  const layers = style.layers?.map(layer => {
    if (layer.id === 'buildings_shadow') {
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15, 0,
            16.5, Number((0.05 * shadowOpacity).toFixed(3)),
            17.5, Number((0.09 * shadowOpacity).toFixed(3)),
            18.5, Number((0.15 * shadowOpacity).toFixed(3)),
            19.5, Number((0.21 * shadowOpacity).toFixed(3)),
          ],
          'fill-opacity-transition': { duration: 500, delay: 0 },
          'fill-translate': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15, ['literal', scaledTranslate(shadowTranslate, 0.55)],
            18, ['literal', shadowTranslate],
            20, ['literal', scaledTranslate(shadowTranslate, 1.25)],
          ],
          'fill-translate-anchor': 'viewport',
          'fill-translate-transition': { duration: 500, delay: 0 },
        },
      };
    }

    if (layer.id === 'bridge_shadow') {
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'line-color': `rgba(29,28,25,${Number((0.12 * shadowOpacity).toFixed(3))})`,
          'line-translate': scaledTranslate(shadowTranslate, 0.72),
          'line-translate-anchor': 'viewport',
          'line-translate-transition': { duration: 500, delay: 0 },
        },
      };
    }

    if (layer.id === 'water_reflection_shimmer') {
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'line-translate': shimmerTranslate,
          'line-translate-anchor': 'viewport',
          'line-translate-transition': { duration: 500, delay: 0 },
        },
      };
    }

    return layer;
  });

  return {
    ...style,
    layers: layers || style.layers,
  };
};
