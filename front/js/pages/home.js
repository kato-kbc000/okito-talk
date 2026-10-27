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
  setPostSaved,
  getPostImages,
  MAX_POST_IMAGES
} from '../api.js';
import { loadGoogleMaps, isOkinawaCoordinate, searchPlaces, geocode, OKINAWA_BOUNDS } from '../maps.js';

/* 沖縄県の市町村（市 → 町 → 村）。投稿の地域選択と、タイムラインの絞り込みの両方で使う */
const OKINAWA_AREAS = [
  { label: '市', items: ['那覇市', '浦添市', '宜野湾市', '沖縄市', 'うるま市', '名護市', '糸満市', '豊見城市', '南城市', '石垣市', '宮古島市'] },
  { label: '町', items: ['北谷町', '嘉手納町', '金武町', '本部町', '西原町', '与那原町', '南風原町', '八重瀬町', '久米島町', '竹富町', '与那国町'] },
  { label: '村', items: ['読谷村', '恩納村', '宜野座村', '北中城村', '中城村', '今帰仁村', '国頭村', '大宜味村', '東村', '伊江村', '伊平屋村', '伊是名村', '座間味村', '渡嘉敷村', '南大東村', '北大東村', '粟国村', '渡名喜村', '多良間村'] }
];

function fillAreaSelect(select, { withAll = false, withPrefecture = false } = {}) {
  if (!select) return;
  const current = select.value;
  select.replaceChildren();
  if (withAll) select.add(new Option('沖縄県すべて', 'all'));
  if (withPrefecture) select.add(new Option('🌺 沖縄県', '沖縄県'));
  OKINAWA_AREAS.forEach((group) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;
    [...new Set(group.items)].forEach((name) => optgroup.append(new Option(name, name)));
    select.append(optgroup);
  });
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

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
  likeCounts: new Map(),
  page: 0,
  pageSize: 30,
  hasMorePosts: true,
  loadingMore: false
  ,postImages: []
  ,mapTarget: 'post'
  ,previewMarker: null
};

function renderPostImages(post) {
  const images = getPostImages(post);
  if (!images.length) return '';
  const cls = images.length === 1 ? 'post-image-grid single' : `post-image-grid count-${Math.min(images.length, 4)}`;
  return `<div class="${cls}">${images
    .map((url) => `<img class="post-image" src="${escapeHtml(url)}" alt="投稿画像" loading="lazy">`)
    .join('')}</div>`;
}

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
        ${renderPostImages(post)}
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
    chooseLocationOnMap(event.latLng.lat(), event.latLng.lng());
  });

  refreshMap();
}

/* ---------- 地図上の「選択中の場所」マーカー ---------- */

function setPreviewMarker(latitude, longitude) {
  if (!state.map || !window.google?.maps) return;
  const position = { lat: latitude, lng: longitude };
  if (!state.previewMarker) {
    state.previewMarker = new window.google.maps.Marker({
      position,
      map: state.map,
      draggable: true,
      title: '選択中の場所（ドラッグで移動できます）',
      animation: window.google.maps.Animation.DROP
    });
    state.previewMarker.addListener('dragend', (event) => {
      chooseLocationOnMap(event.latLng.lat(), event.latLng.lng(), { keepMarker: true });
    });
  } else {
    state.previewMarker.setPosition(position);
  }
}

function clearPreviewMarker() {
  if (state.previewMarker) {
    state.previewMarker.setMap(null);
    state.previewMarker = null;
  }
}

function updatePinClearButton() {
  const button = $('clearPinLocationButton');
  if (button) button.hidden = !state.selectedPinLocation;
}

function showPinStatus(text) {
  const status = $('pinLocationStatus');
  if (!status) return;
  status.textContent = text || '';
  status.hidden = !text;
}

function renderPinCandidates(list) {
  const box = $('pinCandidates');
  if (!box) return;
  box.replaceChildren();
  box.hidden = list.length === 0;
  list.forEach((candidate) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pin-candidate';
    const title = document.createElement('strong');
    title.textContent = candidate.name || candidate.address.split(/[ 、,]/)[0] || '候補';
    const detail = document.createElement('span');
    detail.textContent = candidate.address + (candidate.approximate ? '（おおよその位置）' : '');
    button.append(title, detail);
    button.addEventListener('click', () => pickPinCandidate(candidate));
    box.append(button);
  });
}

