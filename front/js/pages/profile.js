"use strict";

/* ========================================
   localStorageで使用する保存名
======================================== */

const STORAGE_KEYS = {
    profile: "okitalk_profile",
    posts: "okitalk_profile_posts",
    follow: "okitalk_profile_follow",
    setting: "okitalk_profile_setting",
    spots: "okitalk_profile_spots"
};


/* ========================================
   共通設定
======================================== */

const DEFAULT_THEME_COLOR =
    "#2589ff";

const MAX_IMAGE_SIZE =
    2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png"
];


/* ========================================
   初期プロフィール
======================================== */

const defaultProfile = {
    name: "沖縄 太郎",
    userId: "okinawa_taro",

    description:
        "沖縄の海とカフェが好きです。\n地元のおすすめ情報を発信します！",

    location: "那覇市",
    iconImage: "",
    coverImage: ""
};


/* ========================================
   初期投稿
======================================== */

const defaultPosts = [
    {
        id: 1,

        text:
            "今日の那覇は天気が良くて気持ちいいです！",

        location: "那覇市",

        createdAt:
            Date.now() -
            10 * 60 * 1000,

        liked: false,
        saved: false,
        likeCount: 4,
        pinned: false,
        visibility: "public"
    },

    {
        id: 2,

        text:
            "沖縄そばを食べてきました。三枚肉が最高でした！",

        location: "浦添市",

        createdAt:
            Date.now() -
            24 * 60 * 60 * 1000,

        liked: true,
        saved: true,
        likeCount: 12,
        pinned: true,
        visibility: "followers"
    }
];


/* ========================================
   フォロー・フォロワーの初期データ

   島袋花子は両方に存在するため
   動作確認用の相互フォローになります
======================================== */

const defaultFollowData = {
    following: [
        {
            id: 1,
            name: "島袋 花子",
            userId: "hanako_okinawa",
            iconText: "島",
            isFollowing: true
        },

        {
            id: 2,
            name: "比嘉 海斗",
            userId: "kaito_higa",
            iconText: "比",
            isFollowing: true
        }
    ],

    followers: [
        {
            id: 1,
            name: "島袋 花子",
            userId: "hanako_okinawa",
            iconText: "島",
            isFollowing: true
        },

        {
            id: 3,
            name: "山城 琉衣",
            userId: "rui_yamashiro",
            iconText: "山",
            isFollowing: false
        }
    ]
};


/* ========================================
   初期設定
======================================== */

const defaultSetting = {
    locationSharing: false,
    sharedUserIds: [],
    themeColor: DEFAULT_THEME_COLOR
};


/* ========================================
   初期スポット
======================================== */

const defaultSpots = [
    {
        id: 1,
        name: "海風カフェ",
        category: "カフェ",
        location: "那覇市",
        memo: "海が見えるお気に入りのカフェです。"
    }
];


/* ========================================
   localStorageからデータを読み込む
======================================== */

let profileData =
    loadStorage(
        STORAGE_KEYS.profile,
        defaultProfile
    );

let postData =
    loadStorage(
        STORAGE_KEYS.posts,
        defaultPosts
    ).map(normalizePost);

let followData =
    loadStorage(
        STORAGE_KEYS.follow,
        defaultFollowData
    );

let settingData =
    loadStorage(
        STORAGE_KEYS.setting,
        defaultSetting
    );

let spotData =
    loadStorage(
        STORAGE_KEYS.spots,
        defaultSpots
    );


/* ========================================
   一時変数
======================================== */

let currentTab = "posts";

let deleteTargetPostId = null;

let temporaryIconImage = "";

let temporaryCoverImage = "";

let temporarySharedUserIds = [];

let toastTimer = null;


/* ========================================
   HTML要素の取得
======================================== */

