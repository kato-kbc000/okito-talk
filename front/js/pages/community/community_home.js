"use strict";

import { supabase } from "../../supabase.js";
import {
    getCurrentUser, ensureCurrentProfile, getCommunity, getCommunityMembers,
    getCommunityPosts, createPost, uploadPostImage, addComment, deletePost, getPostImages, MAX_POST_IMAGES,
    setPostLiked, setPostSaved, joinCommunity, leaveCommunity,
    upsertCommunityLocation, stopCommunityLocation, getCommunityLocations, deleteComment
} from "../../api.js";
import { loadGoogleMaps, isOkinawaCoordinate, searchPlaces } from "../../maps.js";

/* =========================================
   コミュニティホーム（DB連携版）
   community_home.html?id=<communities.id>
========================================= */

const $ = (id) => document.getElementById(id);
const COVER_CLASS = {
    "自然・海": "sea-community", "グルメ": "gourmet-community", "文化・伝統": "eisa-community",
    "地域": "naha-community", "スポーツ": "sports-community", "旅行・観光": "travel-community"
};
const DEFAULT_RULES = ["相手を尊重して交流しましょう。", "個人情報の投稿には注意してください。"];
const ALLOWED_IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const state = {
    user: null, profile: null, community: null, communityId: "",
    membership: null,            // { role, status } | null
    members: [], posts: [],
    activeTab: "new", images: [], location: "", locationPoint: null, toastTimer: null,
    // コミュニティマップ
    map: null, mapReady: false, markers: [], previewMarker: null, infoWindow: null, fitted: false,
    locations: [], pollTimer: null,
    share: { watchId: null, active: false, current: null, lastSent: null, sending: false, label: "", message: false }
};

const el = {
    hero: $("communityHero"), cover: $("communityHeroCover"), icon: $("communityHeroIcon"),
    category: $("communityCategory"), name: $("communityName"), description: $("communityDescription"),
    memberCount: $("communityMemberCount"), postCount: $("communityPostCount"), createdDate: $("communityCreatedDate"),
    statusButton: $("joinedStatusButton"),
    sideDescription: $("sideCommunityDescription"), sideCategory: $("sideCommunityCategory"),
    owner: $("communityOwner"), rules: $("communityRuleList"), memberList: $("communityMemberList"),
    memberLink: $("memberPageLink"), allMemberLink: $("allMemberLink"), settingsLink: $("communitySettingsLink"),
    userAvatar: $("currentUserAvatar"), userName: $("currentUserName"),
    form: document.querySelector(".community-post-form"),
    text: $("communityPostText"), count: $("characterCount"),
    selectImage: $("selectImageButton"), imageInput: $("postImageInput"),
    previewArea: $("imagePreviewArea"), preview: $("imagePreview"), removeImage: $("removeImageButton"),
    selectLocation: $("selectLocationButton"), locationSelector: $("locationSelector"),
    closeLocation: $("closeLocationSelector"), locationInput: $("locationInput"), addLocation: $("addLocationButton"),
    locationPreview: $("locationPreview"), locationText: $("selectedLocationText"), removeLocation: $("removeLocationButton"),
    submit: $("submitCommunityPost"), posts: $("communityPosts"), empty: $("emptyPostMessage"),
    listTitle: $("postListTitle"), sort: $("postSortSelect"),
    map: $("communityMap"), shareToggle: $("locationShareToggle"), shareStatus: $("locationShareStatus"),
    shareMessage: $("locationShareMessage"), centerMe: $("mapCenterMeButton"), showAll: $("mapShowAllButton"),
    locationCandidates: $("locationCandidates"),
    leaveButton: $("leaveCommunityButton"), leaveModal: $("leaveCommunityModal"),
    cancelLeave: $("cancelLeaveButton"), confirmLeave: $("confirmLeaveButton"), toast: $("communityHomeToast")
};

/* ---------- 共通ユーティリティ ---------- */

function showToast(message) {
    if (!el.toast) return;
    clearTimeout(state.toastTimer);
    el.toast.textContent = message;
    el.toast.hidden = false;
    el.toast.classList.add("show");
    state.toastTimer = setTimeout(() => {
        el.toast.classList.remove("show");
        setTimeout(() => { el.toast.hidden = true; }, 200);
    }, 2500);
}

