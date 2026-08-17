"use strict";

/* =========================================
   コミュニティ一覧ページ
   community.js
========================================= */


/* =========================================
   保存に使用するキー
========================================= */

const STORAGE_KEYS = {
    joinedCommunities: "okinawaJoinedCommunities",
    selectedCommunity: "okinawaSelectedCommunity"
};


/* =========================================
   コミュニティデータ

   将来PHPやAPIから取得する場合は、
   この配列を置き換えれば対応できます。
========================================= */

const communityData = [
    {
        id: "sea",
        name: "沖縄の海好きコミュニティ",
        category: "自然・海",
        description:
            "沖縄の海やビーチ、マリンスポーツについて情報交換するコミュニティです。",
        icon: "🐠",
        memberCount: 128,
        postCount: 84,
        coverClass: "sea-community"
    },
    {
        id: "gourmet",
        name: "沖縄グルメ情報交換",
        category: "グルメ",
        description:
            "沖縄そば、タコライス、カフェなど、おすすめのお店を共有しましょう。",
        icon: "🍜",
        memberCount: 245,
        postCount: 163,
        coverClass: "gourmet-community"
    },
    {
        id: "eisa",
        name: "エイサー好き集まれ",
        category: "文化・伝統",
        description:
            "エイサーのイベント情報や練習風景、地域の青年会について語るコミュニティです。",
        icon: "🥁",
        memberCount: 96,
        postCount: 57,
        coverClass: "eisa-community"
    },
    {
        id: "naha",
        name: "那覇市コミュニティ",
        category: "地域",
        description:
            "那覇市のイベント、お店、暮らしに関する情報を共有する地域コミュニティです。",
        icon: "🏙️",
        memberCount: 184,
        postCount: 119,
        coverClass: "naha-community"
    },
    {
        id: "sports",
        name: "沖縄スポーツ交流会",
        category: "スポーツ",
        description:
            "野球、サッカー、バスケットボールなど、沖縄のスポーツ情報を共有します。",
        icon: "⚽",
        memberCount: 77,
        postCount: 42,
        coverClass: "sports-community"
    },
    {
        id: "travel",
        name: "沖縄おでかけ情報",
        category: "旅行・観光",
        description:
            "休日のおでかけ先や観光スポット、ドライブコースを紹介し合いましょう。",
        icon: "🚗",
        memberCount: 153,
        postCount: 91,
        coverClass: "travel-community"
    }
];


/* =========================================
   初期状態で参加済みにするコミュニティ

   初回表示時のみ使用します。
========================================= */

const defaultJoinedCommunityIds = [
    "sea",
    "gourmet",
    "eisa",
    "naha"
];


/* =========================================
   HTML要素
========================================= */

const elements = {
    communityCount:
        document.getElementById("communityCount"),

    communityLoading:
        document.getElementById("communityLoading"),

    joinedCommunitySection:
        document.getElementById("joinedCommunitySection"),

    joinedCommunityGrid:
        document.getElementById("joinedCommunityGrid"),

    emptyCommunity:
        document.getElementById("emptyCommunity"),

    recommendedSection:
        document.getElementById("recommendedSection"),

    recommendedCommunityGrid:
        document.getElementById("recommendedCommunityGrid"),

    allJoinedMessage:
        document.getElementById("allJoinedMessage"),

    communityError:
        document.getElementById("communityError"),

    communityErrorMessage:
        document.getElementById("communityErrorMessage"),

    reloadCommunityButton:
        document.getElementById("reloadCommunityButton"),

    communityCardTemplate:
        document.getElementById("communityCardTemplate"),

    communityToast:
        document.getElementById("communityToast")
};


/* =========================================
   初期化
========================================= */

document.addEventListener("DOMContentLoaded", initializeCommunityPage);


/**
 * コミュニティ一覧ページを初期化します。
 */
function initializeCommunityPage() {
    try {
        validateRequiredElements();
        initializeJoinedCommunities();
        registerEventListeners();
        renderCommunityPage();
    } catch (error) {
        console.error("コミュニティページの初期化に失敗しました。", error);

        showError(
            "コミュニティ情報の読み込み中に問題が発生しました。"
        );
    }
}


/* =========================================
   必須要素の確認
========================================= */

/**
 * JavaScriptで使用するHTML要素が存在するか確認します。
 */
