"use strict";

/* =========================================
   コミュニティホーム
   community_home.js
========================================= */


/* =========================================
   LocalStorageのキー
========================================= */

const STORAGE_KEYS = {
    joinedCommunities: "okinawaJoinedCommunities",
    selectedCommunity: "okinawaSelectedCommunity",
    postPrefix: "okinawaCommunityPosts_"
};


/* =========================================
   コミュニティデータ

   community.jsと同じIDを使用します。
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
        createdDate: "2026年4月10日",
        owner: "海好き太郎",
        coverClass: "sea-community",
        rules: [
            "海や自然を大切にする情報交換を心がけましょう。",
            "危険な場所や立入禁止区域への誘導は禁止です。",
            "撮影場所を共有するときは安全面にも配慮しましょう。"
        ]
    },
    {
        id: "gourmet",
        name: "沖縄グルメ情報交換",
        category: "グルメ",
        description:
            "沖縄そば、タコライス、カフェなど、おすすめのお店を共有しましょう。",
        icon: "🍜",
        memberCount: 245,
        createdDate: "2026年3月18日",
        owner: "沖縄グルメ部",
        coverClass: "gourmet-community",
        rules: [
            "お店や店員への誹謗中傷は禁止です。",
            "写真を投稿するときは周囲の人に配慮しましょう。",
            "閉店情報などは確認してから共有しましょう。"
        ]
    },
    {
        id: "eisa",
        name: "エイサー好き集まれ",
        category: "文化・伝統",
        description:
            "エイサーのイベント情報や練習風景、地域の青年会について語るコミュニティです。",
        icon: "🥁",
        memberCount: 96,
        createdDate: "2026年5月2日",
        owner: "島袋エイサー",
        coverClass: "eisa-community",
        rules: [
            "地域や団体への敬意を持って交流しましょう。",
            "練習場所や個人情報の無断掲載は禁止です。",
            "イベント情報は日時と場所を確認して投稿しましょう。"
        ]
    },
    {
        id: "naha",
        name: "那覇市コミュニティ",
        category: "地域",
        description:
            "那覇市のイベント、お店、暮らしに関する情報を共有する地域コミュニティです。",
        icon: "🏙️",
        memberCount: 184,
        createdDate: "2026年2月14日",
        owner: "那覇まち情報",
        coverClass: "naha-community",
        rules: [
            "個人を特定できる情報は投稿しないでください。",
            "地域の迷惑になる行為を勧める投稿は禁止です。",
            "イベント情報は公式情報も確認しましょう。"
        ]
    },
    {
        id: "sports",
        name: "沖縄スポーツ交流会",
        category: "スポーツ",
        description:
            "野球、サッカー、バスケットボールなど、沖縄のスポーツ情報を共有します。",
        icon: "⚽",
        memberCount: 77,
        createdDate: "2026年6月1日",
        owner: "うちなースポーツ",
        coverClass: "sports-community",
        rules: [
            "選手やチームへの誹謗中傷は禁止です。",
            "参加募集では日時や場所を明確にしましょう。",
            "安全に配慮してスポーツを楽しみましょう。"
        ]
    },
    {
        id: "travel",
        name: "沖縄おでかけ情報",
        category: "旅行・観光",
        description:
            "休日のおでかけ先や観光スポット、ドライブコースを紹介し合いましょう。",
        icon: "🚗",
        memberCount: 153,
        createdDate: "2026年4月25日",
        owner: "沖縄ドライブ部",
        coverClass: "travel-community",
        rules: [
            "立入禁止区域や危険な場所の紹介は禁止です。",
            "交通ルールと地域のマナーを守りましょう。",
            "施設情報は最新情報を確認して投稿しましょう。"
        ]
    }
];


/* =========================================
   現在のユーザー
========================================= */

const currentUser = {
    id: "current-user",
    name: "りゅうほ",
    account: "@ryuho",
    avatarText: "り"
};


/* =========================================
   サンプルメンバー
========================================= */

const sampleMembers = [
    {
        id: "member-1",
        name: "海好き太郎",
        account: "@umi_taro",
        avatarText: "海"
    },
    {
        id: "member-2",
        name: "うちなー花子",
        account: "@uchina_hanako",
        avatarText: "花"
    },
    {
        id: "member-3",
        name: "島人まさる",
        account: "@shimanchu",
        avatarText: "島"
    },
    {
        id: "member-4",
        name: "沖縄カフェ巡り",
        account: "@okinawa_cafe",
        avatarText: "カ"
    }
];


/* =========================================
   ページ状態
========================================= */

const pageState = {
    community: null,
    communityId: "",
    activeTab: "new",
    selectedImage: "",
    selectedLocation: "",
    toastTimerId: null
};


/* =========================================
   HTML要素
========================================= */

