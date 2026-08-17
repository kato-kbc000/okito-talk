"use strict";

/* =========================================
   community_search.js
========================================= */


/* =========================================
   LocalStorageキー
========================================= */

const STORAGE_KEYS = {
    communities: "okinawaCommunities",
    joinedCommunities: "okinawaJoinedCommunities",
    selectedCommunity: "okinawaSelectedCommunity"
};


/* =========================================
   初期コミュニティデータ
========================================= */

const DEFAULT_COMMUNITIES = [
    {
        id: "sea",
        name: "沖縄の海好き",
        category: "自然・海",
        description:
            "沖縄のきれいな海やビーチ、ダイビング、シュノーケリングについて情報交換するコミュニティです。",
        icon: "🌊",
        cover: "",
        coverClass: "sea-community",
        visibility: "public",
        memberCount: 1280,
        postCount: 346,
        createdAt: "2026-01-15T09:00:00.000Z",
        recommendedScore: 100
    },
    {
        id: "gourmet",
        name: "沖縄グルメ巡り",
        category: "グルメ",
        description:
            "沖縄そば、タコライス、カフェなど、沖縄のおいしいお店をみんなで共有しましょう。",
        icon: "🍜",
        cover: "",
        coverClass: "gourmet-community",
        visibility: "public",
        memberCount: 950,
        postCount: 289,
        createdAt: "2026-02-02T10:00:00.000Z",
        recommendedScore: 95
    },
    {
        id: "eisa",
        name: "エイサーを楽しもう",
        category: "文化・伝統",
        description:
            "エイサーが好きな人、演舞に参加している人、沖縄の伝統文化に興味がある人の交流場所です。",
        icon: "🥁",
        cover: "",
        coverClass: "eisa-community",
        visibility: "public",
        memberCount: 720,
        postCount: 175,
        createdAt: "2026-02-20T11:00:00.000Z",
        recommendedScore: 90
    },
    {
        id: "naha",
        name: "那覇市ゆんたく広場",
        category: "地域",
        description:
            "那覇市のイベント、お店、地域情報などを共有するためのコミュニティです。",
        icon: "📍",
        cover: "",
        coverClass: "naha-community",
        visibility: "public",
        memberCount: 640,
        postCount: 214,
        createdAt: "2026-03-01T08:30:00.000Z",
        recommendedScore: 87
    },
    {
        id: "sports",
        name: "沖縄スポーツ仲間",
        category: "スポーツ",
        description:
            "サッカー、バスケットボール、野球などを一緒に楽しむ仲間を探せます。",
        icon: "⚽",
        cover: "",
        coverClass: "sports-community",
        visibility: "approval",
        memberCount: 510,
        postCount: 138,
        createdAt: "2026-03-15T13:00:00.000Z",
        recommendedScore: 82
    },
    {
        id: "travel",
        name: "沖縄旅行・観光情報",
        category: "旅行・観光",
        description:
            "沖縄の観光地や穴場スポット、ホテル、移動方法などの情報を共有するコミュニティです。",
        icon: "🏝️",
        cover: "",
        coverClass: "travel-community",
        visibility: "public",
        memberCount: 1420,
        postCount: 422,
        createdAt: "2026-01-28T14:00:00.000Z",
        recommendedScore: 98
    },
    {
        id: "cafe",
        name: "沖縄カフェ部",
        category: "グルメ",
        description:
            "沖縄県内のおしゃれなカフェや新しくオープンしたお店を紹介し合いましょう。",
        icon: "☕",
        cover: "",
        coverClass: "gourmet-community",
        visibility: "public",
        memberCount: 830,
        postCount: 265,
        createdAt: "2026-04-03T10:30:00.000Z",
        recommendedScore: 91
    },
    {
        id: "game",
        name: "うちなーゲーム交流会",
        category: "趣味",
        description:
            "沖縄のゲーム好きが集まり、好きなゲームやオンライン交流について話すコミュニティです。",
        icon: "🎮",
        cover: "",
        coverClass: "hobby-community",
        visibility: "public",
        memberCount: 390,
        postCount: 126,
        createdAt: "2026-05-10T18:00:00.000Z",
        recommendedScore: 74
    },
    {
        id: "music",
        name: "沖縄音楽好き",
        category: "趣味",
        description:
            "三線、沖縄民謡、ロック、ポップスなど、音楽が好きな人同士で交流できます。",
        icon: "🎵",
        cover: "",
        coverClass: "music-community",
        visibility: "public",
        memberCount: 610,
        postCount: 192,
        createdAt: "2026-04-22T16:00:00.000Z",
        recommendedScore: 83
    },
    {
        id: "festival",
        name: "沖縄イベント情報",
        category: "イベント",
        description:
            "県内のお祭り、マルシェ、ライブ、地域イベントなどの開催情報を共有します。",
        icon: "🎉",
        cover: "",
        coverClass: "event-community",
        visibility: "public",
        memberCount: 780,
        postCount: 207,
        createdAt: "2026-06-01T12:00:00.000Z",
        recommendedScore: 88
    },
    {
        id: "local-private",
        name: "沖縄同級生交流会",
        category: "その他",
        description:
            "招待されたメンバーだけで交流する非公開コミュニティです。",
        icon: "🤝",
        cover: "",
        coverClass: "other-community",
        visibility: "private",
        memberCount: 35,
        postCount: 58,
        createdAt: "2026-05-25T09:30:00.000Z",
        recommendedScore: 55
    }
];