const elements = {
    profileCover:
        document.getElementById("profileCover"),

    profileIcon:
        document.getElementById("profileIcon"),

    profileName:
        document.getElementById("profileName"),

    profileUserId:
        document.getElementById("profileUserId"),

    profileDescription:
        document.getElementById("profileDescription"),

    profileLocation:
        document.getElementById("profileLocation"),

    postCount:
        document.getElementById("postCount"),

    followingCount:
        document.getElementById("followingCount"),

    followerCount:
        document.getElementById("followerCount"),

    postCountButton:
        document.getElementById("postCountButton"),

    openFollowingButton:
        document.getElementById("openFollowingButton"),

    openFollowerButton:
        document.getElementById("openFollowerButton"),

    copyProfileUrlButton:
        document.getElementById("copyProfileUrlButton"),

    openProfileEditButton:
        document.getElementById("openProfileEditButton"),

    openProfileSettingButton:
        document.getElementById("openProfileSettingButton"),

    locationShareStatus:
        document.getElementById("locationShareStatus"),

    locationShareStatusText:
        document.getElementById("locationShareStatusText"),

    postTools:
        document.getElementById("postTools"),

    postSearchInput:
        document.getElementById("postSearchInput"),

    postSortSelect:
        document.getElementById("postSortSelect"),

    myPostList:
        document.getElementById("myPostList"),

    likedPostList:
        document.getElementById("likedPostList"),

    savedPostList:
        document.getElementById("savedPostList"),

    postEmptyMessage:
        document.getElementById("postEmptyMessage"),

    likeEmptyMessage:
        document.getElementById("likeEmptyMessage"),

    savedEmptyMessage:
        document.getElementById("savedEmptyMessage"),

    favoriteSpotList:
        document.getElementById("favoriteSpotList"),

    spotEmptyMessage:
        document.getElementById("spotEmptyMessage"),

    visitedPlaceList:
        document.getElementById("visitedPlaceList"),

    openSpotAddButton:
        document.getElementById("openSpotAddButton"),

    profileEditModal:
        document.getElementById("profileEditModal"),

    profileEditForm:
        document.getElementById("profileEditForm"),

    editName:
        document.getElementById("editName"),

    editUserId:
        document.getElementById("editUserId"),

    editDescription:
        document.getElementById("editDescription"),

    editLocation:
        document.getElementById("editLocation"),

    profileFormError:
        document.getElementById("profileFormError"),

    descriptionCharacterCount:
        document.getElementById(
            "descriptionCharacterCount"
        ),

    editIconPreview:
        document.getElementById("editIconPreview"),

    editCoverPreview:
        document.getElementById("editCoverPreview"),

    iconImageInput:
        document.getElementById("iconImageInput"),

    coverImageInput:
        document.getElementById("coverImageInput"),

    removeIconImageButton:
        document.getElementById(
            "removeIconImageButton"
        ),

    removeCoverImageButton:
        document.getElementById(
            "removeCoverImageButton"
        ),

    imageLoading:
        document.getElementById("imageLoading"),

    saveProfileButton:
        document.getElementById("saveProfileButton"),

    profileSettingModal:
        document.getElementById("profileSettingModal"),

    profileSettingForm:
        document.getElementById("profileSettingForm"),

    themeColorInput:
        document.getElementById("themeColorInput"),

    themeColorPreview:
        document.getElementById("themeColorPreview"),

    themeColorValue:
        document.getElementById("themeColorValue"),

    resetThemeColorButton:
        document.getElementById(
            "resetThemeColorButton"
        ),

    locationShareOn:
        document.getElementById("locationShareOn"),

    locationShareOff:
        document.getElementById("locationShareOff"),

    shareUserSection:
        document.getElementById("shareUserSection"),

    shareUserList:
        document.getElementById("shareUserList"),

    selectedShareUserCount:
        document.getElementById(
            "selectedShareUserCount"
        ),

    saveSettingButton:
        document.getElementById("saveSettingButton"),

    postEditModal:
        document.getElementById("postEditModal"),

    postEditForm:
        document.getElementById("postEditForm"),

    editPostId:
        document.getElementById("editPostId"),

    editPostText:
        document.getElementById("editPostText"),

    editPostLocation:
        document.getElementById("editPostLocation"),

    editPostVisibility:
        document.getElementById("editPostVisibility"),

    postCharacterCount:
        document.getElementById("postCharacterCount"),

    postFormError:
        document.getElementById("postFormError"),

    savePostButton:
        document.getElementById("savePostButton"),

    spotAddModal:
        document.getElementById("spotAddModal"),

    spotAddForm:
        document.getElementById("spotAddForm"),

    spotNameInput:
        document.getElementById("spotNameInput"),

    spotCategoryInput:
        document.getElementById("spotCategoryInput"),

    spotLocationInput:
        document.getElementById("spotLocationInput"),

    spotMemoInput:
        document.getElementById("spotMemoInput"),

    spotFormError:
        document.getElementById("spotFormError"),

    saveSpotButton:
        document.getElementById("saveSpotButton"),

    deleteConfirmModal:
        document.getElementById("deleteConfirmModal"),

    deletePostPreview:
        document.getElementById("deletePostPreview"),

    confirmDeleteButton:
        document.getElementById("confirmDeleteButton"),

    userListModal:
        document.getElementById("userListModal"),

    userListTitle:
        document.getElementById("userListTitle"),

    userList:
        document.getElementById("userList"),

    toast:
        document.getElementById("toast")
};


/* ========================================
   localStorageからデータを読み込む
======================================== */

function loadStorage(key, defaultValue) {
    const savedValue =
        localStorage.getItem(key);

    if (!savedValue) {
        return structuredCloneSafe(defaultValue);
    }

    try {
        return JSON.parse(savedValue);

    } catch (error) {
        console.error(error);

        return structuredCloneSafe(defaultValue);
    }
}


/* ========================================
   localStorageへデータを保存する
======================================== */

function saveStorage(key, value) {
    try {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

        return true;

    } catch (error) {
        console.error(error);

        showToast(
            "データを保存できませんでした。"
        );

        return false;
    }
}


/* ========================================
   データを複製する
======================================== */

function structuredCloneSafe(data) {
    return JSON.parse(
        JSON.stringify(data)
    );
}


/* ========================================
   古い投稿データへ不足項目を補う
======================================== */

function normalizePost(post, index) {
    return {
        id:
            Number(post.id) ||
            Date.now() + index,

        text:
            String(post.text || ""),

        location:
            String(post.location || ""),

        createdAt:
            Number(post.createdAt) ||
            Date.now(),

        liked:
            Boolean(post.liked),

        saved:
            Boolean(post.saved),

        likeCount:
            Number(post.likeCount) || 0,

        pinned:
            Boolean(post.pinned),

        visibility:
            ["public", "followers", "private"]
                .includes(post.visibility)
                    ? post.visibility
                    : "public"
    };
}


/* ========================================
   動作確認用の相互フォローを確実に追加する

   古いlocalStorageが残っている場合でも
   島袋花子をフォロー中とフォロワーの両方へ登録します
======================================== */

function ensureDemoMutualFollow() {
    const demoUser = {
        id: 9001,
        name: "島袋 花子",
        userId: "hanako_okinawa",
        iconText: "島",
        isFollowing: true
    };

    upsertUser(
        followData.following,
        demoUser
    );

    upsertUser(
        followData.followers,
        demoUser
    );

    saveStorage(
        STORAGE_KEYS.follow,
        followData
    );
}