const elements = {
    communityHero:
        document.getElementById("communityHero"),

    communityHeroCover:
        document.getElementById("communityHeroCover"),

    communityHeroIcon:
        document.getElementById("communityHeroIcon"),

    communityCategory:
        document.getElementById("communityCategory"),

    communityName:
        document.getElementById("communityName"),

    communityDescription:
        document.getElementById("communityDescription"),

    communityMemberCount:
        document.getElementById("communityMemberCount"),

    communityPostCount:
        document.getElementById("communityPostCount"),

    communityCreatedDate:
        document.getElementById("communityCreatedDate"),

    joinedStatusButton:
        document.getElementById("joinedStatusButton"),

    sideCommunityDescription:
        document.getElementById("sideCommunityDescription"),

    sideCommunityCategory:
        document.getElementById("sideCommunityCategory"),

    communityOwner:
        document.getElementById("communityOwner"),

    communityRuleList:
        document.getElementById("communityRuleList"),

    communityMemberList:
        document.getElementById("communityMemberList"),

    memberPageLink:
        document.getElementById("memberPageLink"),

    allMemberLink:
        document.getElementById("allMemberLink"),

    communitySettingsLink:
        document.getElementById("communitySettingsLink"),

    currentUserAvatar:
        document.getElementById("currentUserAvatar"),

    currentUserName:
        document.getElementById("currentUserName"),

    communityPostText:
        document.getElementById("communityPostText"),

    characterCount:
        document.getElementById("characterCount"),

    selectImageButton:
        document.getElementById("selectImageButton"),

    postImageInput:
        document.getElementById("postImageInput"),

    imagePreviewArea:
        document.getElementById("imagePreviewArea"),

    imagePreview:
        document.getElementById("imagePreview"),

    removeImageButton:
        document.getElementById("removeImageButton"),

    selectLocationButton:
        document.getElementById("selectLocationButton"),

    locationSelector:
        document.getElementById("locationSelector"),

    closeLocationSelector:
        document.getElementById("closeLocationSelector"),

    locationInput:
        document.getElementById("locationInput"),

    addLocationButton:
        document.getElementById("addLocationButton"),

    locationPreview:
        document.getElementById("locationPreview"),

    selectedLocationText:
        document.getElementById("selectedLocationText"),

    removeLocationButton:
        document.getElementById("removeLocationButton"),

    submitCommunityPost:
        document.getElementById("submitCommunityPost"),

    communityPosts:
        document.getElementById("communityPosts"),

    emptyPostMessage:
        document.getElementById("emptyPostMessage"),

    postListTitle:
        document.getElementById("postListTitle"),

    postSortSelect:
        document.getElementById("postSortSelect"),

    leaveCommunityButton:
        document.getElementById("leaveCommunityButton"),

    leaveCommunityModal:
        document.getElementById("leaveCommunityModal"),

    cancelLeaveButton:
        document.getElementById("cancelLeaveButton"),

    confirmLeaveButton:
        document.getElementById("confirmLeaveButton"),

    communityHomeToast:
        document.getElementById("communityHomeToast")
};


/* =========================================
   初期化
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeCommunityHome
);


/**
 * ページ全体を初期化します。
 */
function initializeCommunityHome() {
    try {
        pageState.communityId = getCommunityIdFromUrl();

        pageState.community = getCommunityById(
            pageState.communityId
        );

        if (!pageState.community) {
            handleCommunityNotFound();
            return;
        }

        ensureCommunityJoined();
        initializeDefaultPosts();
        setCurrentUserInformation();
        setCommunityInformation();
        renderCommunityRules();
        renderMembers();
        registerEventListeners();
        updateCharacterCount();
        renderPosts();
    } catch (error) {
        console.error(
            "コミュニティホームの初期化に失敗しました。",
            error
        );

        showToast(
            "コミュニティの読み込みに失敗しました。"
        );
    }
}


/* =========================================
   URLからコミュニティID取得
========================================= */

/**
 * URLのidパラメータを取得します。
 *
 * 例：
 * community_home.html?id=sea
 *
 * @returns {string}
 */
function getCommunityIdFromUrl() {
    const searchParams = new URLSearchParams(
        window.location.search
    );

    const communityId = searchParams.get("id");

    if (communityId) {
        return communityId;
    }

    const storedCommunity = getSelectedCommunity();

    if (storedCommunity?.id) {
        return storedCommunity.id;
    }

    return "sea";
}


/* =========================================
   コミュニティ情報取得
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


/**
 * 最後に選択したコミュニティを取得します。
 *
 * @returns {Object|null}
 */
function getSelectedCommunity() {
    const storedValue = localStorage.getItem(
        STORAGE_KEYS.selectedCommunity
    );

    if (!storedValue) {
        return null;
    }

    try {
        return JSON.parse(storedValue);
    } catch (error) {
        console.warn(
            "選択コミュニティを読み込めませんでした。",
            error
        );

        return null;
    }
}


/* =========================================
   コミュニティが存在しない場合
========================================= */

function handleCommunityNotFound() {
    document.title =
        "コミュニティが見つかりません | おきとーーーーーーく";

    elements.communityName.textContent =
        "コミュニティが見つかりません";

    elements.communityDescription.textContent =
        "指定されたコミュニティは存在しないか、削除された可能性があります。";

    elements.joinedStatusButton.hidden = true;

    showToast(
        "コミュニティ情報が見つかりませんでした。"
    );
}


/* =========================================
   参加状態確認
========================================= */

/**
 * URLから直接アクセスした場合も、
 * 参加中として保存します。
 */