function formatRelativeTime(value) {
    const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}日前`;
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function avatarDataUrl(text, color) {
    const ch = String(text || "沖").slice(0, 1).replace(/[&<>"']/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${color}"/><text x="50" y="57" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="42" font-family="sans-serif" font-weight="bold">${ch}</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

const AVATAR_COLORS = ["#2f8cff", "#22b8a7", "#ff9b40", "#ef5c73", "#7950f2"];
const avatarColor = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length];
const displayName = (p) => p?.display_name || p?.username || "ユーザー";
const isMember = () => state.membership?.status === "approved";
const isManager = () => isMember() && ["owner", "admin"].includes(state.membership.role);

function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/* ---------- 初期化 ---------- */

document.addEventListener("DOMContentLoaded", init);

async function init() {
    try {
        state.communityId = new URLSearchParams(location.search).get("id") || "";
        state.user = await getCurrentUser();
        if (!state.user) { location.replace("../../login.html"); return; }
        state.profile = await ensureCurrentProfile(state.user);

        state.community = state.communityId ? await getCommunity(state.communityId) : null;
        if (!state.community) { showNotFound(); return; }

        await loadMembership();
        await Promise.all([loadMembers(), loadPosts()]);

        renderCommunity();
        renderCurrentUser();
        renderMembers();
        renderPosts();
        bindEvents();
        updateCharacterCount();
        initCommunityMap().catch((error) => console.warn("コミュニティマップの初期化に失敗しました。", error));
    } catch (error) {
        console.error("コミュニティホームの初期化に失敗しました。", error);
        showToast("コミュニティの読み込みに失敗しました。");
    }
}

function showNotFound() {
    document.title = "コミュニティが見つかりません | おきとーーーーーーく";
    el.name.textContent = "コミュニティが見つかりません";
    el.description.textContent = "存在しないか、閲覧できないコミュニティです。";
    el.statusButton.hidden = true;
    el.form.hidden = true;
    el.leaveButton.hidden = true;
}

async function loadMembership() {
    const { data, error } = await supabase
        .from("community_members").select("role, status")
        .eq("community_id", state.communityId).eq("user_id", state.user.id).maybeSingle();
    if (error) throw error;
    state.membership = data;
}

async function loadMembers() {
    const rows = await getCommunityMembers(state.communityId);
    state.members = rows.filter((row) => row.profile);
}

async function loadPosts() {
    state.posts = await getCommunityPosts(state.communityId, state.user.id);
}

/* ---------- 画面表示 ---------- */

function renderCommunity() {
    const c = state.community;
    document.title = `${c.name} | おきとーーーーーーく`;
    el.icon.textContent = c.icon_url ? "" : (c.icon_emoji || "🌺");
    if (c.icon_url) Object.assign(el.icon.style, { backgroundImage: `url("${c.icon_url}")`, backgroundSize: "cover", backgroundPosition: "center" });
    el.category.textContent = c.categoryName;
    el.name.textContent = c.name;
    el.description.textContent = c.description || "説明はまだありません。";
    el.sideDescription.textContent = c.description || "説明はまだありません。";
    el.sideCategory.textContent = c.categoryName;
    el.owner.textContent = c.ownerName;
    el.memberCount.textContent = state.members.length.toLocaleString("ja-JP");
    el.createdDate.textContent = new Date(c.created_at).toLocaleDateString("ja-JP");
    el.cover.classList.add(COVER_CLASS[c.categoryName] || "cover-blue");
    if (c.header_url) Object.assign(el.cover.style, { backgroundImage: `url("${c.header_url}")`, backgroundSize: "cover", backgroundPosition: "center" });

    const visibilityLabel = { public: "公開", approval: "承認制", private: "非公開" }[c.visibility] || "公開";
    const visibilityRow = document.querySelector(".community-details div:nth-child(2) dd");
    if (visibilityRow) visibilityRow.textContent = visibilityLabel;

    el.rules.replaceChildren(...(c.rules?.length ? c.rules : DEFAULT_RULES).map((rule) => make("li", "", rule)));

    const id = encodeURIComponent(state.communityId);
    el.memberLink.href = el.allMemberLink.href = `community_members.html?id=${id}`;
    el.settingsLink.href = `community_settings.html?id=${id}`;
    el.settingsLink.hidden = !isManager();

    renderMembershipControls();
    updatePendingBadge();
}

/** 管理者には、承認待ちの参加申請の数を「設定」タブに表示する */
async function updatePendingBadge() {
    if (!isManager()) return;
    try {
        const pending = await getCommunityMembers(state.communityId, "pending");
        const old = el.settingsLink.querySelector(".subnav-badge");
        old?.remove();
        if (pending.length) {
            const badge = make("span", "subnav-badge", String(pending.length));
            badge.title = `${pending.length}件の参加申請が承認待ちです`;
            el.settingsLink.append(badge);
        }
    } catch (error) { console.warn("参加申請の数を取得できませんでした。", error); }
}

function renderMembershipControls() {
    const status = state.membership?.status;
    const isOwner = state.membership?.role === "owner";
    el.statusButton.hidden = false;
    el.statusButton.disabled = false;
    el.leaveButton.hidden = !(status === "approved" && !isOwner);

    if (status === "approved") {
        el.statusButton.textContent = isOwner ? "★ オーナー" : "✓ 参加中";
        el.statusButton.disabled = isOwner;
    } else if (status === "pending") {
        el.statusButton.textContent = "承認待ち（申請取消）";
    } else if (status === "rejected") {
        el.statusButton.textContent = "参加できません";
        el.statusButton.disabled = true;
    } else {
        el.statusButton.textContent = state.community.visibility === "public" ? "＋ 参加する" : "＋ 参加を申請する";
    }
    el.form.hidden = status !== "approved";
}

function renderCurrentUser() {
    const name = displayName(state.profile);
    el.userName.textContent = name;
    el.userAvatar.src = state.profile.avatar_url || avatarDataUrl(name, "#2f8cff");
}

function renderMembers() {
    el.memberCount.textContent = state.members.length.toLocaleString("ja-JP");
    const items = state.members.slice(0, 6).map((member, index) => {
        const p = member.profile;
        const link = make("a", "member-item");
        link.href = `../profile.html?userId=${encodeURIComponent(p.id)}`;
        const img = make("img");
        img.src = p.avatar_url || avatarDataUrl(displayName(p), avatarColor(index));
        img.alt = `${displayName(p)}のプロフィール画像`;
        const text = make("span");
        text.append(make("strong", "", displayName(p)), make("small", "", p.username ? `@${p.username}` : ""));
        link.append(img, text);
        return link;
    });
    el.memberList.replaceChildren(...items);
}

/* ---------- 投稿一覧 ---------- */

function visiblePosts() {
    let posts = [...state.posts];
    if (state.activeTab === "popular") posts = posts.filter((p) => p.likeCount >= 3 || p.comments.length > 0);
    if (state.activeTab === "media") posts = posts.filter((p) => getPostImages(p).length);
    const sort = el.sort.value;
    const time = (p) => new Date(p.created_at).getTime();
    if (sort === "old") posts.sort((a, b) => time(a) - time(b));
    else if (sort === "likes") posts.sort((a, b) => b.likeCount - a.likeCount || time(b) - time(a));
    else posts.sort((a, b) => time(b) - time(a));
    return posts;
}

function renderPosts() {
    const posts = visiblePosts();
    el.postCount.textContent = state.posts.length.toLocaleString("ja-JP");
    el.posts.replaceChildren(...posts.map(createPostElement));
    el.empty.hidden = posts.length > 0;
}

function actionButton(action, className, icon, text) {
    const button = make("button", className);
    button.type = "button";
    button.dataset.action = action;
    button.append(make("span", action === "like" ? "like-icon" : "", icon), make("span", "", text));
    return button;
}

function createPostElement(post) {
    const article = make("article", "community-post");
    article.dataset.postId = post.id;
    const name = displayName(post.profiles);

    const header = make("div", "community-post-header");
    const author = make("a", "post-author");
    author.href = `../profile.html?userId=${encodeURIComponent(post.user_id)}`;
    const authorImg = make("img");
    authorImg.src = post.profiles?.avatar_url || avatarDataUrl(name, "#2f8cff");
    authorImg.alt = `${name}のプロフィール画像`;
    const info = make("span");
    info.append(make("strong", "", name),
        make("small", "", `${post.profiles?.username ? "@" + post.profiles.username : ""}・${formatRelativeTime(post.created_at)}`));
    author.append(authorImg, info);
    header.append(author);
    if (post.user_id === state.user.id || isManager()) {
        const menu = actionButton("menu", "post-menu-button", "…", "");
        menu.replaceChildren("…");
        menu.setAttribute("aria-label", "投稿を削除");
        header.append(menu);
    }

    const body = make("div", "community-post-body");
    if (post.content) body.append(make("p", "", post.content));
    if (post.location_name || hasCoordinates(post)) {
        const place = make("button", "post-location", `📍 ${post.location_name || "地図で選んだ場所"}`);
        place.type = "button";
        if (hasCoordinates(post)) {
            place.dataset.action = "focus-map";
            place.title = "コミュニティマップで見る";
        } else place.disabled = true;
        body.append(place);
    }
    getPostImages(post).forEach((url) => {
        const img = make("img", "community-post-image");
        img.src = url; img.alt = "投稿画像"; img.loading = "lazy";
        body.append(img);
    });

    const actions = make("div", "community-post-actions");
    actions.append(
        actionButton("like", `post-action-button like-button${post.liked ? " liked" : ""}`, post.liked ? "♥" : "♡", String(post.likeCount)),
        actionButton("comment", "post-action-button", "💬", String(post.comments.length)),
        actionButton("share", "post-action-button", "↗", "共有"),
        actionButton("bookmark", `post-action-button${post.saved ? " saved" : ""}`, "🔖", post.saved ? "保存済み" : "保存")
    );

    article.append(header, body, actions, createCommentSection(post));
    return article;
}

function createCommentSection(post) {
    const section = make("div", "comment-section");
    const list = make("div", "comment-list");
    post.comments.forEach((comment) => list.append(createCommentElement(comment)));
    section.append(list);
    if (!isMember()) return section;

    const form = make("form", "comment-form");
    form.dataset.postId = post.id;
    const me = make("img");
    me.src = state.profile.avatar_url || avatarDataUrl(displayName(state.profile), "#2f8cff");
    me.alt = "自分のプロフィール画像";
    const input = make("input");
    Object.assign(input, { type: "text", name: "comment", maxLength: 150, placeholder: "コメントを入力" });
    const file = make("input");
    Object.assign(file, { type: "file", name: "commentImage", accept: ALLOWED_IMAGES.join(","), hidden: true });
    const label = make("label", "comment-image-button", "📷");
    label.title = "コメントに写真を追加";
    label.append(file);
    const send = make("button", "", "送信");
    send.type = "submit";
    form.append(me, input, label, send);
    section.append(form);
    return section;
}

function createCommentElement(comment) {
    const item = make("div", "comment-item");
    const name = displayName(comment.profiles);
    const avatar = make("img");
    avatar.src = comment.profiles?.avatar_url || avatarDataUrl(name, "#22b8a7");
    avatar.alt = `${name}のプロフィール画像`;
    const content = make("div", "comment-content");
    const nameArea = make("div", "comment-name");
    nameArea.append(make("strong", "", name), make("small", "", formatRelativeTime(comment.created_at)));
    content.append(nameArea);
    if (comment.content) content.append(make("p", "", comment.content));
    if (comment.image_url) {
        const img = make("img", "comment-image");
        img.src = comment.image_url; img.alt = "コメント画像"; img.loading = "lazy";
        content.append(img);
    }
    item.append(avatar, content);
    if (comment.user_id === state.user.id || isManager()) {
        const remove = make("button", "comment-delete", "✕");
        remove.type = "button";
        remove.dataset.action = "delete-comment";
        remove.dataset.commentId = comment.id;
        remove.setAttribute("aria-label", "コメントを削除");
        item.append(remove);
    }
    return item;
}

/* ---------- 投稿フォーム ---------- */

function updateCharacterCount() {
    const length = el.text.value.length;
    el.count.textContent = `${length} / 300`;
    el.submit.disabled = !length && !state.images.length && !state.location;
}

function renderImagePreviews() {
    el.previewArea.replaceChildren(...state.images.map((image, index) => {
        const item = make("div", "community-image-thumb");
        const img = make("img");
        img.src = image.url; img.alt = `投稿画像${index + 1}のプレビュー`;
        const remove = make("button", "remove-image-button", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", `画像${index + 1}を削除`);
        remove.addEventListener("click", () => {
            URL.revokeObjectURL(image.url);
            state.images.splice(index, 1);
            renderImagePreviews();
        });
        item.append(img, remove);
        return item;
    }));
    el.previewArea.hidden = state.images.length === 0;
    updateCharacterCount();
}

function handleImageSelection(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    const room = MAX_POST_IMAGES - state.images.length;
    if (files.length > room) showToast(`画像は最大${MAX_POST_IMAGES}枚までです。`);
    for (const file of files.slice(0, Math.max(room, 0))) {
        if (!ALLOWED_IMAGES.includes(file.type)) { showToast("JPEG、PNG、WebP、GIFの画像を選択してください。"); continue; }
        if (file.size > 3 * 1024 * 1024) { showToast("画像サイズは1枚3MB以下にしてください。"); continue; }
        state.images.push({ file, url: URL.createObjectURL(file) });
    }
    renderImagePreviews();
}

function clearImages() {
    state.images.forEach((image) => URL.revokeObjectURL(image.url));
    state.images = [];
    renderImagePreviews();
}

function setPostLocation(point) {
    state.locationPoint = point;
    state.location = point.name;
    el.locationText.textContent = point.name;
    el.locationPreview.hidden = false;
    setPreviewMarker(point.latitude, point.longitude);
    updateCharacterCount();
}

function renderLocationCandidates(list) {
    el.locationCandidates.replaceChildren(...list.map((item) => {
        const button = make("button", "location-candidate");
        button.type = "button";
        button.append(make("strong", "", item.name || item.address.split(/[ 、,]/)[0]), make("span", "", item.address));
        button.addEventListener("click", () => {
            setPostLocation({ name: item.name || item.address.split(/[ 、,]/)[0], latitude: item.latitude, longitude: item.longitude });
            renderLocationCandidates([]);
            closeLocation();
            focusMap(item.latitude, item.longitude, 16);
        });
        return button;
    }));
    el.locationCandidates.hidden = list.length === 0;
}

async function addLocation() {
    const value = el.locationInput.value.trim();
    if (!value) { showToast("場所を入力してください。"); return; }
    el.addLocation.disabled = true;
    try {
        const found = await searchPlaces(value);
        if (!found.length) { showToast("沖縄県内の場所が見つかりませんでした。マップをクリックして選ぶこともできます。"); return; }
        if (found.length === 1) {
            const only = found[0];
            setPostLocation({ name: only.name || value, latitude: only.latitude, longitude: only.longitude });
            closeLocation();
            focusMap(only.latitude, only.longitude, 16);
        } else renderLocationCandidates(found);
    } catch (error) {
        showToast(`場所を検索できませんでした：${error.message}`);
    } finally { el.addLocation.disabled = false; }
}

function closeLocation() {
    el.locationSelector.hidden = true;
    el.locationInput.value = "";
    renderLocationCandidates([]);
}

function clearLocation() {
    state.location = ""; state.locationPoint = null;
    el.locationText.textContent = ""; el.locationPreview.hidden = true;
    clearPreviewMarker();
    updateCharacterCount();
}

async function submitPost() {
    const content = el.text.value.trim();
    if (!content && !state.images.length && !state.location) { showToast("投稿内容を入力してください。"); return; }
    el.submit.disabled = true;
    try {
        const imageUrls = await Promise.all(state.images.map((image) => uploadPostImage(state.user.id, image.file)));
        await createPost({
            userId: state.user.id, content: content || state.location, imageUrls,
            locationName: state.location || null,
            latitude: state.locationPoint?.latitude ?? null, longitude: state.locationPoint?.longitude ?? null,
            communityId: state.communityId, visibility: "public"
        });
        el.text.value = ""; clearImages(); clearLocation();
        await loadPosts();
        renderPosts();
        renderMapMarkers();
        showToast("コミュニティに投稿しました。");
    } catch (error) {
        console.error(error);
        showToast(`投稿できませんでした：${error.message}`);
    } finally {
        updateCharacterCount();
    }
}

/* ---------- 投稿アクション ---------- */

const findPost = (id) => state.posts.find((post) => post.id === id);

async function toggleLike(post) {
    const next = !post.liked;
    post.liked = next; post.likeCount = Math.max(0, post.likeCount + (next ? 1 : -1));
    renderPosts();
    try { await setPostLiked(state.user.id, post.id, next); }
    catch (error) {
        post.liked = !next; post.likeCount = Math.max(0, post.likeCount + (next ? -1 : 1));
        renderPosts(); showToast(`いいねできませんでした：${error.message}`);
    }
}

async function toggleBookmark(post) {
    const next = !post.saved;
    post.saved = next; renderPosts();
    try { await setPostSaved(state.user.id, post.id, next); showToast(next ? "投稿を保存しました。" : "投稿の保存を解除しました。"); }
    catch (error) { post.saved = !next; renderPosts(); showToast(`保存できませんでした：${error.message}`); }
}

async function sharePost(post) {
    const url = `${location.href.split("#")[0]}#post-${post.id}`;
    try {
        if (navigator.share) { await navigator.share({ title: state.community.name, url }); return; }
        await navigator.clipboard.writeText(url);
        showToast("投稿URLをコピーしました。");
    } catch (error) {
        if (error?.name !== "AbortError") showToast("投稿URLをコピーできませんでした。");
    }
}

