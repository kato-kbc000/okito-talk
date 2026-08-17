import {
  getCurrentUser, ensureCurrentProfile, createPost, getTimelinePosts,
  createPlace, getPlaces
} from '../api.js';

const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  profile: null,
  posts: [],
  places: [],
  area: 'all',
  selectedLocation: null,
  map: null,
  layers: null,

  /*
   * ホームの初期表示を軽くするための制御値です。
   */
  mapReady: false,
  mapRefreshScheduled: false,
  loadingData: false
};
const areaCoordinates = {
  '沖縄県':[26.2124,127.6809], '那覇市':[26.2124,127.6809], '浦添市':[26.2458,127.7219],
  '宜野湾市':[26.2816,127.7786], '沖縄市':[26.3344,127.8056], '名護市':[26.5916,127.9773],
  '糸満市':[26.1236,127.6658], 'うるま市':[26.3790,127.8575]
};

function escapeHtml(value='') { const d=document.createElement('div'); d.textContent=String(value); return d.innerHTML; }
function firstChar(value='沖') { return [...String(value).trim()][0] || '沖'; }
function timeAgo(value) {
  const sec=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));
  if(sec<60)return 'たった今'; if(sec<3600)return `${Math.floor(sec/60)}分前`;
  if(sec<86400)return `${Math.floor(sec/3600)}時間前`; if(sec<604800)return `${Math.floor(sec/86400)}日前`;
  return new Date(value).toLocaleDateString('ja-JP');
}
function showMessage(message, isError=false) {
  const el=$('filterResultMessage'); if(!el)return; el.textContent=message; el.style.color=isError?'#b91c1c':'';
}

function renderPosts() {
  const list=$('postList'); if(!list)return;
  const posts=state.posts.filter(p => state.area==='all' || p.location_name===state.area || p.location_address?.includes(state.area));
  list.innerHTML=''; $('emptyPostMessage')?.style.setProperty('display', posts.length ? 'none' : 'block');
  posts.forEach(post => {
    const profile=post.profiles || {};
    const article=document.createElement('article'); article.className='post-card';
    article.dataset.lat=post.latitude ?? ''; article.dataset.lng=post.longitude ?? '';
    article.innerHTML=`
      <!-- 担当メンバー版の投稿カードを維持し、プロフィール遷移だけ追加 -->
      <button
        type="button"
        class="post-user-icon post-profile-link"
        aria-label="${escapeHtml(profile.display_name || "ユーザー")}のプロフィールを開く"
      ></button>
      <div class="post-main">
        <div class="post-header"><div><strong>${escapeHtml(profile.display_name || 'ユーザー')}</strong><span>@${escapeHtml(profile.username || 'user')}</span></div><span class="post-time">${timeAgo(post.created_at)}</span></div>
        <p class="post-text">${escapeHtml(post.content).replaceAll('\n','<br>')}</p>
        ${post.image_url ? `<img class="post-image" src="${escapeHtml(post.image_url)}" alt="投稿画像" loading="lazy">` : ''}
        <div class="post-bottom">
          ${post.location_name || post.location_address ? `<button type="button" class="map-focus-button">📍${escapeHtml(post.location_name || post.location_address)}</button>` : '<span></span>'}
        </div>
      </div>`;

    /*
     * ホーム担当の投稿表示処理は変更せず、
     * プロフィール画像とプロフィール遷移だけを追加します。
     */
    const avatar = article.querySelector('.post-user-icon');

    if (profile.avatar_url) {
        avatar.style.backgroundImage = `url("${profile.avatar_url}")`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
    } else {
        avatar.textContent =
            firstChar(profile.display_name || profile.username);
    }

    /*
     * プロフィール先読みは初期化順序へ影響する可能性があるため、
     * 安定性を優先してクリック時の通常遷移だけにしています。
     */
    avatar.addEventListener('click', () => {
        if (post.user_id) {
            location.href =
                `home/profile.html?userId=${encodeURIComponent(post.user_id)}`;
        }
    });

    article.querySelector('.map-focus-button')?.addEventListener('click',()=>focusPost(post));
    list.appendChild(article);
  });
  showMessage(
    state.area === 'all'
      ? `${posts.length}件の投稿を表示しています。`
      : `${state.area}の投稿：${posts.length}件`
  );

  /*
   * 投稿DOMを先に表示し、その後で地図を更新します。
   * 地域フィルターを素早く切り替えても地図更新を1回にまとめます。
   */
  scheduleMapRefresh();
}

function initMap() {
  if (state.mapReady || !window.L || !$('map')) {
    return;
  }

  state.map = L.map('map').setView([26.2124, 127.6809], 9);

  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }
  ).addTo(state.map);

  state.layers = L.layerGroup().addTo(state.map);
  state.mapReady = true;

  state.map.on('click', (event) => {
    state.selectedLocation = {
      latitude: event.latlng.lat,
      longitude: event.latlng.lng
    };

    $('postLocationStatusText').textContent =
      `地図で選択：${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`;

    $('postLocationStatus')?.classList.add('active');
  });

  scheduleMapRefresh();
}

