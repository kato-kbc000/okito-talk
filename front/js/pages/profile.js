"use strict";

/*
========================================
プロフィール画面専用JavaScript
========================================

このファイルで管理する機能

・プロフィール表示
・プロフィール編集
・プロフィール画像の変更・削除
・ヘッダー画像の変更・削除
・投稿一覧表示
・投稿検索
・投稿並び替え
・投稿編集
・投稿削除
・投稿固定
・いいね
・フォロー中一覧
・フォロワー一覧
・プロフィールURLコピー
・localStorage保存
*/


/*
========================================
localStorageのキー
========================================
*/

const STORAGE_KEYS = {
    profile: "okitalk_profile",
    posts: "okitalk_profile_posts",
    follow: "okitalk_profile_follow"
};


/*
========================================
画像の設定
========================================
*/

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png"
];


/*
========================================
プロフィールの初期データ
========================================
*/

const defaultProfile = {
    name: "沖縄 太郎",

    userId: "okinawa_taro",

    description:
        "沖縄の海とカフェが好きです。\n地元のおすすめ情報を発信します！",

    location: "那覇市",

    iconImage: "",

    coverImage: ""
};


/*
========================================
投稿の初期データ
========================================
*/

const defaultPosts = [
    {
        id: 1,

        text:
            "今日の那覇は天気が良くて気持ちいいです！",

        location: "那覇市",

        createdAt:
            Date.now() - 10 * 60 * 1000,

        liked: false,

        likeCount: 4,

        pinned: false
    },

    {
        id: 2,

        text:
            "沖縄そばを食べてきました。三枚肉が最高でした！",

        location: "浦添市",

        createdAt:
            Date.now() - 24 * 60 * 60 * 1000,

        liked: true,

        likeCount: 12,

        pinned: true
    }
];


/*
========================================
フォロー・フォロワーの初期データ
========================================
*/

const defaultFollowData = {
    /*
    自分がフォローしているユーザー
    */

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
        },

        {
            id: 3,

            name: "金城 美海",

            userId: "mimi_kinjo",

            iconText: "金",

            isFollowing: true
        }
    ],

    /*
    自分をフォローしているユーザー
    */

    followers: [
        {
            id: 4,

            name: "山城 琉衣",

            userId: "rui_yamashiro",

            iconText: "山",

            isFollowing: false
        },

        {
            id: 5,

            name: "上原 こころ",

            userId: "kokoro_uehara",

            iconText: "上",

            isFollowing: true
        },

        {
            id: 6,

            name: "宮城 大輝",

            userId: "daiki_miyagi",

            iconText: "宮",

            isFollowing: false
        }
    ]
};


/*
========================================
現在使用するデータ
========================================
*/

let profileData = loadStorage(
    STORAGE_KEYS.profile,
    defaultProfile
);

let postData = loadStorage(
    STORAGE_KEYS.posts,
    defaultPosts
).map(normalizePost);

let followData = normalizeFollowData(
    loadStorage(
        STORAGE_KEYS.follow,
        defaultFollowData
    )
);


/*
現在表示中のタブ
*/

let currentTab = "posts";


/*
削除対象の投稿ID
*/

let deleteTargetPostId = null;


/*
プロフィール編集時の一時画像
*/

let temporaryIconImage = "";

let temporaryCoverImage = "";


/*
Toastを消すためのタイマー
*/

let toastTimer = null;


/*
========================================
HTML要素を取得
========================================
*/

