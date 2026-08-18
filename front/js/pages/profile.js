import {
    getCurrentUser,
    ensureCurrentProfile,
    getProfile,
    getProfileByUsername,
    updateProfile,
    isUsernameTaken,
    getUserPosts,
    updatePost,
    deletePost,
    getFollowing,
    getFollowers,
    getMutualFollows,
    getFollowState,
    followUser,
    unfollowUser,
    getLikedPosts,
    getSavedPosts,
    setPostLiked,
    setPostSaved,
    getPostEngagement,
    getUserPlaces,
    deletePlace,
    getProfileSettings,
    saveProfileSettings,
    getLocationShareTargets,
    replaceLocationShareTargets
} from '../api.js';

const $ = id => document.getElementById(id);
const state = {
    authUser: null,
    ownProfile: null,
    viewedProfile: null,
    isOwn: true,
    posts: [],
    likedPosts: [],
    savedPosts: [],
    places: [],
    following: [],
    followers: [],
    mutual: [],
    followState: { isFollowing: false, isFollower: false, isMutual: false },
    settings: { location_sharing: false },
    shareTargets: [],
    currentTab: 'posts',
    currentListType: 'following',
    pendingIcon: null,
    pendingHeader: null,
    likedIds: new Set(),
    savedIds: new Set(),
    likeCounts: new Map(),

    /* 必要になったデータだけ取得するための読み込み状態 */
    loaded: {
        posts: false,
        relations: false,
        likes: false,
        saved: false,
        places: false,
        settings: false,
        shareTargets: false
    },

    loading: {}
};

const esc = value => {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
};
const first = value => [...String(value || '沖').trim()][0] || '沖';
const byId = id => document.getElementById(id);

function toast(message) {
    const el = $('toast');
    if (!el) { alert(message); return; }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2500);
}

function openModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.open')) document.body.classList.remove('modal-open');
}

function showFeatureError(error) {
    toast(
        error?.isPendingDatabaseFeature
            ? error.message
            : `処理に失敗しました：${error?.message || "不明なエラー"}`
    );
}

/*
 * 同じAPIを連続で呼ばないための共通処理です。
 * ボタンを連打しても、進行中の同じ通信を再利用します。
 */
function runOnce(key, task) {
    if (state.loading[key]) {
        return state.loading[key];
    }

    state.loading[key] = Promise.resolve()
        .then(task)
        .finally(() => {
            delete state.loading[key];
        });

    return state.loading[key];
}

function showTabLoading(tab, isLoading) {
    const target = $(
        tab === "posts"
            ? "myPostList"
            : tab === "likes"
                ? "likedPostList"
                : tab === "saved"
                    ? "savedPostList"
                    : "spotList"
    );

    if (!target) return;

    target.classList.toggle("is-loading", isLoading);
    target.setAttribute("aria-busy", String(isLoading));
}

function applyAvatar(element, profile) {
    if (!element || !profile) return;
    element.style.backgroundImage = profile.avatar_url ? `url("${profile.avatar_url}")` : '';
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.textContent = profile.avatar_url ? '' : first(profile.display_name);
}

function applyTheme(profile) {
    const color = /^#[0-9a-f]{6}$/i.test(profile.theme_color || '') ? profile.theme_color : '#2589ff';
    const mix = (hex, target, ratio) => {
        const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
        const a = rgb(hex), b = rgb(target);
        return '#' + a.map((v, i) => Math.round(v * (1 - ratio) + b[i] * ratio).toString(16).padStart(2, '0')).join('');
    };
    const root = document.documentElement;
    root.style.setProperty('--profile-primary', color);
    root.style.setProperty('--profile-secondary', mix(color, '#ffffff', .25));
    root.style.setProperty('--profile-soft', mix(color, '#ffffff', .88));
    root.style.setProperty('--profile-primary-dark', mix(color, '#000000', .15));
    root.style.setProperty('--profile-primary-shadow', `${color}2e`);
}