function ensureCommunityJoined() {
    const joinedIds = getJoinedCommunityIds();

    if (joinedIds.includes(pageState.communityId)) {
        return;
    }

    joinedIds.push(pageState.communityId);
    saveJoinedCommunityIds(joinedIds);
}


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

        return parsedValue.filter(
            (id) => typeof id === "string"
        );
    } catch (error) {
        console.warn(
            "参加中コミュニティを読み込めませんでした。",
            error
        );

        return [];
    }
}


/**
 * 参加中コミュニティIDを保存します。
 *
 * @param {Array<string>} joinedIds
 */
function saveJoinedCommunityIds(joinedIds) {
    const normalizedIds = [
        ...new Set(joinedIds)
    ];

    localStorage.setItem(
        STORAGE_KEYS.joinedCommunities,
        JSON.stringify(normalizedIds)
    );
}


/* =========================================
   コミュニティ情報表示
========================================= */

function setCommunityInformation() {
    const community = pageState.community;

    document.title =
        `${community.name} | おきとーーーーーーく`;

    elements.communityHeroIcon.textContent =
        community.icon;

    elements.communityCategory.textContent =
        community.category;

    elements.communityName.textContent =
        community.name;

    elements.communityDescription.textContent =
        community.description;

    elements.sideCommunityDescription.textContent =
        community.description;

    elements.sideCommunityCategory.textContent =
        community.category;

    elements.communityOwner.textContent =
        community.owner;

    elements.communityMemberCount.textContent =
        community.memberCount.toLocaleString("ja-JP");

    elements.communityCreatedDate.textContent =
        community.createdDate;

    elements.communityHeroCover.classList.add(
        community.coverClass
    );

    const posts = getCommunityPosts();

    elements.communityPostCount.textContent =
        posts.length.toLocaleString("ja-JP");

    const encodedId = encodeURIComponent(
        pageState.communityId
    );

    elements.memberPageLink.href =
        `community_members.html?id=${encodedId}`;

    elements.allMemberLink.href =
        `community_members.html?id=${encodedId}`;

    elements.communitySettingsLink.href =
        `community_settings.html?id=${encodedId}`;
}


/* =========================================
   現在のユーザー情報
========================================= */

function setCurrentUserInformation() {
    elements.currentUserName.textContent =
        currentUser.name;

    elements.currentUserAvatar.src =
        createAvatarDataUrl(
            currentUser.avatarText,
            "#2f8cff"
        );
}


/* =========================================
   コミュニティルール表示
========================================= */

function renderCommunityRules() {
    elements.communityRuleList.replaceChildren();

    const fragment = document.createDocumentFragment();

    pageState.community.rules.forEach((rule) => {
        const listItem =
            document.createElement("li");

        listItem.textContent = rule;
        fragment.appendChild(listItem);
    });

    elements.communityRuleList.appendChild(fragment);
}


/* =========================================
   メンバー表示
========================================= */

function renderMembers() {
    elements.communityMemberList.replaceChildren();

    const fragment = document.createDocumentFragment();

    sampleMembers.forEach((member, index) => {
        const memberItem =
            document.createElement("a");

        memberItem.href = "#";
        memberItem.className = "member-item";

        const memberImage =
            document.createElement("img");

        memberImage.src = createAvatarDataUrl(
            member.avatarText,
            getAvatarColor(index)
        );

        memberImage.alt =
            `${member.name}のプロフィール画像`;

        const memberText =
            document.createElement("span");

        const memberName =
            document.createElement("strong");

        memberName.textContent = member.name;

        const memberAccount =
            document.createElement("small");

        memberAccount.textContent = member.account;

        memberText.append(
            memberName,
            memberAccount
        );

        memberItem.append(
            memberImage,
            memberText
        );

        fragment.appendChild(memberItem);
    });

    elements.communityMemberList.appendChild(fragment);
}


/* =========================================
   イベント登録
========================================= */

function registerEventListeners() {
    elements.communityPostText.addEventListener(
        "input",
        updateCharacterCount
    );

    elements.selectImageButton.addEventListener(
        "click",
        () => elements.postImageInput.click()
    );

    elements.postImageInput.addEventListener(
        "change",
        handleImageSelection
    );

    elements.removeImageButton.addEventListener(
        "click",
        removeSelectedImage
    );

    elements.selectLocationButton.addEventListener(
        "click",
        openLocationSelector
    );

    elements.closeLocationSelector.addEventListener(
        "click",
        closeLocationSelector
    );

    elements.addLocationButton.addEventListener(
        "click",
        addSelectedLocation
    );

    elements.locationInput.addEventListener(
        "keydown",
        handleLocationInputKeydown
    );

    elements.removeLocationButton.addEventListener(
        "click",
        removeSelectedLocation
    );

    elements.submitCommunityPost.addEventListener(
        "click",
        submitPost
    );

    elements.postSortSelect.addEventListener(
        "change",
        renderPosts
    );

    document.querySelectorAll(
        ".community-tab"
    ).forEach((tabButton) => {
        tabButton.addEventListener(
            "click",
            handleTabChange
        );
    });

    elements.communityPosts.addEventListener(
        "click",
        handlePostListClick
    );

    elements.communityPosts.addEventListener(
        "submit",
        handleCommentSubmit
    );

    elements.leaveCommunityButton.addEventListener(
        "click",
        openLeaveModal
    );

    elements.joinedStatusButton.addEventListener(
        "click",
        openLeaveModal
    );

    elements.cancelLeaveButton.addEventListener(
        "click",
        closeLeaveModal
    );

    elements.confirmLeaveButton.addEventListener(
        "click",
        leaveCommunity
    );

    elements.leaveCommunityModal.addEventListener(
        "click",
        handleModalBackgroundClick
    );

    document.addEventListener(
        "keydown",
        handleEscapeKey
    );
}


