// home.js

const postForm = document.getElementById("postForm");
const postContent = document.getElementById("postContent");
const areaSelect = document.getElementById("areaSelect");
const characterCount = document.getElementById("characterCount");
const postList = document.getElementById("postList");

const maximumLength = 200;

// 文字数表示
postContent.addEventListener("input", () => {
    const contentLength = postContent.value.length;

    characterCount.textContent =
        `${contentLength} / ${maximumLength}`;

    if (contentLength >= maximumLength) {
        characterCount.style.color = "#e5484d";
    } else {
        characterCount.style.color = "#8791a0";
    }
});

// 仮の投稿処理
postForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const content = postContent.value.trim();
    const area = areaSelect.value;

    if (content === "") {
        alert("投稿内容を入力してください。");
        return;
    }

    const postCard = createPostCard(content, area);

    postList.prepend(postCard);

    postContent.value = "";
    areaSelect.value = "沖縄県";
    characterCount.textContent = `0 / ${maximumLength}`;
    characterCount.style.color = "#8791a0";
});

// 投稿カードを作る関数
function createPostCard(content, area) {
    const article = document.createElement("article");

    article.classList.add("post-card");

    article.innerHTML = `
        <div class="post-user-icon">
            沖
        </div>

        <div class="post-main">

            <div class="post-header">

                <div class="post-user">

                    <span class="post-user-name">
                        沖縄 太郎
                    </span>

                    <span class="post-user-id">
                        @okinawa_taro
                    </span>

                </div>

                <span class="post-time">
                    たった今
                </span>

            </div>

            <p class="post-text"></p>

            <p class="post-area"></p>

            <div class="post-actions">

                <button
                    type="button"
                    class="action-button comment-button"
                >
                    💬
                    <span>0</span>
                </button>

                <button
                    type="button"
                    class="action-button like-button"
                >
                    ♡
                    <span>0</span>
                </button>

                <button
                    type="button"
                    class="action-button"
                >
                    ↗
                </button>

            </div>

        </div>
    `;

    article.querySelector(".post-text").textContent = content;
    article.querySelector(".post-area").textContent = `📍${area}`;

    addLikeEvent(article.querySelector(".like-button"));

    return article;
}

// いいね処理
function addLikeEvent(button) {
    button.addEventListener("click", () => {
        const countElement = button.querySelector("span");

        let likeCount = Number(countElement.textContent);

        if (button.classList.contains("liked")) {
            button.classList.remove("liked");
            button.childNodes[0].textContent = "♡ ";
            likeCount--;
        } else {
            button.classList.add("liked");
            button.childNodes[0].textContent = "♥ ";
            likeCount++;
        }

        countElement.textContent = likeCount;
    });
}

// 最初から表示されている投稿にもいいね処理を付ける
const likeButtons = document.querySelectorAll(".like-button");

likeButtons.forEach((button) => {
    addLikeEvent(button);
});

// 仮のフォロー処理
const followButtons = document.querySelectorAll(".follow-button");

followButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const isFollowing =
            button.classList.toggle("following");

        button.textContent =
            isFollowing
                ? "フォロー中"
                : "フォロー";
    });
});