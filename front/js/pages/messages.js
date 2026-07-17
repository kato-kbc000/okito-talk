const messageForm =
    document.getElementById("messageForm");

const messageInput =
    document.getElementById("messageInput");

const chatMessages =
    document.getElementById("chatMessages");

const conversationItems =
    document.querySelectorAll(".conversation-item");

const messageSearch =
    document.getElementById("messageSearch");

const chatUserName =
    document.getElementById("chatUserName");

const chatUserId =
    document.getElementById("chatUserId");

const chatUserIcon =
    document.getElementById("chatUserIcon");

messageForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = messageInput.value.trim();

    if (!text) {
        return;
    }

    const message =
        document.createElement("div");

    message.className = "message sent";

    const paragraph =
        document.createElement("p");

    paragraph.textContent = text;

    const time =
        document.createElement("time");

    time.textContent =
        new Date().toLocaleTimeString(
            "ja-JP",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    message.append(paragraph, time);
    chatMessages.appendChild(message);

    messageInput.value = "";

    chatMessages.scrollTop =
        chatMessages.scrollHeight;
});

conversationItems.forEach((item) => {
    item.addEventListener("click", () => {
        conversationItems.forEach((button) => {
            button.classList.remove("active");
        });

        item.classList.add("active");

        chatUserName.textContent =
            item.dataset.user;

        chatUserId.textContent =
            item.dataset.id;

        chatUserIcon.textContent =
            item.dataset.icon;

        chatMessages.innerHTML = `
            <div class="message received">
                <p>
                    ${escapeHtml(item.dataset.user)}との会話です。
                </p>
                <time>現在</time>
            </div>
        `;
    });
});

messageSearch.addEventListener("input", () => {
    const keyword =
        messageSearch.value
            .trim()
            .toLowerCase();

    conversationItems.forEach((item) => {
        const user =
            item.dataset.user.toLowerCase();

        const id =
            item.dataset.id.toLowerCase();

        item.hidden =
            !user.includes(keyword) &&
            !id.includes(keyword);
    });
});

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}