async function removePost(post) {
    if (!window.confirm("この投稿を削除しますか？")) return;
    try {
        if (post.user_id === state.user.id) await deletePost(post.id, state.user.id);
        else {
            const { error } = await supabase.from("posts").delete().eq("id", post.id);
            if (error) throw error;
        }
        state.posts = state.posts.filter((item) => item.id !== post.id);
        renderPosts();
        showToast("投稿を削除しました。");
    } catch (error) { showToast(`削除できませんでした：${error.message}`); }
}

function handlePostListClick(event) {
    const button = event.target.closest("[data-action]");
    const article = button?.closest(".community-post");
    const post = article && findPost(article.dataset.postId);
    if (!post) return;
    switch (button.dataset.action) {
        case "like": toggleLike(post); break;
        case "comment": article.querySelector('.comment-form input[name="comment"]')?.focus(); break;
        case "share": sharePost(post); break;
        case "bookmark": toggleBookmark(post); break;
        case "menu": removePost(post); break;
        case "focus-map": focusPostOnMap(post); break;
        case "delete-comment": removeComment(post, button.dataset.commentId); break;
    }
}

async function removeComment(post, commentId) {
    if (!window.confirm("このコメントを削除しますか？")) return;
    try {
        await deleteComment(commentId);
        post.comments = post.comments.filter((comment) => comment.id !== commentId);
        renderPosts();
        showToast("コメントを削除しました。");
    } catch (error) { showToast(`削除できませんでした：${error.message}`); }
}