/* =========================================
   DOM取得
========================================= */

const communitySearchForm =
    document.getElementById("communitySearchForm");

const communitySearchInput =
    document.getElementById("communitySearchInput");

const clearSearchButton =
    document.getElementById("clearSearchButton");

const categoryFilterList =
    document.getElementById("categoryFilterList");

const resetFilterButton =
    document.getElementById("resetFilterButton");

const communitySortSelect =
    document.getElementById("communitySortSelect");

const gridViewButton =
    document.getElementById("gridViewButton");

const listViewButton =
    document.getElementById("listViewButton");

const communitySearchResult =
    document.getElementById("communitySearchResult");

const emptySearchResult =
    document.getElementById("emptySearchResult");

const emptyResetButton =
    document.getElementById("emptyResetButton");

const searchResultText =
    document.getElementById("searchResultText");

const joinConfirmModal =
    document.getElementById("joinConfirmModal");

const joinModalIcon =
    document.getElementById("joinModalIcon");

const joinModalCommunityName =
    document.getElementById("joinModalCommunityName");

const joinModalCommunityCategory =
    document.getElementById("joinModalCommunityCategory");

const cancelJoinButton =
    document.getElementById("cancelJoinButton");

const confirmJoinButton =
    document.getElementById("confirmJoinButton");

const communitySearchToast =
    document.getElementById("communitySearchToast");


/* =========================================
   ページ状態
========================================= */

let allCommunities = [];

let joinedCommunityIds = [];

let selectedCategory = "すべて";

let currentSearchWord = "";

let currentSort = "recommended";

let currentDisplayMode = "grid";

let pendingJoinCommunityId = null;

let toastTimer = null;

let lastFocusedElement = null;


/* =========================================
   初期化
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeCommunitySearch
);


/**
 * ページを初期化します。
 */
function initializeCommunitySearch() {

    if (!communitySearchResult) {
        return;
    }

    allCommunities = loadAllCommunities();

    joinedCommunityIds =
        loadJoinedCommunityIds();

    bindSearchEvents();
    bindCategoryEvents();
    bindSortEvents();
    bindDisplayModeEvents();
    bindCommunityCardEvents();
    bindModalEvents();
    bindKeyboardEvents();

    renderCommunities();

}


/* =========================================
   データ読み込み
========================================= */