function validateRequiredElements() {
    const requiredElements = [
        "communityCount",
        "communityLoading",
        "joinedCommunitySection",
        "joinedCommunityGrid",
        "emptyCommunity",
        "recommendedSection",
        "recommendedCommunityGrid",
        "allJoinedMessage",
        "communityError",
        "communityCardTemplate",
        "communityToast"
    ];

    const missingElements = requiredElements.filter(
        (key) => !elements[key]
    );

    if (missingElements.length > 0) {
        throw new Error(
            `必要なHTML要素が見つかりません: ${missingElements.join(", ")}`
        );
    }
}


/* =========================================
   イベント登録
========================================= */

/**
 * ページ内のイベントを登録します。
 */
function registerEventListeners() {
    elements.joinedCommunityGrid.addEventListener(
        "click",
        handleCommunityGridClick
    );

    elements.recommendedCommunityGrid.addEventListener(
        "click",
        handleCommunityGridClick
    );

    if (elements.reloadCommunityButton) {
        elements.reloadCommunityButton.addEventListener(
            "click",
            handleReload
        );
    }
}


/* =========================================
   LocalStorage初期設定
========================================= */

/**
 * 初回アクセス時に参加中コミュニティを設定します。
 */
function initializeJoinedCommunities() {
    const storedValue = localStorage.getItem(
        STORAGE_KEYS.joinedCommunities
    );

    if (storedValue !== null) {
        return;
    }

    saveJoinedCommunityIds(defaultJoinedCommunityIds);
}


/* =========================================
   ページ全体の描画
========================================= */

/**
 * 参加中・おすすめコミュニティをまとめて描画します。
 */
function renderCommunityPage() {
    hideError();
    showLoading();

    try {
        const joinedIds = getJoinedCommunityIds();

        const joinedCommunities = communityData.filter(
            (community) => joinedIds.includes(community.id)
        );

        const recommendedCommunities = communityData.filter(
            (community) => !joinedIds.includes(community.id)
        );

        renderJoinedCommunities(joinedCommunities);
        renderRecommendedCommunities(recommendedCommunities);
        updateCommunityCount(joinedCommunities.length);

        hideLoading();
    } catch (error) {
        console.error("コミュニティの描画に失敗しました。", error);

        showError(
            "コミュニティ情報を表示できませんでした。"
        );
    }
}


/* =========================================
   参加中コミュニティ描画
========================================= */

/**
 * 参加中コミュニティを表示します。
 *
 * @param {Array<Object>} joinedCommunities
 */
function renderJoinedCommunities(joinedCommunities) {
    elements.joinedCommunityGrid.replaceChildren();

    if (joinedCommunities.length === 0) {
        elements.joinedCommunitySection.hidden = true;
        elements.emptyCommunity.hidden = false;
        return;
    }

    elements.emptyCommunity.hidden = true;
    elements.joinedCommunitySection.hidden = false;

    const fragment = document.createDocumentFragment();

    joinedCommunities.forEach((community) => {
        const card = createCommunityCard(
            community,
            true
        );

        fragment.appendChild(card);
    });

    elements.joinedCommunityGrid.appendChild(fragment);
}


/* =========================================
   おすすめコミュニティ描画
========================================= */

/**
 * 未参加のおすすめコミュニティを表示します。
 *
 * @param {Array<Object>} recommendedCommunities
 */
function renderRecommendedCommunities(
    recommendedCommunities
) {
    elements.recommendedCommunityGrid.replaceChildren();

    if (recommendedCommunities.length === 0) {
        elements.recommendedSection.hidden = true;
        elements.allJoinedMessage.hidden = false;
        return;
    }

    elements.allJoinedMessage.hidden = true;
    elements.recommendedSection.hidden = false;

    const fragment = document.createDocumentFragment();

    recommendedCommunities.forEach((community) => {
        const card = createCommunityCard(
            community,
            false
        );

        fragment.appendChild(card);
    });

    elements.recommendedCommunityGrid.appendChild(fragment);
}


/* =========================================
   カード生成
========================================= */

/**
 * コミュニティカードを生成します。
 *
 * @param {Object} community
 * @param {boolean} isJoined
 * @returns {HTMLElement}
 */
