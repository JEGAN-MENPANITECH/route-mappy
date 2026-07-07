export const POI_NAMES = [
  'poi_airport', 'poi_train', 'poi_bustop', 'poi_bus_station', 'poi_metro',
  'poi_subway', 'poi_taxi', 'poi_ferry', 'poi_marina', 'poi_parking',
  'poi_fuel', 'poi_ev_charging', 'poi_bridge', 'poi_tunnel', 'poi_pier',
  'poi_toll_booth', 'poi_terminal',

  'poi_hospital', 'poi_clinic', 'poi_pharmacy', 'poi_laboratory', 'poi_nursing_home',

  'poi_shop', 'poi_supermarket', 'poi_mall', 'poi_market', 'poi_clothes',
  'poi_textiles', 'poi_silks', 'poi_jewelry', 'poi_electronics', 'poi_appliance',
  'poi_gift', 'poi_optical', 'poi_furniture', 'poi_hardware', 'poi_bookstore',
  'poi_mobile_shop', 'poi_emporium', 'poi_department_store', 'poi_butcher',
  'poi_fish_shop', 'poi_shoe_store', 'poi_watch_store', 'poi_flower_shop',
  'poi_pet_shop', 'poi_bank',

  'poi_restaurant', 'poi_cafe', 'poi_fastfood', 'poi_bakery', 'poi_sweets',
  'poi_icecream', 'poi_bar', 'poi_pub', 'poi_foodcourt',

  'poi_hotel', 'poi_lodge', 'poi_guesthouse', 'poi_hostel', 'poi_resort',

  'poi_apartment', 'poi_complex',

  'poi_government', 'poi_municipality', 'poi_police', 'poi_fire_station',
  'poi_court', 'poi_post', 'poi_embassy', 'poi_prison',

  'poi_temple', 'poi_mosque', 'poi_church', 'poi_synagogue', 'poi_shrine',
  'poi_monument', 'poi_memorial', 'poi_statue',

  'poi_school', 'poi_college', 'poi_university', 'poi_library', 'poi_research',
  'poi_institute',

  'poi_cinema', 'poi_theatre', 'poi_auditorium', 'poi_museum', 'poi_zoo',
  'poi_gallery', 'poi_cultural_center',

  'poi_stadium', 'poi_playground', 'poi_sports', 'poi_turf', 'poi_gym',
  'poi_swimming',

  'poi_park', 'poi_garden', 'poi_peak', 'poi_lake', 'poi_river', 'poi_viewpoint',
  'poi_beach', 'poi_fort',

  'poi_dam', 'poi_power', 'poi_waterworks', 'poi_tower', 'poi_substation',

  'poi_party_hall', 'poi_marriage_hall', 'poi_banquet', 'poi_convention_center',
  'poi_exhibition_center',

  'poi_salon', 'poi_laundry', 'poi_photography', 'poi_print', 'poi_tattoo',
  'poi_repair',

  'poi_cemetery', 'poi_crematorium', 'road_shield',
];

const BASE = import.meta.env.BASE_URL || '/';

export function getPoiUrl(name) {
  return `${BASE}pois/${name}.png`;
}

export async function loadPoiImages(map, names = POI_NAMES) {
  const promises = names.map(async (name) => {
    try {
      const url = getPoiUrl(name);
      const response = await map.loadImage(url);
      if (!map.hasImage(name)) {
        map.addImage(name, response.data, { sdf: false });
      }
    } catch (error) {
      // image missing or failed to load; skip
    }
  });
  await Promise.all(promises);
}