/* ========================================
   同じユーザーIDが存在すれば更新し
   存在しなければ追加する
======================================== */

function upsertUser(userList, userData) {
    const index =
        userList.findIndex(
            (user) =>
                user.userId ===
                userData.userId
        );

    if (index === -1) {
        userList.push({
            ...userData
        });

        return;
    }

    userList[index] = {
        ...userList[index],
        ...userData
    };
}


/* ========================================
   フォロー中一覧を取得
======================================== */

function getFollowingUsers() {
    return followData.following.filter(
        (user) =>
            user.isFollowing
    );
}


/* ========================================
   相互フォローを取得

   フォロー中とフォロワーの両方に
   同じユーザーIDがある人を返します
======================================== */

function getMutualFollowUsers() {
    const followerIds =
        new Set(
            followData.followers.map(
                (user) =>
                    user.userId
            )
        );

    return getFollowingUsers().filter(
        (user) =>
            followerIds.has(
                user.userId
            )
    );
}


/* ========================================
   プロフィールを画面へ反映
======================================== */

function renderProfile() {
    elements.profileName.textContent =
        profileData.name;

    elements.profileUserId.textContent =
        `@${profileData.userId}`;

    elements.profileDescription.textContent =
        profileData.description;

    elements.profileLocation.textContent =
        profileData.location
            ? `📍 ${profileData.location}`
            : "📍 地域未設定";

    setImageOrText(
        elements.profileIcon,
        profileData.iconImage,
        getFirstCharacter(profileData.name)
    );

    elements.profileCover
        .style.backgroundImage =
            profileData.coverImage
                ? `url("${profileData.coverImage}")`
                : "";

    elements.postCount.textContent =
        postData.length;

    elements.followingCount.textContent =
        getFollowingUsers().length;

    elements.followerCount.textContent =
        followData.followers.length;

    renderLocationShareStatus();
}


/* ========================================
   位置情報共有状態を画面へ表示
======================================== */

function renderLocationShareStatus() {
    const isSharing =
        settingData.locationSharing &&
        settingData.sharedUserIds.length > 0;

    elements.locationShareStatus
        .classList.toggle(
            "sharing",
            isSharing
        );

    elements.locationShareStatusText
        .textContent =
            isSharing
                ? `${settingData.sharedUserIds.length}人に位置情報を共有中`
                : "位置情報は共有していません";
}


/* ========================================
   選択したテーマカラーを画面へ反映
======================================== */

function applyThemeColor(color) {
    const primary =
        isValidHexColor(color)
            ? color
            : DEFAULT_THEME_COLOR;

    const secondary =
        mixColor(
            primary,
            "#ffffff",
            0.25
        );

    const soft =
        mixColor(
            primary,
            "#ffffff",
            0.88
        );

    const dark =
        mixColor(
            primary,
            "#000000",
            0.15
        );

    document.documentElement.style.setProperty(
        "--profile-primary",
        primary
    );

    document.documentElement.style.setProperty(
        "--profile-secondary",
        secondary
    );

    document.documentElement.style.setProperty(
        "--profile-soft",
        soft
    );

    document.documentElement.style.setProperty(
        "--profile-primary-dark",
        dark
    );

    elements.themeColorInput.value =
        primary;

    elements.themeColorValue.textContent =
        primary.toUpperCase();

    elements.themeColorPreview
        .style.background =
            `linear-gradient(
                135deg,
                ${primary},
                ${secondary}
            )`;
}


/* ========================================
   16進数カラーの確認
======================================== */

function isValidHexColor(color) {
    return /^#[0-9a-fA-F]{6}$/
        .test(String(color || ""));
}


/* ========================================
   2つの色を混ぜる
======================================== */

function mixColor(
    firstColor,
    secondColor,
    ratio
) {
    const first =
        hexToRgb(firstColor);

    const second =
        hexToRgb(secondColor);

    const mixedRatio =
        Math.min(
            1,
            Math.max(0, ratio)
        );

    return rgbToHex(
        first.r * (1 - mixedRatio) +
            second.r * mixedRatio,

        first.g * (1 - mixedRatio) +
            second.g * mixedRatio,

        first.b * (1 - mixedRatio) +
            second.b * mixedRatio
    );
}


/* ========================================
   HEXをRGBへ変換
======================================== */

function hexToRgb(color) {
    const value =
        color.replace("#", "");

    return {
        r:
            parseInt(
                value.slice(0, 2),
                16
            ),

        g:
            parseInt(
                value.slice(2, 4),
                16
            ),

        b:
            parseInt(
                value.slice(4, 6),
                16
            )
    };
}


/* ========================================
   RGBをHEXへ変換
======================================== */

function rgbToHex(red, green, blue) {
    const convert =
        (value) =>
            Math.round(value)
                .toString(16)
                .padStart(2, "0");

    return (
        "#" +
        convert(red) +
        convert(green) +
        convert(blue)
    );
}


/* ========================================
   現在のタブに表示する投稿を取得
======================================== */