function createCommunityCard(
    community,
    isJoined
) {
    const templateContent =
        elements.communityCardTemplate.content.cloneNode(true);

    const card =
        templateContent.querySelector(".community-card");

    const cover =
        templateContent.querySelector(".community-cover");

    const coverIcon =
        templateContent.querySelector(".community-cover-icon");

    const categoryLabel =
        templateContent.querySelector(".category-label");

    const joinedLabel =
        templateContent.querySelector(".joined-label");

    const name =
        templateContent.querySelector(".community-card-name");

    const description =
        templateContent.querySelector(".community-description");

    const memberCount =
        templateContent.querySelector(".community-member-count");

    const postCount =
        templateContent.querySelector(".community-post-count");

    const openLink =
        templateContent.querySelector(".community-open");

    const joinButton =
        templateContent.querySelector(".join-community-button");

    card.dataset.communityId = community.id;

    cover.classList.add(community.coverClass);
    coverIcon.textContent = community.icon;

    categoryLabel.textContent = community.category;
    name.textContent = community.name;
    description.textContent = community.description;

    memberCount.textContent =
        formatCount(community.memberCount, "人");

    postCount.textContent =
        formatCount(community.postCount, "件");

    if (isJoined) {
        joinedLabel.hidden = false;

        openLink.hidden = false;
        openLink.href =
            `community/community_home.html?id=${encodeURIComponent(
                community.id
            )}`;

        openLink.dataset.action = "open";
        openLink.dataset.communityId = community.id;

        joinButton.hidden = true;
    } else {
        joinedLabel.hidden = true;
        openLink.hidden = true;

        joinButton.hidden = false;
        joinButton.dataset.communityId = community.id;

        joinButton.setAttribute(
            "aria-label",
            `${community.name}に参加する`
        );
    }

    return card;
}


/* =========================================
   カード内のクリック処理
========================================= */

/**
 * コミュニティカード内のクリックを処理します。
 *
 * @param {MouseEvent} event
 */
function handleCommunityGridClick(event) {
    const joinButton = event.target.closest(
        '[data-action="join"]'
    );

    if (joinButton) {
        const communityId =
            joinButton.dataset.communityId;

        handleJoinCommunity(
            communityId,
            joinButton
        );

        return;
    }

    const openLink = event.target.closest(
        '[data-action="open"]'
    );

    if (openLink) {
        const communityId =
            openLink.dataset.communityId;

        saveSelectedCommunity(communityId);
    }
}


/* =========================================
   コミュニティ参加処理
========================================= */

/**
 * 指定したコミュニティに参加します。
 *
 * @param {string} communityId
 * @param {HTMLButtonElement} button
 */
function handleJoinCommunity(
    communityId,
    button
) {
    const community = getCommunityById(communityId);

    if (!community) {
        showToast(
            "コミュニティ情報が見つかりませんでした。"
        );

        return;
    }

    const joinedIds = getJoinedCommunityIds();

    if (joinedIds.includes(communityId)) {
        showToast(
            "すでにこのコミュニティに参加しています。"
        );

        renderCommunityPage();
        return;
    }

    setButtonLoading(button, true);

    try {
        const updatedJoinedIds = [
            ...joinedIds,
            communityId
        ];

        saveJoinedCommunityIds(updatedJoinedIds);
        saveSelectedCommunity(communityId);

        showToast(
            `${community.name}に参加しました。`
        );

        renderCommunityPage();
    } catch (error) {
        console.error(
            "コミュニティへの参加に失敗しました。",
            error
        );

        showToast(
            "コミュニティに参加できませんでした。"
        );
    } finally {
        setButtonLoading(button, false);
    }
}


/* =========================================
   ボタンの読み込み状態
========================================= */

/**
 * 参加ボタンの処理中表示を切り替えます。
 *
 * @param {HTMLButtonElement} button
 * @param {boolean} isLoading
 */
function setButtonLoading(
    button,
    isLoading
) {
    if (!button) {
        return;
    }

    if (isLoading) {
        button.disabled = true;
        button.textContent = "参加中...";
        button.setAttribute("aria-busy", "true");
    } else {
        button.disabled = false;
        button.textContent = "参加する";
        button.removeAttribute("aria-busy");
    }
}


/* =========================================
   件数表示
========================================= */

/**
 * 参加中コミュニティ件数を表示します。
 *
 * @param {number} count
 */
function updateCommunityCount(count) {
    elements.communityCount.textContent =
        `${count}件`;
}


/* =========================================
   LocalStorage読み込み
========================================= */

/**
 * 参加中コミュニティIDを取得します。
 *
 * @returns {Array<string>}
 */
