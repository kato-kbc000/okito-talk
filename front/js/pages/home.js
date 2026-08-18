import {
  getCurrentUser,
  ensureCurrentProfile,
  createPost,
  uploadPostImage,
  getTimelinePosts,
  createPlace,
  getPlaces,
  getFollowing,
  getPostEngagement,
  getUnreadMessageCount,
  subscribeToIncomingMessages,
  setPostLiked,
  setPostSaved
} from '../api.js?v=20260818-4';

const $ = (id) => document.getElementById(id);
const GOOGLE_MAPS_API_KEY = 'AIzaSyCU4qTaXJ3m3Uq-v_dvU3rFgIfyc-gUJkY';
let googleMapsPromise;

function loadGoogleMaps() {
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

const state = {
  user: null,
  profile: null,
  posts: [],
  places: [],
  followingIds: new Set(),
  activeTab: 'all',
  area: 'all',
  selectedPostLocation: null,
  selectedPinLocation: null,
  map: null,
  layers: null,
  mapReady: false,
  loadingData: false,
  likedIds: new Set(),
  savedIds: new Set(),
  likeCounts: new Map(),
  page: 0,
  pageSize: 30,
  hasMorePosts: true
  ,postImageFile: null
  ,postImagePreviewUrl: null
};

function escapeHtml(value = '') {
  const element = document.createElement('div');
  element.textContent = String(value);
  return element.innerHTML;
}

function firstChar(value = '沖') {
  return [...String(value).trim()][0] || '沖';
}

function timeAgo(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'たった今';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}時間前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}日前`;
  return new Date(value).toLocaleDateString('ja-JP');
}

function setAvatar(element, profile) {
  if (!element) return;

  const label = profile?.display_name || profile?.username || 'ユーザー';
  element.textContent = '';
  element.style.backgroundImage = '';

  if (profile?.avatar_url) {
    element.style.backgroundImage = `url("${profile.avatar_url}")`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
  } else {
    element.textContent = firstChar(label);
  }
}

function setTimelineStatus(message = '', isError = false) {
  const element = $('timelineStatus');
  if (!element) return;

  element.textContent = message;
  element.style.display = message ? 'block' : 'none';
  element.style.color = isError ? '#b91c1c' : '';
}

async function refreshUnreadBadge() {
  const badge = $('homeUnreadMessageBadge');
  if (!badge || !state.user) return;
  const count = await getUnreadMessageCount(state.user.id);
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = count === 0;
  badge.setAttribute('aria-label', `未読メッセージ${count}件`);
}

function getVisiblePosts() {
  return state.posts.filter((post) => {
    const matchesTab =
      state.activeTab === 'all' || state.followingIds.has(post.user_id);

    const matchesArea =
      state.area === 'all' ||
      post.location_name === state.area ||
      post.location_address?.includes(state.area);

    return matchesTab && matchesArea;
  });
}

function renderPosts() {
  const list = $('postList');
  if (!list) return;

  const posts = getVisiblePosts();
  list.replaceChildren();

  const noFollowing = $('noFollowingMessage');
  const empty = $('emptyPostMessage');

  if (noFollowing) {
    noFollowing.style.display =
      state.activeTab === 'following' && posts.length === 0 ? 'block' : 'none';
  }

  if (empty) {
    empty.style.display =
      state.activeTab === 'all' && posts.length === 0 ? 'block' : 'none';
  }

  const fragment = document.createDocumentFragment();

  posts.forEach((post) => {
    const profile = post.profiles || {};
    const article = document.createElement('article');
    article.className = 'post-card';

    article.innerHTML = `
      <button
        type="button"
        class="post-user-icon post-profile-link"
        aria-label="${escapeHtml(profile.display_name || 'ユーザー')}のプロフィールを開く"
      ></button>
      <div class="post-main">
        <div class="post-header">
          <div>
            <strong>${escapeHtml(profile.display_name || 'ユーザー')}</strong>
            <span>@${escapeHtml(profile.username || 'user')}</span>
          </div>
          <span class="post-time">${timeAgo(post.created_at)}</span>
        </div>
        <p class="post-text">${escapeHtml(post.content).replaceAll('\n', '<br>')}</p>
        ${post.image_url ? `<img class="post-image" src="${escapeHtml(post.image_url)}" alt="投稿画像" loading="lazy">` : ''}
        <div class="post-bottom">
          ${post.location_name || post.location_address
            ? `<button type="button" class="map-focus-button">📍 ${escapeHtml(post.location_name || post.location_address)}</button>`
            : '<span></span>'}
          <div class="post-actions">
            <button type="button" class="post-action-button ${state.likedIds.has(post.id) ? 'active' : ''}" data-like aria-pressed="${state.likedIds.has(post.id)}">
              ${state.likedIds.has(post.id) ? '♥' : '♡'} いいね <span>${state.likeCounts.get(post.id) || 0}</span>
            </button>
            <button type="button" class="post-action-button ${state.savedIds.has(post.id) ? 'active' : ''}" data-save aria-pressed="${state.savedIds.has(post.id)}">
              ${state.savedIds.has(post.id) ? '🔖' : '🔗'} 保存
            </button>
          </div>
        </div>
      </div>
    `;

    const avatar = article.querySelector('.post-user-icon');
    setAvatar(avatar, profile);

    avatar?.addEventListener('click', () => {
      if (post.user_id) {
        location.href = `home/profile.html?userId=${encodeURIComponent(post.user_id)}`;
      }
    });

    article.querySelector('.map-focus-button')?.addEventListener('click', () => {
      focusPost(post);
    });

    article.querySelector('[data-like]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const nextLiked = !state.likedIds.has(post.id);
      button.disabled = true;
      try {
        await setPostLiked(state.user.id, post.id, nextLiked);
        if (nextLiked) {
          state.likedIds.add(post.id);
          state.likeCounts.set(post.id, (state.likeCounts.get(post.id) || 0) + 1);
        } else {
          state.likedIds.delete(post.id);
          state.likeCounts.set(post.id, Math.max(0, (state.likeCounts.get(post.id) || 0) - 1));
        }
        renderPosts();
      } catch (error) {
        alert(`いいねを更新できませんでした：${error.message}`);
        button.disabled = false;
      }
    });

    article.querySelector('[data-save]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const nextSaved = !state.savedIds.has(post.id);
      button.disabled = true;
      try {
        await setPostSaved(state.user.id, post.id, nextSaved);
        if (nextSaved) state.savedIds.add(post.id);
        else state.savedIds.delete(post.id);
        renderPosts();
      } catch (error) {
        alert(`保存を更新できませんでした：${error.message}`);
        button.disabled = false;
      }
    });

    fragment.appendChild(article);
  });

  list.appendChild(fragment);

  const filterMessage = $('filterResultMessage');
  if (filterMessage) {
    const tabLabel = state.activeTab === 'following' ? 'フォロー中' : '全体';
    const areaLabel = state.area === 'all' ? '沖縄県すべて' : state.area;
    filterMessage.textContent = `${tabLabel}・${areaLabel}：${posts.length}件`;
  }

  refreshMap();
}

async function initMap() {
  if (state.mapReady || !$('map')) return;
  const maps = await loadGoogleMaps();
  state.map = new maps.Map($('map'), {
    center: { lat: 26.2124, lng: 127.6809 },
    zoom: 9,
    mapTypeControl: false,
    streetViewControl: false
  });
  state.layers = [];
  state.mapReady = true;

  state.map.addListener('click', (event) => {
    const latitude = event.latLng.lat();
    const longitude = event.latLng.lng();
    state.selectedPostLocation = {
      latitude,
      longitude
    };

    const text = $('postLocationStatusText');
    if (text) {
      text.textContent = `地図で選択：${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }
    $('postLocationStatus')?.classList.add('active');
  });

  refreshMap();
}