function getVisiblePosts() {
    const searchWord =
        elements.postSearchInput
            .value
            .trim()
            .toLowerCase();

    let posts = [...postData];

    if (currentTab === "likes") {
        posts =
            posts.filter(
                (post) =>
                    post.liked
            );
    }

    if (currentTab === "saved") {
        posts =
            posts.filter(
                (post) =>
                    post.saved
            );
    }

    if (searchWord) {
        posts =
            posts.filter(
                (post) =>
                    `${post.text} ${post.location}`
                        .toLowerCase()
                        .includes(searchWord)
            );
    }

    const sortType =
        elements.postSortSelect.value;

    posts.sort(
        (first, second) => {
            if (sortType === "popular") {
                return (
                    second.likeCount -
                    first.likeCount
                );
            }

            if (sortType === "newest") {
                return (
                    second.createdAt -
                    first.createdAt
                );
            }

            if (
                first.pinned !==
                second.pinned
            ) {
                return (
                    Number(second.pinned) -
                    Number(first.pinned)
                );
            }

            return (
                second.createdAt -
                first.createdAt
            );
        }
    );

    return posts;
}


/* ========================================
   投稿一覧を表示
======================================== */

function renderPosts() {
    elements.myPostList.innerHTML = "";
    elements.likedPostList.innerHTML = "";
    elements.savedPostList.innerHTML = "";

    const visiblePosts =
        getVisiblePosts();

    let target =
        elements.myPostList;

    if (currentTab === "likes") {
        target =
            elements.likedPostList;
    }

    if (currentTab === "saved") {
        target =
            elements.savedPostList;
    }

    visiblePosts.forEach(
        (post) => {
            target.appendChild(
                createPostElement(post)
            );
        }
    );

    elements.postEmptyMessage.style.display =
        currentTab === "posts" &&
        visiblePosts.length === 0
            ? "block"
            : "none";

    elements.likeEmptyMessage.style.display =
        currentTab === "likes" &&
        visiblePosts.length === 0
            ? "block"
            : "none";

    elements.savedEmptyMessage.style.display =
        currentTab === "saved" &&
        visiblePosts.length === 0
            ? "block"
            : "none";

    elements.postCount.textContent =
        postData.length;
}


/* ========================================
   投稿カードを作成
======================================== */

function createPostElement(post) {
    const article =
        document.createElement("article");

    article.className =
        "post-card";

    if (post.pinned) {
        article.classList.add(
            "pinned-post"
        );
    }

    const icon =
        document.createElement("div");

    icon.className =
        "post-icon";

    setImageOrText(
        icon,
        profileData.iconImage,
        getFirstCharacter(profileData.name)
    );

    const content =
        document.createElement("div");

    content.className =
        "post-content";

    if (post.pinned) {
        const pinned =
            document.createElement("span");

        pinned.className =
            "pinned-label";

        pinned.textContent =
            "📌 固定投稿";

        content.appendChild(pinned);
    }

    const visibility =
        document.createElement("span");

    visibility.className =
        "visibility-label";

    visibility.textContent =
        getVisibilityText(
            post.visibility
        );

    content.appendChild(visibility);

    const header =
        document.createElement("div");

    header.className =
        "post-header";

    const headerMain =
        document.createElement("div");

    headerMain.className =
        "post-header-main";

    const name =
        document.createElement("strong");

    name.textContent =
        profileData.name;

    const userId =
        document.createElement("span");

    userId.textContent =
        `@${profileData.userId}`;

    const time =
        document.createElement("span");

    time.textContent =
        `・${formatRelativeTime(
            post.createdAt
        )}`;

    headerMain.append(
        name,
        userId,
        time
    );

    const menuWrapper =
        document.createElement("div");

    menuWrapper.className =
        "post-menu-wrapper";

    const menuButton =
        document.createElement("button");

    menuButton.type =
        "button";

    menuButton.className =
        "post-menu-button";

    menuButton.textContent =
        "⋯";

    const menu =
        document.createElement("div");

    menu.className =
        "post-menu";

    const pinButton =
        createMenuButton(
            post.pinned
                ? "固定を解除"
                : "プロフィールに固定"
        );

    const editButton =
        createMenuButton("編集");

    const deleteButton =
        createMenuButton("削除");

    deleteButton.classList.add(
        "delete-post-button"
    );

    menu.append(
        pinButton,
        editButton,
        deleteButton
    );

    menuWrapper.append(
        menuButton,
        menu
    );

    header.append(
        headerMain,
        menuWrapper
    );

    const text =
        document.createElement("p");

    text.className =
        "post-text";

    text.textContent =
        post.text;

    const location =
        document.createElement("p");

    location.className =
        "post-location";

    location.textContent =
        post.location
            ? `📍 ${post.location}`
            : "📍 位置情報なし";

    const actions =
        document.createElement("div");

    actions.className =
        "post-action";

    const likeButton =
        document.createElement("button");

    likeButton.type =
        "button";

    likeButton.className =
        "post-action-button";

    likeButton.textContent =
        post.liked
            ? `♥ ${post.likeCount}`
            : `♡ ${post.likeCount}`;

    likeButton.classList.toggle(
        "liked",
        post.liked
    );

    const saveButton =
        document.createElement("button");

    saveButton.type =
        "button";

    saveButton.className =
        "post-action-button";

    saveButton.textContent =
        post.saved
            ? "🔖 保存済み"
            : "▱ 保存";

    saveButton.classList.toggle(
        "saved",
        post.saved
    );

    menuButton.addEventListener(
        "click",
        (event) => {
            event.stopPropagation();

            closeAllPostMenus();

            menu.classList.toggle(
                "open"
            );
        }
    );

    pinButton.addEventListener(
        "click",
        () => togglePin(post.id)
    );

    editButton.addEventListener(
        "click",
        () => openPostEditModal(post.id)
    );

    deleteButton.addEventListener(
        "click",
        () => openDeleteModal(post.id)
    );

    likeButton.addEventListener(
        "click",
        () => toggleLike(post.id)
    );

    saveButton.addEventListener(
        "click",
        () => toggleSave(post.id)
    );

    actions.append(
        likeButton,
        saveButton
    );

    content.append(
        header,
        text,
        location,
        actions
    );

    article.append(
        icon,
        content
    );

    return article;
}


