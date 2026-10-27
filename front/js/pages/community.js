"use strict";

import { getCurrentUser, listCommunities, getMyMemberships, joinCommunity } from "../api.js";

/* =========================================
   コミュニティ検索（DB連携版）
========================================= */

const $ = (id) => document.getElementById(id);
const COVER_CLASS = {
    "自然・海": "sea-community", "グルメ": "gourmet-community", "文化・伝統": "eisa-community",
    "地域": "naha-community", "スポーツ": "sports-community", "旅行・観光": "travel-community"
};
const COVER_FALLBACK = ["sea-community", "gourmet-community", "eisa-community", "naha-community", "sports-community", "travel-community"];
const coverClass = (name = "") => COVER_CLASS[name] || COVER_FALLBACK[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COVER_FALLBACK.length];
const VISIBILITY = {
    public: { icon: "🌐", label: "公開" },
    approval: { icon: "🔐", label: "承認制" },
    private: { icon: "🔒", label: "非公開" }
};

const els = {
    form: $("communitySearchForm"), input: $("communitySearchInput"), clear: $("clearSearchButton"),
    result: $("communitySearchResult"), empty: $("emptySearchResult"), resultText: $("searchResultText"),
    sort: $("communitySortSelect"), grid: $("gridViewButton"), list: $("listViewButton"),
    categories: $("categoryFilterList"), reset: $("resetFilterButton"), emptyReset: $("emptyResetButton"),
    modal: $("joinConfirmModal"), modalIcon: $("joinModalIcon"), modalName: $("joinModalCommunityName"),
    modalCategory: $("joinModalCommunityCategory"), modalTitle: $("joinConfirmTitle"),
    cancelJoin: $("cancelJoinButton"), confirmJoin: $("confirmJoinButton"), toast: $("communitySearchToast")
};

const state = { user: null, communities: [], memberships: {}, keyword: "", category: "すべて", sort: "recommended", scope: "all", joining: null, toastTimer: null };

const nf = new Intl.NumberFormat("ja-JP");
const df = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" });

function esc(value = "") {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML.replaceAll('"', "&quot;");
}

function showToast(message, type = "") {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.classList.remove("show", "success", "error");
    if (type) els.toast.classList.add(type);
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add("show"));
    state.toastTimer = setTimeout(() => {
        els.toast.classList.remove("show");
        setTimeout(() => { els.toast.hidden = true; }, 220);
    }, 2800);
}

/* ---------- データ取得 ---------- */

async function init() {
    try {
        state.user = await getCurrentUser();
        if (!state.user) { location.replace("../login.html"); return; }
        els.result.innerHTML = '<p class="search-loading">コミュニティを読み込んでいます…</p>';
        [state.communities, state.memberships] = await Promise.all([listCommunities(), getMyMemberships(state.user.id)]);
        bindEvents();
        render();
    } catch (error) {
        console.error(error);
        els.result.innerHTML = `<p class="search-loading">読み込めませんでした：${esc(error.message)}</p>`;
    }
}

/* ---------- 絞り込み・表示 ---------- */

