import { getCurrentUser, getOtherProfiles, getProfile, getMessages, sendMessage } from '../api.js';
const $=id=>document.getElementById(id);
const state={user:null,profiles:[],selected:null};
const esc=v=>{const d=document.createElement('div');d.textContent=String(v??'');return d.innerHTML};

/*
 * メッセージ担当版の表示処理を維持し、
 * プロフィール画像とテーマカラーだけを反映します。
 */
function applyAvatar(el,p){
    if(!el)return;

    if(p.avatar_url){
        el.textContent='';
        el.style.backgroundImage=`url("${p.avatar_url}")`;
        el.style.backgroundSize='cover';
        el.style.backgroundPosition='center';
    }else{
        el.style.backgroundImage='';
        el.textContent=[...(p.display_name||p.username||'沖')][0];
    }

    el.style.setProperty(
        '--message-theme',
        p.theme_color||'#2589ff'
    );
}

function renderProfiles(){
    const q=$('messageSearch').value.toLowerCase();
    const rows=state.profiles.filter(
        p=>`${p.display_name} ${p.username}`.toLowerCase().includes(q)
    );

    $('conversationItems').innerHTML='';
    $('conversationEmpty').style.display=rows.length?'none':'block';

    rows.forEach(p=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='conversation-item';
        b.innerHTML=`<span class="conversation-avatar"></span><span><strong>${esc(p.display_name||'ユーザー')}</strong><small>@${esc(p.username||'user')}</small></span>`;

        applyAvatar(
            b.querySelector('.conversation-avatar'),
            p
        );

        b.addEventListener(
            'click',
            ()=>selectProfile(p,b)
        );

        $('conversationItems').appendChild(b);
    });
}

async function selectProfile(p,button=null){
    state.selected=p;

    document
        .querySelectorAll('.conversation-item')
        .forEach(el=>el.classList.remove('active'));

    button?.classList.add('active');

    $('chatUserName').textContent=p.display_name||'ユーザー';
    $('chatUserId').textContent=`@${p.username||'user'}`;

    applyAvatar(
        $('chatUserIcon'),
        p
    );

    $('messageInput').disabled=false;
    $('messageForm').querySelector('button').disabled=false;
    await renderMessages();
}
async function renderMessages(){const rows=await getMessages(state.user.id,state.selected.id);$('chatMessages').innerHTML=rows.length?'':'<p class="chat-empty">まだメッセージはありません。</p>';rows.forEach(m=>{const el=document.createElement('div');el.className=`message-bubble ${m.sender_id===state.user.id?'mine':'theirs'}`;el.textContent=m.content;$('chatMessages').appendChild(el);});$('chatMessages').scrollTop=$('chatMessages').scrollHeight;}
$('messageSearch').addEventListener('input',renderProfiles);$('messageForm').addEventListener('submit',async e=>{e.preventDefault();const content=$('messageInput').value.trim();if(!content||!state.selected)return;try{await sendMessage({senderId:state.user.id,receiverId:state.selected.id,content});$('messageInput').value='';await renderMessages();}catch(err){alert(`送信できませんでした：${err.message}`);}});
document.addEventListener('DOMContentLoaded',async()=>{
    try{
        state.user=await getCurrentUser();

        if(!state.user){
            location.replace('../login.html');
            return;
        }

        state.profiles=await getOtherProfiles(state.user.id);
        renderProfiles();

        /*
         * プロフィールページから渡されたユーザーIDがある場合だけ、
         * 対象の会話を自動で開きます。
         */
        const requested=
            new URLSearchParams(location.search).get('userId');

        if(requested){
            let target=
                state.profiles.find(p=>p.id===requested);

            if(!target){
                target=await getProfile(requested);
                state.profiles.unshift(target);
                renderProfiles();
            }

            const buttons=[
                ...document.querySelectorAll('.conversation-item')
            ];

            const index=
                state.profiles.findIndex(p=>p.id===target.id);

            await selectProfile(
                target,
                buttons[index]||null
            );
        }
    }catch(error){
        console.error(error);
        alert(
            `メッセージを読み込めませんでした：${error.message}`
        );
    }
});