/* ========================================
   投稿メニュー内のボタンを作成
======================================== */

function createMenuButton(text) {
    const button =
        document.createElement("button");

    button.type = "button";
    button.textContent = text;

    return button;
}


/* ========================================
   公開範囲を日本語で表示
======================================== */

function getVisibilityText(value) {
    const labels = {
        public: "🌐 全体公開",
        followers: "👥 フォロワーのみ",
        private: "🔒 自分のみ"
    };

    return labels[value] || labels.public;
}


/* ========================================
   いいねを切り替える
======================================== */

function toggleLike(postId) {
    postData =
        postData.map(
            (post) => {
                if (post.id !== postId) {
                    return post;
                }

                const liked =
                    !post.liked;

                return {
                    ...post,

                    liked,

                    likeCount:
                        liked
                            ? post.likeCount + 1
                            : Math.max(
                                post.likeCount - 1,
                                0
                            )
                };
            }
        );

    saveStorage(
        STORAGE_KEYS.posts,
        postData
    );

    renderPosts();
}


/* ========================================
   保存を切り替える
======================================== */

function toggleSave(postId) {
    postData =
        postData.map(
            (post) =>
                post.id === postId
                    ? {
                        ...post,
                        saved: !post.saved
                    }
                    : post
        );

    saveStorage(
        STORAGE_KEYS.posts,
        postData
    );

    renderPosts();
}


/* ========================================
   固定投稿を切り替える
======================================== */

function togglePin(postId) {
    const target =
        postData.find(
            (post) =>
                post.id === postId
        );

    if (!target) {
        return;
    }

    const nextPinned =
        !target.pinned;

    postData =
        postData.map(
            (post) => {
                if (post.id === postId) {
                    return {
                        ...post,
                        pinned: nextPinned
                    };
                }

                return nextPinned
                    ? {
                        ...post,
                        pinned: false
                    }
                    : post;
            }
        );

    saveStorage(
        STORAGE_KEYS.posts,
        postData
    );

    renderPosts();
}


/* ========================================
   投稿メニューを閉じる
======================================== */

function closeAllPostMenus() {
    document
        .querySelectorAll(
            ".post-menu.open"
        )
        .forEach(
            (menu) =>
                menu.classList.remove(
                    "open"
                )
        );
}


/* ========================================
   タブを切り替える
======================================== */

function changeTab(tabName) {
    currentTab = tabName;

    document
        .querySelectorAll(".profile-tab")
        .forEach(
            (button) => {
                const active =
                    button.dataset.tab ===
                    tabName;

                button.classList.toggle(
                    "active",
                    active
                );

                button.setAttribute(
                    "aria-selected",
                    active
                );
            }
        );

    document
        .querySelectorAll(
            ".profile-tab-content"
        )
        .forEach(
            (content) =>
                content.classList.remove(
                    "active"
                )
        );

    const tabMap = {
        posts:
            document.getElementById(
                "postsTabContent"
            ),

        likes:
            document.getElementById(
                "likesTabContent"
            ),

        saved:
            document.getElementById(
                "savedTabContent"
            ),

        spots:
            document.getElementById(
                "spotsTabContent"
            )
    };

    tabMap[tabName].classList.add(
        "active"
    );

    elements.postTools.style.display =
        tabName === "spots"
            ? "none"
            : "grid";

    if (tabName === "spots") {
        renderSpots();

    } else {
        renderPosts();
    }
}


/* ========================================
   プロフィール編集を開く
======================================== */

function openProfileEditModal() {
    elements.editName.value =
        profileData.name;

    elements.editUserId.value =
        profileData.userId;

    elements.editDescription.value =
        profileData.description;

    elements.editLocation.value =
        profileData.location;

    temporaryIconImage =
        profileData.iconImage;

    temporaryCoverImage =
        profileData.coverImage;

    updateDescriptionCount();

    updateImagePreview();

    openModal(
        elements.profileEditModal
    );
}


/* ========================================
   プロフィールを保存
======================================== */

function saveProfile(event) {
    event.preventDefault();

    const name =
        elements.editName.value.trim();

    const userId =
        elements.editUserId.value.trim();

    if (!name) {
        elements.profileFormError
            .textContent =
                "名前を入力してください。";

        return;
    }

    if (
        !/^[a-zA-Z0-9_]{3,20}$/
            .test(userId)
    ) {
        elements.profileFormError
            .textContent =
                "ユーザーIDは3〜20文字の半角英数字とアンダーバーで入力してください。";

        return;
    }

    profileData = {
        ...profileData,

        name,

        userId,

        description:
            elements.editDescription
                .value
                .trim(),

        location:
            elements.editLocation
                .value
                .trim(),

        iconImage:
            temporaryIconImage,

        coverImage:
            temporaryCoverImage
    };

    saveStorage(
        STORAGE_KEYS.profile,
        profileData
    );

    renderProfile();
    renderPosts();

    closeModal(
        elements.profileEditModal
    );

    showToast(
        "プロフィールを保存しました。"
    );
}


/* ========================================
   設定画面を開く
======================================== */

function openProfileSettingModal() {
    ensureDemoMutualFollow();

    temporarySharedUserIds = [
        ...settingData.sharedUserIds
    ];

    elements.locationShareOn.checked =
        settingData.locationSharing;

    elements.locationShareOff.checked =
        !settingData.locationSharing;

    applyThemeColor(
        settingData.themeColor
    );

    renderShareUsers();

    updateShareSection();

    openModal(
        elements.profileSettingModal
    );
}