const elements = {
    profileCover:
        document.getElementById(
            "profileCover"
        ),

    profileIcon:
        document.getElementById(
            "profileIcon"
        ),

    profileName:
        document.getElementById(
            "profileName"
        ),

    profileUserId:
        document.getElementById(
            "profileUserId"
        ),

    profileDescription:
        document.getElementById(
            "profileDescription"
        ),

    profileLocation:
        document.getElementById(
            "profileLocation"
        ),

    postCount:
        document.getElementById(
            "postCount"
        ),

    followingCount:
        document.getElementById(
            "followingCount"
        ),

    followerCount:
        document.getElementById(
            "followerCount"
        ),

    postCountButton:
        document.getElementById(
            "postCountButton"
        ),

    copyProfileUrlButton:
        document.getElementById(
            "copyProfileUrlButton"
        ),

    openProfileEditButton:
        document.getElementById(
            "openProfileEditButton"
        ),

    profileEditModal:
        document.getElementById(
            "profileEditModal"
        ),

    profileEditForm:
        document.getElementById(
            "profileEditForm"
        ),

    editName:
        document.getElementById(
            "editName"
        ),

    editUserId:
        document.getElementById(
            "editUserId"
        ),

    editDescription:
        document.getElementById(
            "editDescription"
        ),

    editLocation:
        document.getElementById(
            "editLocation"
        ),

    profileFormError:
        document.getElementById(
            "profileFormError"
        ),

    descriptionCharacterCount:
        document.getElementById(
            "descriptionCharacterCount"
        ),

    editIconPreview:
        document.getElementById(
            "editIconPreview"
        ),

    editCoverPreview:
        document.getElementById(
            "editCoverPreview"
        ),

    iconImageInput:
        document.getElementById(
            "iconImageInput"
        ),

    coverImageInput:
        document.getElementById(
            "coverImageInput"
        ),

    removeIconImageButton:
        document.getElementById(
            "removeIconImageButton"
        ),

    removeCoverImageButton:
        document.getElementById(
            "removeCoverImageButton"
        ),

    imageLoading:
        document.getElementById(
            "imageLoading"
        ),

    saveProfileButton:
        document.getElementById(
            "saveProfileButton"
        ),

    myPostList:
        document.getElementById(
            "myPostList"
        ),

    likedPostList:
        document.getElementById(
            "likedPostList"
        ),

    postEmptyMessage:
        document.getElementById(
            "postEmptyMessage"
        ),

    likeEmptyMessage:
        document.getElementById(
            "likeEmptyMessage"
        ),

    postSearchInput:
        document.getElementById(
            "postSearchInput"
        ),

    postSortSelect:
        document.getElementById(
            "postSortSelect"
        ),

    postEditModal:
        document.getElementById(
            "postEditModal"
        ),

    postEditForm:
        document.getElementById(
            "postEditForm"
        ),

    editPostId:
        document.getElementById(
            "editPostId"
        ),

    editPostText:
        document.getElementById(
            "editPostText"
        ),

    editPostLocation:
        document.getElementById(
            "editPostLocation"
        ),

    postCharacterCount:
        document.getElementById(
            "postCharacterCount"
        ),

    postFormError:
        document.getElementById(
            "postFormError"
        ),

    savePostButton:
        document.getElementById(
            "savePostButton"
        ),

    deleteConfirmModal:
        document.getElementById(
            "deleteConfirmModal"
        ),

    confirmDeleteButton:
        document.getElementById(
            "confirmDeleteButton"
        ),

    deletePostPreview:
        document.getElementById(
            "deletePostPreview"
        ),

    userListModal:
        document.getElementById(
            "userListModal"
        ),

    userListTitle:
        document.getElementById(
            "userListTitle"
        ),

    userList:
        document.getElementById(
            "userList"
        ),

    openFollowingButton:
        document.getElementById(
            "openFollowingButton"
        ),

    openFollowerButton:
        document.getElementById(
            "openFollowerButton"
        ),

    toast:
        document.getElementById(
            "toast"
        )
};


/*
========================================
データを複製
========================================
*/

function cloneData(data) {
    return JSON.parse(
        JSON.stringify(data)
    );
}


/*
========================================
localStorageから読み込む
========================================
*/

function loadStorage(
    key,
    defaultValue
) {
    const savedData =
        localStorage.getItem(key);

    if (!savedData) {
        return cloneData(
            defaultValue
        );
    }

    try {
        return JSON.parse(
            savedData
        );

    } catch (error) {
        console.error(
            "保存データの読み込みに失敗しました。",
            error
        );

        return cloneData(
            defaultValue
        );
    }
}


/*
========================================
localStorageへ保存
========================================
*/

function saveStorage(
    key,
    value
) {
    try {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

        return true;

    } catch (error) {
        console.error(
            "データの保存に失敗しました。",
            error
        );

        showToast(
            "保存容量を超えたため、保存できませんでした。"
        );

        return false;
    }
}


/*
========================================
古い投稿データを現在の形式へ整える
========================================
*/

function normalizePost(
    post,
    index
) {
    return {
        id:
            Number(post.id) ||
            Date.now() + index,

        text:
            String(
                post.text || ""
            ),

        location:
            String(
                post.location || ""
            ),

        createdAt:
            typeof post.createdAt ===
            "number"
                ? post.createdAt
                : Date.now() -
                    index * 1000,

        liked:
            Boolean(
                post.liked
            ),

        likeCount:
            Number(
                post.likeCount
            ) || 0,

        pinned:
            Boolean(
                post.pinned
            )
    };
}


/*
========================================
フォローデータを整える
========================================
*/

function normalizeFollowData(data) {
    const following =
        Array.isArray(data.following)
            ? data.following
            : [];

    const followers =
        Array.isArray(data.followers)
            ? data.followers
            : [];

    return {
        following:
            following.map(
                normalizeUser
            ),

        followers:
            followers.map(
                normalizeUser
            )
    };
}


/*
========================================
ユーザーデータを整える
========================================
*/

function normalizeUser(user) {
    return {
        id:
            Number(user.id),

        name:
            String(
                user.name || ""
            ),

        userId:
            String(
                user.userId || ""
            ),

        iconText:
            String(
                user.iconText ||
                getFirstCharacter(
                    user.name || ""
                )
            ),

        isFollowing:
            Boolean(
                user.isFollowing
            )
    };
}


/*
========================================
実際にフォローしているユーザーを取得
========================================

following配列とfollowers配列の両方から、
isFollowingがtrueのユーザーを取得します。

同じユーザーIDが複数存在する場合は、
1人として扱います。
*/

function getFollowingUsers() {
    const allUsers = [
        ...followData.following,
        ...followData.followers
    ];

    const followingUserMap =
        new Map();

    allUsers.forEach((user) => {
        if (!user.isFollowing) {
            return;
        }

        if (!user.userId) {
            return;
        }

        followingUserMap.set(
            user.userId,
            user
        );
    });

    return Array.from(
        followingUserMap.values()
    );
}