function renderProfile() {
    const p = state.viewedProfile;
    if (!p) return;
    applyTheme(p);
    $('profileName').textContent = p.display_name || 'ユーザー';
    $('profileUserId').textContent = `@${p.username || 'user'}`;
    $('profileDescription').textContent = p.bio || '自己紹介はまだありません。';
    $('profileLocation').textContent = p.city ? `📍 ${p.city}` : '📍 地域未設定';
    applyAvatar($('profileIcon'), p);
    applyAvatar($('editIconPreview'), p);
    if ($('profileCover')) $('profileCover').style.backgroundImage = p.header_url ? `url("${p.header_url}")` : '';
    if ($('editCoverPreview')) $('editCoverPreview').style.backgroundImage = p.header_url ? `url("${p.header_url}")` : '';
    $('postCount').textContent = state.posts.length;
    $('followingCount').textContent = state.following.length;
    $('followerCount').textContent = state.followers.length;
    if ($('mutualCount')) $('mutualCount').textContent = state.mutual.length;

    const ownOnly = ['copyProfileUrlButton', 'openProfileEditButton', 'openProfileSettingButton', 'openSpotAddButton'];
    ownOnly.forEach(id => { if ($(id)) $(id).hidden = !state.isOwn; });
    if ($('openMutualButton')) $('openMutualButton').hidden = !state.isOwn;
    if ($('savedTabButton')) $('savedTabButton').hidden = !state.isOwn;
    if ($('otherProfileActions')) {
        $('otherProfileActions').hidden =
            state.isOwn || !state.loaded.relations;
    }
    if ($('locationShareStatus')) $('locationShareStatus').hidden = !state.isOwn;

    if (!state.isOwn) renderOtherProfileActions();
    renderLocationStatus();
}

function renderOtherProfileActions() {
    const label = $('otherProfileFollowingLabel');
    const followButton = $('otherProfileFollowButton');
    const messageButton = $('otherProfileMessageButton');
    if (!followButton) return;
    label.hidden = !state.followState.isFollowing;
    followButton.textContent = state.followState.isFollowing ? 'フォローを外す' : 'フォローする';
    followButton.classList.toggle('other-profile-unfollow-button', state.followState.isFollowing);
    followButton.onclick = async () => {
        try {
            if (state.followState.isFollowing) {
                if (!confirm(`${state.viewedProfile.display_name}さんのフォローを外しますか？`)) return;
                await unfollowUser(state.authUser.id, state.viewedProfile.id);
            } else {
                await followUser(state.authUser.id, state.viewedProfile.id);
            }
            await loadRelations({ force: true });
            renderProfile();
        } catch (error) { alert(error.message); }
    };
    if (messageButton) messageButton.onclick = () => {
        location.href = `messages.html?userId=${encodeURIComponent(state.viewedProfile.id)}`;
    };
}

function visibleForViewer(post) {
    if (state.isOwn || post.user_id === state.authUser.id) return true;
    if (post.visibility === 'private') return false;
    if (post.visibility === 'followers') return state.followState.isFollowing;
    return true;
}