function pickPinCandidate(candidate, { fromSubmit = false } = {}) {
  state.mapTarget = 'pin';
  chooseLocationOnMap(candidate.latitude, candidate.longitude);
  if ($('placeAddress') && candidate.address) {
    $('placeAddress').value = candidate.address.replace(/^日本、?\s*/, '').replace(/^〒?\d{3}-\d{4}\s*/, '');
    $('placeAddress').dataset.auto = '0';
  }
  if ($('placeName') && !$('placeName').value.trim() && candidate.name) $('placeName').value = candidate.name;
  const warn = candidate.approximate ? '　⚠ おおよその位置です。地図のピンをドラッグして合わせてください。' : '';
  const confirm = fromSubmit ? '　この位置でよければ、もう一度「地図に追加」を押してください。' : '';
  showPinStatus(`📍 ${candidate.name ? `${candidate.name}／` : ''}${candidate.address || '選択した位置'}${warn}${confirm}`);
  state.map?.setCenter({ lat: candidate.latitude, lng: candidate.longitude });
  state.map?.setZoom(17);
}

/** 店名＋住所で場所を検索し、候補を出す。 */
async function runPinSearch({ autoPick = false, fromSubmit = false } = {}) {
  const name = $('placeName')?.value.trim() || '';
  const address = $('placeAddress')?.value.trim() || '';
  if (!name && !address) {
    alert('場所の名前か住所を入力してください。');
    return;
  }
  state.mapTarget = 'pin';
  const button = $('searchPinAddressButton');
  if (button) button.disabled = true;
  try {
    let list = await searchPlaces([name, address].filter(Boolean).join(' '));
    if (!list.length && name && address) list = await searchPlaces(address);
    renderPinCandidates(list);
    if (!list.length) {
      alert('沖縄県内の場所を見つけられませんでした。店名・市町村名・番地を確認するか、地図をクリックして位置を指定してください。');
      return;
    }
    if (autoPick || list.length === 1) pickPinCandidate(list[0], { fromSubmit });
    else showPinStatus('候補から選ぶか、地図をクリックして位置を指定してください。');
  } catch (error) {
    alert(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

/** ピン用の選択を解除（住所欄・マーカー・状態をすべて戻す） */
function clearPinLocation({ keepAddress = false } = {}) {
  renderPinCandidates([]);
  state.selectedPinLocation = null;
  if (!keepAddress && $('placeAddress')) $('placeAddress').value = '';
  if (state.mapTarget === 'pin') clearPreviewMarker();
  showPinStatus('');
  updatePinClearButton();
}

/** 投稿用の場所の選択を解除 */
function clearPostLocation() {
  state.selectedPostLocation = null;
  if ($('postLocationStatusText')) $('postLocationStatusText').textContent = '';
  if ($('postAddressInput')) $('postAddressInput').value = '';
  $('postLocationStatus')?.classList.remove('active');
  if (state.mapTarget === 'post') clearPreviewMarker();
}

/** 地図クリック / マーカー移動で場所を決める。ピン入力中ならピン、それ以外は投稿の場所。 */
function chooseLocationOnMap(latitude, longitude, { keepMarker = false } = {}) {
  if (!isOkinawaCoordinate(latitude, longitude)) {
    alert('沖縄県内の場所を選択してください。');
    return;
  }
  if (!keepMarker) setPreviewMarker(latitude, longitude);
  const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

  if (state.mapTarget === 'pin') {
    state.selectedPinLocation = { latitude, longitude };
    if ($('placeAddress') && (!$('placeAddress').value.trim() || $('placeAddress').dataset.auto === '1')) {
      $('placeAddress').value = '地図で選択した場所';
      $('placeAddress').dataset.auto = '1';
    }
    showPinStatus(`📍 地図で選択：${coords}（ドラッグで微調整できます）`);
    updatePinClearButton();
  } else {
    state.selectedPostLocation = { latitude, longitude };
    if ($('postLocationStatusText')) $('postLocationStatusText').textContent = `地図で選択：${coords}`;
    $('postLocationStatus')?.classList.add('active');
  }
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


function focusPost(post) {
  const latitude = Number(post.latitude);
  const longitude = Number(post.longitude);

  if (state.map && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    state.map.setCenter({ lat: latitude, lng: longitude });
    state.map.setZoom(15);
  }

  $('mapSection')?.scrollIntoView({ behavior: 'smooth' });
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

  let end = $('timelineEndMessage');
  if (!end) {
    end = document.createElement('p');
    end.id = 'timelineEndMessage';
    end.className = 'timeline-end-message';
    button.after(end);
  }
  const reachedEnd = !state.hasMorePosts && state.posts.length > 0;
  end.hidden = !reachedEnd;
  end.textContent = reachedEnd ? `これより古い投稿はありません（${state.posts.length}件）` : '';
}

async function loadOlderPosts() {
  const button = $('loadMorePostsButton');
  if (!button || !state.hasMorePosts || state.loadingMore) return;
  state.loadingMore = true;
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
    if (additions.length) {
      const engagement = await getPostEngagement(additions.map(post => post.id), state.user.id);
      engagement.likedIds.forEach(id => state.likedIds.add(id));
      engagement.savedIds.forEach(id => state.savedIds.add(id));
      engagement.likeCounts.forEach((count, id) => state.likeCounts.set(id, count));
    }
    setTimelineStatus('');
    renderPosts();
  } catch (error) {
    console.error(error);
    setTimelineStatus(`過去の投稿を読み込めませんでした：${error.message}（もう一度ボタンを押してください）`, true);
  } finally {
    state.loadingMore = false;
    updateLoadMoreButton();
  }
}

/* 一覧の最後までスクロールしたら、自動で古い投稿を続けて読み込む */
(() => {
  const target = $('loadMorePostsButton');
  if (!target || !('IntersectionObserver' in window)) return;
  new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting) && state.hasMorePosts && !state.loadingMore) loadOlderPosts();
  }, { rootMargin: '300px' }).observe(target);
})();