/*
========================================
フォロー中の人数を取得
========================================
*/

function getFollowingCount() {
    return getFollowingUsers().length;
}


/*
========================================
フォロワー人数を取得
========================================
*/

function getFollowerCount() {
    return followData.followers.length;
}


/*
========================================
同じユーザーのフォロー状態を同期
========================================

同じユーザーがfollowingとfollowersの両方に
存在する場合も、フォロー状態をそろえます。
*/

function updateFollowingState(
    userId,
    isFollowing
) {
    followData.following =
        followData.following.map(
            (user) => {
                if (
                    user.userId !==
                    userId
                ) {
                    return user;
                }

                return {
                    ...user,

                    isFollowing
                };
            }
        );

    followData.followers =
        followData.followers.map(
            (user) => {
                if (
                    user.userId !==
                    userId
                ) {
                    return user;
                }

                return {
                    ...user,

                    isFollowing
                };
            }
        );
}


/*
========================================
プロフィールを表示
========================================
*/

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
        getFirstCharacter(
            profileData.name
        )
    );

    elements.profileCover
        .style.backgroundImage =
            profileData.coverImage
                ? `url("${profileData.coverImage}")`
                : "";

    elements.postCount.textContent =
        postData.length;

    /*
    実際にフォロー中の人数だけ表示
    */

    elements.followingCount.textContent =
        getFollowingCount();

    /*
    フォロワー数は自分をフォローしている人数
    */

    elements.followerCount.textContent =
        getFollowerCount();
}


/*
========================================
検索・並び替え後の投稿を取得
========================================
*/

function getVisiblePosts() {
    const searchWord =
        elements.postSearchInput
            .value
            .trim()
            .toLowerCase();

    const sortType =
        elements.postSortSelect.value;

    let visiblePosts =
        currentTab === "likes"
            ? postData.filter(
                (post) => post.liked
            )
            : [...postData];

    if (searchWord) {
        visiblePosts =
            visiblePosts.filter(
                (post) => {
                    const searchTarget =
                        `${post.text} ${post.location}`
                            .toLowerCase();

                    return searchTarget.includes(
                        searchWord
                    );
                }
            );
    }

    visiblePosts.sort(
        (
            firstPost,
            secondPost
        ) => {
            if (
                sortType === "popular"
            ) {
                return (
                    secondPost.likeCount -
                    firstPost.likeCount
                );
            }

            if (
                sortType === "newest"
            ) {
                return (
                    secondPost.createdAt -
                    firstPost.createdAt
                );
            }

            const pinnedDifference =
                Number(
                    secondPost.pinned
                ) -
                Number(
                    firstPost.pinned
                );

            if (
                pinnedDifference !== 0
            ) {
                return pinnedDifference;
            }

            return (
                secondPost.createdAt -
                firstPost.createdAt
            );
        }
    );

    return visiblePosts;
}


/*
========================================
投稿一覧を表示
========================================
*/

function renderPosts() {
    elements.myPostList.innerHTML =
        "";

    elements.likedPostList.innerHTML =
        "";

    const visiblePosts =
        getVisiblePosts();

    const targetList =
        currentTab === "likes"
            ? elements.likedPostList
            : elements.myPostList;

    visiblePosts.forEach(
        (post) => {
            targetList.appendChild(
                createPostElement(
                    post
                )
            );
        }
    );

    elements.postEmptyMessage
        .style.display =
            currentTab === "posts" &&
            visiblePosts.length === 0
                ? "block"
                : "none";

    elements.likeEmptyMessage
        .style.display =
            currentTab === "likes" &&
            visiblePosts.length === 0
                ? "block"
                : "none";

    elements.postCount.textContent =
        postData.length;
}


/*
========================================
投稿要素を作成
========================================
*/