async function handleCommentSubmit(event) {
    const form = event.target.closest(".comment-form");
    if (!form) return;
    event.preventDefault();
    const post = findPost(form.dataset.postId);
    const text = form.querySelector('input[name="comment"]').value.trim();
    const file = form.querySelector('input[name="commentImage"]')?.files?.[0];
    if (!post || (!text && !file)) { showToast("コメントを入力してください。"); return; }
    if (file && (!ALLOWED_IMAGES.includes(file.type) || file.size > 3 * 1024 * 1024)) {
        showToast("コメント画像はJPEG/PNG/WebP/GIFの3MB以下にしてください。"); return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
        const imageUrl = file ? await uploadPostImage(state.user.id, file) : null;
        const comment = await addComment({ postId: post.id, userId: state.user.id, content: text, imageUrl });
        post.comments.push(comment);
        renderPosts();
        showToast("コメントを投稿しました。");
    } catch (error) {
        submit.disabled = false;
        showToast(`コメントできませんでした：${error.message}`);
    }
}

/* ---------- 参加・退出 ---------- */

async function handleStatusButton() {
    const status = state.membership?.status;
    try {
        if (status === "approved") { openLeave(); return; }
        if (status === "pending") {
            await leaveCommunity(state.communityId, state.user.id);
            state.membership = null;
            showToast("参加申請を取り消しました。");
        } else if (!status) {
            const result = await joinCommunity(state.community, state.user.id);
            state.membership = { role: "member", status: result };
            showToast(result === "approved" ? "コミュニティに参加しました。" : "参加を申請しました。承認をお待ちください。");
        }
        await Promise.all([loadMembers(), loadPosts()]);
        renderCommunity(); renderMembers(); renderPosts();
    } catch (error) { showToast(`操作できませんでした：${error.message}`); }
}