/**
 * 初期コミュニティと作成済みコミュニティを結合します。
 *
 * @returns {Object[]}
 */
function loadAllCommunities() {

    const savedCommunities =
        readStorageArray(STORAGE_KEYS.communities);

    const communityMap = new Map();

    DEFAULT_COMMUNITIES.forEach(community => {

        communityMap.set(
            community.id,
            normalizeCommunity(community)
        );

    });

    savedCommunities.forEach(community => {

        if (
            !community ||
            typeof community !== "object" ||
            !community.id
        ) {
            return;
        }

        communityMap.set(
            community.id,
            normalizeCommunity(community)
        );

    });

    return [...communityMap.values()];

}


/**
 * データの不足項目を補います。
 *
 * @param {Object} community
 * @returns {Object}
 */
function normalizeCommunity(community) {

    return {
        id:
            String(
                community.id ||
                generateTemporaryId()
            ),

        name:
            String(
                community.name ||
                "名称未設定のコミュニティ"
            ),

        category:
            String(
                community.category ||
                "その他"
            ),

        description:
            String(
                community.description ||
                "コミュニティの説明はありません。"
            ),

        icon:
            String(
                community.icon ||
                "🌺"
            ),

        cover:
            typeof community.cover === "string"
                ? community.cover
                : "",

        coverClass:
            String(
                community.coverClass ||
                getCoverClassByCategory(
                    community.category
                )
            ),

        visibility:
            String(
                community.visibility ||
                "public"
            ),

        memberCount:
            Number.isFinite(
                Number(community.memberCount)
            )
                ? Number(community.memberCount)
                : 1,

        postCount:
            Number.isFinite(
                Number(community.postCount)
            )
                ? Number(community.postCount)
                : 0,

        createdAt:
            community.createdAt ||
            new Date().toISOString(),

        recommendedScore:
            Number.isFinite(
                Number(community.recommendedScore)
            )
                ? Number(community.recommendedScore)
                : 70,

        isCustom:
            Boolean(community.isCustom)
    };

}


/**
 * 参加中コミュニティIDを読み込みます。
 *
 * @returns {string[]}
 */
function loadJoinedCommunityIds() {

    const storedItems =
        readStorageArray(
            STORAGE_KEYS.joinedCommunities
        );

    return storedItems
        .map(item => {

            if (typeof item === "string") {
                return item;
            }

            if (
                item &&
                typeof item === "object" &&
                item.id
            ) {
                return String(item.id);
            }

            return "";

        })
        .filter(Boolean);

}


/**
 * LocalStorageから配列を読み込みます。
 *
 * @param {string} key
 * @returns {Array}
 */
function readStorageArray(key) {

    const storedValue =
        localStorage.getItem(key);

    if (!storedValue) {
        return [];
    }

    try {

        const parsedValue =
            JSON.parse(storedValue);

        return Array.isArray(parsedValue)
            ? parsedValue
            : [];

    } catch (error) {

        console.warn(
            `${key}の読み込みに失敗しました。`,
            error
        );

        return [];

    }

}


/* =========================================
   検索
========================================= */

/**
 * 検索イベントを登録します。
 */
function bindSearchEvents() {

    communitySearchForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            currentSearchWord =
                communitySearchInput.value.trim();

            renderCommunities();

        }
    );


    communitySearchInput.addEventListener(
        "input",
        () => {

            currentSearchWord =
                communitySearchInput.value.trim();

            clearSearchButton.hidden =
                !communitySearchInput.value;

            renderCommunities();

        }
    );


    clearSearchButton.addEventListener(
        "click",
        () => {

            communitySearchInput.value = "";
            currentSearchWord = "";

            clearSearchButton.hidden = true;

            communitySearchInput.focus();

            renderCommunities();

        }
    );


    document
        .querySelectorAll(
            ".search-suggestion-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const searchWord =
                        button.dataset.searchWord || "";

                    communitySearchInput.value =
                        searchWord;

                    currentSearchWord =
                        searchWord;

                    clearSearchButton.hidden =
                        false;

                    renderCommunities();

                }
            );

        });


    resetFilterButton.addEventListener(
        "click",
        resetSearchConditions
    );


    emptyResetButton.addEventListener(
        "click",
        resetSearchConditions
    );

}