/*
 * requestIdleCallbackに対応していないブラウザでは
 * setTimeoutで代用します。
 */
function runWhenBrowserIsIdle(callback) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, {
      timeout: 900
    });
    return;
  }

  window.setTimeout(callback, 120);
}

/*
 * 投稿フォームと投稿一覧を先に表示し、
 * 地図はブラウザが落ち着いてから初期化します。
 */
function scheduleMapInitialization() {
  runWhenBrowserIsIdle(() => {
    initMap();
  });
}

/*
 * 連続して呼ばれても、次の描画タイミングで1回だけ
 * マーカーを作り直します。
 */
function scheduleMapRefresh() {
  if (!state.mapReady || state.mapRefreshScheduled) {
    return;
  }

  state.mapRefreshScheduled = true;

  window.requestAnimationFrame(() => {
    state.mapRefreshScheduled = false;
    refreshMap();
  });
}

function refreshMap() {
  if (!state.layers || !state.map) {
    return;
  }

  state.layers.clearLayers();

  const bounds = [];
  const items = [
    ...state.posts.map((post) => ({
      ...post,
      kind: 'post'
    })),
    ...state.places.map((place) => ({
      ...place,
      kind: 'place'
    }))
  ];

  /*
   * DocumentFragmentのように一括追加できないLeafletでは、
   * LayerGroupへまとめて追加してDOM更新回数を抑えます。
   */
  const markerGroup = [];

  items.forEach((item) => {
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    const rawLabel =
      item.kind === 'post'
        ? item.content
        : `${item.name}${item.description ? `\n${item.description}` : ''}`;

    const marker = L.marker([
      latitude,
      longitude
    ]).bindPopup(
      escapeHtml(rawLabel).replaceAll('\n', '<br>')
    );

    markerGroup.push(marker);
    bounds.push([
      latitude,
      longitude
    ]);
  });

  markerGroup.forEach((marker) => {
    marker.addTo(state.layers);
  });

  if (bounds.length) {
    state.map.fitBounds(bounds, {
      padding: [24, 24],
      maxZoom: 13
    });
  }
}
function focusPost(post) {
  const lat=Number(post.latitude),lng=Number(post.longitude);
  if(Number.isFinite(lat)&&Number.isFinite(lng)) state.map?.setView([lat,lng],15);
  else if(areaCoordinates[post.location_name]) state.map?.setView(areaCoordinates[post.location_name],13);
  document.getElementById('mapSection')?.scrollIntoView({behavior:'smooth'});
}