/* ========================================
   相互フォロー一覧を表示
======================================== */

function renderShareUsers() {
    elements.shareUserList.innerHTML = "";

    getMutualFollowUsers().forEach(
        (user) => {
            const label =
                document.createElement("label");

            label.className =
                "share-user-item";

            const icon =
                document.createElement("div");

            icon.className =
                "share-user-icon";

            icon.textContent =
                user.iconText;

            const information =
                document.createElement("div");

            information.className =
                "share-user-information";

            const name =
                document.createElement("strong");

            name.textContent =
                user.name;

            const userId =
                document.createElement("span");

            userId.textContent =
                `@${user.userId}`;

            information.append(
                name,
                userId
            );

            const checkbox =
                document.createElement("input");

            checkbox.type =
                "checkbox";

            checkbox.className =
                "share-user-checkbox";

            checkbox.checked =
                temporarySharedUserIds
                    .includes(user.userId);

            checkbox.addEventListener(
                "change",
                () => {
                    if (checkbox.checked) {
                        temporarySharedUserIds.push(
                            user.userId
                        );

                    } else {
                        temporarySharedUserIds =
                            temporarySharedUserIds
                                .filter(
                                    (id) =>
                                        id !== user.userId
                                );
                    }

                    updateShareCount();
                }
            );

            label.append(
                icon,
                information,
                checkbox
            );

            elements.shareUserList
                .appendChild(label);
        }
    );

    updateShareCount();
}


/* ========================================
   選択人数を表示
======================================== */

function updateShareCount() {
    elements.selectedShareUserCount
        .textContent =
            `${temporarySharedUserIds.length}人選択`;
}


/* ========================================
   共有相手欄を有効・無効にする
======================================== */

function updateShareSection() {
    elements.shareUserSection
        .classList.toggle(
            "disabled",
            !elements.locationShareOn.checked
        );
}


/* ========================================
   設定を保存
======================================== */

function saveSetting(event) {
    event.preventDefault();

    const locationSharing =
        elements.locationShareOn.checked;

    if (
        locationSharing &&
        temporarySharedUserIds.length === 0
    ) {
        showToast(
            "共有する相手を選択してください。"
        );

        return;
    }

    settingData = {
        locationSharing,

        sharedUserIds:
            locationSharing
                ? [...temporarySharedUserIds]
                : [],

        themeColor:
            elements.themeColorInput.value
    };

    saveStorage(
        STORAGE_KEYS.setting,
        settingData
    );

    applyThemeColor(
        settingData.themeColor
    );

    renderLocationShareStatus();

    closeModal(
        elements.profileSettingModal
    );

    showToast(
        "設定を保存しました。"
    );
}


/* ========================================
   投稿編集を開く
======================================== */

function openPostEditModal(postId) {
    const post =
        postData.find(
            (item) =>
                item.id === postId
        );

    if (!post) {
        return;
    }

    elements.editPostId.value =
        post.id;

    elements.editPostText.value =
        post.text;

    elements.editPostLocation.value =
        post.location;

    elements.editPostVisibility.value =
        post.visibility;

    updatePostCount();

    openModal(
        elements.postEditModal
    );
}


/* ========================================
   投稿編集を保存
======================================== */

function savePost(event) {
    event.preventDefault();

    const text =
        elements.editPostText
            .value
            .trim();

    if (!text) {
        elements.postFormError
            .textContent =
                "投稿内容を入力してください。";

        return;
    }

    const postId =
        Number(elements.editPostId.value);

    postData =
        postData.map(
            (post) =>
                post.id === postId
                    ? {
                        ...post,

                        text,

                        location:
                            elements
                                .editPostLocation
                                .value
                                .trim(),

                        visibility:
                            elements
                                .editPostVisibility
                                .value
                    }
                    : post
        );

    saveStorage(
        STORAGE_KEYS.posts,
        postData
    );

    renderPosts();
    renderVisitedPlaces();

    closeModal(
        elements.postEditModal
    );

    showToast(
        "投稿を更新しました。"
    );
}


/* ========================================
   投稿削除確認を開く
======================================== */

function openDeleteModal(postId) {
    const post =
        postData.find(
            (item) =>
                item.id === postId
        );

    if (!post) {
        return;
    }

    deleteTargetPostId = postId;

    elements.deletePostPreview
        .textContent =
            `「${post.text}」`;

    openModal(
        elements.deleteConfirmModal
    );
}


/* ========================================
   投稿を削除
======================================== */

function deletePost() {
    postData =
        postData.filter(
            (post) =>
                post.id !==
                deleteTargetPostId
        );

    deleteTargetPostId = null;

    saveStorage(
        STORAGE_KEYS.posts,
        postData
    );

    renderProfile();
    renderPosts();
    renderVisitedPlaces();

    closeModal(
        elements.deleteConfirmModal
    );

    showToast(
        "投稿を削除しました。"
    );
}


/* ========================================
   スポット一覧を表示
======================================== */