/* =========================================
   文字数表示
========================================= */

function updateCharacterCount() {
    const textLength =
        elements.communityPostText.value.length;

    elements.characterCount.textContent =
        `${textLength} / 300`;

    elements.submitCommunityPost.disabled =
        textLength === 0 &&
        !pageState.selectedImage &&
        !pageState.selectedLocation;
}


/* =========================================
   画像選択
========================================= */

function handleImageSelection(event) {
    const file = event.target.files?.[0];

    if (!file) {
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ];

    if (!allowedTypes.includes(file.type)) {
        showToast(
            "JPEG、PNG、WebP、GIFの画像を選択してください。"
        );

        event.target.value = "";
        return;
    }

    const maxFileSize = 3 * 1024 * 1024;

    if (file.size > maxFileSize) {
        showToast(
            "画像サイズは3MB以下にしてください。"
        );

        event.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
        pageState.selectedImage =
            String(reader.result);

        elements.imagePreview.src =
            pageState.selectedImage;

        elements.imagePreviewArea.hidden = false;

        updateCharacterCount();
    });

    reader.addEventListener("error", () => {
        showToast(
            "画像を読み込めませんでした。"
        );
    });

    reader.readAsDataURL(file);
}


function removeSelectedImage() {
    pageState.selectedImage = "";

    elements.postImageInput.value = "";
    elements.imagePreview.src = "";
    elements.imagePreviewArea.hidden = true;

    updateCharacterCount();
}


/* =========================================
   場所選択
========================================= */

function openLocationSelector() {
    elements.locationSelector.hidden = false;
    elements.locationInput.focus();
}


function closeLocationSelector() {
    elements.locationSelector.hidden = true;
    elements.locationInput.value = "";
}


function addSelectedLocation() {
    const location =
        elements.locationInput.value.trim();

    if (!location) {
        showToast(
            "場所を入力してください。"
        );

        return;
    }

    pageState.selectedLocation = location;

    elements.selectedLocationText.textContent =
        location;

    elements.locationPreview.hidden = false;

    closeLocationSelector();
    updateCharacterCount();
}


function handleLocationInputKeydown(event) {
    if (event.key !== "Enter") {
        return;
    }

    event.preventDefault();
    addSelectedLocation();
}


function removeSelectedLocation() {
    pageState.selectedLocation = "";

    elements.selectedLocationText.textContent = "";
    elements.locationPreview.hidden = true;

    updateCharacterCount();
}


/* =========================================
   投稿追加
========================================= */

function submitPost() {
    const postText =
        elements.communityPostText.value.trim();

    if (
        !postText &&
        !pageState.selectedImage &&
        !pageState.selectedLocation
    ) {
        showToast(
            "投稿内容を入力してください。"
        );

        return;
    }

    const posts = getCommunityPosts();

    const newPost = {
        id: createUniqueId("post"),
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAccount: currentUser.account,
        authorAvatarText: currentUser.avatarText,
        text: postText,
        image: pageState.selectedImage,
        location: pageState.selectedLocation,
        createdAt: new Date().toISOString(),
        likes: 0,
        liked: false,
        comments: []
    };

    posts.unshift(newPost);

    try {
        saveCommunityPosts(posts);
    } catch (error) {
        console.error(
            "投稿の保存に失敗しました。",
            error
        );

        showToast(
            "画像が大きすぎるため保存できない可能性があります。"
        );

        return;
    }

    resetPostForm();
    renderPosts();

    showToast(
        "コミュニティに投稿しました。"
    );
}


function resetPostForm() {
    elements.communityPostText.value = "";

    removeSelectedImage();
    removeSelectedLocation();

    updateCharacterCount();
}


/* =========================================
   投稿データ
========================================= */

function getPostStorageKey() {
    return (
        STORAGE_KEYS.postPrefix +
        pageState.communityId
    );
}


/**
 * コミュニティの投稿を取得します。
 *
 * @returns {Array<Object>}
 */
function getCommunityPosts() {
    const storedValue = localStorage.getItem(
        getPostStorageKey()
    );

    if (!storedValue) {
        return [];
    }

    try {
        const parsedValue = JSON.parse(storedValue);

        return Array.isArray(parsedValue)
            ? parsedValue
            : [];
    } catch (error) {
        console.warn(
            "投稿データを読み込めませんでした。",
            error
        );

        return [];
    }
}


/**
 * コミュニティの投稿を保存します。
 *
 * @param {Array<Object>} posts
 */