/**
 * 検索条件を初期状態へ戻します。
 */
function resetSearchConditions() {

    communitySearchInput.value = "";

    clearSearchButton.hidden = true;

    currentSearchWord = "";
    selectedCategory = "すべて";
    currentSort = "recommended";

    communitySortSelect.value =
        "recommended";

    updateCategoryButtonState();

    renderCommunities();

}


/* =========================================
   カテゴリー
========================================= */

/**
 * カテゴリーイベントを登録します。
 */
function bindCategoryEvents() {

    categoryFilterList.addEventListener(
        "click",
        event => {

            const categoryButton =
                event.target.closest(
                    ".category-filter-button"
                );

            if (!categoryButton) {
                return;
            }

            selectedCategory =
                categoryButton.dataset.category ||
                "すべて";

            updateCategoryButtonState();

            renderCommunities();

        }
    );

}


/**
 * カテゴリーボタンの状態を更新します。
 */
function updateCategoryButtonState() {

    const categoryButtons =
        categoryFilterList.querySelectorAll(
            ".category-filter-button"
        );

    categoryButtons.forEach(button => {

        const isActive =
            button.dataset.category ===
            selectedCategory;

        button.classList.toggle(
            "active",
            isActive
        );

        button.setAttribute(
            "aria-pressed",
            String(isActive)
        );

    });

}


/* =========================================
   並び替え
========================================= */

/**
 * 並び替えイベントを登録します。
 */
function bindSortEvents() {

    communitySortSelect.addEventListener(
        "change",
        () => {

            currentSort =
                communitySortSelect.value;

            renderCommunities();

        }
    );

}


/* =========================================
   表示形式
========================================= */

/**
 * 表示形式切り替えイベントを登録します。
 */
function bindDisplayModeEvents() {

    gridViewButton.addEventListener(
        "click",
        () => {
            changeDisplayMode("grid");
        }
    );


    listViewButton.addEventListener(
        "click",
        () => {
            changeDisplayMode("list");
        }
    );

}


/**
 * 表示形式を変更します。
 *
 * @param {"grid"|"list"} mode
 */
function changeDisplayMode(mode) {

    currentDisplayMode = mode;

    const isGrid = mode === "grid";

    communitySearchResult.classList.toggle(
        "list-view",
        !isGrid
    );

    gridViewButton.classList.toggle(
        "active",
        isGrid
    );

    listViewButton.classList.toggle(
        "active",
        !isGrid
    );

    gridViewButton.setAttribute(
        "aria-pressed",
        String(isGrid)
    );

    listViewButton.setAttribute(
        "aria-pressed",
        String(!isGrid)
    );

}


/* =========================================
   絞り込み・並び替え
========================================= */

/**
 * 表示対象コミュニティを取得します。
 *
 * @returns {Object[]}
 */
function getFilteredCommunities() {

    const normalizedSearchWord =
        normalizeSearchText(currentSearchWord);

    const filteredCommunities =
        allCommunities.filter(community => {

            const matchesCategory =
                selectedCategory === "すべて" ||
                community.category ===
                    selectedCategory;

            if (!matchesCategory) {
                return false;
            }

            if (!normalizedSearchWord) {
                return true;
            }

            const searchTarget =
                normalizeSearchText(
                    [
                        community.name,
                        community.category,
                        community.description
                    ].join(" ")
                );

            return searchTarget.includes(
                normalizedSearchWord
            );

        });

    return sortCommunities(
        filteredCommunities
    );

}


