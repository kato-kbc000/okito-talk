// ---------- Dummy data ----------
const trends = [
  {
    cat: "テクノロジー・トレンド",
    tag: "#AIエージェント",
    count: "128,000件のポスト"
  },
  {
    cat: "スポーツ",
    tag: "夏の大会",
    count: "64,500件のポスト"
  },
  {
    cat: "エンタメ",
    tag: "新曲リリース",
    count: "41,200件のポスト"
  },
  {
    cat: "トレンド",
    tag: "#青space",
    count: "33,900件のポスト"
  },
  {
    cat: "ニュース",
    tag: "沖縄の天気",
    count: "21,000件のポスト"
  },
  {
    cat: "ゲーム",
    tag: "新作アップデート",
    count: "18,700件のポスト"
  }
];

const people = [
  {
    name: "Aoi Mizuno",
    handle: "@aoi_sea",
    bio: "写真家 / 海と空を撮っています",
    seed: "aoi"
  },
  {
    name: "Kenta Sora",
    handle: "@kenta_sky",
    bio: "フロントエンドエンジニア",
    seed: "kenta"
  },
  {
    name: "Hana Umi",
    handle: "@hana_wave",
    bio: "旅行ブロガー ✈️",
    seed: "hana"
  },
  {
    name: "Ryo Nami",
    handle: "@ryo_nami",
    bio: "音楽プロデューサー 🎧",
    seed: "ryo"
  },
  {
    name: "Yui Tsuki",
    handle: "@yui_moon",
    bio: "イラストレーター",
    seed: "yui"
  },
  {
    name: "Sora Blue",
    handle: "@sora_blue",
    bio: "デザイン / UI・UX",
    seed: "sora"
  }
];

// ---------- HTML要素の取得 ----------
const trendList = document.getElementById("trendList");
const peopleList = document.getElementById("peopleList");
const exploreGrid = document.getElementById("exploreGrid");

const tabs = document.querySelectorAll(".tab");
const indicator = document.getElementById("tabIndicator");
const panels = document.querySelectorAll(".panel");

const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");
const clearBtn = document.getElementById("clearBtn");
const emptyState = document.getElementById("emptyState");

// ---------- トレンド一覧を表示 ----------
function renderTrends(list = trends) {
  trendList.innerHTML = "";

  list.forEach((trend, index) => {
    const trendElement = document.createElement("div");

    trendElement.className = "trend-item";

    trendElement.innerHTML = `
      <div style="display:flex; align-items:center;">
        <div class="trend-rank">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <div class="trend-info">
          <div class="cat">${trend.cat}</div>
          <div class="tag">${trend.tag}</div>
          <div class="count">${trend.count}</div>
        </div>
      </div>
    `;

    trendList.appendChild(trendElement);
  });
}

// ---------- アカウント一覧を表示 ----------
function renderPeople(list = people) {
  peopleList.innerHTML = "";

  list.forEach((person) => {
    const personElement = document.createElement("div");

    personElement.className = "person-row";

    personElement.innerHTML = `
      <img
        src="https://api.dicebear.com/7.x/avataaars/svg?seed=${person.seed}"
        alt="${person.name}"
      >

      <div class="person-info">
        <div class="name">${person.name}</div>
        <div class="handle">${person.handle}</div>
        <div class="bio">${person.bio}</div>
      </div>

      <button class="follow-btn">
        フォロー
      </button>
    `;

    const followButton =
      personElement.querySelector(".follow-btn");

    followButton.addEventListener("click", () => {
      followButton.classList.toggle("following");

      followButton.textContent =
        followButton.classList.contains("following")
          ? "フォロー中"
          : "フォロー";
    });

    peopleList.appendChild(personElement);
  });
}

// ---------- 写真・動画一覧を表示 ----------
function renderMedia(seedOffset = 0) {
  exploreGrid.innerHTML = "";

  for (let index = 0; index < 12; index++) {
    const id = 200 + seedOffset + index;

    const likes =
      Math.floor(Math.random() * 900) + 50;

    const comments =
      Math.floor(Math.random() * 90) + 3;

    const tile = document.createElement("div");

    tile.className = "tile";

    tile.innerHTML = `
      <img
        src="https://picsum.photos/seed/blue${id}/400/400"
        loading="lazy"
        alt="投稿画像"
      >

      <div class="tile-overlay">
        <div class="tile-stat">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 21s-7.5-4.6-10-9.3C.6 8 2.4 4 6.6 4c2 0 3.6 1.1 4.4 2.6C11.8 5.1 13.4 4 15.4 4 19.6 4 21.4 8 20 11.7 17.5 16.4 12 21 12 21z"
            />
          </svg>

          ${likes}
        </div>

        <div class="tile-stat">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 4h16v12H8l-4 4z" />
          </svg>

          ${comments}
        </div>
      </div>
    `;

    exploreGrid.appendChild(tile);
  }
}

// ---------- タブの下線を移動 ----------
function moveIndicator(tab) {
  if (!tab || !indicator) {
    return;
  }

  indicator.style.width =
    `${tab.offsetWidth}px`;

  indicator.style.left =
    `${tab.offsetLeft}px`;
}

// ---------- 選択中のタブを変更 ----------
function setActiveTab(tab) {
  tabs.forEach((tabElement) => {
    tabElement.classList.remove("active");
  });

  tab.classList.add("active");

  moveIndicator(tab);

  const targetPanelName =
    tab.dataset.panel;

  panels.forEach((panel) => {
    panel.classList.toggle(
      "active",
      panel.id === `panel-${targetPanelName}`
    );
  });
}