function saveCommunityPosts(posts) {
    localStorage.setItem(
        getPostStorageKey(),
        JSON.stringify(posts)
    );
}


/* =========================================
   サンプル投稿
========================================= */

function initializeDefaultPosts() {
    const storageKey = getPostStorageKey();

    if (localStorage.getItem(storageKey) !== null) {
        return;
    }

    const defaultPosts =
        createDefaultPostsForCommunity(
            pageState.communityId
        );

    saveCommunityPosts(defaultPosts);
}


function createDefaultPostsForCommunity(communityId) {
    const commonPosts = [
        {
            id: createUniqueId("sample"),
            authorId: "member-1",
            authorName: "海好き太郎",
            authorAccount: "@umi_taro",
            authorAvatarText: "海",
            text:
                getSamplePostText(communityId, 0),
            image: "",
            location:
                getSampleLocation(communityId, 0),
            createdAt:
                createPastDate(40),
            likes: 14,
            liked: false,
            comments: [
                {
                    id: createUniqueId("comment"),
                    authorName: "うちなー花子",
                    authorAvatarText: "花",
                    text:
                        "素敵な情報ありがとうございます！",
                    createdAt:
                        createPastDate(25)
                }
            ]
        },
        {
            id: createUniqueId("sample"),
            authorId: "member-2",
            authorName: "うちなー花子",
            authorAccount: "@uchina_hanako",
            authorAvatarText: "花",
            text:
                getSamplePostText(communityId, 1),
            image: "",
            location:
                getSampleLocation(communityId, 1),
            createdAt:
                createPastDate(180),
            likes: 8,
            liked: false,
            comments: []
        }
    ];

    return commonPosts;
}


function getSamplePostText(communityId, index) {
    const postTexts = {
        sea: [
            "今日の海はとても透明度が高くてきれいでした！海に行く方は日差しが強いので、日焼け対策を忘れずに。",
            "週末にビーチクリーンを行う予定です。参加できる方がいれば、ぜひ一緒に沖縄の海をきれいにしましょう！"
        ],
        gourmet: [
            "新しく見つけた沖縄そばのお店に行ってきました。あっさりしたスープで、とてもおいしかったです！",
            "国際通り周辺でおすすめのカフェを探しています。落ち着いて過ごせるお店があれば教えてください。"
        ],
        eisa: [
            "今週末にエイサーイベントがあります。迫力のある演舞が楽しみです！",
            "練習に参加してきました。太鼓の音を合わせるのは難しいですが、とても楽しかったです。"
        ],
        naha: [
            "国際通りで地域イベントが開催されていました。たくさんの人でにぎわっていました！",
            "那覇市内で静かに勉強できる場所を探しています。おすすめがあれば教えてください。"
        ],
        sports: [
            "今週の試合も盛り上がりました！沖縄のスポーツをみんなで応援しましょう。",
            "週末に参加できるスポーツ交流会を探しています。初心者でも参加できるイベントはありますか？"
        ],
        travel: [
            "天気が良かったのでドライブに行ってきました。海沿いの景色が最高でした！",
            "次の休日に北部へ出かける予定です。おすすめの立ち寄りスポットを教えてください。"
        ]
    };

    return postTexts[communityId]?.[index]
        ?? "コミュニティのみなさん、よろしくお願いします！";
}


function getSampleLocation(communityId, index) {
    const locations = {
        sea: [
            "豊崎美らSUNビーチ",
            "瀬長島"
        ],
        gourmet: [
            "那覇市",
            "国際通り"
        ],
        eisa: [
            "沖縄市",
            "那覇市"
        ],
        naha: [
            "国際通り",
            "那覇市"
        ],
        sports: [
            "沖縄県総合運動公園",
            "那覇市"
        ],
        travel: [
            "海中道路",
            "沖縄県北部"
        ]
    };

    return locations[communityId]?.[index] ?? "";
}


/* =========================================
   投稿一覧表示
========================================= */

function renderPosts() {
    let posts = getCommunityPosts();

    posts = filterPostsByTab(
        posts,
        pageState.activeTab
    );

    posts = sortPosts(
        posts,
        elements.postSortSelect.value
    );

    elements.communityPosts.replaceChildren();

    elements.communityPostCount.textContent =
        getCommunityPosts()
            .length
            .toLocaleString("ja-JP");

    if (posts.length === 0) {
        elements.emptyPostMessage.hidden = false;
        return;
    }

    elements.emptyPostMessage.hidden = true;

    const fragment = document.createDocumentFragment();

    posts.forEach((post) => {
        fragment.appendChild(
            createPostElement(post)
        );
    });

    elements.communityPosts.appendChild(fragment);
}


/**
 * タブに合わせて投稿を絞り込みます。
 *
 * @param {Array<Object>} posts
 * @param {string} tabName
 * @returns {Array<Object>}
 */
function filterPostsByTab(posts, tabName) {
    if (tabName === "popular") {
        return posts.filter(
            (post) =>
                Number(post.likes) >= 5 ||
                post.comments.length > 0
        );
    }

    if (tabName === "media") {
        return posts.filter(
            (post) => Boolean(post.image)
        );
    }

    return posts;
}