/**
 * コミュニティを並び替えます。
 *
 * @param {Object[]} communities
 * @returns {Object[]}
 */
function sortCommunities(communities) {

    const sortedCommunities =
        [...communities];

    switch (currentSort) {

        case "members-desc":

            sortedCommunities.sort(
                (a, b) =>
                    b.memberCount -
                    a.memberCount
            );

            break;


        case "members-asc":

            sortedCommunities.sort(
                (a, b) =>
                    a.memberCount -
                    b.memberCount
            );

            break;


        case "newest":

            sortedCommunities.sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            );

            break;


        case "name":

            sortedCommunities.sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name,
                        "ja"
                    )
            );

            break;


        case "recommended":
        default:

            sortedCommunities.sort(
                (a, b) =>
                    b.recommendedScore -
                    a.recommendedScore
            );

            break;

    }

    return sortedCommunities;

}


/**
 * 検索比較用の文字列へ変換します。
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeSearchText(text) {

    return String(text)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/g, "");

}


/* =========================================
   描画
========================================= */

/**
 * 検索結果を描画します。
 */
function renderCommunities() {

    const filteredCommunities =
        getFilteredCommunities();

    communitySearchResult.innerHTML = "";

    searchResultText.textContent =
        `${filteredCommunities.length}件のコミュニティが見つかりました`;

    if (filteredCommunities.length === 0) {

        communitySearchResult.hidden = true;
        emptySearchResult.hidden = false;

        return;
    }

    communitySearchResult.hidden = false;
    emptySearchResult.hidden = true;

    const fragment =
        document.createDocumentFragment();

    filteredCommunities.forEach(
        community => {

            fragment.appendChild(
                createCommunityCard(community)
            );

        }
    );

    communitySearchResult.appendChild(
        fragment
    );

    changeDisplayMode(currentDisplayMode);

}


/**
 * コミュニティカードを作成します。
 *
 * @param {Object} community
 * @returns {HTMLElement}
 */
function createCommunityCard(community) {

    const card =
        document.createElement("article");

    card.className =
        "community-search-card";

    card.dataset.communityId =
        community.id;

    const isJoined =
        joinedCommunityIds.includes(
            community.id
        );

    const isNew =
        isNewCommunity(
            community.createdAt
        );

    const visibilityDisplay =
        getVisibilityDisplay(
            community.visibility
        );

    const coverHtml =
        community.cover
            ? `
                <img
                    src="${escapeAttribute(
                        community.cover
                    )}"
                    alt=""
                >
            `
            : `
                <div
                    class="community-cover-background ${escapeAttribute(
                        community.coverClass
                    )}"
                ></div>
            `;

    card.innerHTML = `
        <div
            class="community-card-cover"
            data-action="open-community"
            tabindex="0"
            role="link"
            aria-label="${escapeAttribute(
                community.name
            )}を開く"
        >
            ${coverHtml}

            <div class="community-card-badges">
                ${
                    isNew
                        ? `
                            <span class="community-new-badge">
                                NEW
                            </span>
                        `
                        : ""
                }

                <span class="community-status-badge">
                    ${visibilityDisplay.icon}
                    ${visibilityDisplay.label}
                </span>
            </div>

            <div
                class="community-card-icon"
                aria-hidden="true"
            >
                ${escapeHtml(community.icon)}
            </div>
        </div>

        <div class="community-card-body">

            <span class="community-card-category">
                ${escapeHtml(
                    community.category
                )}
            </span>

            <h2
                class="community-card-title"
                data-action="open-community"
            >
                ${escapeHtml(
                    community.name
                )}
            </h2>

            <p class="community-card-description">
                ${escapeHtml(
                    community.description
                )}
            </p>

            <div class="community-card-meta">

                <div class="community-card-meta-group">
                    <span>
                        👥
                        ${formatNumber(
                            community.memberCount
                        )}
                    </span>

                    <span>
                        💬
                        ${formatNumber(
                            community.postCount
                        )}
                    </span>
                </div>

                <span>
                    ${formatCreatedDate(
                        community.createdAt
                    )}
                </span>

            </div>

            <div class="community-card-actions">

                <button
                    type="button"
                    class="community-detail-button"
                    data-action="open-community"
                >
                    詳細を見る
                </button>

                ${createJoinButtonHtml(
                    community,
                    isJoined
                )}

            </div>

        </div>
    `;

    return card;

}