function createPostCard(post, { editable = false } = {}) {
    const profile = post.profiles || state.viewedProfile;
    const article = document.createElement('article');
    article.className = 'post-card';
    article.innerHTML = `
        <div class="post-icon"></div>
        <div class="post-content">
            <div class="post-header">
                <div class="post-header-main">
                    <strong>${esc(profile?.display_name || 'ユーザー')}</strong>
                    <span>@${esc(profile?.username || 'user')}</span>
                    <span>・${new Date(post.created_at).toLocaleString('ja-JP')}</span>
                </div>
                ${editable ? '<div class="post-menu-wrapper"><button type="button" class="post-menu-button">⋯</button><div class="post-menu"><button type="button" data-edit>編集</button><button type="button" class="delete-post-button" data-delete>削除</button></div></div>' : ''}
            </div>
            <span class="visibility-label">${post.visibility === 'private' ? '🔒 自分のみ' : post.visibility === 'followers' ? '👥 フォロワーのみ' : '🌐 全体公開'}</span>
            <p class="post-text">${esc(post.content).replaceAll('\n', '<br>')}</p>
            ${post.image_url ? `<img class="profile-post-image" src="${esc(post.image_url)}" alt="投稿画像">` : ''}
            ${post.location_name ? `<p class="post-location">📍 ${esc(post.location_name)}</p>` : ''}
            <div class="post-action">
                <button type="button" class="post-action-button ${state.likedIds.has(post.id) ? 'active' : ''}" data-like aria-pressed="${state.likedIds.has(post.id)}">
                    ${state.likedIds.has(post.id) ? '♥' : '♡'} いいね <span>${state.likeCounts.get(post.id) || 0}</span>
                </button>
                <button type="button" class="post-action-button ${state.savedIds.has(post.id) ? 'active' : ''}" data-save aria-pressed="${state.savedIds.has(post.id)}">
                    ${state.savedIds.has(post.id) ? '🔖 保存済み' : '🔖 保存'}
                </button>
            </div>
        </div>`;
    applyAvatar(article.querySelector('.post-icon'), profile || state.viewedProfile);
    article.querySelector('[data-like]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const nextLiked = !state.likedIds.has(post.id);
        button.disabled = true;
        try {
            await setPostLiked(state.authUser.id, post.id, nextLiked);
            if (nextLiked) {
                state.likedIds.add(post.id);
                state.likeCounts.set(post.id, (state.likeCounts.get(post.id) || 0) + 1);
                toast('いいねしました。');
            } else {
                state.likedIds.delete(post.id);
                state.likeCounts.set(post.id, Math.max(0, (state.likeCounts.get(post.id) || 0) - 1));
                toast('いいねを取り消しました。');
            }
            state.loaded.likes = false;
            renderPosts();
        } catch (e) {
            alert(e.message);
            button.disabled = false;
        }
    });
    article.querySelector('[data-save]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const nextSaved = !state.savedIds.has(post.id);
        button.disabled = true;
        try {
            await setPostSaved(state.authUser.id, post.id, nextSaved);
            if (nextSaved) {
                state.savedIds.add(post.id);
                toast('保存しました。');
            } else {
                state.savedIds.delete(post.id);
                toast('保存を解除しました。');
            }
            state.loaded.saved = false;
            renderPosts();
        } catch (e) {
            alert(e.message);
            button.disabled = false;
        }
    });
    if (editable) {
        const menuButton = article.querySelector('.post-menu-button');
        const menu = article.querySelector('.post-menu');
        menuButton?.addEventListener('click', () => menu.classList.toggle('open'));
        article.querySelector('[data-edit]')?.addEventListener('click', async () => {
            const content = prompt('投稿内容を編集してください。', post.content);
            if (content === null || !content.trim()) return;
            await updatePost(post.id, state.authUser.id, { content: content.trim() });
            await loadPosts({ force: true });
        });
        article.querySelector('[data-delete]')?.addEventListener('click', async () => {
            if (!confirm('この投稿を削除しますか？')) return;
            await deletePost(post.id, state.authUser.id);
            await loadPosts({ force: true });
        });
    }
    return article;
}

function renderPosts() {
    const lists = { posts: $('myPostList'), likes: $('likedPostList'), saved: $('savedPostList') };
    Object.values(lists).forEach(list => { if (list) list.innerHTML = ''; });
    const source = state.currentTab === 'likes' ? state.likedPosts : state.currentTab === 'saved' ? state.savedPosts : state.posts;
    const rows = source.filter(visibleForViewer);
    const target = lists[state.currentTab] || lists.posts;
    rows.forEach(post => target?.appendChild(createPostCard(post, { editable: state.currentTab === 'posts' && state.isOwn })));
    if ($('postEmptyMessage')) $('postEmptyMessage').style.display = state.currentTab === 'posts' && !rows.length ? 'block' : 'none';
    if ($('likeEmptyMessage')) $('likeEmptyMessage').style.display = state.currentTab === 'likes' && !rows.length ? 'block' : 'none';
    if ($('savedEmptyMessage')) $('savedEmptyMessage').style.display = state.currentTab === 'saved' && !rows.length ? 'block' : 'none';
}