async function init() {
  fillAreaSelect($('areaSelect'), { withPrefecture: true });
  fillAreaSelect($('areaFilterSelect'), { withAll: true });
  try {
    state.user = await getCurrentUser();
    if (!state.user) {
      location.replace('login.html');
      return;
    }

    state.profile = await ensureCurrentProfile(state.user);
    setAvatar($('postFormAvatar'), state.profile);

    initMap().catch((error) => {
      console.warn('地図を初期化できませんでした。', error);
      const note = $('mapSection');
      if (note && !note.querySelector('.map-load-error')) {
        const p = document.createElement('p');
        p.className = 'map-load-error';
        p.textContent = `地図を読み込めませんでした：${error.message}`;
        note.prepend(p);
      }
    });
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

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function renderPostImagePreviews() {
  const area = $('postImagePreviewArea');
  if (!area) return;
  area.replaceChildren();
  area.hidden = state.postImages.length === 0;
  state.postImages.forEach((image, index) => {
    const item = document.createElement('div');
    item.className = 'post-image-thumb';
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = `投稿画像${index + 1}のプレビュー`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `画像${index + 1}を削除`);
    remove.addEventListener('click', () => {
      URL.revokeObjectURL(image.url);
      state.postImages.splice(index, 1);
      renderPostImagePreviews();
    });
    item.append(img, remove);
    area.append(item);
  });
  const counter = $('postImageCounter');
  if (counter) counter.textContent = `${state.postImages.length} / ${MAX_POST_IMAGES}枚`;
}

function clearPostImages() {
  state.postImages.forEach((image) => URL.revokeObjectURL(image.url));
  state.postImages = [];
  if ($('postImageInput')) $('postImageInput').value = '';
  renderPostImagePreviews();
}

$('postImageInput')?.addEventListener('change', (event) => {
  const files = [...(event.target.files || [])];
  event.target.value = '';
  if (!files.length) return;
  const room = MAX_POST_IMAGES - state.postImages.length;
  if (files.length > room) {
    alert(`画像は最大${MAX_POST_IMAGES}枚までです。先頭の${Math.max(room, 0)}枚だけ追加します。`);
  }
  for (const file of files.slice(0, Math.max(room, 0))) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) {
      alert(`「${file.name}」は追加できません。JPEG・PNG・WebP・GIFの5MB以下を選択してください。`);
      continue;
    }
    state.postImages.push({ file, url: URL.createObjectURL(file) });
  }
  renderPostImagePreviews();
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
  state.mapTarget = 'post';
  clearPostLocation();
});