/**
 * 投稿を並べ替えます。
 *
 * @param {Array<Object>} posts
 * @param {string} sortType
 * @returns {Array<Object>}
 */
function sortPosts(posts, sortType) {
    const copiedPosts = [...posts];

    if (sortType === "old") {
        return copiedPosts.sort(
            (a, b) =>
                new Date(a.createdAt) -
                new Date(b.createdAt)
        );
    }

    if (sortType === "likes") {
        return copiedPosts.sort(
            (a, b) =>
                Number(b.likes) -
                Number(a.likes)
        );
    }

    return copiedPosts.sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );
}


/* =========================================
   投稿カード生成
========================================= */

function createPostElement(post) {
    const article =
        document.createElement("article");

    article.className = "community-post";
    article.dataset.postId = post.id;


    /* 投稿ヘッダー */
    const header =
        document.createElement("div");

    header.className = "community-post-header";


    const author =
        document.createElement("a");

    author.href = "#";
    author.className = "post-author";


    const authorImage =
        document.createElement("img");

    authorImage.src = createAvatarDataUrl(
        post.authorAvatarText || "沖",
        "#2f8cff"
    );

    authorImage.alt =
        `${post.authorName}のプロフィール画像`;


    const authorInformation =
        document.createElement("span");


    const authorName =
        document.createElement("strong");

    authorName.textContent =
        post.authorName;


    const postDate =
        document.createElement("small");

    postDate.textContent =
        `${post.authorAccount || ""}・${formatRelativeTime(
            post.createdAt
        )}`;


    authorInformation.append(
        authorName,
        postDate
    );

    author.append(
        authorImage,
        authorInformation
    );


    const menuButton =
        document.createElement("button");

    menuButton.type = "button";
    menuButton.className = "post-menu-button";
    menuButton.dataset.action = "menu";
    menuButton.setAttribute(
        "aria-label",
        "投稿メニュー"
    );

    menuButton.textContent = "…";


    header.append(
        author,
        menuButton
    );


    /* 投稿本文 */
    const body =
        document.createElement("div");

    body.className = "community-post-body";


    if (post.text) {
        const postText =
            document.createElement("p");

        postText.textContent = post.text;
        body.appendChild(postText);
    }


    if (post.location) {
        const location =
            document.createElement("div");

        location.className = "post-location";
        location.textContent =
            `📍 ${post.location}`;

        body.appendChild(location);
    }


    if (post.image) {
        const postImage =
            document.createElement("img");

        postImage.className =
            "community-post-image";

        postImage.src = post.image;
        postImage.alt = "投稿画像";

        body.appendChild(postImage);
    }


    /* アクション */
    const actions =
        document.createElement("div");

    actions.className =
        "community-post-actions";


    const likeButton = createActionButton({
        action: "like",
        className:
            `post-action-button like-button${
                post.liked ? " liked" : ""
            }`,
        icon: post.liked ? "♥" : "♡",
        text: String(post.likes || 0)
    });


    const commentButton = createActionButton({
        action: "comment",
        className: "post-action-button",
        icon: "💬",
        text: String(post.comments?.length || 0)
    });


    const shareButton = createActionButton({
        action: "share",
        className: "post-action-button",
        icon: "↗",
        text: "共有"
    });


    const bookmarkButton = createActionButton({
        action: "bookmark",
        className: "post-action-button",
        icon: "🔖",
        text: "保存"
    });


    actions.append(
        likeButton,
        commentButton,
        shareButton,
        bookmarkButton
    );


    /* コメント欄 */
    const commentSection =
        createCommentSection(post);


    article.append(
        header,
        body,
        actions,
        commentSection
    );

    return article;
}


/**
 * 投稿アクションボタンを生成します。
 */
function createActionButton({
    action,
    className,
    icon,
    text
}) {
    const button =
        document.createElement("button");

    button.type = "button";
    button.className = className;
    button.dataset.action = action;

    const iconSpan =
        document.createElement("span");

    iconSpan.textContent = icon;

    if (action === "like") {
        iconSpan.className = "like-icon";
    }

    const textSpan =
        document.createElement("span");

    textSpan.textContent = text;

    button.append(
        iconSpan,
        textSpan
    );

    return button;
}


/* =========================================
   コメント欄生成
========================================= */

function createCommentSection(post) {
    const section =
        document.createElement("div");

    section.className = "comment-section";


    const commentList =
        document.createElement("div");

    commentList.className = "comment-list";


    const comments = Array.isArray(post.comments)
        ? post.comments
        : [];


    comments.forEach((comment) => {
        commentList.appendChild(
            createCommentElement(comment)
        );
    });


    const form =
        document.createElement("form");

    form.className = "comment-form";
    form.dataset.postId = post.id;


    const currentUserImage =
        document.createElement("img");

    currentUserImage.src =
        createAvatarDataUrl(
            currentUser.avatarText,
            "#2f8cff"
        );

    currentUserImage.alt =
        "自分のプロフィール画像";


    const commentInput =
        document.createElement("input");

    commentInput.type = "text";
    commentInput.name = "comment";
    commentInput.maxLength = 150;
    commentInput.placeholder =
        "コメントを入力";


    const submitButton =
        document.createElement("button");

    submitButton.type = "submit";
    submitButton.textContent = "送信";


    form.append(
        currentUserImage,
        commentInput,
        submitButton
    );


    section.append(
        commentList,
        form
    );

    return section;
}