function renderPlaces() {
    const container = $('spotList') || $('userPinList') || $('spotsTabContent');
    if (!container) return;
    let list = container.querySelector('.db-place-list');
    if (!list) { list = document.createElement('div'); list.className = 'spot-list db-place-list'; container.appendChild(list); }
    list.innerHTML = '';
    state.places.forEach(place => {
        const card = document.createElement('article');
        card.className = 'spot-card';
        card.innerHTML = `<div class="spot-card-header"><span class="spot-category">公開スポット</span>${state.isOwn ? '<button type="button" class="spot-delete-button">削除</button>' : ''}</div><h3>${esc(place.name)}</h3><p>${esc(place.address)}</p><p>${esc(place.description || '')}</p>`;
        card.querySelector('.spot-delete-button')?.addEventListener('click', async () => {
            if (!confirm('このスポットを削除しますか？')) return;
            await deletePlace(place.id, state.authUser.id);
            await loadPlaces({ force: true });
        });
        list.appendChild(card);
    });
}

function renderLocationStatus() {
    if (!$('locationShareStatusText')) return;
    const enabled = Boolean(state.settings.location_sharing && state.shareTargets.length);
    $('locationShareStatus').classList.toggle('sharing', enabled);
    $('locationShareStatusText').textContent = enabled ? `${state.shareTargets.length}人に位置情報を共有中` : '位置情報は共有していません';
}

async function loadPosts({ force = false } = {}) {
    if (state.loaded.posts && !force) return state.posts;

    return runOnce("posts", async () => {
        showTabLoading("posts", true);

        try {
            state.posts = await getUserPosts(state.viewedProfile.id);
            state.posts = state.posts.map(post => ({
                ...post,
                profiles: state.viewedProfile
            }));

            const engagement = await getPostEngagement(
                state.posts.map(post => post.id),
                state.authUser.id
            );
            state.likedIds = engagement.likedIds;
            state.savedIds = engagement.savedIds;
            state.likeCounts = engagement.likeCounts;
            state.loaded.posts = true;
            renderPosts();
            renderProfile();
            return state.posts;
        } finally {
            showTabLoading("posts", false);
        }
    });
}

async function loadRelations({ force = false } = {}) {
    if (state.loaded.relations && !force) {
        return {
            following: state.following,
            followers: state.followers,
            mutual: state.mutual
        };
    }

    return runOnce("relations", async () => {
        const [followingResult, followersResult] = await Promise.allSettled([
            getFollowing(state.viewedProfile.id),
            getFollowers(state.viewedProfile.id)
        ]);

        state.following =
            followingResult.status === "fulfilled"
                ? followingResult.value
                : [];

        state.followers =
            followersResult.status === "fulfilled"
                ? followersResult.value
                : [];

        state.mutual =
            state.isOwn
                ? await getMutualFollows(state.viewedProfile.id).catch(() => [])
                : [];

        if (!state.isOwn) {
            state.followState =
                await getFollowState(
                    state.authUser.id,
                    state.viewedProfile.id
                ).catch(() => ({
                    isFollowing: false,
                    isFollower: false,
                    isMutual: false,
                    databasePending: true
                }));
        }

        state.loaded.relations = true;
        renderProfile();

        return {
            following: state.following,
            followers: state.followers,
            mutual: state.mutual
        };
    });
}

async function loadLikes({ force = false } = {}) {
    if (state.loaded.likes && !force) return state.likedPosts;

    return runOnce("likes", async () => {
        showTabLoading("likes", true);
        try {
            state.likedPosts =
                await getLikedPosts(state.viewedProfile.id)
                    .catch(() => []);
            state.loaded.likes = true;
            if (state.currentTab === "likes") renderPosts();
            return state.likedPosts;
        } finally {
            showTabLoading("likes", false);
        }
    });
}