function renderSpots() {
    elements.favoriteSpotList.innerHTML =
        "";

    spotData.forEach(
        (spot) => {
            const card =
                document.createElement("article");

            card.className =
                "spot-card";

            const header =
                document.createElement("div");

            header.className =
                "spot-card-header";

            const category =
                document.createElement("span");

            category.className =
                "spot-category";

            category.textContent =
                spot.category;

            const deleteButton =
                document.createElement("button");

            deleteButton.type =
                "button";

            deleteButton.className =
                "spot-delete-button";

            deleteButton.textContent =
                "削除";

            deleteButton.addEventListener(
                "click",
                () => deleteSpot(spot.id)
            );

            header.append(
                category,
                deleteButton
            );

            const name =
                document.createElement("h3");

            name.textContent =
                spot.name;

            const location =
                document.createElement("p");

            location.textContent =
                `📍 ${spot.location || "場所未設定"}`;

            const memo =
                document.createElement("p");

            memo.textContent =
                spot.memo || "メモなし";

            card.append(
                header,
                name,
                location,
                memo
            );

            elements.favoriteSpotList
                .appendChild(card);
        }
    );

    elements.spotEmptyMessage.style.display =
        spotData.length === 0
            ? "block"
            : "none";

    renderVisitedPlaces();
}


/* ========================================
   スポットを追加
======================================== */

function addSpot(event) {
    event.preventDefault();

    const name =
        elements.spotNameInput
            .value
            .trim();

    if (!name) {
        elements.spotFormError
            .textContent =
                "スポット名を入力してください。";

        return;
    }

    spotData.unshift({
        id: Date.now(),

        name,

        category:
            elements.spotCategoryInput.value,

        location:
            elements.spotLocationInput
                .value
                .trim(),

        memo:
            elements.spotMemoInput
                .value
                .trim()
    });

    saveStorage(
        STORAGE_KEYS.spots,
        spotData
    );

    elements.spotAddForm.reset();

    renderSpots();

    closeModal(
        elements.spotAddModal
    );

    showToast(
        "スポットを追加しました。"
    );
}


/* ========================================
   スポットを削除
======================================== */

function deleteSpot(spotId) {
    spotData =
        spotData.filter(
            (spot) =>
                spot.id !== spotId
        );

    saveStorage(
        STORAGE_KEYS.spots,
        spotData
    );

    renderSpots();
}


/* ========================================
   訪れた場所を表示
======================================== */

function renderVisitedPlaces() {
    elements.visitedPlaceList.innerHTML =
        "";

    const locations =
        [...new Set(
            postData
                .map(
                    (post) =>
                        post.location
                )
                .filter(Boolean)
        )];

    locations.forEach(
        (location) => {
            const item =
                document.createElement("span");

            item.className =
                "visited-place-item";

            item.textContent =
                `📍 ${location}`;

            elements.visitedPlaceList
                .appendChild(item);
        }
    );
}


/* ========================================
   フォロー・フォロワー一覧を表示
======================================== */

function openUserList(type) {
    const users =
        type === "following"
            ? getFollowingUsers()
            : followData.followers;

    elements.userListTitle.textContent =
        type === "following"
            ? "フォロー中"
            : "フォロワー";

    elements.userList.innerHTML = "";

    users.forEach(
        (user) => {
            const item =
                document.createElement("div");

            item.className =
                "user-list-item";

            const icon =
                document.createElement("div");

            icon.className =
                "user-list-icon";

            icon.textContent =
                user.iconText;

            const information =
                document.createElement("div");

            information.className =
                "user-list-information";

            information.innerHTML =
                `<strong>${user.name}</strong>
                 <span>@${user.userId}</span>`;

            item.append(
                icon,
                information
            );

            elements.userList
                .appendChild(item);
        }
    );

    openModal(
        elements.userListModal
    );
}


/* ========================================
   画像を読み込む
======================================== */

function handleImageChange(
    event,
    type
) {
    const file =
        event.target.files[0];

    if (!file) {
        return;
    }

    if (
        !ALLOWED_IMAGE_TYPES.includes(
            file.type
        ) ||
        file.size > MAX_IMAGE_SIZE
    ) {
        showToast(
            "JPG・PNG形式で2MB以内の画像を選択してください。"
        );

        return;
    }

    const reader =
        new FileReader();

    reader.onload = () => {
        if (type === "icon") {
            temporaryIconImage =
                reader.result;

        } else {
            temporaryCoverImage =
                reader.result;
        }

        updateImagePreview();
    };

    reader.readAsDataURL(file);
}


/* ========================================
   画像プレビューを更新
======================================== */

function updateImagePreview() {
    setImageOrText(
        elements.editIconPreview,
        temporaryIconImage,
        getFirstCharacter(
            elements.editName.value ||
            profileData.name
        )
    );

    elements.editCoverPreview
        .style.backgroundImage =
            temporaryCoverImage
                ? `url("${temporaryCoverImage}")`
                : "";
}


/* ========================================
   文字数表示
======================================== */

function updateDescriptionCount() {
    elements.descriptionCharacterCount
        .textContent =
            elements.editDescription
                .value.length;
}

function updatePostCount() {
    elements.postCharacterCount
        .textContent =
            elements.editPostText
                .value.length;
}


/* ========================================
   相対時間を作成
======================================== */

function formatRelativeTime(timestamp) {
    const elapsed =
        Date.now() - timestamp;

    const minute =
        60 * 1000;

    const hour =
        60 * minute;

    const day =
        24 * hour;

    if (elapsed < minute) {
        return "たった今";
    }

    if (elapsed < hour) {
        return `${Math.floor(
            elapsed / minute
        )}分前`;
    }

    if (elapsed < day) {
        return `${Math.floor(
            elapsed / hour
        )}時間前`;
    }

    return `${Math.floor(
        elapsed / day
    )}日前`;
}


/* ========================================
   URLをコピー
======================================== */

function copyProfileUrl() {
    navigator.clipboard
        .writeText(
            window.location.href
        )
        .then(
            () =>
                showToast(
                    "URLをコピーしました。"
                )
        );
}