function getJoinedCommunityIds() {
    const storedValue = localStorage.getItem(
        STORAGE_KEYS.joinedCommunities
    );

    if (!storedValue) {
        return [];
    }

    try {
        const parsedValue = JSON.parse(storedValue);

        if (!Array.isArray(parsedValue)) {
            return [];
        }

        return normalizeCommunityIds(parsedValue);
    } catch (error) {
        console.warn(
            "参加中コミュニティの保存データを読み込めませんでした。",
            error
        );

        return [];
    }
}


/* =========================================
   LocalStorage保存
========================================= */

/**
 * 参加中コミュニティIDを保存します。
 *
 * @param {Array<string>} communityIds
 */
function saveJoinedCommunityIds(communityIds) {
    const normalizedIds =
        normalizeCommunityIds(communityIds);

    localStorage.setItem(
        STORAGE_KEYS.joinedCommunities,
        JSON.stringify(normalizedIds)
    );
}


/**
 * 最後に選択したコミュニティを保存します。
 *
 * @param {string} communityId
 */
function saveSelectedCommunity(communityId) {
    const community = getCommunityById(communityId);

    if (!community) {
        return;
    }

    localStorage.setItem(
        STORAGE_KEYS.selectedCommunity,
        JSON.stringify({
            id: community.id,
            name: community.name,
            savedAt: new Date().toISOString()
        })
    );
}


/* =========================================
   コミュニティID整形
========================================= */

/**
 * 保存対象として正しいコミュニティIDだけを残します。
 *
 * @param {Array<unknown>} communityIds
 * @returns {Array<string>}
 */
function normalizeCommunityIds(communityIds) {
    const validCommunityIds = new Set(
        communityData.map(
            (community) => community.id
        )
    );

    const normalizedIds = communityIds
        .filter(
            (id) =>
                typeof id === "string" &&
                validCommunityIds.has(id)
        );

    return [...new Set(normalizedIds)];
}


/* =========================================
   コミュニティ検索
========================================= */

/**
 * IDからコミュニティを取得します。
 *
 * @param {string} communityId
 * @returns {Object|null}
 */
function getCommunityById(communityId) {
    return communityData.find(
        (community) =>
            community.id === communityId
    ) ?? null;
}


/* =========================================
   数値表示
========================================= */

/**
 * 人数や投稿数を見やすく整形します。
 *
 * @param {number} value
 * @param {string} suffix
 * @returns {string}
 */
function formatCount(value, suffix) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return `0${suffix}`;
    }

    return `${number.toLocaleString("ja-JP")}${suffix}`;
}


/* =========================================
   読み込み表示
========================================= */

/**
 * 読み込み中表示を出します。
 */
function showLoading() {
    elements.communityLoading.hidden = false;

    elements.joinedCommunitySection.hidden = true;
    elements.emptyCommunity.hidden = true;
    elements.recommendedSection.hidden = true;
    elements.allJoinedMessage.hidden = true;
    elements.communityError.hidden = true;
}


/**
 * 読み込み中表示を消します。
 */
function hideLoading() {
    elements.communityLoading.hidden = true;
}


/* =========================================
   エラー表示
========================================= */

/**
 * エラー画面を表示します。
 *
 * @param {string} message
 */
function showError(message) {
    hideLoading();

    elements.joinedCommunitySection.hidden = true;
    elements.emptyCommunity.hidden = true;
    elements.recommendedSection.hidden = true;
    elements.allJoinedMessage.hidden = true;

    elements.communityError.hidden = false;

    if (elements.communityErrorMessage) {
        elements.communityErrorMessage.textContent = message;
    }
}


/**
 * エラー画面を非表示にします。
 */
function hideError() {
    elements.communityError.hidden = true;
}


/* =========================================
   再読み込み
========================================= */

/**
 * ページを再読み込みします。
 */
function handleReload() {
    window.location.reload();
}


/* =========================================
   トーストメッセージ
========================================= */

let toastTimerId = null;


/**
 * 画面下部に一時メッセージを表示します。
 *
 * @param {string} message
 */
function showToast(message) {
    if (!elements.communityToast) {
        return;
    }

    if (toastTimerId !== null) {
        window.clearTimeout(toastTimerId);
    }

    elements.communityToast.textContent = message;
    elements.communityToast.hidden = false;
    elements.communityToast.classList.add("show");

    toastTimerId = window.setTimeout(() => {
        elements.communityToast.classList.remove("show");

        window.setTimeout(() => {
            elements.communityToast.hidden = true;
        }, 200);
    }, 2600);
}