async function loadSaved({ force = false } = {}) {
    if (!state.isOwn) return [];
    if (state.loaded.saved && !force) return state.savedPosts;

    return runOnce("saved", async () => {
        showTabLoading("saved", true);
        try {
            state.savedPosts =
                await getSavedPosts(state.authUser.id)
                    .catch(() => []);
            state.loaded.saved = true;
            if (state.currentTab === "saved") renderPosts();
            return state.savedPosts;
        } finally {
            showTabLoading("saved", false);
        }
    });
}

async function loadPlaces({ force = false } = {}) {
    if (state.loaded.places && !force) return state.places;

    return runOnce("places", async () => {
        showTabLoading("spots", true);
        try {
            state.places =
                await getUserPlaces(state.viewedProfile.id)
                    .catch(() => []);
            state.loaded.places = true;
            if (state.currentTab === "spots") renderPlaces();
            return state.places;
        } finally {
            showTabLoading("spots", false);
        }
    });
}

async function loadSettings({ force = false } = {}) {
    if (!state.isOwn) return state.settings;
    if (state.loaded.settings && !force) return state.settings;

    return runOnce("settings", async () => {
        state.settings =
            await getProfileSettings(state.authUser.id)
                .catch(() => ({
                    location_sharing: false,
                    databasePending: true
                }));
        state.loaded.settings = true;
        renderLocationStatus();
        return state.settings;
    });
}

async function loadShareTargets({ force = false } = {}) {
    if (!state.isOwn) return [];
    if (state.loaded.shareTargets && !force) return state.shareTargets;

    return runOnce("shareTargets", async () => {
        state.shareTargets =
            await getLocationShareTargets(state.authUser.id)
                .catch(() => []);
        state.loaded.shareTargets = true;
        renderLocationStatus();
        return state.shareTargets;
    });
}

async function openUserList(type) {
    state.currentListType = type;

    if (!state.loaded.relations) {
        if ($('userList')) {
            $('userList').innerHTML = '<p class="user-list-loading">読み込み中…</p>';
        }
        openModal('userListModal');
        await loadRelations();
    }
    const rows = type === 'followers' ? state.followers : type === 'mutual' ? state.mutual : state.following;
    $('userListTitle').textContent = type === 'followers' ? 'フォロワー' : type === 'mutual' ? '相互フォロー' : 'フォロー中';
    $('userList').innerHTML = '';
    rows.forEach(profile => {
        const item = document.createElement('div');
        item.className = 'user-list-item';
        const isSelf = profile.id === state.authUser.id;
        item.innerHTML = `<div class="user-list-icon"></div><div class="user-list-information"><button type="button" class="user-name-link"><strong>${esc(profile.display_name)}</strong></button><span>@${esc(profile.username)}</span></div><div class="user-list-actions"></div>`;
        applyAvatar(item.querySelector('.user-list-icon'), profile);
        item.querySelector('.user-name-link').onclick = () => location.href = `profile.html?userId=${encodeURIComponent(profile.id)}`;
        const actions = item.querySelector('.user-list-actions');
        if (!isSelf) {
            const message = document.createElement('button');
            message.type = 'button'; message.className = 'user-message-button'; message.textContent = '✉ メッセージ';
            message.onclick = () => location.href = `messages.html?userId=${encodeURIComponent(profile.id)}`;
            actions.appendChild(message);
            if (state.isOwn && type !== 'followers') {
                const unfollow = document.createElement('button');
                unfollow.type = 'button'; unfollow.className = 'unfollow-button'; unfollow.textContent = 'フォローを外す';
                unfollow.onclick = async () => {
                    if (!confirm(`${profile.display_name}さんのフォローを外しますか？`)) return;

                    try {
                        await unfollowUser(state.authUser.id, profile.id);
                        await loadRelations({ force: true });
                        renderProfile();
                        openUserList(type);
                    } catch (error) {
                        showFeatureError(error);
                    }
                };
                actions.prepend(unfollow);
            }
        }
        $('userList').appendChild(item);
    });
    openModal('userListModal');
}