function openLeave() { el.leaveModal.hidden = false; document.body.style.overflow = "hidden"; el.cancelLeave.focus(); }
function closeLeave() { el.leaveModal.hidden = true; document.body.style.overflow = ""; }

async function confirmLeave() {
    el.confirmLeave.disabled = true;
    try {
        await leaveCommunity(state.communityId, state.user.id);
        closeLeave();
        showToast("コミュニティから退出しました。");
        setTimeout(() => { location.href = "../community.html"; }, 700);
    } catch (error) {
        el.confirmLeave.disabled = false;
        showToast(`退出できませんでした：${error.message}`);
    }
}

/* ---------- イベント ---------- */

function bindEvents() {
    el.text.addEventListener("input", updateCharacterCount);
    el.selectImage.addEventListener("click", () => el.imageInput.click());
    el.imageInput.addEventListener("change", handleImageSelection);
    el.removeImage?.addEventListener("click", clearImages);
    el.selectLocation.addEventListener("click", () => { el.locationSelector.hidden = false; el.locationInput.focus(); });
    el.shareToggle?.addEventListener("click", toggleSharing);
    el.centerMe?.addEventListener("click", () => {
        const me = state.share.current;
        if (me) focusMap(me.latitude, me.longitude, 17);
    });
    el.showAll?.addEventListener("click", () => fitMap());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) loadLocations(); });
    window.addEventListener("pagehide", () => { if (state.pollTimer) clearInterval(state.pollTimer); });
    el.closeLocation.addEventListener("click", closeLocation);
    el.addLocation.addEventListener("click", addLocation);
    el.locationInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addLocation(); } });
    el.removeLocation.addEventListener("click", clearLocation);
    el.submit.addEventListener("click", submitPost);
    el.sort.addEventListener("change", renderPosts);
    document.querySelectorAll(".community-tab").forEach((tab) => tab.addEventListener("click", (event) => {
        state.activeTab = event.currentTarget.dataset.tab;
        document.querySelectorAll(".community-tab").forEach((t) => {
            const active = t.dataset.tab === state.activeTab;
            t.classList.toggle("active", active);
            t.setAttribute("aria-selected", String(active));
        });
        el.listTitle.textContent = { new: "新着の投稿", popular: "人気の投稿", media: "画像付きの投稿" }[state.activeTab];
        renderPosts();
    }));
    el.posts.addEventListener("click", handlePostListClick);
    el.posts.addEventListener("submit", handleCommentSubmit);
    el.statusButton.addEventListener("click", handleStatusButton);
    el.leaveButton.addEventListener("click", openLeave);
    el.cancelLeave.addEventListener("click", closeLeave);
    el.confirmLeave.addEventListener("click", confirmLeave);
    el.leaveModal.addEventListener("click", (e) => { if (e.target === el.leaveModal) closeLeave(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.leaveModal.hidden) closeLeave(); });
}


