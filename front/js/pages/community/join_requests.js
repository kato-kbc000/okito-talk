import { supabase } from '../../supabase.js';
const id = new URLSearchParams(location.search).get('id');
const notice = document.getElementById('notice');
const root = document.getElementById('requests');
document.getElementById('back').href = `community_home.html?id=${encodeURIComponent(id || '')}`;
async function load() {
 root.replaceChildren();
 if (!id) { notice.textContent='コミュニティIDがありません'; return; }
 const {data: auth, error: authError}=await supabase.auth.getUser();
 if(authError || !auth.user) {notice.textContent='ログインが必要です';return;}
 const {data: community,error: cError}=await supabase.from('communities').select('owner_id,name').eq('id',id).single();
 if(cError) {notice.textContent=cError.message;return;}
 if(community.owner_id!==auth.user.id) {notice.textContent='管理者だけが申請を確認できます';return;}
 const {data, error}=await supabase.from('community_members').select('user_id,joined_at,profile:user_id(display_name,username)').eq('community_id',id).eq('status','pending').order('joined_at');
 if(error) {notice.textContent=`読み込み失敗: ${error.message}`;return;}
 notice.textContent=data.length?`${data.length}件の承認待ち申請があります`:'承認待ちの申請はありません';
 for(const row of data){
  const article=document.createElement('article');
  const name=document.createElement('strong');name.textContent=row.profile?.display_name || row.profile?.username || 'ユーザー';article.append(name);
  for(const [label,approve] of [['承認',true],['却下',false]]){
   const button=document.createElement('button');button.type='button';button.textContent=label;if(!approve)button.className='reject';
   button.addEventListener('click',async()=>{button.disabled=true;const {error}=await supabase.rpc('okito_review_join_request',{p_community:id,p_user:row.user_id,p_approve:approve});if(error){notice.textContent=error.message;button.disabled=false;}else await load();});article.append(button);
  }
  root.append(article);
 }
}
load().catch(e=>notice.textContent=e.message);