/**
 * 参加ボタンのHTMLを作成します。
 *
 * @param {Object} community
 * @param {boolean} isJoined
 * @returns {string}
 */
function createJoinButtonHtml(
    community,
    isJoined
) {

    if (isJoined) {

        return `
            <button
                type="button"
                class="community-join-button joined"
                data-action="open-community"
            >
                ✓ 参加中
            </button>
        `;

    }

    if (
        community.visibility === "private"
    ) {

        return `
            <button
                type="button"
                class="community-join-button private"
                disabled
            >
                🔒 招待制
            </button>
        `;

    }

    if (
        community.visibility === "approval"
    ) {

        return `
            <button
                type="button"
                class="community-join-button approval"
                data-action="join-community"
            >
                参加申請
            </button>
        `;

    }

    return `
        <button
            type="button"
            class="community-join-button"
            data-action="join-community"
        >
            ＋ 参加する
        </button>
    `;

}


/* =========================================
   カード操作
========================================= */

/**
 * カード内のイベントを登録します。
 */
function bindCommunityCardEvents() {

    communitySearchResult.addEventListener(
        "click",
        event => {

            const actionElement =
                event.target.closest(
                    "[data-action]"
                );

            if (!actionElement) {
                return;
            }

            const card =
                actionElement.closest(
                    ".community-search-card"
                );

            if (!card) {
                return;
            }

            const communityId =
                card.dataset.communityId;

            const action =
                actionElement.dataset.action;

            if (
                action === "open-community"
            ) {
                openCommunity(communityId);
            }

            if (
                action === "join-community"
            ) {
                openJoinModal(communityId);
            }

        }
    );


    communitySearchResult.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Enter" &&
                event.key !== " "
            ) {
                return;
            }

            const openElement =
                event.target.closest(
                    '[data-action="open-community"]'
                );

            if (!openElement) {
                return;
            }

            event.preventDefault();

            const card =
                openElement.closest(
                    ".community-search-card"
                );

            if (card) {
                openCommunity(
                    card.dataset.communityId
                );
            }

        }
    );

}


/**
 * コミュニティ詳細を開きます。
 *
 * @param {string} communityId
 */
function openCommunity(communityId) {

    const community =
        findCommunityById(communityId);

    if (!community) {

        showToast(
            "コミュニティ情報を取得できませんでした。",
            "error"
        );

        return;
    }

    localStorage.setItem(
        STORAGE_KEYS.selectedCommunity,
        JSON.stringify(community)
    );

    window.location.href =
        `community_home.html?id=${encodeURIComponent(
            community.id
        )}`;

}


/* =========================================
   参加モーダル
========================================= */

/**
 * モーダルイベントを登録します。
 */
function bindModalEvents() {

    cancelJoinButton.addEventListener(
        "click",
        closeJoinModal
    );


    confirmJoinButton.addEventListener(
        "click",
        confirmJoinCommunity
    );


    joinConfirmModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                joinConfirmModal
            ) {
                closeJoinModal();
            }

        }
    );

}


/**
 * 参加確認モーダルを開きます。
 *
 * @param {string} communityId
 */