function createPostElement(post) {
    const article =
        document.createElement(
            "article"
        );

    article.className =
        "post-card";

    article.dataset.postId =
        post.id;

    if (post.pinned) {
        article.classList.add(
            "pinned-post"
        );
    }

    const icon =
        document.createElement(
            "div"
        );

    icon.className =
        "post-icon";

    setImageOrText(
        icon,
        profileData.iconImage,
        getFirstCharacter(
            profileData.name
        )
    );

    const content =
        document.createElement(
            "div"
        );

    content.className =
        "post-content";

    if (post.pinned) {
        const pinnedLabel =
            document.createElement(
                "div"
            );

        pinnedLabel.className =
            "pinned-label";

        pinnedLabel.textContent =
            "📌 固定された投稿";

        content.appendChild(
            pinnedLabel
        );
    }

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "post-header";

    const headerMain =
        document.createElement(
            "div"
        );

    headerMain.className =
        "post-header-main";

    const name =
        document.createElement(
            "strong"
        );

    name.textContent =
        profileData.name;

    const userId =
        document.createElement(
            "span"
        );

    userId.textContent =
        `@${profileData.userId}`;

    const createdAt =
        document.createElement(
            "span"
        );

    createdAt.textContent =
        `・${formatRelativeTime(
            post.createdAt
        )}`;

    headerMain.append(
        name,
        userId,
        createdAt
    );

    const menuWrapper =
        document.createElement(
            "div"
        );

    menuWrapper.className =
        "post-menu-wrapper";

    const menuButton =
        document.createElement(
            "button"
        );

    menuButton.type =
        "button";

    menuButton.className =
        "post-menu-button";

    menuButton.textContent =
        "⋯";

    menuButton.setAttribute(
        "aria-label",
        "投稿メニューを開く"
    );

    menuButton.setAttribute(
        "aria-expanded",
        "false"
    );

    const menu =
        document.createElement(
            "div"
        );

    menu.className =
        "post-menu";

    const pinButton =
        createMenuButton(
            post.pinned
                ? "固定を解除"
                : "プロフィールに固定",

            "pin-post-button"
        );

    const editButton =
        createMenuButton(
            "編集",

            "edit-post-button"
        );

    const deleteButton =
        createMenuButton(
            "削除",

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
        document.createElement(
            "p"
        );

    text.className =
        "post-text";

    text.textContent =
        post.text;

    const location =
        document.createElement(
            "p"
        );

    location.className =
        "post-location";

    location.textContent =
        post.location
            ? `📍 ${post.location}`
            : "📍 位置情報なし";

    const action =
        document.createElement(
            "div"
        );

    action.className =
        "post-action";

    const likeButton =
        document.createElement(
            "button"
        );

    likeButton.type =
        "button";

    likeButton.className =
        "post-action-button";

    likeButton.setAttribute(
        "aria-label",

        post.liked
            ? "いいねを取り消す"
            : "いいねする"
    );

    if (post.liked) {
        likeButton.classList.add(
            "liked"
        );
    }

    likeButton.textContent =
        post.liked
            ? `♥ ${post.likeCount}`
            : `♡ ${post.likeCount}`;

    menuButton.addEventListener(
        "click",

        (event) => {
            event.stopPropagation();

            const willOpen =
                !menu.classList.contains(
                    "open"
                );

            closeAllPostMenus();

            menu.classList.toggle(
                "open",
                willOpen
            );

            menuButton.setAttribute(
                "aria-expanded",
                String(willOpen)
            );
        }
    );

    pinButton.addEventListener(
        "click",

        () => {
            togglePin(
                post.id
            );
        }
    );

    editButton.addEventListener(
        "click",

        () => {
            openPostEditModal(
                post.id
            );
        }
    );

    deleteButton.addEventListener(
        "click",

        () => {
            openDeleteConfirmModal(
                post.id
            );
        }
    );

    likeButton.addEventListener(
        "click",

        () => {
            toggleLike(
                post.id
            );
        }
    );

    action.appendChild(
        likeButton
    );

    content.append(
        header,
        text,
        location,
        action
    );

    article.append(
        icon,
        content
    );

    return article;
}


/*
========================================
投稿メニューボタンを作成
========================================
*/

function createMenuButton(
    text,
    className
) {
    const button =
        document.createElement(
            "button"
        );

    button.type =
        "button";

    button.className =
        className;

    button.textContent =
        text;

    return button;
}


/*
========================================
投稿日時を相対表示
========================================
*/

function formatRelativeTime(timestamp) {
    const elapsed =
        Date.now() - timestamp;

    const minute =
        60 * 1000;

    const hour =
        60 * minute;

    const day =
        24 * hour;

    if (
        elapsed < minute
    ) {
        return "たった今";
    }

    if (
        elapsed < hour
    ) {
        return `${Math.floor(
            elapsed / minute
        )}分前`;
    }

    if (
        elapsed < day
    ) {
        return `${Math.floor(
            elapsed / hour
        )}時間前`;
    }

    if (
        elapsed < day * 7
    ) {
        return `${Math.floor(
            elapsed / day
        )}日前`;
    }

    return new Date(
        timestamp
    ).toLocaleDateString(
        "ja-JP"
    );
}


/*
========================================
すべての投稿メニューを閉じる
========================================
*/

function closeAllPostMenus() {
    document
        .querySelectorAll(
            ".post-menu.open"
        )
        .forEach(
            (menu) => {
                menu.classList.remove(
                    "open"
                );

                const menuButton =
                    menu.previousElementSibling;

                if (menuButton) {
                    menuButton.setAttribute(
                        "aria-expanded",
                        "false"
                    );
                }
            }
        );
}


/*
========================================
投稿を固定・固定解除
========================================
*/

function togglePin(postId) {
    const targetPost =
        postData.find(
            (post) =>
                post.id === postId
        );

    if (!targetPost) {
        return;
    }

    const nextPinnedState =
        !targetPost.pinned;

    postData =
        postData.map(
            (post) => {
                if (
                    post.id === postId
                ) {
                    return {
                        ...post,

                        pinned:
                            nextPinnedState
                    };
                }

                if (
                    nextPinnedState
                ) {
                    return {
                        ...post,

                        pinned:
                            false
                    };
                }

                return post;
            }
        );

    saveStorage(
        STORAGE_KEYS.posts,
        postData
    );

    closeAllPostMenus();

    renderPosts();

    showToast(
        nextPinnedState
            ? "投稿を固定しました。"
            : "投稿の固定を解除しました。"
    );
}


/*
========================================
いいね・いいね解除
========================================
*/

function toggleLike(postId) {
    postData =
        postData.map(
            (post) => {
                if (
                    post.id !== postId
                ) {
                    return post;
                }

                const nextLiked =
                    !post.liked;

                return {
                    ...post,

                    liked:
                        nextLiked,

                    likeCount:
                        nextLiked
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


/*
========================================
プロフィール編集を開く
========================================
*/

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

    elements.iconImageInput.value =
        "";

    elements.coverImageInput.value =
        "";

    elements.profileFormError.textContent =
        "";

    updateDescriptionCharacterCount();

    updateEditImagePreview();

    openModal(
        elements.profileEditModal
    );

    elements.editName.focus();
}


/*
========================================
プロフィール入力チェック
========================================
*/

function validateProfileForm() {
    const name =
        elements.editName
            .value
            .trim();

    const userId =
        elements.editUserId
            .value
            .trim();

    const description =
        elements.editDescription
            .value;

    const location =
        elements.editLocation
            .value
            .trim();

    if (!name) {
        return {
            valid:
                false,

            message:
                "名前を入力してください。",

            target:
                elements.editName
        };
    }

    if (
        name.length < 1 ||
        name.length > 30
    ) {
        return {
            valid:
                false,

            message:
                "名前は1〜30文字で入力してください。",

            target:
                elements.editName
        };
    }

    if (
        !/^[a-zA-Z0-9_]{3,20}$/
            .test(userId)
    ) {
        return {
            valid:
                false,

            message:
                "ユーザーIDは3〜20文字の半角英数字とアンダーバーで入力してください。",

            target:
                elements.editUserId
        };
    }

    const reservedUserIds = [
        "admin",
        "administrator",
        "root",
        "support"
    ];

    if (
        reservedUserIds.includes(
            userId.toLowerCase()
        )
    ) {
        return {
            valid:
                false,

            message:
                "このユーザーIDは使用できません。",

            target:
                elements.editUserId
        };
    }

    if (
        description.length > 160
    ) {
        return {
            valid:
                false,

            message:
                "自己紹介は160文字以内で入力してください。",

            target:
                elements.editDescription
        };
    }

    if (
        location.length > 30
    ) {
        return {
            valid:
                false,

            message:
                "地域は30文字以内で入力してください。",

            target:
                elements.editLocation
        };
    }

    return {
        valid:
            true,

        data: {
            name,

            userId,

            description:
                description.trim(),

            location
        }
    };
}


/*
========================================
プロフィールを保存
========================================
*/

async function saveProfile(event) {
    event.preventDefault();

    const validation =
        validateProfileForm();

    if (!validation.valid) {
        elements.profileFormError
            .textContent =
                validation.message;

        validation.target.focus();

        return;
    }

    setButtonLoading(
        elements.saveProfileButton,
        true,
        "保存中…"
    );

    await delay(350);

    const nextProfile = {
        ...profileData,

        ...validation.data,

        iconImage:
            temporaryIconImage,

        coverImage:
            temporaryCoverImage
    };

    const isSaved =
        saveStorage(
            STORAGE_KEYS.profile,
            nextProfile
        );

    if (!isSaved) {
        setButtonLoading(
            elements.saveProfileButton,
            false,
            "保存"
        );

        return;
    }

    profileData =
        nextProfile;

    renderProfile();

    renderPosts();

    closeModal(
        elements.profileEditModal
    );

    setButtonLoading(
        elements.saveProfileButton,
        false,
        "保存"
    );

    showToast(
        "プロフィールを保存しました。"
    );
}


/*
========================================
画像を選択
========================================
*/

function handleImageChange(
    event,
    imageType
) {
    const file =
        event.target.files[0];

    if (!file) {
        return;
    }

    const validation =
        validateImageFile(
            file
        );

    if (!validation.valid) {
        event.target.value =
            "";

        showToast(
            validation.message
        );

        return;
    }

    elements.imageLoading
        .classList.add(
            "show"
        );

    convertImageToBase64(
        file
    )
        .then(
            (imageData) => {
                if (
                    imageType ===
                    "icon"
                ) {
                    temporaryIconImage =
                        imageData;

                } else {
                    temporaryCoverImage =
                        imageData;
                }

                updateEditImagePreview();
            }
        )
        .catch(
            (error) => {
                console.error(
                    error
                );

                showToast(
                    "画像の読み込みに失敗しました。"
                );
            }
        )
        .finally(
            () => {
                elements.imageLoading
                    .classList.remove(
                        "show"
                    );
            }
        );
}


/*
========================================
画像ファイルを確認
========================================
*/

function validateImageFile(file) {
    if (
        !ALLOWED_IMAGE_TYPES
            .includes(
                file.type
            )
    ) {
        return {
            valid:
                false,

            message:
                "JPGまたはPNG形式の画像を選択してください。"
        };
    }

    if (
        file.size >
        MAX_IMAGE_SIZE
    ) {
        return {
            valid:
                false,

            message:
                "画像サイズは2MB以内にしてください。"
        };
    }

    return {
        valid:
            true
    };
}


/*
========================================
画像をBase64へ変換
========================================
*/

function convertImageToBase64(file) {
    return new Promise(
        (
            resolve,
            reject
        ) => {
            const reader =
                new FileReader();

            reader.onload =
                () => {
                    resolve(
                        reader.result
                    );
                };

            reader.onerror =
                () => {
                    reject(
                        new Error(
                            "画像読み込みエラー"
                        )
                    );
                };

            reader.readAsDataURL(
                file
            );
        }
    );
}


/*
========================================
アイコン画像を削除
========================================
*/

function removeIconImage() {
    temporaryIconImage =
        "";

    elements.iconImageInput.value =
        "";

    updateEditImagePreview();

    showToast(
        "保存するとアイコンが初期状態に戻ります。"
    );
}


/*
========================================
ヘッダー画像を削除
========================================
*/

function removeCoverImage() {
    temporaryCoverImage =
        "";

    elements.coverImageInput.value =
        "";

    updateEditImagePreview();

    showToast(
        "保存するとヘッダー画像が初期状態に戻ります。"
    );
}


/*
========================================
編集画面の画像プレビュー更新
========================================
*/

function updateEditImagePreview() {
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


/*
========================================
自己紹介文字数更新
========================================
*/

function updateDescriptionCharacterCount() {
    elements.descriptionCharacterCount
        .textContent =
            elements.editDescription
                .value
                .length;
}


/*
========================================
投稿編集画面を開く
========================================
*/

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

    elements.postFormError.textContent =
        "";

    updatePostCharacterCount();

    closeAllPostMenus();

    openModal(
        elements.postEditModal
    );

    elements.editPostText.focus();
}


/*
========================================
投稿入力チェック
========================================
*/

function validatePostForm() {
    const text =
        elements.editPostText
            .value
            .trim();

    const location =
        elements.editPostLocation
            .value
            .trim();

    if (!text) {
        return {
            valid:
                false,

            message:
                "投稿内容を入力してください。",

            target:
                elements.editPostText
        };
    }

    if (
        text.length > 300
    ) {
        return {
            valid:
                false,

            message:
                "投稿内容は300文字以内で入力してください。",

            target:
                elements.editPostText
        };
    }

    if (
        location.length > 50
    ) {
        return {
            valid:
                false,

            message:
                "位置情報は50文字以内で入力してください。",

            target:
                elements.editPostLocation
        };
    }

    return {
        valid:
            true,

        data: {
            text,

            location
        }
    };
}


/*
========================================
投稿を保存
========================================
*/

async function savePost(event) {
    event.preventDefault();

    const validation =
        validatePostForm();

    if (!validation.valid) {
        elements.postFormError
            .textContent =
                validation.message;

        validation.target.focus();

        return;
    }

    setButtonLoading(
        elements.savePostButton,
        true,
        "保存中…"
    );

    await delay(300);

    const postId =
        Number(
            elements.editPostId.value
        );

    postData =
        postData.map(
            (post) => {
                if (
                    post.id !== postId
                ) {
                    return post;
                }

                return {
                    ...post,

                    ...validation.data
                };
            }
        );

    saveStorage(
        STORAGE_KEYS.posts,
        postData
    );

    renderPosts();

    closeModal(
        elements.postEditModal
    );

    setButtonLoading(
        elements.savePostButton,
        false,
        "保存"
    );

    showToast(
        "投稿を更新しました。"
    );
}


/*
========================================
投稿文字数更新
========================================
*/

function updatePostCharacterCount() {
    elements.postCharacterCount
        .textContent =
            elements.editPostText
                .value
                .length;
}


/*
========================================
投稿削除確認を開く
========================================
*/

function openDeleteConfirmModal(postId) {
    const post =
        postData.find(
            (item) =>
                item.id === postId
        );

    if (!post) {
        return;
    }

    deleteTargetPostId =
        postId;

    const maximumLength =
        80;

    const previewText =
        post.text.length >
        maximumLength
            ? `${post.text.slice(
                0,
                maximumLength
            )}…`
            : post.text;

    elements.deletePostPreview
        .textContent =
            `「${previewText}」`;

    closeAllPostMenus();

    openModal(
        elements.deleteConfirmModal
    );
}


/*
========================================
投稿を削除
========================================
*/

async function deletePost() {
    if (
        deleteTargetPostId ===
        null
    ) {
        return;
    }

    setButtonLoading(
        elements.confirmDeleteButton,
        true,
        "削除中…"
    );

    const targetElement =
        document.querySelector(
            `[data-post-id="${deleteTargetPostId}"]`
        );

    if (targetElement) {
        targetElement.classList.add(
            "deleting"
        );
    }

    await delay(250);

    postData =
        postData.filter(
            (post) =>
                post.id !==
                deleteTargetPostId
        );

    saveStorage(
        STORAGE_KEYS.posts,
        postData
    );

    deleteTargetPostId =
        null;

    renderPosts();

    renderProfile();

    closeModal(
        elements.deleteConfirmModal
    );

    elements.deletePostPreview
        .textContent =
            "";

    setButtonLoading(
        elements.confirmDeleteButton,
        false,
        "削除する"
    );

    showToast(
        "投稿を削除しました。"
    );
}


/*
========================================
投稿・いいねタブ切り替え
========================================
*/

function changeTab(tabName) {
    currentTab =
        tabName;

    document
        .querySelectorAll(
            ".profile-tab"
        )
        .forEach(
            (tabButton) => {
                const isActive =
                    tabButton.dataset.tab ===
                    tabName;

                tabButton.classList.toggle(
                    "active",
                    isActive
                );

                tabButton.setAttribute(
                    "aria-selected",
                    String(isActive)
                );
            }
        );

    document
        .querySelectorAll(
            ".profile-tab-content"
        )
        .forEach(
            (content) => {
                content.classList.remove(
                    "active"
                );
            }
        );

    const targetContent =
        tabName === "posts"
            ? document.getElementById(
                "postsTabContent"
            )
            : document.getElementById(
                "likesTabContent"
            );

    targetContent.classList.add(
        "active"
    );

    renderPosts();
}


/*
========================================
フォロー・フォロワー一覧を開く
========================================
*/

function openUserList(type) {
    const isFollowingList =
        type === "following";

    elements.userListTitle
        .textContent =
            isFollowingList
                ? "フォロー中"
                : "フォロワー";

    /*
    フォロー中一覧はisFollowingがtrueの人だけ
    */

    const users =
        isFollowingList
            ? getFollowingUsers()
            : followData.followers;

    elements.userList.innerHTML =
        "";

    /*
    一覧が0人の場合
    */

    if (users.length === 0) {
        const emptyMessage =
            document.createElement(
                "p"
            );

        emptyMessage.className =
            "empty-message";

        emptyMessage.style.display =
            "block";

        emptyMessage.textContent =
            isFollowingList
                ? "フォロー中のユーザーはいません。"
                : "フォロワーはいません。";

        elements.userList.appendChild(
            emptyMessage
        );

        openModal(
            elements.userListModal
        );

        return;
    }

    users.forEach(
        (user) => {
            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "user-list-item";

            const icon =
                document.createElement(
                    "div"
                );

            icon.className =
                "user-list-icon";

            icon.textContent =
                user.iconText;

            const information =
                document.createElement(
                    "div"
                );

            information.className =
                "user-list-information";

            const name =
                document.createElement(
                    "strong"
                );

            name.textContent =
                user.name;

            const userId =
                document.createElement(
                    "span"
                );

            userId.textContent =
                `@${user.userId}`;

            information.append(
                name,
                userId
            );

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "user-list-button";

            updateFollowButton(
                button,
                user.isFollowing
            );

            button.addEventListener(
                "click",

                () => {
                    const nextFollowingState =
                        !user.isFollowing;

                    /*
                    同じユーザーの状態を全データで同期
                    */

                    updateFollowingState(
                        user.userId,
                        nextFollowingState
                    );

                    saveStorage(
                        STORAGE_KEYS.follow,
                        followData
                    );

                    /*
                    プロフィール上部の人数を更新
                    */

                    renderProfile();

                    /*
                    一覧を再表示
                    */

                    openUserList(type);

                    showToast(
                        nextFollowingState
                            ? "フォローしました。"
                            : "フォローを解除しました。"
                    );
                }
            );

            item.append(
                icon,
                information,
                button
            );

            elements.userList
                .appendChild(
                    item
                );
        }
    );

    openModal(
        elements.userListModal
    );
}


/*
========================================
フォローボタン表示更新
========================================
*/

function updateFollowButton(
    button,
    isFollowing
) {
    button.textContent =
        isFollowing
            ? "フォロー中"
            : "フォローする";

    button.classList.toggle(
        "following",
        isFollowing
    );
}


/*
========================================
プロフィールURLコピー
========================================
*/

async function copyProfileUrl() {
    const profileUrl =
        createProfileUrl();

    try {
        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {
            await navigator.clipboard
                .writeText(
                    profileUrl
                );

        } else {
            fallbackCopyText(
                profileUrl
            );
        }

        showToast(
            "プロフィールURLをコピーしました。"
        );

    } catch (error) {
        console.error(
            "URLコピーに失敗しました。",
            error
        );

        showToast(
            "URLをコピーできませんでした。"
        );
    }
}


/*
========================================
プロフィールURL作成
========================================
*/

function createProfileUrl() {
    const currentUrl =
        new URL(
            window.location.href
        );

    currentUrl.searchParams.set(
        "user",
        profileData.userId
    );

    return currentUrl.toString();
}


/*
========================================
Clipboard APIが使えない場合のコピー
========================================
*/

function fallbackCopyText(text) {
    const textArea =
        document.createElement(
            "textarea"
        );

    textArea.value =
        text;

    textArea.style.position =
        "fixed";

    textArea.style.opacity =
        "0";

    document.body.appendChild(
        textArea
    );

    textArea.focus();

    textArea.select();

    const succeeded =
        document.execCommand(
            "copy"
        );

    textArea.remove();

    if (!succeeded) {
        throw new Error(
            "コピーに失敗しました。"
        );
    }
}


/*
========================================
モーダルを開く
========================================
*/

function openModal(modalElement) {
    modalElement.classList.add(
        "open"
    );

    modalElement.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}


/*
========================================
モーダルを閉じる
========================================
*/

function closeModal(modalElement) {
    modalElement.classList.remove(
        "open"
    );

    modalElement.setAttribute(
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


/*
========================================
アイコンへ画像または文字を表示
========================================
*/

function setImageOrText(
    element,
    imageData,
    text
) {
    if (imageData) {
        element.textContent =
            "";

        element.style.backgroundImage =
            `url("${imageData}")`;

    } else {
        element.textContent =
            text;

        element.style.backgroundImage =
            "";
    }
}


/*
========================================
名前の先頭文字を取得
========================================
*/

function getFirstCharacter(name) {
    const trimmedName =
        String(name).trim();

    if (!trimmedName) {
        return "沖";
    }

    return Array.from(
        trimmedName
    )[0];
}


/*
========================================
ボタンの読み込み表示
========================================
*/

function setButtonLoading(
    button,
    isLoading,
    loadingText
) {
    if (isLoading) {
        button.dataset.originalText =
            button.textContent;

        button.textContent =
            loadingText;

        button.disabled =
            true;

    } else {
        button.textContent =
            button.dataset.originalText ||
            loadingText;

        button.disabled =
            false;
    }
}


/*
========================================
指定時間待機
========================================
*/

function delay(milliseconds) {
    return new Promise(
        (resolve) => {
            setTimeout(
                resolve,
                milliseconds
            );
        }
    );
}


/*
========================================
Toast通知
========================================
*/

function showToast(message) {
    elements.toast.textContent =
        message;

    elements.toast.classList.add(
        "show"
    );

    clearTimeout(
        toastTimer
    );

    toastTimer =
        setTimeout(
            () => {
                elements.toast
                    .classList.remove(
                        "show"
                    );
            },
            2500
        );
}


/*
========================================
イベント登録
========================================
*/

function setupEventListeners() {
    elements.openProfileEditButton
        .addEventListener(
            "click",
            openProfileEditModal
        );

    elements.copyProfileUrlButton
        .addEventListener(
            "click",
            copyProfileUrl
        );

    elements.postCountButton
        .addEventListener(
            "click",

            () => {
                changeTab(
                    "posts"
                );

                document
                    .querySelector(
                        ".profile-posts"
                    )
                    .scrollIntoView({
                        behavior:
                            "smooth"
                    });
            }
        );

    elements.profileEditForm
        .addEventListener(
            "submit",
            saveProfile
        );

    elements.editDescription
        .addEventListener(
            "input",
            updateDescriptionCharacterCount
        );

    elements.editName
        .addEventListener(
            "input",
            updateEditImagePreview
        );

    elements.iconImageInput
        .addEventListener(
            "change",

            (event) => {
                handleImageChange(
                    event,
                    "icon"
                );
            }
        );

    elements.coverImageInput
        .addEventListener(
            "change",

            (event) => {
                handleImageChange(
                    event,
                    "cover"
                );
            }
        );

    elements.removeIconImageButton
        .addEventListener(
            "click",
            removeIconImage
        );

    elements.removeCoverImageButton
        .addEventListener(
            "click",
            removeCoverImage
        );

    elements.postEditForm
        .addEventListener(
            "submit",
            savePost
        );

    elements.editPostText
        .addEventListener(
            "input",
            updatePostCharacterCount
        );

    elements.confirmDeleteButton
        .addEventListener(
            "click",
            deletePost
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
        .querySelectorAll(
            ".profile-tab"
        )
        .forEach(
            (tabButton) => {
                tabButton.addEventListener(
                    "click",

                    () => {
                        changeTab(
                            tabButton.dataset.tab
                        );
                    }
                );
            }
        );

    elements.openFollowingButton
        .addEventListener(
            "click",

            () => {
                openUserList(
                    "following"
                );
            }
        );

    elements.openFollowerButton
        .addEventListener(
            "click",

            () => {
                openUserList(
                    "followers"
                );
            }
        );

    document
        .querySelectorAll(
            "[data-close-modal]"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",

                    () => {
                        const modalType =
                            button.dataset
                                .closeModal;

                        const modalMap = {
                            profile:
                                elements.profileEditModal,

                            post:
                                elements.postEditModal,

                            delete:
                                elements.deleteConfirmModal,

                            "user-list":
                                elements.userListModal
                        };

                        if (
                            modalMap[
                                modalType
                            ]
                        ) {
                            closeModal(
                                modalMap[
                                    modalType
                                ]
                            );
                        }

                        if (
                            modalType ===
                            "delete"
                        ) {
                            deleteTargetPostId =
                                null;

                            elements
                                .deletePostPreview
                                .textContent =
                                    "";
                        }
                    }
                );
            }
        );

    document.addEventListener(
        "keydown",

        (event) => {
            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            document
                .querySelectorAll(
                    ".modal.open"
                )
                .forEach(
                    (modal) => {
                        closeModal(
                            modal
                        );
                    }
                );

            closeAllPostMenus();

            deleteTargetPostId =
                null;
        }
    );

    document.addEventListener(
        "click",
        closeAllPostMenus
    );
}


/*
========================================
プロフィール画面初期化
========================================
*/

function initializeProfilePage() {
    /*
    修正されたフォロー情報を保存
    */

    saveStorage(
        STORAGE_KEYS.follow,
        followData
    );

    renderProfile();

    renderPosts();

    setupEventListeners();
}


/*
========================================
HTML読み込み完了後に実行
========================================
*/

document.addEventListener(
    "DOMContentLoaded",
    initializeProfilePage
);