async function changeTab(tab) {
    if (!state.isOwn && tab === 'saved') return;
    state.currentTab = tab;
    document.querySelectorAll('.profile-tab').forEach(button => {
        const active = button.dataset.tab === tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.remove('active'));
    $(`${tab}TabContent`)?.classList.add('active');
    $('postTools').style.display = ['posts', 'likes', 'saved'].includes(tab) ? '' : 'none';
    if (tab === 'likes' && !state.loaded.likes) {
        await loadLikes();
        return;
    }

    if (tab === 'saved' && !state.loaded.saved) {
        await loadSaved();
        return;
    }

    if (tab === 'spots' && !state.loaded.places) {
        await loadPlaces();
        return;
    }

    if (tab === 'spots') renderPlaces();
    else renderPosts();
}

function readFile(input, callback) {
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) { alert('JPEGまたはPNG画像を選択してください。'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('画像は2MB以下にしてください。'); return; }
    const reader = new FileReader();
    reader.onload = () => callback(String(reader.result));
    reader.readAsDataURL(file);
}

async function init() {
    try {
        state.authUser = await getCurrentUser();

        if (!state.authUser) {
            location.replace('../login.html');
            return;
        }

        state.ownProfile = await ensureCurrentProfile(state.authUser);

        const params = new URLSearchParams(location.search);
        const requested = params.get('userId') || params.get('username');

        if (
            !requested ||
            requested === state.authUser.id ||
            requested === state.ownProfile.username
        ) {
            state.viewedProfile = state.ownProfile;
            state.isOwn = true;
        } else {
            state.viewedProfile = requested.includes('-')
                ? await getProfile(requested)
                : await getProfileByUsername(requested);
            state.isOwn = state.viewedProfile.id === state.authUser.id;
        }

        /*
         * 基本プロフィールを先に描画し、ここでページを表示します。
         * いいね・保存・スポット・設定は、必要になった時だけ取得します。
         */
        renderProfile();
        document.documentElement.classList.remove('okitalk-page-loading');

        /* 投稿と件数はバックグラウンドで並行取得します。 */
        Promise.allSettled([
            loadPosts(),
            loadRelations()
        ]).then(() => {
            renderProfile();
        });
    } catch (error) {
        console.error(error);
        document.documentElement.classList.remove('okitalk-page-loading');
        alert(`プロフィールを読み込めませんでした：${error.message}`);
    }
}

// タブ・件数ボタン
document.querySelectorAll('.profile-tab').forEach(button => button.addEventListener('click', () => changeTab(button.dataset.tab)));
$('postCountButton')?.addEventListener('click', () => { changeTab('posts'); $('profilePostsSection')?.scrollIntoView({ behavior: 'smooth' }); });
$('openFollowingButton')?.addEventListener('click', () => openUserList('following'));
$('openFollowerButton')?.addEventListener('click', () => openUserList('followers'));
$('openMutualButton')?.addEventListener('click', () => state.isOwn && openUserList('mutual'));
$('openSpotAddButton')?.addEventListener('click', () => {
    location.href = '../home.html#mapSection';
});

// モーダル
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => {
    const map = { profile: 'profileEditModal', setting: 'profileSettingModal', 'post-edit': 'postEditModal', spot: 'spotAddModal', delete: 'deleteConfirmModal', 'user-list': 'userListModal' };
    closeModal(map[button.dataset.closeModal] || button.dataset.closeModal);
}));
$('openProfileEditButton')?.addEventListener('click', () => {
    const p = state.ownProfile;
    $('editName').value = p.display_name || '';
    $('editUserId').value = p.username || '';
    $('editDescription').value = p.bio || '';
    $('editLocation').value = p.city || '';
    openModal('profileEditModal');
});
$('openProfileSettingButton')?.addEventListener('click', async () => {
    openModal('profileSettingModal');

    await Promise.allSettled([
        loadRelations(),
        loadSettings(),
        loadShareTargets()
    ]);

    if ($('themeColorInput')) {
        $('themeColorInput').value =
            state.ownProfile.theme_color || '#2589ff';
    }

    if ($('locationShareOn')) {
        $('locationShareOn').checked =
            Boolean(state.settings.location_sharing);
    }

    if ($('locationShareOff')) {
        $('locationShareOff').checked =
            !state.settings.location_sharing;
    }

    renderShareTargets();
});