function createCommentElement(comment) {
    const item =
        document.createElement("div");

    item.className = "comment-item";


    const avatar =
        document.createElement("img");

    avatar.src = createAvatarDataUrl(
        comment.authorAvatarText || "沖",
        "#22b8a7"
    );

    avatar.alt =
        `${comment.authorName}のプロフィール画像`;


    const content =
        document.createElement("div");

    content.className = "comment-content";


    const nameArea =
        document.createElement("div");

    nameArea.className = "comment-name";


    const name =
        document.createElement("strong");

    name.textContent =
        comment.authorName;


    const date =
        document.createElement("small");

    date.textContent =
        formatRelativeTime(
            comment.createdAt
        );


    const text =
        document.createElement("p");

    text.textContent = comment.text;


    nameArea.append(
        name,
        date
    );

    content.append(
        nameArea,
        text
    );

    item.append(
        avatar,
        content
    );

    return item;
}


/* =========================================
   タブ変更
========================================= */

function handleTabChange(event) {
    const selectedTab =
        event.currentTarget.dataset.tab;

    pageState.activeTab = selectedTab;

    document.querySelectorAll(
        ".community-tab"
    ).forEach((tabButton) => {
        const isActive =
            tabButton.dataset.tab === selectedTab;

        tabButton.classList.toggle(
            "active",
            isActive
        );

        tabButton.setAttribute(
            "aria-selected",
            String(isActive)
        );
    });

    const titles = {
        new: "新着の投稿",
        popular: "人気の投稿",
        media: "画像付きの投稿"
    };

    elements.postListTitle.textContent =
        titles[selectedTab] || "投稿";

    renderPosts();
}


/* =========================================
   投稿アクション
========================================= */

function handlePostListClick(event) {
    const actionButton =
        event.target.closest("[data-action]");

    if (!actionButton) {
        return;
    }

    const postElement =
        actionButton.closest(".community-post");

    if (!postElement) {
        return;
    }

    const postId =
        postElement.dataset.postId;

    const action =
        actionButton.dataset.action;

    switch (action) {
        case "like":
            toggleLike(postId);
            break;

        case "comment":
            focusCommentInput(postElement);
            break;

        case "share":
            sharePost(postId);
            break;

        case "bookmark":
            toggleBookmark(actionButton);
            break;

        case "menu":
            handlePostMenu(postId);
            break;

        default:
            break;
    }
}


/* =========================================
   いいね
========================================= */

function toggleLike(postId) {
    const posts = getCommunityPosts();

    const targetPost = posts.find(
        (post) => post.id === postId
    );

    if (!targetPost) {
        return;
    }

    targetPost.liked = !targetPost.liked;

    if (targetPost.liked) {
        targetPost.likes =
            Number(targetPost.likes || 0) + 1;
    } else {
        targetPost.likes = Math.max(
            0,
            Number(targetPost.likes || 0) - 1
        );
    }

    saveCommunityPosts(posts);
    renderPosts();
}


/* =========================================
   コメント
========================================= */

function focusCommentInput(postElement) {
    const commentInput =
        postElement.querySelector(
            '.comment-form input[name="comment"]'
        );

    commentInput?.focus();
}


function handleCommentSubmit(event) {
    const form =
        event.target.closest(".comment-form");

    if (!form) {
        return;
    }

    event.preventDefault();

    const postId = form.dataset.postId;

    const input =
        form.querySelector(
            'input[name="comment"]'
        );

    const commentText =
        input.value.trim();

    if (!commentText) {
        showToast(
            "コメントを入力してください。"
        );

        return;
    }

    const posts = getCommunityPosts();

    const targetPost = posts.find(
        (post) => post.id === postId
    );

    if (!targetPost) {
        return;
    }

    if (!Array.isArray(targetPost.comments)) {
        targetPost.comments = [];
    }

    targetPost.comments.push({
        id: createUniqueId("comment"),
        authorName: currentUser.name,
        authorAvatarText: currentUser.avatarText,
        text: commentText,
        createdAt: new Date().toISOString()
    });

    saveCommunityPosts(posts);
    renderPosts();

    showToast(
        "コメントを投稿しました。"
    );
}


/* =========================================
   投稿共有
========================================= */

async function sharePost(postId) {
    const shareUrl =
        `${window.location.href.split("#")[0]}#post-${postId}`;

    try {
        if (navigator.share) {
            await navigator.share({
                title: pageState.community.name,
                text:
                    `${pageState.community.name}の投稿`,
                url: shareUrl
            });

            return;
        }

        await navigator.clipboard.writeText(
            shareUrl
        );

        showToast(
            "投稿URLをコピーしました。"
        );
    } catch (error) {
        if (error?.name === "AbortError") {
            return;
        }

        console.warn(
            "共有処理に失敗しました。",
            error
        );

        showToast(
            "投稿URLをコピーできませんでした。"
        );
    }
}


/* =========================================
   ブックマーク
========================================= */