/* =========================================
   コミュニティマップ（投稿の場所 + メンバーの現在地）
========================================= */

const MAP_COLORS = { me: "#16a34a", member: "#2f8cff", post: "#ef4444" };
const hasCoordinates = (row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))
    && row.latitude !== null && row.longitude !== null;

function circleIcon(color) {
    return {
        path: window.google.maps.SymbolPath.CIRCLE, scale: 13, fillColor: color, fillOpacity: 1,
        strokeColor: "#ffffff", strokeWeight: 3
    };
}

async function initCommunityMap() {
    if (!el.map) return;
    updateShareUi();
    try {
        const maps = await loadGoogleMaps();
        state.map = new maps.Map(el.map, {
            center: { lat: 26.2124, lng: 127.6809 }, zoom: 9, mapTypeControl: false, streetViewControl: false
        });
        state.infoWindow = new maps.InfoWindow();
        state.map.addListener("click", onMapClick);
        state.mapReady = true;
    } catch (error) {
        console.warn("コミュニティマップを読み込めませんでした。", error);
        el.map.textContent = `地図を読み込めませんでした：${error.message}`;
        el.map.classList.add("map-error");
    }
    await loadLocations();
    state.pollTimer = setInterval(() => { if (!document.hidden) loadLocations(); }, 20000);
    // 前回の共有が有効期限内に残っていれば、そのまま追跡を再開する
    if (isMember() && state.locations.some((row) => row.user_id === state.user.id)) startSharing({ resume: true });
}