$('searchPostAddressButton')?.addEventListener('click', async () => {
  const address = $('postAddressInput')?.value.trim();
  if (!address) return alert('検索する住所を入力してください。');
  const button = $('searchPostAddressButton');
  button.disabled = true;
  try {
    const coordinates = await geocode(address);
    state.mapTarget = 'post';
    state.selectedPostLocation = { ...coordinates, address };
    $('postLocationStatusText').textContent = `住所：${address}`;
    $('postLocationStatus')?.classList.add('active');
    setPreviewMarker(coordinates.latitude, coordinates.longitude);
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
      if (!isOkinawaCoordinate(position.coords.latitude, position.coords.longitude)) {
        alert('現在地が沖縄県外のため、場所として追加できません。');
        return;
      }
      state.mapTarget = 'post';
      state.selectedPostLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      if ($('postLocationStatusText')) {
        $('postLocationStatusText').textContent = '現在地を投稿に追加します。';
      }
      $('postLocationStatus')?.classList.add('active');
      setPreviewMarker(position.coords.latitude, position.coords.longitude);
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
    const imageUrls = await Promise.all(
      state.postImages.map((image) => uploadPostImage(state.user.id, image.file))
    );
    await createPost({
      userId: state.user.id,
      content,
      locationName: $('areaSelect')?.value || null,
      locationAddress: state.selectedPostLocation?.address ?? null,
      imageUrls,
      latitude: state.selectedPostLocation?.latitude ?? null,
      longitude: state.selectedPostLocation?.longitude ?? null
    });

    form.reset();
    clearPostImages();
    if ($('characterCount')) $('characterCount').textContent = '0 / 200';
    state.mapTarget = 'post';
    clearPostLocation();

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
    if (!$('placeName')?.value.trim()) {
      alert('場所の名前を入力してください。');
      return;
    }

    // 位置が未確定なら、候補を検索して地図に仮置きする（住所だけで黙って登録しない）
    if (!state.selectedPinLocation) {
      await runPinSearch({ autoPick: true, fromSubmit: true });
      return;
    }
    const coordinates = state.selectedPinLocation;

    await createPlace({
      userId: state.user.id,
      name: $('placeName')?.value.trim(),
      address,
      description: $('placeDescription')?.value.trim() || null,
      ...coordinates
    });

    form.reset();
    state.mapTarget = 'pin';
    clearPinLocation();
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
      const { latitude, longitude } = position.coords;
      if (!isOkinawaCoordinate(latitude, longitude)) {
        alert('現在地が沖縄県外のため、ピンにできません。');
        return;
      }
      state.mapTarget = 'pin';
      chooseLocationOnMap(latitude, longitude);
      if ($('placeAddress')) {
        $('placeAddress').value = '現在地';
        $('placeAddress').dataset.auto = '1';
      }
      state.map?.setCenter({ lat: latitude, lng: longitude });
      state.map?.setZoom(16);
    },
    () => alert('現在地を取得できませんでした。')
  );
});

$('searchPinAddressButton')?.addEventListener('click', () => runPinSearch());

/* 住所を打ち直したら、古い選択（現在地など）は無効にする */
$('placeAddress')?.addEventListener('input', (event) => {
  event.target.dataset.auto = '0';
  if (state.selectedPinLocation) clearPinLocation({ keepAddress: true });
});

$('clearPinLocationButton')?.addEventListener('click', () => {
  state.mapTarget = 'pin';
  clearPinLocation();
});

/* 今どちらのフォームを触っているかで、地図クリックの行き先を切り替える */
$('placeForm')?.addEventListener('focusin', () => { state.mapTarget = 'pin'; });
$('postForm')?.addEventListener('focusin', () => { state.mapTarget = 'post'; });

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
