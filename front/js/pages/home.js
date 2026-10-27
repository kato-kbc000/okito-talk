import * as authApi from "../api.js?v=20260818-4";
import { supabase } from '../supabase.js';
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
  mapCategory: 'all',
  loadingData: false,
  likedIds: new Set(),
  savedIds: new Set(),
  likeCounts: new Map(),
  commentCounts: new Map(),
  openCommentIds: new Set(),
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

async function loadPostComments(postId, section) {
  if (!section) return;
  const list = section.querySelector('.post-comment-list');
  list.textContent = 'コメントを読み込んでいます…';
  try {
    const { data: comments, error } = await supabase
      .from('post_comments')
      .select('id, user_id, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const userIds = [...new Set((comments || []).map(item => item.user_id))];
    let profiles = [];
    if (userIds.length) {
      const result = await supabase.from('profiles')
        .select('id, display_name, username, avatar_url').in('id', userIds);
      if (result.error) throw result.error;
      profiles = result.data || [];
    }
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    list.replaceChildren();
    if (!comments?.length) {
      const empty = document.createElement('p');
      empty.className = 'post-comment-empty';
      empty.textContent = 'まだコメントはありません。最初のコメントを投稿しよう！';
      list.appendChild(empty);
    }
    for (const comment of comments || []) {
      const profile = byId.get(comment.user_id) || {};
      const item = document.createElement('div');
      item.className = 'post-comment-item';
      const avatar = document.createElement('div');
      avatar.className = 'post-comment-avatar';
      setAvatar(avatar, profile);
      const body = document.createElement('div');
      body.className = 'post-comment-bubble';
      const name = document.createElement('strong');
      name.textContent = profile.display_name || profile.username || 'ユーザー';
      const time = document.createElement('span');
      time.className = 'post-comment-time';
      time.textContent = timeAgo(comment.created_at);
      const content = document.createElement('p');
      content.textContent = comment.content;
      body.append(name, time, content);
      if (comment.user_id === state.user?.id) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'post-comment-delete';
        remove.textContent = '削除';
        remove.addEventListener('click', async () => {
          if (!confirm('このコメントを削除しますか？')) return;
          remove.disabled = true;
          const { error: deleteError } = await supabase.from('post_comments')
            .delete().eq('id', comment.id).eq('user_id', state.user.id);
          if (deleteError) {
            alert(`削除できませんでした：${deleteError.message}`);
            remove.disabled = false;
            return;
          }
          state.commentCounts.set(postId, Math.max(0, (state.commentCounts.get(postId) || 1) - 1));
          const button = section.closest('.post-card')?.querySelector('[data-comment-count]');
          if (button) button.textContent = state.commentCounts.get(postId);
          await loadPostComments(postId, section);
        });
        body.append(remove);
      }
      item.append(avatar, body);
      list.append(item);
    }
  } catch (error) {
    list.textContent = `コメントを読み込めませんでした：${error.message}`;
  }
}