async function loadLocations() {
    try {
        state.locations = await getCommunityLocations(state.communityId);
    } catch (error) {
        console.warn("共有位置を取得できませんでした。", error);
        state.locations = [];
    }
    renderMapMarkers();
    updateShareUi();
}

function clearMarkers() {
    state.markers.forEach((marker) => marker.setMap(null));
    state.markers = [];
}

function addMarker(options, html) {
    const marker = new window.google.maps.Marker({ map: state.map, ...options });
    marker.addListener("click", () => {
        state.infoWindow.setContent(html);
        state.infoWindow.open({ map: state.map, anchor: marker });
    });
    state.markers.push(marker);
    return marker;
}

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function renderMapMarkers() {
    if (!state.mapReady) return;
    clearMarkers();
    const bounds = new window.google.maps.LatLngBounds();
    let count = 0;

    state.posts.filter(hasCoordinates).forEach((post) => {
        const position = { lat: Number(post.latitude), lng: Number(post.longitude) };
        addMarker({ position, title: post.location_name || "投稿の場所" },
            `<strong>${escapeHtml(displayName(post.profiles))}</strong><br>${escapeHtml(post.content.slice(0, 60))}${post.location_name ? `<br>📍 ${escapeHtml(post.location_name)}` : ""}`);
        bounds.extend(position); count += 1;
    });

    state.locations.forEach((row) => {
        const mine = row.user_id === state.user.id;
        // 自分は端末の最新位置を優先（サーバー反映を待たず滑らかに動く）
        const live = mine && state.share.current ? state.share.current : row;
        const position = { lat: Number(live.latitude), lng: Number(live.longitude) };
        const name = displayName(row.profile);
        addMarker({
            position, zIndex: mine ? 1000 : 500, title: `${name}の現在地`,
            icon: circleIcon(mine ? MAP_COLORS.me : MAP_COLORS.member),
            label: { text: name.charAt(0), color: "#ffffff", fontWeight: "700", fontSize: "12px" }
        }, `<strong>${escapeHtml(name)}${mine ? "（自分）" : ""}</strong><br>📍 ${escapeHtml(row.label || "現在地")}<br><small>${formatRelativeTime(row.updated_at)}に更新</small>`);
        bounds.extend(position); count += 1;
    });

    // 共有していなくても、端末の現在地が取れていれば自分を表示（共有開始直後など）
    if (state.share.current && !state.locations.some((row) => row.user_id === state.user.id)) {
        const position = { lat: state.share.current.latitude, lng: state.share.current.longitude };
        addMarker({ position, zIndex: 1000, title: "自分の現在地", icon: circleIcon(MAP_COLORS.me),
            label: { text: displayName(state.profile).charAt(0), color: "#ffffff", fontWeight: "700", fontSize: "12px" } }, "<strong>自分</strong>");
        bounds.extend(position); count += 1;
    }

    state.boundsCount = count;
    state.bounds = bounds;
    if (count && !state.fitted) fitMap();
}

function fitMap() {
    if (!state.mapReady || !state.boundsCount) return;
    state.fitted = true;
    state.map.fitBounds(state.bounds, 40);
    window.google.maps.event.addListenerOnce(state.map, "idle", () => {
        if (state.map.getZoom() > 16) state.map.setZoom(16);
    });
}

function focusMap(latitude, longitude, zoom = 16) {
    if (!state.mapReady) return;
    state.map.setCenter({ lat: latitude, lng: longitude });
    state.map.setZoom(zoom);
}