function refreshMap() {
  if (!state.mapReady || !state.map || !window.google?.maps) return;
  state.layers.forEach(marker => marker.setMap(null));
  state.layers = [];
  const bounds = new window.google.maps.LatLngBounds();
  let markerCount = 0;
  const visiblePostIds = new Set(getVisiblePosts().map((post) => post.id));

  const items = [
    ...state.posts
      .filter((post) => visiblePostIds.has(post.id))
      .map((post) => ({ ...post, kind: 'post' })),
    ...state.places.map((place) => ({ ...place, kind: 'place' }))
  ];

  items.forEach((item) => {
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !isOkinawaCoordinate(latitude, longitude)) return;

    const label = item.kind === 'post'
      ? item.content
      : `${item.name}${item.description ? `\n${item.description}` : ''}`;

    const marker = new window.google.maps.Marker({
      position: { lat: latitude, lng: longitude },
      map: state.map,
      title: label
    });
    const info = new window.google.maps.InfoWindow({
      content: `<div>${escapeHtml(label).replaceAll('\n', '<br>')}</div>`
    });
    marker.addListener('click', () => info.open({ map: state.map, anchor: marker }));
    state.layers.push(marker);
    bounds.extend(marker.getPosition());
    markerCount += 1;
  });

  if (markerCount) {
    state.map.fitBounds(bounds, 24);
    window.google.maps.event.addListenerOnce(state.map, 'idle', () => {
      if (state.map.getZoom() > 13) state.map.setZoom(13);
    });
  }
}