function filtered() {
    const words = state.keyword.toLowerCase().split(/\s+/).filter(Boolean);
    const list = state.communities.filter((c) => {
        if (state.scope === "mine" && !["approved", "pending"].includes(state.memberships[c.id]?.status)) return false;
        if (state.category !== "すべて" && c.categoryName !== state.category) return false;
        const haystack = `${c.name} ${c.description || ""} ${c.categoryName}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
    });
    const created = (c) => new Date(c.created_at).getTime();
    const sorters = {
        recommended: (a, b) => (b.memberCount * 2 + b.postCount) - (a.memberCount * 2 + a.postCount),
        "members-desc": (a, b) => b.memberCount - a.memberCount,
        "members-asc": (a, b) => a.memberCount - b.memberCount,
        newest: (a, b) => created(b) - created(a),
        name: (a, b) => a.name.localeCompare(b.name, "ja")
    };
    return list.sort(sorters[state.sort] || sorters.recommended);
}

function joinButton(c) {
    const status = state.memberships[c.id]?.status;
    if (status === "approved") return '<button type="button" class="community-join-button joined" data-action="open-community">✓ 参加中</button>';
    if (status === "pending") return '<button type="button" class="community-join-button approval" disabled>承認待ち</button>';
    if (status === "rejected") return '<button type="button" class="community-join-button private" disabled>参加不可</button>';
    if (c.visibility === "public") return '<button type="button" class="community-join-button" data-action="join-community">＋ 参加する</button>';
    return '<button type="button" class="community-join-button approval" data-action="join-community">参加申請</button>';
}

function cardElement(c) {
    const card = document.createElement("article");
    card.className = "community-search-card";
    card.dataset.communityId = c.id;
    const isNew = Date.now() - new Date(c.created_at).getTime() < 7 * 24 * 3600 * 1000;
    const vis = VISIBILITY[c.visibility] || VISIBILITY.public;
    const cover = c.header_url
        ? `<img src="${esc(c.header_url)}" alt="">`
        : `<div class="community-cover-background ${coverClass(c.categoryName)}"></div>`;
    const icon = c.icon_url ? `<img src="${esc(c.icon_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : esc(c.icon_emoji || "🌺");
    card.innerHTML = `
        <div class="community-card-cover" data-action="open-community" tabindex="0" role="link" aria-label="${esc(c.name)}を開く">
            ${cover}
            <div class="community-card-badges">
                ${isNew ? '<span class="community-new-badge">NEW</span>' : ""}
                <span class="community-status-badge">${vis.icon} ${vis.label}</span>
            </div>
            <div class="community-card-icon" aria-hidden="true">${icon}</div>
        </div>
        <div class="community-card-body">
            <span class="community-card-category">${esc(c.categoryName)}</span>
            <h2 class="community-card-title" data-action="open-community">${esc(c.name)}</h2>
            <p class="community-card-description">${esc(c.description || "説明はまだありません。")}</p>
            <div class="community-card-meta">
                <div class="community-card-meta-group"><span>👥 ${nf.format(c.memberCount)}</span><span>💬 ${nf.format(c.postCount)}</span></div>
                <span>${df.format(new Date(c.created_at))}</span>
            </div>
            <div class="community-card-actions">
                <button type="button" class="community-detail-button" data-action="open-community">詳細を見る</button>
                ${joinButton(c)}
            </div>
        </div>`;
    return card;
}

function render() {
    const list = filtered();
    els.result.replaceChildren(...list.map(cardElement));
    els.empty.hidden = list.length > 0;
    els.result.hidden = list.length === 0;
    els.resultText.textContent = state.scope === "mine" && !list.length && !state.keyword && state.category === "すべて"
        ? "まだ参加しているコミュニティはありません"
        : `${list.length}件のコミュニティが見つかりました`;
    const mine = state.communities.filter((c) => ["approved", "pending"].includes(state.memberships[c.id]?.status)).length;
    const count = document.getElementById("mineCount");
    if (count) count.textContent = String(mine);
    els.clear.hidden = !els.input.value;
}

function setCategory(category) {
    state.category = category;
    els.categories.querySelectorAll(".category-filter-button").forEach((button) => {
        const active = button.dataset.category === category;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

function resetFilters() {
    els.input.value = ""; state.keyword = ""; els.sort.value = "recommended"; state.sort = "recommended";
    setCategory("すべて"); render();
}

function setMode(grid) {
    els.result.classList.toggle("list-view", !grid);
    els.grid.classList.toggle("active", grid); els.list.classList.toggle("active", !grid);
    els.grid.setAttribute("aria-pressed", String(grid)); els.list.setAttribute("aria-pressed", String(!grid));
}

/* ---------- 参加 ---------- */

function openJoinModal(community) {
    state.joining = community;
    const needsApproval = community.visibility !== "public";
    els.modalIcon.textContent = community.icon_emoji || "🌺";
    els.modalName.textContent = community.name;
    els.modalCategory.textContent = community.categoryName;
    els.modalTitle.textContent = needsApproval ? "参加を申請しますか？" : "コミュニティに参加しますか？";
    els.confirmJoin.textContent = needsApproval ? "申請する" : "参加する";
    els.modal.hidden = false;
    document.body.style.overflow = "hidden";
    els.confirmJoin.focus();
}

function closeJoinModal() { els.modal.hidden = true; document.body.style.overflow = ""; state.joining = null; }

async function confirmJoin() {
    const community = state.joining;
    if (!community) return;
    els.confirmJoin.disabled = true;
    try {
        const status = await joinCommunity(community, state.user.id);
        state.memberships[community.id] = { role: "member", status };
        if (status === "approved") community.memberCount += 1;
        closeJoinModal();
        render();
        showToast(status === "approved" ? `「${community.name}」に参加しました。` : "参加を申請しました。承認をお待ちください。", "success");
    } catch (error) {
        showToast(`参加できませんでした：${error.message}`, "error");
    } finally { els.confirmJoin.disabled = false; }
}

/* ---------- イベント ---------- */

function bindEvents() {
    els.form.addEventListener("submit", (e) => { e.preventDefault(); state.keyword = els.input.value.trim(); render(); });
    els.input.addEventListener("input", () => { state.keyword = els.input.value.trim(); render(); });
    els.clear.addEventListener("click", () => { els.input.value = ""; state.keyword = ""; render(); els.input.focus(); });
    document.querySelectorAll("[data-search-word]").forEach((button) => button.addEventListener("click", () => {
        els.input.value = button.dataset.searchWord; state.keyword = els.input.value; render();
    }));
    els.categories.addEventListener("click", (e) => {
        const button = e.target.closest(".category-filter-button");
        if (button) { setCategory(button.dataset.category); render(); }
    });
    els.sort.addEventListener("change", () => { state.sort = els.sort.value; render(); });
    els.grid.addEventListener("click", () => setMode(true));
    els.list.addEventListener("click", () => setMode(false));
    document.querySelectorAll(".scope-tab").forEach((tab) => tab.addEventListener("click", () => {
        state.scope = tab.dataset.scope;
        document.querySelectorAll(".scope-tab").forEach((t) => {
            const active = t === tab;
            t.classList.toggle("active", active);
            t.setAttribute("aria-selected", String(active));
        });
        render();
    }));
    els.reset.addEventListener("click", resetFilters);
    els.emptyReset.addEventListener("click", resetFilters);

    const handleCard = (e) => {
        const target = e.target.closest("[data-action]");
        const card = target?.closest(".community-search-card");
        const community = card && state.communities.find((c) => c.id === card.dataset.communityId);
        if (!community) return;
        if (target.dataset.action === "join-community") openJoinModal(community);
        else location.href = `community/community_home.html?id=${encodeURIComponent(community.id)}`;
    };
    els.result.addEventListener("click", handleCard);
    els.result.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches('[role="link"]')) handleCard(e); });

    els.cancelJoin.addEventListener("click", closeJoinModal);
    els.confirmJoin.addEventListener("click", confirmJoin);
    els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeJoinModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !els.modal.hidden) closeJoinModal(); });
}

document.addEventListener("DOMContentLoaded", init);