function focusPostOnMap(post) {
    focusMap(Number(post.latitude), Number(post.longitude), 17);
    $("communityMapSection")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function setPreviewMarker(latitude, longitude) {
    if (!state.mapReady) return;
    const position = { lat: latitude, lng: longitude };
    if (!state.previewMarker) {
        state.previewMarker = new window.google.maps.Marker({
            map: state.map, position, draggable: true, title: "投稿に付ける場所（ドラッグで移動）",
            animation: window.google.maps.Animation.DROP
        });
        state.previewMarker.addListener("dragend", (event) => onMapClick(event, true));
    } else state.previewMarker.setPosition(position);
}

function clearPreviewMarker() {
    state.previewMarker?.setMap(null);
    state.previewMarker = null;
}

/** 「場所」を開いているときだけ、マップのクリックで投稿の場所を決める */
function onMapClick(event, fromDrag = false) {
    if (el.locationSelector.hidden && !fromDrag) return;
    const latitude = event.latLng.lat();
    const longitude = event.latLng.lng();
    if (!isOkinawaCoordinate(latitude, longitude)) { showToast("沖縄県内の場所を選んでください。"); return; }
    setPostLocation({ name: state.location && fromDrag ? state.location : "地図で選んだ場所", latitude, longitude });
    if (!fromDrag) closeLocation();
}

/* ---------- 現在地の共有（自動追跡） ---------- */

function distanceMeters(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLng = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

async function reverseLabel(latitude, longitude) {
    try {
        const maps = await loadGoogleMaps();
        const { results } = await new maps.Geocoder().geocode({ location: { lat: latitude, lng: longitude }, language: "ja" });
        const parts = results?.[0]?.address_components || [];
        const pick = (type) => parts.find((part) => part.types.includes(type))?.long_name;
        const label = [pick("locality") || pick("administrative_area_level_2"), pick("sublocality_level_1")].filter(Boolean).join(" ");
        return label.slice(0, 60) || "現在地";
    } catch {
        return "現在地";
    }
}

function setShareMessage(text, type = "") {
    if (!el.shareMessage) return;
    el.shareMessage.textContent = text;
    el.shareMessage.classList.toggle("error", type === "error");
}

function updateShareUi() {
    if (!el.shareToggle) return;
    const active = state.share.active;
    const others = state.locations.filter((row) => row.user_id !== state.user.id).length;
    el.shareStatus.textContent = active ? "共有中" : "共有停止中";
    el.shareStatus.classList.toggle("on", active);
    el.shareStatus.classList.toggle("off", !active);
    el.shareToggle.textContent = active ? "■ 共有を停止する" : "📍 現在地を共有して追跡する";
    el.shareToggle.classList.toggle("stop", active);
    el.shareToggle.disabled = !isMember();
    el.centerMe.hidden = !state.share.current;
    if (!active && others) el.shareStatus.textContent = `共有停止中（${others}人が共有中）`;
    if (!isMember()) setShareMessage("コミュニティに参加すると、現在地を共有してメンバーの位置を見られます。");
}

function toggleSharing() {
    if (state.share.active) stopSharing(); else startSharing();
}

function startSharing({ resume = false } = {}) {
    if (!isMember() || state.share.watchId !== null) return;
    if (!navigator.geolocation) { setShareMessage("このブラウザでは現在地を取得できません。", "error"); return; }
    state.share.active = true;
    state.share.message = true;
    setShareMessage(resume ? "前回の共有を再開しています…" : "現在地を取得しています…（許可を求められたら「許可」を選んでください）");
    updateShareUi();
    state.share.watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
        enableHighAccuracy: true, maximumAge: 5000, timeout: 30000
    });
}

async function onPosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    const now = Date.now();
    state.share.current = { latitude, longitude, accuracy };
    renderMapMarkers();
    updateShareUi();

    const last = state.share.lastSent;
    // 15m以上動いたとき、または30秒ごとに送信（有効期限を延ばす役割も兼ねる）
    if (last && distanceMeters(last, state.share.current) < 15 && now - last.time < 30000) return;
    if (state.share.sending) return;
    state.share.sending = true;
    try {
        if (!state.share.label) state.share.label = await reverseLabel(latitude, longitude);
        await upsertCommunityLocation({ communityId: state.communityId, userId: state.user.id, label: state.share.label, latitude, longitude });
        state.share.lastSent = { latitude, longitude, time: now };
        const time = new Date(now).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
        setShareMessage(`共有中：${state.share.label}（${time}に更新・精度 約${Math.round(accuracy)}m）。ページを開いている間、自動で更新されます。`);
        if (!state.locations.some((row) => row.user_id === state.user.id)) await loadLocations();
    } catch (error) {
        console.error(error);
        setShareMessage(`位置を送信できませんでした：${error.message}`, "error");
    } finally { state.share.sending = false; }
}

function onPositionError(error) {
    if (error.code === 1) {
        stopSharing({ keepMessage: true });
        setShareMessage("位置情報の利用が許可されていません。ブラウザのアドレスバー付近の設定で「位置情報」を許可してください。", "error");
    } else {
        setShareMessage("現在地を取得できません。電波やGPSの状態を確認してください（取得でき次第、自動で再開します）。", "error");
    }
}

async function stopSharing({ keepMessage = false } = {}) {
    if (state.share.watchId !== null) navigator.geolocation.clearWatch(state.share.watchId);
    state.share.watchId = null;
    state.share.active = false;
    state.share.current = null;
    state.share.lastSent = null;
    state.share.label = "";
    state.share.message = keepMessage;
    try { await stopCommunityLocation(state.communityId, state.user.id); }
    catch (error) { console.warn("共有位置を削除できませんでした。", error); }
    if (!keepMessage) setShareMessage("共有を停止しました。あなたの現在地は、他のメンバーに表示されなくなりました。");
    await loadLocations();
}