function openJoinModal(communityId) {

    const community =
        findCommunityById(communityId);

    if (!community) {
        return;
    }

    if (
        community.visibility === "private"
    ) {

        showToast(
            "このコミュニティは招待制です。",
            "error"
        );

        return;
    }

    pendingJoinCommunityId =
        community.id;

    lastFocusedElement =
        document.activeElement;

    joinModalIcon.textContent =
        community.icon;

    joinModalCommunityName.textContent =
        community.name;

    joinModalCommunityCategory.textContent =
        community.category;

    confirmJoinButton.textContent =
        community.visibility === "approval"
            ? "参加申請を送る"
            : "参加する";

    joinConfirmModal.hidden = false;

    document.body.style.overflow =
        "hidden";

    window.requestAnimationFrame(() => {
        cancelJoinButton.focus();
    });

}


/**
 * 参加確認モーダルを閉じます。
 */
function closeJoinModal() {

    pendingJoinCommunityId = null;

    joinConfirmModal.hidden = true;

    document.body.style.overflow = "";

    if (
        lastFocusedElement &&
        typeof lastFocusedElement.focus ===
            "function"
    ) {
        lastFocusedElement.focus();
    }

}


/**
 * 参加または参加申請を処理します。
 */
function confirmJoinCommunity() {

    const community =
        findCommunityById(
            pendingJoinCommunityId
        );

    if (!community) {

        closeJoinModal();

        return;
    }

    if (
        community.visibility === "approval"
    ) {

        closeJoinModal();

        showToast(
            "参加申請を送信しました。",
            "success"
        );

        return;
    }

    joinCommunity(community);

}


/**
 * コミュニティに参加します。
 *
 * @param {Object} community
 */
function joinCommunity(community) {

    if (
        !joinedCommunityIds.includes(
            community.id
        )
    ) {
        joinedCommunityIds.push(
            community.id
        );
    }

    try {

        localStorage.setItem(
            STORAGE_KEYS.joinedCommunities,
            JSON.stringify(
                joinedCommunityIds
            )
        );

        community.memberCount += 1;

        saveCustomCommunityUpdate(
            community
        );

        closeJoinModal();

        renderCommunities();

        showToast(
            `${community.name}に参加しました。`,
            "success"
        );

    } catch (error) {

        console.error(
            "参加情報の保存に失敗しました。",
            error
        );

        showToast(
            "参加情報を保存できませんでした。",
            "error"
        );

    }

}


/**
 * 作成済みコミュニティの更新内容を保存します。
 *
 * @param {Object} community
 */
function saveCustomCommunityUpdate(
    community
) {

    if (!community.isCustom) {
        return;
    }

    const savedCommunities =
        readStorageArray(
            STORAGE_KEYS.communities
        );

    const updatedCommunities =
        savedCommunities.map(item => {

            if (
                item &&
                item.id === community.id
            ) {
                return {
                    ...item,
                    memberCount:
                        community.memberCount
                };
            }

            return item;

        });

    localStorage.setItem(
        STORAGE_KEYS.communities,
        JSON.stringify(
            updatedCommunities
        )
    );

}


/* =========================================
   キーボード操作
========================================= */

/**
 * キーボードイベントを登録します。
 */
function bindKeyboardEvents() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                !joinConfirmModal.hidden
            ) {
                closeJoinModal();
            }

            if (
                event.key === "Tab" &&
                !joinConfirmModal.hidden
            ) {
                trapModalFocus(event);
            }

        }
    );

}


/**
 * モーダル内にフォーカスを閉じ込めます。
 *
 * @param {KeyboardEvent} event
 */
function trapModalFocus(event) {

    const focusableElements = [
        ...joinConfirmModal.querySelectorAll(
            "button:not([disabled]), a[href]"
        )
    ];

    if (!focusableElements.length) {
        return;
    }

    const firstElement =
        focusableElements[0];

    const lastElement =
        focusableElements[
            focusableElements.length - 1
        ];

    if (
        event.shiftKey &&
        document.activeElement === firstElement
    ) {

        event.preventDefault();

        lastElement.focus();

    } else if (
        !event.shiftKey &&
        document.activeElement === lastElement
    ) {

        event.preventDefault();

        firstElement.focus();

    }

}