function isOkinawaCoordinate(latitude, longitude) {
  return latitude >= 24 && latitude <= 28.8 && longitude >= 122.5 && longitude <= 131.5;
}

function focusPost(post) {
  const latitude = Number(post.latitude);
  const longitude = Number(post.longitude);

  if (state.map && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    state.map.setCenter({ lat: latitude, lng: longitude });
    state.map.setZoom(15);
  }

  $('mapSection')?.scrollIntoView({ behavior: 'smooth' });
}

async function geocode(address) {
  const query = /沖縄/.test(address) ? address : `沖縄県 ${address}`;
  try {
    await loadGoogleMaps();
    const geocoder = new window.google.maps.Geocoder();
    const { results } = await geocoder.geocode({ address: query, region: 'JP' });
    if (results?.[0]) {
      const result = {
        latitude: results[0].geometry.location.lat(),
        longitude: results[0].geometry.location.lng(),
        formattedAddress: results[0].formatted_address
      };
      if (isOkinawaCoordinate(result.latitude, result.longitude)) return result;
    }
  } catch (error) {
    console.warn('Google Geocoderを利用できないため代替検索を使用します。', error);
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=jp&viewbox=122.5,28.8,131.5,24&bounded=1&q=${encodeURIComponent(query)}`,
    { headers: { 'Accept-Language': 'ja' } }
  );
  if (!response.ok) throw new Error('住所検索サービスへ接続できませんでした。');
  const rows = await response.json();
  const latitude = Number(rows?.[0]?.lat);
  const longitude = Number(rows?.[0]?.lon);
  if (!isOkinawaCoordinate(latitude, longitude)) {
    throw new Error('沖縄県内の住所を確認できませんでした。市町村名・番地まで入力してください。');
  }
  return { latitude, longitude, formattedAddress: rows[0].display_name };
}

async function loadData({ force = false } = {}) {
  if (state.loadingData) return;

  state.loadingData = true;
  setTimelineStatus('投稿を読み込んでいます…');

  try {
    const [posts, following, places] = await Promise.all([
      getTimelinePosts({ force, page: 0, pageSize: state.pageSize }),
      getFollowing(state.user.id, { force }),
      getPlaces({ force })
    ]);

    state.posts = posts || [];
    state.page = 0;
    state.hasMorePosts = state.posts.length === state.pageSize;
    state.followingIds = new Set((following || []).map((profile) => profile.id));
    state.places = places || [];

    const engagement = await getPostEngagement(
      state.posts.map((post) => post.id),
      state.user.id
    );
    state.likedIds = engagement.likedIds;
    state.savedIds = engagement.savedIds;
    state.likeCounts = engagement.likeCounts;

    setTimelineStatus('');
    renderPosts();
    updateLoadMoreButton();
  } catch (error) {
    console.error(error);
    state.posts = [];
    state.places = [];
    state.followingIds = new Set();
    setTimelineStatus(`投稿を読み込めませんでした：${error.message}`, true);
    renderPosts();
  } finally {
    state.loadingData = false;
  }
}

function updateLoadMoreButton() {
  const button = $('loadMorePostsButton');
  if (!button) return;
  button.hidden = !state.hasMorePosts;
  button.disabled = false;
  button.textContent = '過去の投稿をさらに見る';
}

async function loadOlderPosts() {
  const button = $('loadMorePostsButton');
  if (!button || !state.hasMorePosts) return;
  button.disabled = true;
  button.textContent = '読み込み中…';
  try {
    const nextPage = state.page + 1;
    const rows = await getTimelinePosts({ page: nextPage, pageSize: state.pageSize });
    const knownIds = new Set(state.posts.map(post => post.id));
    const additions = (rows || []).filter(post => !knownIds.has(post.id));
    state.posts.push(...additions);
    state.page = nextPage;
    state.hasMorePosts = (rows || []).length === state.pageSize;
    const engagement = await getPostEngagement(additions.map(post => post.id), state.user.id);
    engagement.likedIds.forEach(id => state.likedIds.add(id));
    engagement.savedIds.forEach(id => state.savedIds.add(id));
    engagement.likeCounts.forEach((count, id) => state.likeCounts.set(id, count));
    renderPosts();
  } catch (error) {
    alert(`過去の投稿を読み込めませんでした：${error.message}`);
  } finally {
    updateLoadMoreButton();
  }
}

async function init() {
  try {
    state.user = await getCurrentUser();
    if (!state.user) {
      location.replace('login.html');
      return;
    }

    state.profile = await ensureCurrentProfile(state.user);
    setAvatar($('postFormAvatar'), state.profile);

    await initMap();
    await loadData();
    await refreshUnreadBadge();
    subscribeToIncomingMessages(state.user.id, refreshUnreadBadge);

    const savedScroll = Number(sessionStorage.getItem('okitalk_home_scroll_y') || 0);
    if (savedScroll > 0) {
      requestAnimationFrame(() => window.scrollTo({ top: savedScroll, behavior: 'auto' }));
    }
  } catch (error) {
    console.error(error);
    setTimelineStatus(`ホームを読み込めませんでした：${error.message}`, true);
  }
}

$('postContent')?.addEventListener('input', (event) => {
  if ($('characterCount')) {
    $('characterCount').textContent = `${event.target.value.length} / 200`;
  }
});

$('postImageInput')?.addEventListener('change', (event) => {
  const file = event.target.files?.[0] || null;
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    alert('JPEG・PNG・WebP・GIFの5MB以下の画像を選択してください。');
    event.target.value = '';
    return;
  }
  if (state.postImagePreviewUrl) URL.revokeObjectURL(state.postImagePreviewUrl);
  state.postImageFile = file;
  state.postImagePreviewUrl = URL.createObjectURL(file);
  $('postImagePreview').src = state.postImagePreviewUrl;
  $('postImagePreviewArea').hidden = false;
});

$('removePostImageButton')?.addEventListener('click', () => {
  if (state.postImagePreviewUrl) URL.revokeObjectURL(state.postImagePreviewUrl);
  state.postImageFile = null;
  state.postImagePreviewUrl = null;
  if ($('postImageInput')) $('postImageInput').value = '';
  $('postImagePreviewArea').hidden = true;
  $('postImagePreview').removeAttribute('src');
});

$('placeDescription')?.addEventListener('input', (event) => {
  if ($('placeDescriptionCount')) {
    $('placeDescriptionCount').textContent = `${event.target.value.length} / 150`;
  }
});

document.querySelectorAll('.timeline-tab').forEach((button) => {
  button.addEventListener('click', () => {
    state.activeTab = button.dataset.tab || 'all';
    document.querySelectorAll('.timeline-tab').forEach((tab) => {
      tab.classList.toggle('active', tab === button);
    });
    renderPosts();
  });
});

$('areaFilterSelect')?.addEventListener('change', (event) => {
  state.area = event.target.value;
  renderPosts();
});

$('clearAreaFilterButton')?.addEventListener('click', () => {
  state.area = 'all';
  if ($('areaFilterSelect')) $('areaFilterSelect').value = 'all';
  renderPosts();
});

$('resetMapButton')?.addEventListener('click', () => {
  state.map?.setCenter({ lat: 26.2124, lng: 127.6809 });
  state.map?.setZoom(9);
});

$('cancelPostLocationButton')?.addEventListener('click', () => {
  state.selectedPostLocation = null;
  if ($('postLocationStatusText')) $('postLocationStatusText').textContent = '';
  $('postLocationStatus')?.classList.remove('active');
});

$('searchPostAddressButton')?.addEventListener('click', async () => {
  const address = $('postAddressInput')?.value.trim();
  if (!address) return alert('検索する住所を入力してください。');
  const button = $('searchPostAddressButton');
  button.disabled = true;
  try {
    const coordinates = await geocode(address);
    state.selectedPostLocation = { ...coordinates, address };
    $('postLocationStatusText').textContent = `住所：${address}`;
    $('postLocationStatus')?.classList.add('active');
    state.map?.setCenter({ lat: coordinates.latitude, lng: coordinates.longitude });
    state.map?.setZoom(15);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
});

$('loadMorePostsButton')?.addEventListener('click', loadOlderPosts);

$('useCurrentLocationButton')?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('このブラウザでは現在地を取得できません。');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.selectedPostLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      if ($('postLocationStatusText')) {
        $('postLocationStatusText').textContent = '現在地を投稿に追加します。';
      }
      $('postLocationStatus')?.classList.add('active');
      state.map?.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      state.map?.setZoom(15);
    },
    () => alert('現在地を取得できませんでした。')
  );
});

$('postForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const content = $('postContent')?.value.trim();
  if (!content) return;

  const button = form.querySelector('[type="submit"]');
  button.disabled = true;

  try {
    const imageUrl = state.postImageFile
      ? await uploadPostImage(state.user.id, state.postImageFile)
      : null;
    await createPost({
      userId: state.user.id,
      content,
      locationName: $('areaSelect')?.value || null,
      locationAddress: state.selectedPostLocation?.address ?? null,
      imageUrl,
      latitude: state.selectedPostLocation?.latitude ?? null,
      longitude: state.selectedPostLocation?.longitude ?? null
    });

    form.reset();
    if (state.postImagePreviewUrl) URL.revokeObjectURL(state.postImagePreviewUrl);
    state.postImageFile = null;
    state.postImagePreviewUrl = null;
    $('postImagePreviewArea').hidden = true;
    $('postImagePreview').removeAttribute('src');
    if ($('characterCount')) $('characterCount').textContent = '0 / 200';
    state.selectedPostLocation = null;
    if ($('postLocationStatusText')) $('postLocationStatusText').textContent = '';
    $('postLocationStatus')?.classList.remove('active');

    await loadData({ force: true });
  } catch (error) {
    alert(`投稿に失敗しました：${error.message}`);
  } finally {
    button.disabled = false;
  }
});

$('placeForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = $('addPinButton');
  button.disabled = true;

  try {
    const address = $('placeAddress')?.value.trim();
    const coordinates = state.selectedPinLocation || await geocode(address);

    await createPlace({
      userId: state.user.id,
      name: $('placeName')?.value.trim(),
      address,
      description: $('placeDescription')?.value.trim() || null,
      ...coordinates
    });

    form.reset();
    state.selectedPinLocation = null;
    if ($('clearPinLocationButton')) $('clearPinLocationButton').hidden = true;
    await loadData({ force: true });
  } catch (error) {
    alert(`ピンを追加できませんでした：${error.message}`);
  } finally {
    button.disabled = false;
  }
});

$('useCurrentLocationForPinButton')?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('このブラウザでは現在地を取得できません。');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.selectedPinLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      if ($('placeAddress')) $('placeAddress').value = '現在地';
      if ($('clearPinLocationButton')) $('clearPinLocationButton').hidden = false;
    },
    () => alert('現在地を取得できませんでした。')
  );
});

$('clearPinLocationButton')?.addEventListener('click', () => {
  state.selectedPinLocation = null;
  if ($('placeAddress')) $('placeAddress').value = '';
  $('clearPinLocationButton').hidden = true;
});

const menu = $('mobileMenuDrawer');
function toggleMenu(open) {
  if (!menu) return;
  menu.setAttribute('aria-hidden', String(!open));
  menu.classList.toggle('open', open);
  $('mobileMenuButton')?.setAttribute('aria-expanded', String(open));
}

$('mobileMenuButton')?.addEventListener('click', () => toggleMenu(true));
$('mobileMenuCloseButton')?.addEventListener('click', () => toggleMenu(false));
$('mobileMenuBackdrop')?.addEventListener('click', () => toggleMenu(false));

document.querySelectorAll('.mobile-menu-link').forEach((link) => {
  link.addEventListener('click', () => toggleMenu(false));
});

window.addEventListener('pagehide', () => {
  sessionStorage.setItem('okitalk_home_scroll_y', String(window.scrollY));
});

document.addEventListener('DOMContentLoaded', init);
