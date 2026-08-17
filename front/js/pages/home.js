import {
  getCurrentUser,
  ensureCurrentProfile,
  createPost,
  getTimelinePosts,
  createPlace,
  getPlaces,
  getFollowing,
  getPostEngagement,
  setPostLiked,
  setPostSaved
} from '../api.js';

const $ = (id) => document.getElementById(id);

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
  likeCounts: new Map()
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

function initMap() {
  if (state.mapReady || !window.L || !$('map')) return;

  state.map = window.L.map('map').setView([26.2124, 127.6809], 9);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.map);

  state.layers = window.L.layerGroup().addTo(state.map);
  state.mapReady = true;

  state.map.on('click', (event) => {
    state.selectedPostLocation = {
      latitude: event.latlng.lat,
      longitude: event.latlng.lng
    };

    const text = $('postLocationStatusText');
    if (text) {
      text.textContent = `地図で選択：${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`;
    }
    $('postLocationStatus')?.classList.add('active');
  });

  refreshMap();
}

function refreshMap() {
  if (!state.mapReady || !state.layers || !state.map) return;

  state.layers.clearLayers();
  const bounds = [];
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
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const label = item.kind === 'post'
      ? item.content
      : `${item.name}${item.description ? `\n${item.description}` : ''}`;

    window.L.marker([latitude, longitude])
      .bindPopup(escapeHtml(label).replaceAll('\n', '<br>'))
      .addTo(state.layers);

    bounds.push([latitude, longitude]);
  });

  if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
  }
}

function focusPost(post) {
  const latitude = Number(post.latitude);
  const longitude = Number(post.longitude);

  if (state.map && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    state.map.setView([latitude, longitude], 15);
  }

  $('mapSection')?.scrollIntoView({ behavior: 'smooth' });
}

async function geocode(address) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=jp&q=${encodeURIComponent(address)}`,
    { headers: { 'Accept-Language': 'ja' } }
  );

  if (!response.ok) throw new Error('住所検索に失敗しました。');

  const data = await response.json();
  if (!data[0]) throw new Error('住所から場所を見つけられませんでした。');

  return {
    latitude: Number(data[0].lat),
    longitude: Number(data[0].lon)
  };
}

async function loadData({ force = false } = {}) {
  if (state.loadingData) return;

  state.loadingData = true;
  setTimelineStatus('投稿を読み込んでいます…');

  try {
    const [posts, following, places] = await Promise.all([
      getTimelinePosts({ force }),
      getFollowing(state.user.id, { force }),
      getPlaces({ force })
    ]);

    state.posts = posts || [];
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

async function init() {
  try {
    state.user = await getCurrentUser();
    if (!state.user) {
      location.replace('login.html');
      return;
    }

    state.profile = await ensureCurrentProfile(state.user);
    setAvatar($('postFormAvatar'), state.profile);

    initMap();
    await loadData();

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
  state.map?.setView([26.2124, 127.6809], 9);
});

$('cancelPostLocationButton')?.addEventListener('click', () => {
  state.selectedPostLocation = null;
  if ($('postLocationStatusText')) $('postLocationStatusText').textContent = '';
  $('postLocationStatus')?.classList.remove('active');
});

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
      state.map?.setView([position.coords.latitude, position.coords.longitude], 15);
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
    await createPost({
      userId: state.user.id,
      content,
      locationName: $('areaSelect')?.value || null,
      latitude: state.selectedPostLocation?.latitude ?? null,
      longitude: state.selectedPostLocation?.longitude ?? null
    });

    form.reset();
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
