import { getCurrentSession } from './api.js';

/*
 * 地図まわりの共通処理（ホーム・コミュニティで共用）
 *  - Google Maps の読み込み
 *  - 沖縄県内かどうかの判定
 *  - 店名・住所からの場所検索（候補つき）
 */

/* ブラウザに公開されるキーです。Google Cloud 側で HTTP リファラー制限をかけてください */
const GOOGLE_MAPS_API_KEY = 'AIzaSyCU4qTaXJ3m3Uq-v_dvU3rFgIfyc-gUJkY';
let googleMapsPromise;

export function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = `okitalkGoogleMapsReady${Date.now()}`;
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=${callbackName}&language=ja&region=JP&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Google Mapsを読み込めませんでした。APIキーの制限とMaps JavaScript APIの有効化を確認してください。'));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

export function isOkinawaCoordinate(latitude, longitude) {
  return latitude >= 24 && latitude <= 28.8 && longitude >= 122.5 && longitude <= 131.5;
}

export const OKINAWA_BOUNDS = { north: 28.8, south: 24.0, east: 131.5, west: 122.5 };

/** FastAPI サーバー（/api/geocode）が使えるときはそちらで検索する。使えなければ null。 */
async function searchOnServer(query) {
  try {
    const session = await getCurrentSession();
    if (!session) return null;
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' }
    });
    if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) return null;
    const body = await response.json();
    const list = (body.candidates?.length ? body.candidates : [body]).map((item) => ({
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      name: item.name || '',
      address: item.address || '',
      approximate: Boolean(item.approximate)
    }));
    return list.filter((item) => isOkinawaCoordinate(item.latitude, item.longitude));
  } catch {
    return null;
  }
}

/** Google の「場所検索」（店名で探せる）。使えない設定のときは null。 */
async function searchWithGooglePlaces(query) {
  try {
    await loadGoogleMaps();
    const { Place } = await window.google.maps.importLibrary('places');
    const { places } = await Place.searchByText({
      textQuery: query,
      fields: ['displayName', 'formattedAddress', 'location'],
      language: 'ja',
      region: 'jp',
      maxResultCount: 5,
      locationBias: OKINAWA_BOUNDS
    });
    return (places || []).map((place) => ({
      latitude: place.location.lat(),
      longitude: place.location.lng(),
      name: place.displayName || '',
      address: place.formattedAddress || '',
      approximate: false
    }));
  } catch (error) {
    console.warn('Googleの場所検索を利用できません。住所検索に切り替えます。', error);
    return null;
  }
}

async function searchWithGeocoder(query) {
  try {
    await loadGoogleMaps();
    const geocoder = new window.google.maps.Geocoder();
    const { results } = await geocoder.geocode({ address: query, region: 'JP', bounds: OKINAWA_BOUNDS });
    return (results || []).slice(0, 5).map((result) => ({
      latitude: result.geometry.location.lat(),
      longitude: result.geometry.location.lng(),
      name: '',
      address: result.formatted_address || '',
      // 番地までは特定できていない（市・町の中心などに置かれた）結果
      approximate: !['ROOFTOP', 'RANGE_INTERPOLATED'].includes(result.geometry.location_type) || Boolean(result.partial_match)
    }));
  } catch (error) {
    console.warn('Google Geocoderを利用できません。', error);
    return null;
  }
}

async function searchWithNominatim(query) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=jp&viewbox=122.5,28.8,131.5,24&bounded=1&q=${encodeURIComponent(query)}`,
    { headers: { 'Accept-Language': 'ja' } }
  );
  if (!response.ok) throw new Error('住所検索サービスへ接続できませんでした。');
  const rows = await response.json();
  return (rows || []).map((row) => ({
    latitude: Number(row.lat),
    longitude: Number(row.lon),
    name: row.name || '',
    address: row.display_name || '',
    approximate: false
  }));
}

/** 店名・住所から場所の候補を最大5件返す（サーバー → Google場所検索 → Geocoder → OpenStreetMap の順）。 */
export async function searchPlaces(rawQuery) {
  const query = /沖縄/.test(rawQuery) ? rawQuery : `沖縄県 ${rawQuery}`;
  const attempts = [
    () => searchOnServer(rawQuery),
    () => searchWithGooglePlaces(query),
    () => searchWithGeocoder(query),
    () => searchWithNominatim(query)
  ];
  for (const attempt of attempts) {
    const found = await attempt();
    const inOkinawa = (found || []).filter((item) => isOkinawaCoordinate(item.latitude, item.longitude));
    if (inOkinawa.length) {
      const seen = new Set();
      return inOkinawa.filter((item) => {
        const key = `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  }
  return [];
}

export async function geocode(address) {
  const [first] = await searchPlaces(address);
  if (!first) throw new Error('沖縄県内の住所を確認できませんでした。市町村名・番地まで入力してください。');
  return { latitude: first.latitude, longitude: first.longitude, formattedAddress: first.address };
}