/* =========================================
   補助関数
========================================= */

/**
 * IDからコミュニティを取得します。
 *
 * @param {string} communityId
 * @returns {Object|undefined}
 */
function findCommunityById(communityId) {

    return allCommunities.find(
        community =>
            community.id === communityId
    );

}


/**
 * 公開設定表示を取得します。
 *
 * @param {string} visibility
 * @returns {{icon: string, label: string}}
 */
function getVisibilityDisplay(
    visibility
) {

    const visibilityMap = {
        public: {
            icon: "🌐",
            label: "公開"
        },
        approval: {
            icon: "✅",
            label: "承認制"
        },
        private: {
            icon: "🔒",
            label: "非公開"
        }
    };

    return visibilityMap[visibility] ||
        visibilityMap.public;

}


/**
 * カテゴリーからカバークラスを取得します。
 *
 * @param {string} category
 * @returns {string}
 */
function getCoverClassByCategory(category) {

    const categoryMap = {
        "自然・海": "sea-community",
        "グルメ": "gourmet-community",
        "文化・伝統": "eisa-community",
        "地域": "naha-community",
        "スポーツ": "sports-community",
        "旅行・観光": "travel-community",
        "音楽": "music-community",
        "趣味": "hobby-community",
        "子育て": "family-community",
        "学校・学習": "study-community",
        "仕事": "work-community",
        "イベント": "event-community",
        "その他": "other-community"
    };

    return categoryMap[category] ||
        "other-community";

}


/**
 * 新着コミュニティか判定します。
 *
 * @param {string} createdAt
 * @returns {boolean}
 */
function isNewCommunity(createdAt) {

    const createdDate =
        new Date(createdAt);

    if (
        Number.isNaN(
            createdDate.getTime()
        )
    ) {
        return false;
    }

    const difference =
        Date.now() -
        createdDate.getTime();

    const thirtyDays =
        30 * 24 * 60 * 60 * 1000;

    return (
        difference >= 0 &&
        difference <= thirtyDays
    );

}


/**
 * 数値を見やすく表示します。
 *
 * @param {number} number
 * @returns {string}
 */
function formatNumber(number) {

    return Number(number || 0)
        .toLocaleString("ja-JP");

}


/**
 * 作成日を表示します。
 *
 * @param {string} createdAt
 * @returns {string}
 */
function formatCreatedDate(createdAt) {

    const date = new Date(createdAt);

    if (
        Number.isNaN(date.getTime())
    ) {
        return "";
    }

    return new Intl.DateTimeFormat(
        "ja-JP",
        {
            year: "numeric",
            month: "short"
        }
    ).format(date);

}


/**
 * トーストを表示します。
 *
 * @param {string} message
 * @param {"success"|"error"|""} type
 */
function showToast(message, type = "") {

    if (!communitySearchToast) {
        return;
    }

    if (toastTimer) {
        window.clearTimeout(toastTimer);
    }

    communitySearchToast.textContent =
        message;

    communitySearchToast.classList.remove(
        "show",
        "success",
        "error"
    );

    if (type) {
        communitySearchToast.classList.add(
            type
        );
    }

    communitySearchToast.hidden = false;

    window.requestAnimationFrame(() => {

        communitySearchToast.classList.add(
            "show"
        );

    });

    toastTimer = window.setTimeout(
        () => {

            communitySearchToast.classList.remove(
                "show"
            );

            window.setTimeout(
                () => {
                    communitySearchToast.hidden =
                        true;
                },
                220
            );

        },
        2800
    );

}


/**
 * HTML特殊文字を無害化します。
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/**
 * HTML属性用に特殊文字を無害化します。
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeAttribute(value) {

    return escapeHtml(value);
}


/**
 * 一時的なIDを生成します。
 *
 * @returns {string}
 */
function generateTemporaryId() {

    return `community-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

}