import {
  getCurrentUser, ensureCurrentProfile, createPost, getTimelinePosts,
  createPlace, getPlaces
} from '../api.js';

const $ = (id) => document.getElementById(id);
const state = { user: null, profile: null, posts: [], places: [], area: 'all', selectedLocation: null, map: null, layers: null };
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
      <div class="post-user-icon">${escapeHtml(firstChar(profile.display_name || profile.username))}</div>
      <div class="post-main">
        <div class="post-header"><div><strong>${escapeHtml(profile.display_name || 'ユーザー')}</strong><span>@${escapeHtml(profile.username || 'user')}</span></div><span class="post-time">${timeAgo(post.created_at)}</span></div>
        <p class="post-text">${escapeHtml(post.content).replaceAll('\n','<br>')}</p>
        ${post.image_url ? `<img class="post-image" src="${escapeHtml(post.image_url)}" alt="投稿画像" loading="lazy">` : ''}
        <div class="post-bottom">
          ${post.location_name || post.location_address ? `<button type="button" class="map-focus-button">📍${escapeHtml(post.location_name || post.location_address)}</button>` : '<span></span>'}
        </div>
      </div>`;
    article.querySelector('.map-focus-button')?.addEventListener('click',()=>focusPost(post));
    list.appendChild(article);
  });
  showMessage(state.area==='all' ? `${posts.length}件の投稿を表示しています。` : `${state.area}の投稿：${posts.length}件`);
  refreshMap();
}

function initMap() {
  if(!window.L || !$('map')) return;
  state.map=L.map('map').setView([26.2124,127.6809],9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(state.map);
  state.layers=L.layerGroup().addTo(state.map);
  state.map.on('click', e => {
    state.selectedLocation={latitude:e.latlng.lat,longitude:e.latlng.lng};
    $('postLocationStatusText').textContent=`地図で選択：${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    $('postLocationStatus')?.classList.add('active');
  });
}
function refreshMap() {
  if(!state.layers)return; state.layers.clearLayers();
  const bounds=[];
  [...state.posts.map(p=>({...p,kind:'post'})),...state.places.map(p=>({...p,kind:'place'}))].forEach(item=>{
    const lat=Number(item.latitude),lng=Number(item.longitude); if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    const label=item.kind==='post' ? item.content : `${item.name}${item.description?`<br>${item.description}`:''}`;
    L.marker([lat,lng]).bindPopup(escapeHtml(label)).addTo(state.layers); bounds.push([lat,lng]);
  });
  if(bounds.length) state.map.fitBounds(bounds,{padding:[24,24],maxZoom:13});
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

async function loadData() {
  [state.posts,state.places]=await Promise.all([getTimelinePosts(),getPlaces().catch(()=>[])]);
  renderPosts();
}

async function init() {
  try {
    state.user=await getCurrentUser();
    if(!state.user){ location.replace('login.html'); return; }
    state.profile=await ensureCurrentProfile(state.user);
    ['currentUserAvatar','postFormAvatar'].forEach(id=>{if($(id))$(id).textContent=firstChar(state.profile.display_name)});
    if($('currentUserDisplayName'))$('currentUserDisplayName').textContent=state.profile.display_name;
    if($('currentUsername'))$('currentUsername').textContent=`@${state.profile.username}`;
    if($('currentUserEmail'))$('currentUserEmail').textContent=state.user.email || '';
    initMap(); await loadData();
  } catch(error) { console.error(error); alert(`ホームの読み込みに失敗しました：${error.message}`); }
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
    e.currentTarget.reset(); $('characterCount').textContent='0 / 200'; state.selectedLocation=null; await loadData();
  } catch(error){alert(`投稿に失敗しました：${error.message}`);} finally{button.disabled=false;}
});

$('placeForm')?.addEventListener('submit',async e=>{
  e.preventDefault(); const button=$('addPinButton'); button.disabled=true;
  try {
    const address=$('placeAddress').value.trim(); const coords=state.selectedLocation || await geocode(address);
    await createPlace({userId:state.user.id,name:$('placeName').value.trim(),address,description:$('placeDescription')?.value.trim()||null,...coords});
    e.currentTarget.reset(); state.selectedLocation=null; await loadData(); alert('地図に追加しました。');
  } catch(error){alert(`ピンを追加できませんでした：${error.message}`);} finally{button.disabled=false;}
});

$('useCurrentLocationForPinButton')?.addEventListener('click',()=>navigator.geolocation?.getCurrentPosition(pos=>{
  state.selectedLocation={latitude:pos.coords.latitude,longitude:pos.coords.longitude}; $('placeAddress').value='現在地'; $('clearPinLocationButton').hidden=false;
},()=>alert('現在地を取得できませんでした。')));
$('clearPinLocationButton')?.addEventListener('click',()=>{state.selectedLocation=null;$('placeAddress').value='';$('clearPinLocationButton').hidden=true;});

const menu=$('mobileMenuDrawer');
function toggleMenu(open){if(!menu)return;menu.setAttribute('aria-hidden',String(!open));menu.classList.toggle('open',open);$('mobileMenuButton')?.setAttribute('aria-expanded',String(open));}
$('mobileMenuButton')?.addEventListener('click',()=>toggleMenu(true)); $('mobileMenuCloseButton')?.addEventListener('click',()=>toggleMenu(false)); $('mobileMenuBackdrop')?.addEventListener('click',()=>toggleMenu(false));

document.addEventListener('DOMContentLoaded',init);