$('iconImageInput')?.addEventListener('change', e => readFile(e.target, value => { state.pendingIcon = value; $('editIconPreview').style.backgroundImage = `url("${value}")`; $('editIconPreview').textContent = ''; }));
$('coverImageInput')?.addEventListener('change', e => readFile(e.target, value => { state.pendingHeader = value; $('editCoverPreview').style.backgroundImage = `url("${value}")`; }));
$('removeIconImageButton')?.addEventListener('click', () => { state.pendingIcon = ''; $('editIconPreview').style.backgroundImage = ''; $('editIconPreview').textContent = first(state.ownProfile.display_name); });
$('removeCoverImageButton')?.addEventListener('click', () => { state.pendingHeader = ''; $('editCoverPreview').style.backgroundImage = ''; });

$('profileEditForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const username = $('editUserId').value.trim();
    const displayName = $('editName').value.trim();
    try {
        if (!/^[A-Za-z0-9_]+$/.test(username)) throw new Error('ユーザーIDは半角英数字とアンダーバーで入力してください。');
        if (await isUsernameTaken(username, state.authUser.id)) throw new Error('このユーザーIDは使用されています。');
        state.ownProfile = await updateProfile(state.authUser.id, {
            username,
            displayName,
            bio: $('editDescription').value.trim(),
            city: $('editLocation').value.trim(),
            avatarUrl: state.pendingIcon === null ? state.ownProfile.avatar_url : state.pendingIcon,
            headerUrl: state.pendingHeader === null ? state.ownProfile.header_url : state.pendingHeader,
            isPrivate: state.ownProfile.is_private,
            themeColor: state.ownProfile.theme_color
        });
        state.viewedProfile = state.ownProfile;
        state.pendingIcon = state.pendingHeader = null;
        closeModal('profileEditModal'); renderProfile(); renderPosts(); toast('プロフィールを保存しました。');
    } catch (error) { $('profileFormError').textContent = error.message; }
});

function renderShareTargets() {
    if (!$('shareUserList')) return;
    $('shareUserList').innerHTML = '';
    const selected = new Set(state.shareTargets.map(profile => profile.id));
    state.mutual.forEach(profile => {
        const label = document.createElement('label');
        label.className = 'share-user-item';
        label.innerHTML = `<input type="checkbox" value="${profile.id}" ${selected.has(profile.id) ? 'checked' : ''}><span>${esc(profile.display_name)}<small>@${esc(profile.username)}</small></span>`;
        $('shareUserList').appendChild(label);
    });
    if ($('selectedShareUserCount')) $('selectedShareUserCount').textContent = String(selected.size);
}

$('profileSettingForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
        const themeColor = $('themeColorInput')?.value || '#2589ff';
        state.ownProfile = await updateProfile(state.authUser.id, {
            username: state.ownProfile.username,
            displayName: state.ownProfile.display_name,
            bio: state.ownProfile.bio,
            city: state.ownProfile.city,
            avatarUrl: state.ownProfile.avatar_url,
            headerUrl: state.ownProfile.header_url,
            isPrivate: state.ownProfile.is_private,
            themeColor
        });
        const locationSharing = Boolean($('locationShareOn')?.checked);
        const targetIds = [...document.querySelectorAll('#shareUserList input:checked')].map(input => input.value);
        state.settings = await saveProfileSettings(state.authUser.id, { locationSharing });
        await replaceLocationShareTargets(state.authUser.id, locationSharing ? targetIds : []);
        state.shareTargets = locationSharing ? state.mutual.filter(profile => targetIds.includes(profile.id)) : [];
        state.viewedProfile = state.ownProfile;
        closeModal('profileSettingModal'); renderProfile(); toast('設定を保存しました。');
    } catch (error) { alert(error.message); }
});

$('copyProfileUrlButton')?.addEventListener('click', async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}?userId=${state.viewedProfile.id}`); toast('プロフィールURLをコピーしました。'); });

document.addEventListener('DOMContentLoaded', init);