async function geocode(address) {
  const response=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=jp&q=${encodeURIComponent(address)}`,{headers:{'Accept-Language':'ja'}});
  if(!response.ok) throw new Error('住所検索に失敗しました。');
  const data=await response.json(); if(!data[0]) throw new Error('住所から場所を見つけられませんでした。');
  return {latitude:Number(data[0].lat),longitude:Number(data[0].lon)};
}

async function loadData({
  force = false
} = {}) {
  if (state.loadingData) {
    return;
  }

  state.loadingData = true;

  try {
    /*
     * 画面の中心となる投稿を先に取得して表示します。
     * スポット取得を待たないため、初期表示が速くなります。
     */
    state.posts = await getTimelinePosts({
      force
    });

    renderPosts();

    /*
     * スポットは後から取得し、地図だけ更新します。
     * 取得失敗時も投稿一覧はそのまま利用できます。
     */
    getPlaces({
      force
    })
      .then((places) => {
        state.places = places || [];
        scheduleMapRefresh();
      })
      .catch((error) => {
        console.warn(
          'スポット情報を読み込めませんでした。',
          error
        );

        state.places = [];
      });
  } finally {
    state.loadingData = false;
  }
}

async function init() {
  try {
    state.user=await getCurrentUser();
    if(!state.user){ location.replace('login.html'); return; }
    state.profile=await ensureCurrentProfile(state.user);
    /*
     * 担当メンバー版のユーザー表示を維持し、
     * プロフィール画像がある場合だけ画像を優先します。
     */
    ['currentUserAvatar','postFormAvatar'].forEach(id=>{
      const el=$(id);
      if(!el)return;

      if(state.profile.avatar_url){
        el.textContent='';
        el.style.backgroundImage=`url("${state.profile.avatar_url}")`;
        el.style.backgroundSize='cover';
        el.style.backgroundPosition='center';
      }else{
        el.textContent=firstChar(state.profile.display_name);
        el.style.backgroundImage='';
      }
    });
    if ($('currentUserDisplayName')) {
      $('currentUserDisplayName').textContent =
        state.profile.display_name;
    }

    if ($('currentUsername')) {
      $('currentUsername').textContent =
        `@${state.profile.username}`;
    }

    if ($('currentUserEmail')) {
      $('currentUserEmail').textContent =
        state.user.email || '';
    }

    /*
     * 投稿一覧を優先し、重い地図処理は後回しにします。
     */
    await loadData();
    scheduleMapInitialization();

    /*
     * 戻る操作でホームへ戻った場合の位置を復元します。
     */
    const savedScroll =
      Number(
        sessionStorage.getItem(
          'okitalk_home_scroll_y'
        ) || 0
      );

    if (savedScroll > 0) {
      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: savedScroll,
          behavior: 'auto'
        });
      });
    }
  } catch (error) {
    console.error(error);

    alert(
      `ホームの読み込みに失敗しました：${error.message}`
    );
  }
}

$('postContent')?.addEventListener('input',e=>{$('characterCount').textContent=`${e.target.value.length} / 200`;});
$('placeDescription')?.addEventListener('input',e=>{$('placeDescriptionCount').textContent=`${e.target.value.length} / 150`;});
$('areaFilterSelect')?.addEventListener('change',e=>{state.area=e.target.value;renderPosts();});
$('clearAreaFilterButton')?.addEventListener('click',()=>{state.area='all';$('areaFilterSelect').value='all';renderPosts();});
$('resetMapButton')?.addEventListener('click',()=>state.map?.setView([26.2124,127.6809],9));
$('cancelPostLocationButton')?.addEventListener('click',()=>{state.selectedLocation=null;$('postLocationStatusText').textContent='';$('postLocationStatus')?.classList.remove('active');});
$('useCurrentLocationButton')?.addEventListener('click',()=>navigator.geolocation?.getCurrentPosition(pos=>{
  state.selectedLocation={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
  $('postLocationStatusText').textContent='現在地を投稿に追加します。'; $('postLocationStatus')?.classList.add('active');
  state.map?.setView([pos.coords.latitude,pos.coords.longitude],15);
},()=>alert('現在地を取得できませんでした。')));
$('postImage')?.addEventListener('change',()=>alert('画像アップロードはStorage設定後に利用できます。今回は画像なしで投稿してください。'));
$('removeImageButton')?.addEventListener('click',()=>{if($('postImage'))$('postImage').value='';$('imagePreviewContainer').style.display='none';});

$('postForm')?.addEventListener('submit',async e=>{
  e.preventDefault(); const content=$('postContent').value.trim(); if(!content)return;
  const button=e.currentTarget.querySelector('[type="submit"]'); button.disabled=true;
  try {
    const area=$('areaSelect').value;
    await createPost({userId:state.user.id,content,locationName:area,latitude:state.selectedLocation?.latitude ?? areaCoordinates[area]?.[0] ?? null,longitude:state.selectedLocation?.longitude ?? areaCoordinates[area]?.[1] ?? null});
    e.currentTarget.reset(); $('characterCount').textContent='0 / 200'; state.selectedLocation=null; await loadData({ force: true });
  } catch(error){alert(`投稿に失敗しました：${error.message}`);} finally{button.disabled=false;}
});

$('placeForm')?.addEventListener('submit',async e=>{
  e.preventDefault(); const button=$('addPinButton'); button.disabled=true;
  try {
    const address=$('placeAddress').value.trim(); const coords=state.selectedLocation || await geocode(address);
    await createPlace({userId:state.user.id,name:$('placeName').value.trim(),address,description:$('placeDescription')?.value.trim()||null,...coords});
    e.currentTarget.reset(); state.selectedLocation=null; await loadData({ force: true }); alert('地図に追加しました。');
  } catch(error){alert(`ピンを追加できませんでした：${error.message}`);} finally{button.disabled=false;}
});

$('useCurrentLocationForPinButton')?.addEventListener('click',()=>navigator.geolocation?.getCurrentPosition(pos=>{
  state.selectedLocation={latitude:pos.coords.latitude,longitude:pos.coords.longitude}; $('placeAddress').value='現在地'; $('clearPinLocationButton').hidden=false;
},()=>alert('現在地を取得できませんでした。')));
$('clearPinLocationButton')?.addEventListener('click',()=>{state.selectedLocation=null;$('placeAddress').value='';$('clearPinLocationButton').hidden=true;});

const menu=$('mobileMenuDrawer');
function toggleMenu(open){if(!menu)return;menu.setAttribute('aria-hidden',String(!open));menu.classList.toggle('open',open);$('mobileMenuButton')?.setAttribute('aria-expanded',String(open));}
$('mobileMenuButton')?.addEventListener('click',()=>toggleMenu(true)); $('mobileMenuCloseButton')?.addEventListener('click',()=>toggleMenu(false)); $('mobileMenuBackdrop')?.addEventListener('click',()=>toggleMenu(false));

/*
 * ページを離れる直前にスクロール位置を保存します。
 * ホームへ戻った際に、元の位置へ復元できます。
 */
window.addEventListener('pagehide', () => {
  sessionStorage.setItem(
    'okitalk_home_scroll_y',
    String(window.scrollY)
  );
});

document.addEventListener(
  'DOMContentLoaded',
  init
);
