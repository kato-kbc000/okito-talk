import {
    getCurrentUser,
    ensureCurrentProfile,
    createPost,
    getTimelinePosts
} from "../api.js";

let currentUser = null;
let currentProfile = null;

const postForm = document.getElementById("postForm");
const postContent = document.getElementById("postContent");
const areaSelect = document.getElementById("areaSelect");
const characterCount = document.getElementById("characterCount");
const postList = document.getElementById("postList");

const placeForm = document.getElementById("placeForm");
const placeName = document.getElementById("placeName");
const placeAddress =
    document.getElementById("placeAddress");

const addPinButton =
    document.getElementById("addPinButton");

const resetMapButton = document.getElementById("resetMapButton");
const mapStatus = document.getElementById("mapStatus");

const maximumLength = 200;

const okinawaCenter = {
    lat: 26.3344,
    lng: 127.8056
};

let map;
let geocoder;
let markers = [];

/* ================================
   Google Maps
================================ */

window.initMap = function () {
    const mapElement =
        document.getElementById("map");

    if (!mapElement) {
        console.error("地図の要素が見つかりません。");
        return;
    }

    map = new google.maps.Map(mapElement, {
        center: okinawaCenter,
        zoom: 9,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
    });

    geocoder = new google.maps.Geocoder();

    const defaultPlaces = [
        {
            name: "瀬長島",
            lat: 26.1746,
            lng: 127.6764,
            description: "海がきれいなおすすめスポット"
        },
        {
            name: "那覇市",
            lat: 26.2124,
            lng: 127.6809,
            description: "国際通りやカフェの投稿"
        },
        {
            name: "沖縄市",
            lat: 26.3344,
            lng: 127.8056,
            description: "エイサーイベント情報"
        },
        {
            name: "北谷町",
            lat: 26.3158,
            lng: 127.7575,
            description: "海沿いのお店やカフェ"
        },
        {
            name: "名護市",
            lat: 26.5915,
            lng: 127.9773,
            description: "北部のおすすめ情報"
        }
    ];

    defaultPlaces.forEach((place) => {
        addMapMarker(place);
    });

    mapStatus.textContent =
        `${defaultPlaces.length}件の場所を表示しています。`;

    connectPostMapButtons();
};