/* ========================================
   画像または頭文字を表示
======================================== */

function setImageOrText(
    element,
    image,
    text
) {
    if (image) {
        element.textContent = "";

        element.style.backgroundImage =
            `url("${image}")`;

    } else {
        element.textContent = text;

        element.style.backgroundImage =
            "";
    }
}


/* ========================================
   名前の先頭文字を取得
======================================== */

function getFirstCharacter(name) {
    return Array.from(
        String(name || "沖").trim()
    )[0] || "沖";
}


/* ========================================
   モーダルを開閉
======================================== */

function openModal(modal) {
    modal.classList.add("open");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}

function closeModal(modal) {
    modal.classList.remove("open");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    if (
        !document.querySelector(
            ".modal.open"
        )
    ) {
        document.body.classList.remove(
            "modal-open"
        );
    }
}


/* ========================================
   通知を表示
======================================== */

function showToast(message) {
    elements.toast.textContent =
        message;

    elements.toast.classList.add(
        "show"
    );

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(
            () =>
                elements.toast
                    .classList.remove(
                        "show"
                    ),
            2500
        );
}


/* ========================================
   イベント登録
======================================== */

function setupEventListeners() {
    elements.openProfileEditButton
        .addEventListener(
            "click",
            openProfileEditModal
        );

    elements.openProfileSettingButton
        .addEventListener(
            "click",
            openProfileSettingModal
        );

    elements.copyProfileUrlButton
        .addEventListener(
            "click",
            copyProfileUrl
        );

    elements.profileEditForm
        .addEventListener(
            "submit",
            saveProfile
        );

    elements.profileSettingForm
        .addEventListener(
            "submit",
            saveSetting
        );

    elements.postEditForm
        .addEventListener(
            "submit",
            savePost
        );

    elements.spotAddForm
        .addEventListener(
            "submit",
            addSpot
        );

    elements.openSpotAddButton
        .addEventListener(
            "click",
            () =>
                openModal(
                    elements.spotAddModal
                )
        );

    elements.confirmDeleteButton
        .addEventListener(
            "click",
            deletePost
        );

    elements.locationShareOn
        .addEventListener(
            "change",
            updateShareSection
        );

    elements.locationShareOff
        .addEventListener(
            "change",
            updateShareSection
        );

    elements.themeColorInput
        .addEventListener(
            "input",
            () =>
                applyThemeColor(
                    elements.themeColorInput
                        .value
                )
        );

    elements.resetThemeColorButton
        .addEventListener(
            "click",
            () =>
                applyThemeColor(
                    DEFAULT_THEME_COLOR
                )
        );

    elements.iconImageInput
        .addEventListener(
            "change",
            (event) =>
                handleImageChange(
                    event,
                    "icon"
                )
        );

    elements.coverImageInput
        .addEventListener(
            "change",
            (event) =>
                handleImageChange(
                    event,
                    "cover"
                )
        );

    elements.removeIconImageButton
        .addEventListener(
            "click",
            () => {
                temporaryIconImage = "";

                updateImagePreview();
            }
        );

    elements.removeCoverImageButton
        .addEventListener(
            "click",
            () => {
                temporaryCoverImage = "";

                updateImagePreview();
            }
        );

    elements.editDescription
        .addEventListener(
            "input",
            updateDescriptionCount
        );

    elements.editPostText
        .addEventListener(
            "input",
            updatePostCount
        );

    elements.postSearchInput
        .addEventListener(
            "input",
            renderPosts
        );

    elements.postSortSelect
        .addEventListener(
            "change",
            renderPosts
        );

    document
        .querySelectorAll(".profile-tab")
        .forEach(
            (button) =>
                button.addEventListener(
                    "click",
                    () =>
                        changeTab(
                            button.dataset.tab
                        )
                )
        );

    elements.postCountButton
        .addEventListener(
            "click",
            () => changeTab("posts")
        );

    elements.openFollowingButton
        .addEventListener(
            "click",
            () =>
                openUserList(
                    "following"
                )
        );

    elements.openFollowerButton
        .addEventListener(
            "click",
            () =>
                openUserList(
                    "followers"
                )
        );

    document
        .querySelectorAll(
            "[data-close-modal]"
        )
        .forEach(
            (button) =>
                button.addEventListener(
                    "click",
                    () => {
                        const map = {
                            profile:
                                elements.profileEditModal,

                            setting:
                                elements.profileSettingModal,

                            post:
                                elements.postEditModal,

                            spot:
                                elements.spotAddModal,

                            delete:
                                elements.deleteConfirmModal,

                            "user-list":
                                elements.userListModal
                        };

                        const modal =
                            map[
                                button.dataset
                                    .closeModal
                            ];

                        if (
                            button.dataset
                                .closeModal ===
                            "setting"
                        ) {
                            applyThemeColor(
                                settingData.themeColor
                            );
                        }

                        closeModal(modal);
                    }
                )
        );

    document.addEventListener(
        "click",
        closeAllPostMenus
    );
}


/* ========================================
   ページ初期化
======================================== */

function initializeProfilePage() {
    /* 動作確認用の相互フォローを追加 */
    ensureDemoMutualFollow();

    /* 保存済みのテーマカラーを反映 */
    applyThemeColor(
        settingData.themeColor
    );

    /* 各内容を画面へ表示 */
    renderProfile();
    renderPosts();
    renderSpots();

    /* ボタン操作を登録 */
    setupEventListeners();
}


/* HTML読み込み完了後に初期化 */
document.addEventListener(
    "DOMContentLoaded",
    initializeProfilePage
);