function toggleBookmark(button) {
    const isSaved =
        button.classList.toggle("saved");

    const textElement =
        button.querySelector(
            "span:last-child"
        );

    if (textElement) {
        textElement.textContent =
            isSaved ? "保存済み" : "保存";
    }

    showToast(
        isSaved
            ? "投稿を保存しました。"
            : "投稿の保存を解除しました。"
    );
}


/* =========================================
   投稿メニュー
========================================= */

function handlePostMenu(postId) {
    const posts = getCommunityPosts();

    const post = posts.find(
        (item) => item.id === postId
    );

    if (!post) {
        return;
    }

    if (post.authorId !== currentUser.id) {
        showToast(
            "この投稿は自分の投稿ではありません。"
        );

        return;
    }

    const shouldDelete = window.confirm(
        "この投稿を削除しますか？"
    );

    if (!shouldDelete) {
        return;
    }

    const updatedPosts = posts.filter(
        (item) => item.id !== postId
    );

    saveCommunityPosts(updatedPosts);
    renderPosts();

    showToast(
        "投稿を削除しました。"
    );
}


/* =========================================
   退出モーダル
========================================= */

function openLeaveModal() {
    elements.leaveCommunityModal.hidden = false;

    document.body.style.overflow = "hidden";

    elements.cancelLeaveButton.focus();
}


function closeLeaveModal() {
    elements.leaveCommunityModal.hidden = true;

    document.body.style.overflow = "";
}


function handleModalBackgroundClick(event) {
    if (
        event.target ===
        elements.leaveCommunityModal
    ) {
        closeLeaveModal();
    }
}


function handleEscapeKey(event) {
    if (
        event.key === "Escape" &&
        !elements.leaveCommunityModal.hidden
    ) {
        closeLeaveModal();
    }
}


/* =========================================
   コミュニティ退出
========================================= */

function leaveCommunity() {
    const joinedIds =
        getJoinedCommunityIds();

    const updatedJoinedIds =
        joinedIds.filter(
            (id) =>
                id !== pageState.communityId
        );

    saveJoinedCommunityIds(
        updatedJoinedIds
    );

    localStorage.removeItem(
        STORAGE_KEYS.selectedCommunity
    );

    closeLeaveModal();

    showToast(
        "コミュニティから退出しました。"
    );

    window.setTimeout(() => {
        window.location.href =
            "../community.html";
    }, 700);
}


/* =========================================
   トースト
========================================= */

function showToast(message) {
    if (!elements.communityHomeToast) {
        return;
    }

    if (pageState.toastTimerId !== null) {
        window.clearTimeout(
            pageState.toastTimerId
        );
    }

    elements.communityHomeToast.textContent =
        message;

    elements.communityHomeToast.hidden = false;

    elements.communityHomeToast.classList.add(
        "show"
    );

    pageState.toastTimerId =
        window.setTimeout(() => {
            elements.communityHomeToast.classList.remove(
                "show"
            );

            window.setTimeout(() => {
                elements.communityHomeToast.hidden = true;
            }, 200);
        }, 2500);
}


/* =========================================
   時刻表示
========================================= */

function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();

    const difference =
        now.getTime() - date.getTime();

    const minutes =
        Math.floor(difference / 60000);

    if (minutes < 1) {
        return "たった今";
    }

    if (minutes < 60) {
        return `${minutes}分前`;
    }

    const hours =
        Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}時間前`;
    }

    const days =
        Math.floor(hours / 24);

    if (days < 7) {
        return `${days}日前`;
    }

    return new Intl.DateTimeFormat(
        "ja-JP",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    ).format(date);
}


/* =========================================
   ID生成
========================================= */

function createUniqueId(prefix) {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return `${prefix}-${crypto.randomUUID()}`;
    }

    return (
        `${prefix}-${Date.now()}-` +
        Math.random()
            .toString(16)
            .slice(2)
    );
}


/* =========================================
   過去時刻生成
========================================= */

function createPastDate(minutesAgo) {
    const date = new Date();

    date.setMinutes(
        date.getMinutes() - minutesAgo
    );

    return date.toISOString();
}


/* =========================================
   アイコン画像生成
========================================= */

/**
 * 文字入りの丸いプロフィール画像を生成します。
 *
 * @param {string} text
 * @param {string} backgroundColor
 * @returns {string}
 */
function createAvatarDataUrl(
    text,
    backgroundColor
) {
    const safeText =
        escapeSvgText(
            String(text).slice(0, 1)
        );

    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="100"
            height="100"
            viewBox="0 0 100 100"
        >
            <rect
                width="100"
                height="100"
                rx="50"
                fill="${backgroundColor}"
            />
            <text
                x="50"
                y="57"
                text-anchor="middle"
                dominant-baseline="middle"
                fill="#ffffff"
                font-size="42"
                font-family="sans-serif"
                font-weight="bold"
            >
                ${safeText}
            </text>
        </svg>
    `;

    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );
}


function escapeSvgText(text) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}


function getAvatarColor(index) {
    const colors = [
        "#2f8cff",
        "#22b8a7",
        "#ff9b40",
        "#ef5c73",
        "#7950f2"
    ];

    return colors[index % colors.length];
}