async function loadCommentCounts(posts) {
  const ids = posts.map(post => post.id);
  if (!ids.length) return;
  const { data, error } = await supabase.from('post_comments')
    .select('post_id').in('post_id', ids);
  if (error) {
    console.warn('コメント件数を取得できませんでした', error);
    return;
  }
  ids.forEach(id => state.commentCounts.set(id, 0));
  (data || []).forEach(item => state.commentCounts.set(
    item.post_id, (state.commentCounts.get(item.post_id) || 0) + 1
  ));
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
          <div class="post-header-right">
            <span class="post-time">${timeAgo(post.created_at)}</span>
            <div class="post-menu-wrapper">
              <button type="button" class="post-menu-button" aria-label="投稿メニュー" aria-expanded="false">⋯</button>
              <div class="post-menu" hidden>
                ${post.user_id === state.user?.id
                  ? `<button type="button" class="edit-post-button">✏️ 投稿を編集</button>
                     <button type="button" class="delete-post-button">🗑️ 投稿を削除</button>`
                  : `<button type="button" class="report-post-button">🚩 投稿を通報</button>`}
              </div>
            </div>
          </div>
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
            <button type="button" class="post-action-button" data-comments aria-expanded="${state.openCommentIds.has(post.id)}">
              💬 コメント <span data-comment-count>${state.commentCounts.get(post.id) ?? 0}</span>
            </button>
            <button type="button" class="post-action-button ${state.savedIds.has(post.id) ? 'active' : ''}" data-save aria-pressed="${state.savedIds.has(post.id)}">
              ${state.savedIds.has(post.id) ? '🔖' : '🔗'} 保存
            </button>
          </div>
        </div>
        <section class="post-comment-section" ${state.openCommentIds.has(post.id) ? '' : 'hidden'}>
          <div class="post-comment-list" aria-live="polite">コメントを読み込んでいます…</div>
          <form class="post-comment-form">
            <div class="post-comment-avatar" aria-hidden="true">${escapeHtml(firstChar(state.profile?.display_name || state.profile?.username || '沖'))}</div>
            <input class="post-comment-input" type="text" maxlength="500" placeholder="コメントを入力…" aria-label="コメントを入力" required>
            <button class="post-comment-send" type="submit">送信</button>
          </form>
        </section>
      </div>
    `;

    if (state.openCommentIds.has(post.id)) {
      loadPostComments(post.id, article.querySelector('.post-comment-section'));
    }
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

    const commentButton = article.querySelector('[data-comments]');
    const commentSection = article.querySelector('.post-comment-section');
    commentButton?.addEventListener('click', async () => {
      const opening = !state.openCommentIds.has(post.id);
      if (opening) state.openCommentIds.add(post.id);
      else state.openCommentIds.delete(post.id);
      commentButton.setAttribute('aria-expanded', String(opening));
      commentSection.hidden = !opening;
      if (opening) await loadPostComments(post.id, commentSection);
    });
    commentSection?.querySelector('form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = commentSection.querySelector('.post-comment-input');
      const content = input.value.trim();
      if (!content || !state.user) return;
      const sendButton = commentSection.querySelector('.post-comment-send');
      sendButton.disabled = true;
      try {
        const { error } = await supabase.from('post_comments').insert({
          post_id: post.id, user_id: state.user.id, content
        });
        if (error) throw error;
        input.value = '';
        state.commentCounts.set(post.id, (state.commentCounts.get(post.id) || 0) + 1);
        commentButton.querySelector('[data-comment-count]').textContent = state.commentCounts.get(post.id);
        await loadPostComments(post.id, commentSection);
      } catch (error) {
        alert(`コメントを送信できませんでした：${error.message}`);
      } finally {
        sendButton.disabled = false;
      }
    });

    // 投稿メニュー（編集・削除・通報）
    const menuButton = article.querySelector('.post-menu-button');
    const postMenu = article.querySelector('.post-menu');
    menuButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      document.querySelectorAll('.post-menu').forEach(menu => {
        if (menu !== postMenu) {
          menu.hidden = true;
          menu.parentElement?.querySelector('.post-menu-button')?.setAttribute('aria-expanded', 'false');
        }
      });
      postMenu.hidden = !postMenu.hidden;
      menuButton.setAttribute('aria-expanded', String(!postMenu.hidden));
    });

    article.querySelector('.edit-post-button')?.addEventListener('click', () => {
      postMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      if (state.user?.id === post.user_id) openPostAction('edit', post);
    });
    article.querySelector('.delete-post-button')?.addEventListener('click', () => {
      postMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      if (state.user?.id === post.user_id) openPostAction('delete', post);
    });
    article.querySelector('.report-post-button')?.addEventListener('click', () => {
      postMenu.hidden = true;
      menuButton.setAttribute('aria-expanded', 'false');
      if (state.user && state.user.id !== post.user_id) openPostAction('report', post);
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

function mapCategoryFor(item) {
  const text = [item.category, item.name, item.description, item.content, item.location_name].filter(Boolean).join(' ').toLowerCase();
  if (/カフェ|喫茶|コーヒー|coffee|cafe/.test(text)) return 'cafe';
  if (/グルメ|食事|レストラン|料理|ランチ|ディナー|そば|ラーメン|食堂|パン|スイーツ|焼肉/.test(text)) return 'food';
  if (/買い物|ショップ|ショッピング|市場|雑貨|お土産|shop/.test(text)) return 'shop';
  if (/観光|ビーチ|海|公園|城|景色|絶景|神社|水族館|スポット|夕日/.test(text)) return 'sight';
  return 'other';
}

function mapMarkerIcon(category) {
  const colors = { cafe: '#b985e9', food: '#ffad39', sight: '#25bdb8', shop: '#ff6b9b', other: '#2789e8' };
  const color = colors[category] || colors.other;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58"><path d="M24 3C12 3 3 12 3 24c0 17 21 31 21 31s21-14 21-31C45 12 36 3 24 3Z" fill="${color}" stroke="white" stroke-width="3"/><circle cx="24" cy="24" r="15" fill="white" opacity=".95"/></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(40, 48), anchor: new google.maps.Point(20, 46), labelOrigin: new google.maps.Point(20, 20) };
}

function refreshMap() {
  if (!state.mapReady || !state.map || !window.google?.maps) return;
  state.layers.forEach(marker => marker.setMap(null));
  state.layers = [];
  const bounds = new google.maps.LatLngBounds();
  const visiblePostIds = new Set(getVisiblePosts().map(post => post.id));
  const items = [
    ...state.posts.filter(post => visiblePostIds.has(post.id)).map(post => ({ ...post, kind: 'post' })),
    ...state.places.map(place => ({ ...place, kind: 'place' }))
  ];
  const info = new google.maps.InfoWindow({ maxWidth: 260 });
  let count = 0;
  items.forEach(item => {
    const lat = Number(item.latitude), lng = Number(item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isOkinawaCoordinate(lat, lng)) return;
    const category = mapCategoryFor(item);
    if (state.mapCategory !== 'all' && category !== state.mapCategory) return;
    const title = item.kind === 'post' ? (item.location_name || 'みんなの投稿') : (item.name || 'おすすめスポット');
    const description = item.kind === 'post' ? item.content : item.description;
    const profile = item.profiles || {};
    const username = profile.display_name || profile.username || (item.kind === 'post' ? '投稿者' : 'おすすめスポット');
    const imageUrl = item.kind === 'post' && /^https:\/\//i.test(item.image_url || '') ? item.image_url : null;
    const photo = imageUrl ? `<img class="sns-map-popup-photo" src="${escapeHtml(imageUrl)}" alt="スポット写真">` : `<div class="sns-map-popup-placeholder">🌺</div>`;
    const html = `<div class="sns-map-popup">${photo}<div class="sns-map-popup-content"><strong>${escapeHtml(title)}</strong><span class="sns-map-popup-user">${item.kind === 'post' ? '👤 ' : '📍 '}${escapeHtml(username)}</span><p>${escapeHtml(String(description || '沖縄のおすすめスポット')).slice(0, 130)}</p></div></div>`;
    const emoji = { cafe: '☕', food: '🍴', sight: '🌴', shop: '🛍', other: '📍' }[category];
    const marker = new google.maps.Marker({ map: state.map, position: {lat,lng}, title, icon: mapMarkerIcon(category), label: { text: emoji, fontSize: '16px' } });
    marker.addListener('click', () => { info.setContent(html); info.open({map:state.map,anchor:marker}); });
    state.layers.push(marker);
    bounds.extend(marker.getPosition());
    count++;
  });
  const label = document.getElementById('snsMapCount');
  if (label) label.textContent = count ? `📍 ${count}件のスポットを表示中` : 'このカテゴリのスポットはまだありません';
  if (count) {
    state.map.fitBounds(bounds, 24);
    google.maps.event.addListenerOnce(state.map, 'idle', () => {
      if (state.map.getZoom() > 13) state.map.setZoom(13);
    });
  }
}

document.querySelectorAll('[data-map-category]').forEach(button => {
  button.addEventListener('click', () => {
    state.mapCategory = button.dataset.mapCategory;
    document.querySelectorAll('[data-map-category]').forEach(other => {
      const active = other === button;
      other.classList.toggle('active', active);
      other.setAttribute('aria-pressed', String(active));
    });
    refreshMap();
  });
});

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
    await loadCommentCounts(state.posts);

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
    await loadCommentCounts(additions);
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


// 投稿の場所設定を必要なときだけ開く
$('togglePostLocationButton')?.addEventListener('click', () => {
  const panel = $('postLocationOptions');
  const button = $('togglePostLocationButton');
  if (!panel || !button) return;
  panel.hidden = !panel.hidden;
  button.setAttribute('aria-expanded', String(!panel.hidden));
});

// SNS風ログアウト確認モーダル（SupabaseのlogoutUserを利用）
let logoutReturnFocus = null;
let logoutBusy = false;
function openLogoutModal() {
  const modal = $('logoutModal');
  if (!modal) return;
  logoutReturnFocus = document.activeElement;
  $('logoutError').hidden = true;
  modal.hidden = false;
  document.body.classList.add('logout-modal-open');
  $('cancelLogoutButton').focus();
}
function closeLogoutModal() {
  if (logoutBusy) return;
  $('logoutModal').hidden = true;
  document.body.classList.remove('logout-modal-open');
  logoutReturnFocus?.focus?.();
}
$('sideLogoutButton')?.addEventListener('click', openLogoutModal);
$('mobileLogoutButton')?.addEventListener('click', openLogoutModal);
$('cancelLogoutButton')?.addEventListener('click', closeLogoutModal);
$('logoutModal')?.querySelector('[data-close-logout]')?.addEventListener('click', closeLogoutModal);
document.addEventListener('keydown', (event) => {
  const modal = $('logoutModal');
  if (!modal || modal.hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeLogoutModal(); }
  if (event.key === 'Tab') {
    const buttons = [...modal.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
$('confirmLogoutButton')?.addEventListener('click', async () => {
  if (logoutBusy) return;
  logoutBusy = true;
  const confirm = $('confirmLogoutButton');
  const cancel = $('cancelLogoutButton');
  confirm.disabled = true;
  cancel.disabled = true;
  confirm.textContent = 'ログアウト中…';
  $('logoutError').hidden = true;
  try {
    await authApi.logoutUser();
    sessionStorage.removeItem('okitalk_home_scroll_y');
    window.location.replace('login.html');
  } catch (error) {
    const message = $('logoutError');
    message.textContent = `ログアウトできませんでした：${error?.message || String(error)}`;
    message.hidden = false;
    logoutBusy = false;
    confirm.disabled = false;
    cancel.disabled = false;
    confirm.textContent = 'ログアウト';
    confirm.focus();
  }
});


// SNS風 投稿操作モーダル
let currentPostAction = null;
let previousPostActionFocus = null;
function closePostAction() {
  const modal = $('postActionModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  currentPostAction = null;
  previousPostActionFocus?.focus?.();
}
function openPostAction(type, post) {
  const modal = $('postActionModal');
  if (!modal) return;
  previousPostActionFocus = document.activeElement;
  currentPostAction = { type, post };
  $('postActionEdit').hidden = type !== 'edit';
  $('postActionDelete').hidden = type !== 'delete';
  $('postActionReport').hidden = type !== 'report';
  $('postActionError').hidden = true;
  $('postActionForm').reset();
  const names = { edit: '✏️ 投稿を編集', delete: '投稿の削除', report: '🚩 投稿を通報' };
  $('postActionTitle').textContent = names[type];
  const submit = $('postActionSubmit');
  submit.textContent = { edit: '変更を保存', delete: '投稿を削除', report: '通報する' }[type];
  submit.classList.toggle('is-danger', type === 'delete');
  submit.disabled = false;
  if (type === 'edit') {
    $('postActionContent').value = post.content || '';
    $('postActionCount').textContent = `${[...$('postActionContent').value].length} / 200`;
  }
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  (type === 'edit' ? $('postActionContent') : $('postActionClose')).focus();
}
function setupPostActionModal() {
  const modal = $('postActionModal');
  if (!modal) return;
  const showError = (message) => {
    $('postActionError').textContent = message;
    $('postActionError').hidden = false;
  };
  $('postActionClose').addEventListener('click', closePostAction);
  $('postActionCancel').addEventListener('click', closePostAction);
  modal.querySelector('[data-close-post-action]').addEventListener('click', closePostAction);
  document.addEventListener('keydown', event => {
    if (modal.hidden) return;
    if (event.key === 'Escape') closePostAction();
    if (event.key === 'Tab') {
      const focusables = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')]
        .filter(el => el.getClientRects().length);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  $('postActionContent').addEventListener('input', event => {
    $('postActionCount').textContent = `${[...event.target.value].length} / 200`;
  });
  $('postActionForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentPostAction || !state.user) return;
    const { type, post } = currentPostAction;
    const submit = $('postActionSubmit');
    $('postActionError').hidden = true;
    let content, reason;
    if (type === 'edit') {
      content = $('postActionContent').value.trim();
      if (!content || [...content].length > 200) return showError('1〜200文字で入力してください。');
    }
    if (type === 'report') {
      reason = modal.querySelector('input[name="reportReason"]:checked')?.value;
      if (!reason) return showError('通報理由を選んでください。');
    }
    if ((type === 'edit' || type === 'delete') && post.user_id !== state.user.id) return showError('操作する権限がありません。');
    if (type === 'report' && post.user_id === state.user.id) return showError('自分の投稿は通報できません。');
    submit.disabled = true;
    try {
      if (type === 'edit') {
        const { data, error } = await supabase.from('posts').update({ content })
          .eq('id', post.id).eq('user_id', state.user.id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('更新対象が見つからないか、権限がありません。');
        post.content = content;
      } else if (type === 'delete') {
        const { data, error } = await supabase.from('posts').delete()
          .eq('id', post.id).eq('user_id', state.user.id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('削除対象が見つからないか、権限がありません。');
        state.posts = state.posts.filter(item => item.id !== post.id);
        state.openCommentIds.delete(post.id);
      } else {
        const { error } = await supabase.from('post_reports').insert({
          post_id: post.id, reporter_id: state.user.id, reason
        });
        if (error) throw error;
      }
      closePostAction();
      if (type !== 'report') renderPosts();
      alert({ edit: '投稿を更新しました！', delete: '投稿を削除しました。', report: '通報を受け付けました。' }[type]);
    } catch (error) {
      showError(error.code === '23505' ? 'この投稿はすでに通報済みです。' : error.message);
    } finally {
      submit.disabled = false;
    }
  });
}
setupPostActionModal();