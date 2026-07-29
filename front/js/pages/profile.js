import { getCurrentUser, ensureCurrentProfile, updateProfile, getUserPosts, updatePost, deletePost, isUsernameTaken } from '../api.js';

const $ = id => document.getElementById(id);
const state = { user:null, profile:null, posts:[] };
function esc(v=''){const d=document.createElement('div');d.textContent=String(v);return d.innerHTML;}
function first(v='沖'){return [...String(v).trim()][0]||'沖';}
function toast(message){const el=$('toast');if(!el){alert(message);return;}el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2500);}
function openModal(id){$(id)?.removeAttribute('hidden');$(id)?.classList.add('open');}
function closeModal(id){$(id)?.setAttribute('hidden','');$(id)?.classList.remove('open');}
function applyProfile(){
  const p=state.profile;
  $('profileName').textContent=p.display_name||'ユーザー'; $('profileUserId').textContent=`@${p.username||'user'}`;
  $('profileDescription').textContent=p.bio||'自己紹介はまだありません。'; $('profileLocation').textContent=p.city||'沖縄県';
  $('profileIcon').textContent=first(p.display_name); if(p.avatar_url){$('profileIcon').style.backgroundImage=`url("${p.avatar_url}")`;$('profileIcon').style.backgroundSize='cover';$('profileIcon').textContent='';}
  if(p.header_url){$('profileCover').style.backgroundImage=`url("${p.header_url}")`;}
  $('postCount').textContent=state.posts.length;
  $('editName').value=p.display_name||''; $('editUserId').value=p.username||''; $('editDescription').value=p.bio||''; $('editLocation').value=p.city||'';
  $('descriptionCharacterCount').textContent=`${(p.bio||'').length} / 160`;
}
function renderPosts(){
  const list=$('myPostList'); if(!list)return; list.innerHTML=''; $('postEmptyMessage').style.display=state.posts.length?'none':'block';
  state.posts.forEach(post=>{
    const el=document.createElement('article');el.className='profile-post-card';
    el.innerHTML=`<div class="profile-post-head"><strong>${esc(state.profile.display_name)}</strong><span>${new Date(post.created_at).toLocaleString('ja-JP')}</span></div><p>${esc(post.content).replaceAll('\n','<br>')}</p><div class="profile-post-actions"><button type="button" data-edit>編集</button><button type="button" data-delete>削除</button></div>`;
    el.querySelector('[data-edit]').addEventListener('click',async()=>{const content=prompt('投稿内容を編集してください。',post.content);if(content===null||!content.trim())return;try{await updatePost(post.id,state.user.id,{content:content.trim()});await loadPosts();toast('投稿を更新しました。');}catch(e){alert(e.message);}});
    el.querySelector('[data-delete]').addEventListener('click',async()=>{if(!confirm('この投稿を削除しますか？'))return;try{await deletePost(post.id,state.user.id);await loadPosts();toast('投稿を削除しました。');}catch(e){alert(e.message);}});
    list.appendChild(el);
  });
}
async function loadPosts(){state.posts=await getUserPosts(state.user.id);renderPosts();applyProfile();}
async function init(){
  try{state.user=await getCurrentUser();if(!state.user){location.replace('../login.html');return;}state.profile=await ensureCurrentProfile(state.user);await loadPosts();}
  catch(e){console.error(e);alert(`プロフィールを読み込めませんでした：${e.message}`);}
}
$('openProfileEditButton')?.addEventListener('click',()=>openModal('profileEditModal'));
$('openProfileSettingButton')?.addEventListener('click',()=>openModal('profileSettingModal'));
document.querySelectorAll('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.closeModal;const map={profile:'profileEditModal',setting:'profileSettingModal','post-edit':'postEditModal',spot:'spotAddModal',delete:'deleteConfirmModal','user-list':'userListModal'};closeModal(map[key]||key);}));
$('editDescription')?.addEventListener('input',e=>$('descriptionCharacterCount').textContent=`${e.target.value.length} / 160`);
$('profileEditForm')?.addEventListener('submit',async e=>{
  e.preventDefault(); const username=$('editUserId').value.trim(); const displayName=$('editName').value.trim(); const error=$('profileFormError');error.textContent='';
  try{if(!/^[a-zA-Z0-9_]+$/.test(username))throw new Error('ユーザー名は半角英数字とアンダースコアで入力してください。');if(await isUsernameTaken(username,state.user.id))throw new Error('このユーザー名はすでに使われています。');
    state.profile=await updateProfile(state.user.id,{username,displayName,bio:$('editDescription').value.trim(),city:$('editLocation').value.trim(),avatarUrl:state.profile.avatar_url,headerUrl:state.profile.header_url,isPrivate:state.profile.is_private});applyProfile();closeModal('profileEditModal');toast('プロフィールを保存しました。');
  }catch(err){error.textContent=err.message;}
});
$('copyProfileUrlButton')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(location.href);toast('プロフィールURLをコピーしました。');});
['likesTabContent','savedTabContent','spotsTabContent'].forEach(id=>{const el=$(id);if(el)el.querySelectorAll('[id$="List"]').forEach(list=>list.innerHTML='');});
document.addEventListener('DOMContentLoaded',init);