// ---------- タブのクリック処理 ----------
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab);
  });
});

// ---------- サジェスト内容を作成 ----------
function makeSuggestionHTML() {
  const suggestionItems = [
    ...trends.slice(0, 3).map((trend) => ({
      type: "tag",
      label: trend.tag,
      sub: trend.count
    })),

    ...people.slice(0, 3).map((person) => ({
      type: "person",
      label: person.name,
      sub: person.handle,
      seed: person.seed
    }))
  ];

  return suggestionItems
    .map((item) => {
      if (item.type === "person") {
        return `
          <div
            class="sugg-item"
            data-q="${item.label}"
          >
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}"
              alt="${item.label}"
            >

            <div class="sugg-text">
              <div class="name">
                ${item.label}
              </div>

              <div class="sub">
                ${item.sub}
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div
          class="sugg-item"
          data-q="${item.label}"
        >
          <div class="icon">#</div>

          <div class="sugg-text">
            <div class="name">
              ${item.label}
            </div>

            <div class="sub">
              ${item.sub}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

// ---------- サジェストのクリック処理 ----------
function bindSuggestionClicks() {
  const suggestionItems =
    document.querySelectorAll(".sugg-item");

  suggestionItems.forEach((item) => {
    item.addEventListener("click", () => {
      searchInput.value =
        item.dataset.q;

      suggestions.classList.remove("show");

      clearBtn.style.display = "block";

      searchInput.dispatchEvent(
        new Event("input")
      );
    });
  });
}

// ---------- 検索内容に応じて表示を更新 ----------
function handleSearch() {
  clearBtn.style.display =
    searchInput.value ? "block" : "none";

  const keyword =
    searchInput.value
      .trim()
      .toLowerCase();

  if (!keyword) {
    suggestions.innerHTML =
      makeSuggestionHTML();

    suggestions.classList.add("show");

    bindSuggestionClicks();

    emptyState.style.display = "none";

    panels.forEach((panel) => {
      panel.style.display =
        panel.classList.contains("active")
          ? "block"
          : "none";
    });

    renderTrends();
    renderPeople();
    renderMedia();

    return;
  }

  const matchedPeople =
    people.filter((person) => {
      return (
        person.name
          .toLowerCase()
          .includes(keyword) ||
        person.handle
          .toLowerCase()
          .includes(keyword) ||
        person.bio
          .toLowerCase()
          .includes(keyword)
      );
    });

  const matchedTrends =
    trends.filter((trend) => {
      return (
        trend.tag
          .toLowerCase()
          .includes(keyword) ||
        trend.cat
          .toLowerCase()
          .includes(keyword)
      );
    });

  const matchedSuggestionItems = [
    ...matchedTrends,
    ...matchedPeople
  ].slice(0, 5);

  suggestions.innerHTML =
    matchedSuggestionItems
      .map((item) => {
        if (item.name) {
          return `
            <div
              class="sugg-item"
              data-q="${item.name}"
            >
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}"
                alt="${item.name}"
              >

              <div class="sugg-text">
                <div class="name">
                  ${item.name}
                </div>

                <div class="sub">
                  ${item.handle}
                </div>
              </div>
            </div>
          `;
        }

        return `
          <div
            class="sugg-item"
            data-q="${item.tag}"
          >
            <div class="icon">#</div>

            <div class="sugg-text">
              <div class="name">
                ${item.tag}
              </div>

              <div class="sub">
                ${item.count}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

  suggestions.classList.toggle(
    "show",
    matchedSuggestionItems.length > 0
  );

  bindSuggestionClicks();

  renderTrends(matchedTrends);
  renderPeople(matchedPeople);

  const hasAnyResult =
    matchedPeople.length > 0 ||
    matchedTrends.length > 0;

  emptyState.style.display =
    hasAnyResult ? "none" : "flex";
}

// ---------- 検索欄にフォーカスしたとき ----------
searchInput.addEventListener("focus", () => {
  suggestions.innerHTML =
    makeSuggestionHTML();

  suggestions.classList.add("show");

  bindSuggestionClicks();
});

// ---------- 検索欄への入力 ----------
searchInput.addEventListener(
  "input",
  handleSearch
);

// ---------- クリアボタン ----------
clearBtn.addEventListener("click", () => {
  searchInput.value = "";

  clearBtn.style.display = "none";

  emptyState.style.display = "none";

  renderTrends();
  renderPeople();
  renderMedia();

  searchInput.focus();

  handleSearch();
});

// ---------- 検索欄以外を押したとき ----------
document.addEventListener("click", (event) => {
  const clickedInsideSearchBox =
    event.target.closest(".search-box");

  if (!clickedInsideSearchBox) {
    suggestions.classList.remove("show");
  }
});

// ---------- 画面サイズ変更時 ----------
window.addEventListener("resize", () => {
  const activeTab =
    document.querySelector(".tab.active");

  moveIndicator(activeTab);
});

// ---------- 初期表示 ----------
window.addEventListener("DOMContentLoaded", () => {
  renderTrends();
  renderPeople();
  renderMedia();

  const activeTab =
    document.querySelector(".tab.active");

  moveIndicator(activeTab);
});