function addMapMarker(place) {
    if (!map) {
        return;
    }

    const marker = new google.maps.Marker({
        map: map,
        position: {
            lat: place.lat,
            lng: place.lng
        },
        title: place.name
    });

    const addressHtml = place.address
        ? `<p>${escapeHtml(place.address)}</p>`
        : "";

    const descriptionHtml = place.description
        ? `<p>${escapeHtml(place.description)}</p>`
        : "";

    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div class="map-info-window">
                <strong>
                    ${escapeHtml(place.name)}
                </strong>

                ${addressHtml}
                ${descriptionHtml}
            </div>
        `
    });

    marker.addListener("click", () => {
        markers.forEach((item) => {
            item.infoWindow.close();
        });

        infoWindow.open({
            map: map,
            anchor: marker
        });

        map.panTo(marker.getPosition());
        map.setZoom(15);

        mapStatus.textContent =
            `${place.name}を表示しています。`;
    });

    markers.push({
        marker: marker,
        infoWindow: infoWindow,
        place: place
    });
}

function focusMap(lat, lng, label) {
    if (!map) {
        return;
    }

    map.panTo({
        lat,
        lng
    });

    map.setZoom(14);

    mapStatus.textContent =
        `${label}付近を表示しています。`;

    document
        .getElementById("mapSection")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}

function connectPostMapButtons() {
    const postCards =
        document.querySelectorAll(".post-card");

    postCards.forEach((card) => {
        const button =
            card.querySelector(".map-focus-button");

        if (!button) {
            return;
        }

        button.addEventListener("click", () => {
            const lat = Number(card.dataset.lat);
            const lng = Number(card.dataset.lng);
            const label = button.textContent.trim();

            focusMap(lat, lng, label);
        });
    });
}

resetMapButton.addEventListener("click", () => {
    if (!map) {
        return;
    }

    map.setCenter(okinawaCenter);
    map.setZoom(9);

    markers.forEach((item) => {
        item.infoWindow.close();
    });

    mapStatus.textContent =
        `${markers.length}件の場所を表示しています。`;
});

/* ================================
   ピン追加
================================ */

placeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = placeName.value.trim();
    const address = placeAddress.value.trim();

    if (!name) {
        alert("場所の名前を入力してください。");
        return;
    }

    if (!address) {
        alert("住所を入力してください。");
        return;
    }

    if (!geocoder) {
        alert("地図の準備がまだ完了していません。");
        return;
    }

    addPinButton.disabled = true;
    addPinButton.textContent = "住所を検索中...";

    try {
        const response = await geocoder.geocode({
            address: address,

            // 日本国内の結果を優先
            region: "jp",

            // 沖縄県内の結果に絞りやすくする
            componentRestrictions: {
                country: "JP",
                administrativeArea: "沖縄県"
            }
        });

        if (!response.results.length) {
            alert(
                "住所が見つかりませんでした。\n" +
                "市町村名や番地を確認してください。"
            );
            return;
        }

        const result = response.results[0];
        const location = result.geometry.location;

        const lat = location.lat();
        const lng = location.lng();
        const formattedAddress = result.formatted_address;

        addMapMarker({
            name: name,
            lat: lat,
            lng: lng,
            address: formattedAddress,
            description: "ユーザーが追加した場所"
        });

        focusMap(
            lat,
            lng,
            `${name}（${formattedAddress}）`
        );

        mapStatus.textContent =
            `${name}を地図へ追加しました。`;

        placeForm.reset();
    } catch (error) {
        console.error("住所検索エラー:", error);

        alert(
            "住所の検索に失敗しました。\n" +
            "Geocoding APIの設定を確認してください。"
        );
    } finally {
        addPinButton.disabled = false;
        addPinButton.textContent = "地図に追加";
    }
});

/* ================================
   投稿フォーム
================================ */

postContent.addEventListener("input", () => {
    const length = postContent.value.length;

    characterCount.textContent =
        `${length} / ${maximumLength}`;

    characterCount.style.color =
        length >= maximumLength
            ? "#e5484d"
            : "#8791a0";
});

postForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const content = postContent.value.trim();
    const area = areaSelect.value;

    if (!content) {
        alert("投稿内容を入力してください。");
        return;
    }

    if (!currentUser) {
        alert("ログイン情報を確認できません。もう一度ログインしてください。");
        window.location.href = "./login.html";
        return;
    }

    try {
        const coordinates = getAreaCoordinates(area);
        await createPost({
            userId: currentUser.id,
            content,
            locationName: area,
            latitude: coordinates.lat,
            longitude: coordinates.lng
        });

        const article = createPostCard(content, area);
        postList.prepend(article);
    } catch (error) {
        console.error("投稿保存エラー:", error);
        alert("投稿を保存できませんでした。SupabaseのRLS設定を確認してください。");
        return;
    }

    postContent.value = "";
    areaSelect.value = "沖縄県";

    characterCount.textContent =
        `0 / ${maximumLength}`;

    characterCount.style.color =
        "#8791a0";
});

function createPostCard(content, area) {
    const coordinates =
        getAreaCoordinates(area);

    const article =
        document.createElement("article");

    article.className = "post-card";
    article.dataset.lat = coordinates.lat;
    article.dataset.lng = coordinates.lng;
    article.dataset.following = "true";

    article.innerHTML = `
        <div class="post-user-icon">
            ${escapeHtml((currentProfile?.display_name || "沖").charAt(0))}
        </div>

        <div class="post-main">

            <div class="post-header">

                <div>
                    <strong>${escapeHtml(currentProfile?.display_name || "ユーザー")}</strong>
                    <span>@${escapeHtml(currentProfile?.username || "user")}</span>
                </div>

                <span class="post-time">
                    たった今
                </span>

            </div>

            <p class="post-text"></p>

            <div class="post-bottom">

                <button
                    type="button"
                    class="map-focus-button"
                ></button>

                <button
                    type="button"
                    class="like-button"
                >
                    ♡ 0
                </button>

            </div>

        </div>
    `;

    article
        .querySelector(".post-text")
        .textContent = content;

    const mapButton =
        article.querySelector(".map-focus-button");

    mapButton.textContent = `📍${area}`;

    mapButton.addEventListener("click", () => {
        focusMap(
            coordinates.lat,
            coordinates.lng,
            area
        );
    });

    addLikeEvent(
        article.querySelector(".like-button")
    );

    addMapMarker({
        name: area,
        lat: coordinates.lat,
        lng: coordinates.lng,
        description: content
    });

    return article;
}

function getAreaCoordinates(area) {
    const coordinates = {
        "沖縄県": {
            lat: 26.3344,
            lng: 127.8056
        },
        "那覇市": {
            lat: 26.2124,
            lng: 127.6809
        },
        "浦添市": {
            lat: 26.2458,
            lng: 127.7218
        },
        "宜野湾市": {
            lat: 26.2816,
            lng: 127.7785
        },
        "沖縄市": {
            lat: 26.3344,
            lng: 127.8056
        },
        "名護市": {
            lat: 26.5915,
            lng: 127.9773
        },
        "糸満市": {
            lat: 26.1236,
            lng: 127.6658
        },
        "うるま市": {
            lat: 26.3790,
            lng: 127.8575
        }
    };

    return coordinates[area] || coordinates["沖縄県"];
}

/* ================================
   全体・フォロー中タブ
================================ */

const timelineTabs =
    document.querySelectorAll(".timeline-tab");

timelineTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        timelineTabs.forEach((item) => {
            item.classList.remove("active");
        });

        tab.classList.add("active");

        const selectedTab = tab.dataset.tab;
        const posts =
            document.querySelectorAll(".post-card");

        posts.forEach((post) => {
            if (selectedTab === "all") {
                post.hidden = false;
                return;
            }

            post.hidden =
                post.dataset.following !== "true";
        });
    });
});

/* ================================
   いいね
================================ */

document
    .querySelectorAll(".like-button")
    .forEach((button) => {
        addLikeEvent(button);
    });

function addLikeEvent(button) {
    button.addEventListener("click", () => {
        const currentText =
            button.textContent.trim();

        const currentCount =
            Number(currentText.replace(/\D/g, "")) || 0;

        const isLiked =
            button.classList.toggle("liked");

        button.textContent =
            isLiked
                ? `♥ ${currentCount + 1}`
                : `♡ ${Math.max(0, currentCount - 1)}`;
    });
}

/* ================================
   HTMLエスケープ
================================ */

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* ================================
   Supabaseユーザー初期化
================================ */
async function initializeCurrentUser() {
    try {
        currentUser = await getCurrentUser();
        if (!currentUser) {
            window.location.href = "./login.html";
            return;
        }

        currentProfile = await ensureCurrentProfile(currentUser);

        const displayName = document.getElementById("currentUserDisplayName");
        const username = document.getElementById("currentUsername");
        const email = document.getElementById("currentUserEmail");
        const avatar = document.getElementById("currentUserAvatar");
        const postIcon = document.querySelector(".post-form-icon");

        if (displayName) displayName.textContent = currentProfile.display_name;
        if (username) username.textContent = `@${currentProfile.username}`;
        if (email) email.textContent = currentUser.email || "";
        if (avatar) avatar.textContent = (currentProfile.display_name || "沖").charAt(0);
        if (postIcon) postIcon.textContent = (currentProfile.display_name || "沖").charAt(0);

        await renderSupabaseTimeline();
    } catch (error) {
        console.error("ホーム初期化エラー:", error);
        alert("ユーザー情報を読み込めませんでした。");
    }
}

async function renderSupabaseTimeline() {
    try {
        const posts = await getTimelinePosts();
        if (!posts.length) return;
        postList.innerHTML = "";
        posts.forEach((post) => {
            const profile = post.profiles || {};
            const article = createPostCard(post.content, post.location_name || "沖縄県");
            const strong = article.querySelector(".post-header strong");
            const handle = article.querySelector(".post-header span");
            const icon = article.querySelector(".post-user-icon");
            const time = article.querySelector(".post-time");
            if (strong) strong.textContent = profile.display_name || "ユーザー";
            if (handle) handle.textContent = `@${profile.username || "user"}`;
            if (icon) icon.textContent = (profile.display_name || "沖").charAt(0);
            if (time) time.textContent = new Date(post.created_at).toLocaleString("ja-JP");
            postList.appendChild(article);
        });
    } catch (error) {
        console.error("投稿一覧取得エラー:", error);
    }
}

document.addEventListener("DOMContentLoaded", initializeCurrentUser);
