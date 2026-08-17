"use strict";

/* =========================================
   community_create.js
   コミュニティ作成ページ
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
   設定値
========================================= */

const SETTINGS = {
    maxCommunityNameLength: 30,
    maxDescriptionLength: 300,
    maxRuleCount: 5,
    maxRuleLength: 100,
    maxImageSize: 3 * 1024 * 1024,
    allowedImageTypes: [
        "image/jpeg",
        "image/png",
        "image/webp"
    ]
};


/* =========================================
   DOM取得
========================================= */

const communityCreateForm =
    document.getElementById("communityCreateForm");

const communityNameInput =
    document.getElementById("communityNameInput");

const communityCategorySelect =
    document.getElementById("communityCategorySelect");

const communityDescriptionInput =
    document.getElementById("communityDescriptionInput");

const communityNameCount =
    document.getElementById("communityNameCount");

const communityDescriptionCount =
    document.getElementById("communityDescriptionCount");

const communityNameError =
    document.getElementById("communityNameError");

const communityCategoryError =
    document.getElementById("communityCategoryError");

const communityDescriptionError =
    document.getElementById("communityDescriptionError");

const coverUploadArea =
    document.getElementById("coverUploadArea");

const coverImageInput =
    document.getElementById("coverImageInput");

const coverUploadPlaceholder =
    document.getElementById("coverUploadPlaceholder");

const coverImagePreviewArea =
    document.getElementById("coverImagePreviewArea");

const coverImagePreview =
    document.getElementById("coverImagePreview");

const removeCoverImageButton =
    document.getElementById("removeCoverImageButton");

const coverImageError =
    document.getElementById("coverImageError");

const emojiSelector =
    document.getElementById("emojiSelector");

const selectedEmojiInput =
    document.getElementById("selectedEmojiInput");

const communityRuleContainer =
    document.getElementById("communityRuleContainer");

const addRuleButton =
    document.getElementById("addRuleButton");

const ruleCount =
    document.getElementById("ruleCount");

const formProgressText =
    document.getElementById("formProgressText");

const formProgressBar =
    document.getElementById("formProgressBar");

const createCommunityButton =
    document.getElementById("createCommunityButton");

const previewCoverImage =
    document.getElementById("previewCoverImage");

const previewCoverBackground =
    document.getElementById("previewCoverBackground");

const previewIcon =
    document.getElementById("previewIcon");

const previewCategory =
    document.getElementById("previewCategory");

const previewVisibility =
    document.getElementById("previewVisibility");

const previewCommunityName =
    document.getElementById("previewCommunityName");

const previewCommunityDescription =
    document.getElementById("previewCommunityDescription");

const previewRuleList =
    document.getElementById("previewRuleList");

const emptyRulePreview =
    document.getElementById("emptyRulePreview");

const createConfirmModal =
    document.getElementById("createConfirmModal");

const cancelCreateConfirmButton =
    document.getElementById("cancelCreateConfirmButton");

const confirmCreateCommunityButton =
    document.getElementById("confirmCreateCommunityButton");

const modalCommunityIcon =
    document.getElementById("modalCommunityIcon");

const modalCommunityName =
    document.getElementById("modalCommunityName");

const modalCommunityCategory =
    document.getElementById("modalCommunityCategory");

const creatingModal =
    document.getElementById("creatingModal");

const communityCreateToast =
    document.getElementById("communityCreateToast");


/* =========================================
   ページ内状態
========================================= */

let selectedCoverImage = "";

let toastTimer = null;

let lastFocusedElement = null;

let isCreatingCommunity = false;


/* =========================================
   初期化
========================================= */

document.addEventListener("DOMContentLoaded", initializePage);


/**
 * ページを初期化します。
 */
function initializePage() {

    if (!communityCreateForm) {
        return;
    }

    bindInputEvents();
    bindCoverImageEvents();
    bindEmojiEvents();
    bindVisibilityEvents();
    bindRuleEvents();
    bindModalEvents();
    bindKeyboardEvents();

    updateCharacterCounts();
    updateRuleState();
    updatePreview();
    updateProgress();

}


/* =========================================
   基本情報入力イベント
========================================= */

/**
 * 基本情報のイベントを登録します。
 */
function bindInputEvents() {

    communityNameInput.addEventListener("input", () => {

        updateCharacterCounts();
        updatePreview();
        updateProgress();

        if (communityNameInput.value.trim()) {
            clearFieldError(
                communityNameInput,
                communityNameError
            );
        }

    });


    communityCategorySelect.addEventListener("change", () => {

        updatePreview();
        updateProgress();

        if (communityCategorySelect.value) {
            clearFieldError(
                communityCategorySelect,
                communityCategoryError
            );
        }

    });


    communityDescriptionInput.addEventListener("input", () => {

        updateCharacterCounts();
        updatePreview();
        updateProgress();

        if (communityDescriptionInput.value.trim()) {
            clearFieldError(
                communityDescriptionInput,
                communityDescriptionError
            );
        }

    });


    communityNameInput.addEventListener("blur", () => {

        if (!communityNameInput.value.trim()) {
            showFieldError(
                communityNameInput,
                communityNameError,
                "コミュニティ名を入力してください。"
            );
        }

    });


    communityCategorySelect.addEventListener("blur", () => {

        if (!communityCategorySelect.value) {
            showFieldError(
                communityCategorySelect,
                communityCategoryError,
                "カテゴリーを選択してください。"
            );
        }

    });


    communityDescriptionInput.addEventListener("blur", () => {

        if (!communityDescriptionInput.value.trim()) {
            showFieldError(
                communityDescriptionInput,
                communityDescriptionError,
                "コミュニティの説明を入力してください。"
            );
        }

    });


    communityCreateForm.addEventListener(
        "submit",
        handleFormSubmit
    );

}


/* =========================================
   文字数表示
========================================= */

/**
 * 入力文字数を更新します。
 */
function updateCharacterCounts() {

    const nameLength =
        communityNameInput.value.length;

    const descriptionLength =
        communityDescriptionInput.value.length;

    communityNameCount.textContent =
        `${nameLength} / ${SETTINGS.maxCommunityNameLength}`;

    communityDescriptionCount.textContent =
        `${descriptionLength} / ${SETTINGS.maxDescriptionLength}`;

    communityNameCount.classList.toggle(
        "limit-near",
        nameLength >= 25
    );

    communityDescriptionCount.classList.toggle(
        "limit-near",
        descriptionLength >= 270
    );

}


/* =========================================
   カバー画像
========================================= */

/**
 * カバー画像関連のイベントを登録します。
 */
function bindCoverImageEvents() {

    coverUploadArea.addEventListener("click", () => {
        coverImageInput.click();
    });


    coverUploadArea.addEventListener("keydown", event => {

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {
            event.preventDefault();
            coverImageInput.click();
        }

    });


    coverImageInput.addEventListener("change", event => {

        const file = event.target.files[0];

        if (file) {
            processCoverImage(file);
        }

    });


    coverUploadArea.addEventListener("dragover", event => {

        event.preventDefault();

        coverUploadArea.classList.add("drag-over");

    });


    coverUploadArea.addEventListener("dragleave", event => {

        if (
            event.relatedTarget &&
            coverUploadArea.contains(event.relatedTarget)
        ) {
            return;
        }

        coverUploadArea.classList.remove("drag-over");

    });


    coverUploadArea.addEventListener("drop", event => {

        event.preventDefault();

        coverUploadArea.classList.remove("drag-over");

        const file =
            event.dataTransfer.files[0];

        if (file) {
            processCoverImage(file);
        }

    });


    removeCoverImageButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            removeCoverImage();

        }
    );

}


/**
 * カバー画像を処理します。
 *
 * @param {File} file 選択された画像
 */
function processCoverImage(file) {

    clearCoverImageError();

    if (!SETTINGS.allowedImageTypes.includes(file.type)) {

        showCoverImageError(
            "JPEG・PNG・WebP形式の画像を選択してください。"
        );

        return;
    }

    if (file.size > SETTINGS.maxImageSize) {

        showCoverImageError(
            "画像サイズは3MB以下にしてください。"
        );

        return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", event => {

        const result = event.target.result;

        if (typeof result !== "string") {

            showCoverImageError(
                "画像を読み込めませんでした。"
            );

            return;
        }

        selectedCoverImage = result;

        coverImagePreview.src = result;
        coverImagePreviewArea.hidden = false;
        coverUploadPlaceholder.hidden = true;
        removeCoverImageButton.hidden = false;

        previewCoverImage.src = result;
        previewCoverImage.hidden = false;

        showToast(
            "カバー画像を設定しました。",
            "success"
        );

    });


    reader.addEventListener("error", () => {

        showCoverImageError(
            "画像を読み込めませんでした。"
        );

    });


    reader.readAsDataURL(file);

}


/**
 * カバー画像を削除します。
 */
function removeCoverImage() {

    selectedCoverImage = "";

    coverImageInput.value = "";

    coverImagePreview.src = "";
    coverImagePreviewArea.hidden = true;
    coverUploadPlaceholder.hidden = false;
    removeCoverImageButton.hidden = true;

    previewCoverImage.src = "";
    previewCoverImage.hidden = true;

    clearCoverImageError();

    showToast(
        "カバー画像を削除しました。"
    );

}


/**
 * カバー画像のエラーを表示します。
 *
 * @param {string} message エラーメッセージ
 */
function showCoverImageError(message) {

    coverImageError.textContent = message;
    coverImageError.hidden = false;

    coverUploadArea.classList.add("invalid");

    coverImageInput.value = "";

    showToast(message, "error");

}


/**
 * カバー画像のエラーを解除します。
 */
function clearCoverImageError() {

    coverImageError.hidden = true;

    coverUploadArea.classList.remove("invalid");

}


/* =========================================
   絵文字選択
========================================= */

/**
 * 絵文字選択イベントを登録します。
 */
function bindEmojiEvents() {

    emojiSelector.addEventListener("click", event => {

        const emojiButton =
            event.target.closest(".emoji-option");

        if (!emojiButton) {
            return;
        }

        selectEmoji(emojiButton);

    });


    emojiSelector.addEventListener("keydown", event => {

        const emojiButtons = [
            ...emojiSelector.querySelectorAll(
                ".emoji-option"
            )
        ];

        const currentIndex =
            emojiButtons.indexOf(document.activeElement);

        if (currentIndex === -1) {
            return;
        }

        let nextIndex = currentIndex;

        if (
            event.key === "ArrowRight" ||
            event.key === "ArrowDown"
        ) {
            nextIndex =
                (currentIndex + 1) %
                emojiButtons.length;
        }

        if (
            event.key === "ArrowLeft" ||
            event.key === "ArrowUp"
        ) {
            nextIndex =
                (
                    currentIndex -
                    1 +
                    emojiButtons.length
                ) %
                emojiButtons.length;
        }

        if (nextIndex !== currentIndex) {

            event.preventDefault();

            emojiButtons[nextIndex].focus();

        }

    });

}


/**
 * 選択された絵文字を反映します。
 *
 * @param {HTMLButtonElement} selectedButton
 */
function selectEmoji(selectedButton) {

    const emojiButtons =
        emojiSelector.querySelectorAll(".emoji-option");

    emojiButtons.forEach(button => {

        const isSelected =
            button === selectedButton;

        button.classList.toggle(
            "active",
            isSelected
        );

        button.setAttribute(
            "aria-checked",
            String(isSelected)
        );

    });

    const selectedEmoji =
        selectedButton.dataset.emoji || "🌺";

    selectedEmojiInput.value = selectedEmoji;

    updatePreview();
    updateProgress();

}


/* =========================================
   公開設定
========================================= */

/**
 * 公開設定イベントを登録します。
 */
function bindVisibilityEvents() {

    const visibilityInputs =
        document.querySelectorAll(
            'input[name="communityVisibility"]'
        );

    visibilityInputs.forEach(input => {

        input.addEventListener(
            "change",
            updatePreview
        );

    });

}


/**
 * 現在選択されている公開設定を取得します。
 *
 * @returns {string}
 */
function getSelectedVisibility() {

    const selectedInput =
        document.querySelector(
            'input[name="communityVisibility"]:checked'
        );

    return selectedInput
        ? selectedInput.value
        : "public";

}


/**
 * 公開設定の表示情報を返します。
 *
 * @param {string} visibility
 * @returns {{label: string, icon: string}}
 */
function getVisibilityDisplay(visibility) {

    const visibilityMap = {
        public: {
            label: "公開",
            icon: "🌐"
        },
        approval: {
            label: "承認制",
            icon: "✅"
        },
        private: {
            label: "非公開",
            icon: "🔒"
        }
    };

    return visibilityMap[visibility] ||
        visibilityMap.public;

}


/* =========================================
   ルール追加・削除
========================================= */

/**
 * ルール関連イベントを登録します。
 */
function bindRuleEvents() {

    addRuleButton.addEventListener(
        "click",
        addRuleInput
    );


    communityRuleContainer.addEventListener(
        "click",
        event => {

            const removeButton =
                event.target.closest(
                    '[data-action="remove-rule"]'
                );

            if (!removeButton) {
                return;
            }

            const ruleRow =
                removeButton.closest(".rule-input-row");

            if (ruleRow) {

                ruleRow.remove();

                updateRuleState();
                updatePreview();
                updateProgress();

            }

        }
    );


    communityRuleContainer.addEventListener(
        "input",
        event => {

            if (!event.target.classList.contains("rule-input")) {
                return;
            }

            updatePreview();
            updateProgress();

        }
    );

}


/**
 * 新しいルール入力欄を追加します。
 */
function addRuleInput() {

    const currentRuleCount =
        getRuleRows().length;

    if (
        currentRuleCount >=
        SETTINGS.maxRuleCount
    ) {

        showToast(
            "ルールは最大5件までです。",
            "error"
        );

        return;
    }

    const ruleRow =
        document.createElement("div");

    ruleRow.className = "rule-input-row";

    ruleRow.innerHTML = `
        <span class="rule-number"></span>

        <input
            type="text"
            class="rule-input"
            maxlength="${SETTINGS.maxRuleLength}"
            placeholder="コミュニティルールを入力"
        >

        <button
            type="button"
            class="remove-rule-button"
            data-action="remove-rule"
        >
            ×
        </button>
    `;

    communityRuleContainer.appendChild(ruleRow);

    updateRuleState();
    updatePreview();
    updateProgress();

    const newInput =
        ruleRow.querySelector(".rule-input");

    if (newInput) {
        newInput.focus();
    }

}


/**
 * ルール欄の番号と状態を更新します。
 */
function updateRuleState() {

    const ruleRows = getRuleRows();

    ruleRows.forEach((row, index) => {

        const ruleNumber =
            row.querySelector(".rule-number");

        const ruleInput =
            row.querySelector(".rule-input");

        const removeButton =
            row.querySelector(".remove-rule-button");

        const displayNumber = index + 1;

        row.dataset.ruleIndex =
            String(displayNumber);

        if (ruleNumber) {
            ruleNumber.textContent =
                String(displayNumber);
        }

        if (ruleInput) {
            ruleInput.setAttribute(
                "aria-label",
                `コミュニティルール${displayNumber}`
            );
        }

        if (removeButton) {
            removeButton.setAttribute(
                "aria-label",
                `ルール${displayNumber}を削除`
            );
        }

    });

    ruleCount.textContent =
        `${ruleRows.length} / ${SETTINGS.maxRuleCount}`;

    addRuleButton.disabled =
        ruleRows.length >= SETTINGS.maxRuleCount;

}


/**
 * ルール行を配列で取得します。
 *
 * @returns {HTMLElement[]}
 */
function getRuleRows() {

    return [
        ...communityRuleContainer.querySelectorAll(
            ".rule-input-row"
        )
    ];

}


/**
 * 入力済みルールを取得します。
 *
 * @returns {string[]}
 */
function getRules() {

    return getRuleRows()
        .map(row => {

            const input =
                row.querySelector(".rule-input");

            return input
                ? input.value.trim()
                : "";

        })
        .filter(Boolean);

}


/* =========================================
   リアルタイムプレビュー
========================================= */

/**
 * 右側プレビューを更新します。
 */
function updatePreview() {

    const communityName =
        communityNameInput.value.trim();

    const category =
        communityCategorySelect.value;

    const description =
        communityDescriptionInput.value.trim();

    const selectedEmoji =
        selectedEmojiInput.value || "🌺";

    const visibility =
        getSelectedVisibility();

    const visibilityDisplay =
        getVisibilityDisplay(visibility);


    previewCommunityName.textContent =
        communityName || "コミュニティ名";


    previewCategory.textContent =
        category || "カテゴリー";


    previewCommunityDescription.textContent =
        description ||
        "コミュニティの説明がここに表示されます。";


    previewCommunityDescription.classList.toggle(
        "placeholder-text",
        !description
    );


    previewIcon.textContent =
        selectedEmoji;


    previewVisibility.textContent =
        `${visibilityDisplay.icon} ${visibilityDisplay.label}`;


    updateRulePreview();

}


/**
 * ルールプレビューを更新します。
 */
function updateRulePreview() {

    const rules = getRules();

    previewRuleList.innerHTML = "";

    if (rules.length === 0) {

        previewRuleList.hidden = true;
        emptyRulePreview.hidden = false;

        return;
    }

    rules.forEach(rule => {

        const listItem =
            document.createElement("li");

        listItem.textContent = rule;

        previewRuleList.appendChild(listItem);

    });

    previewRuleList.hidden = false;
    emptyRulePreview.hidden = true;

}


/* =========================================
   入力進捗
========================================= */

/**
 * 入力進捗を更新します。
 */
function updateProgress() {

    const progressItems = [
        Boolean(communityNameInput.value.trim()),
        Boolean(communityCategorySelect.value),
        Boolean(
            communityDescriptionInput.value.trim()
        ),
        Boolean(selectedEmojiInput.value)
    ];

    const completedCount =
        progressItems.filter(Boolean).length;

    const progress =
        Math.round(
            (
                completedCount /
                progressItems.length
            ) * 100
        );

    formProgressText.textContent =
        `${progress}%`;

    formProgressBar.style.width =
        `${progress}%`;

}


/* =========================================
   バリデーション
========================================= */

/**
 * フォーム送信時の処理です。
 *
 * @param {SubmitEvent} event
 */
function handleFormSubmit(event) {

    event.preventDefault();

    if (isCreatingCommunity) {
        return;
    }

    const isValid = validateForm();

    if (!isValid) {

        showToast(
            "入力内容を確認してください。",
            "error"
        );

        focusFirstInvalidField();

        return;
    }

    openCreateConfirmModal();

}


/**
 * 必須項目を検証します。
 *
 * @returns {boolean}
 */
function validateForm() {

    let isValid = true;

    const communityName =
        communityNameInput.value.trim();

    const category =
        communityCategorySelect.value;

    const description =
        communityDescriptionInput.value.trim();


    if (!communityName) {

        showFieldError(
            communityNameInput,
            communityNameError,
            "コミュニティ名を入力してください。"
        );

        isValid = false;

    } else if (
        communityName.length >
        SETTINGS.maxCommunityNameLength
    ) {

        showFieldError(
            communityNameInput,
            communityNameError,
            "コミュニティ名は30文字以内で入力してください。"
        );

        isValid = false;

    } else {

        clearFieldError(
            communityNameInput,
            communityNameError
        );

    }


    if (!category) {

        showFieldError(
            communityCategorySelect,
            communityCategoryError,
            "カテゴリーを選択してください。"
        );

        isValid = false;

    } else {

        clearFieldError(
            communityCategorySelect,
            communityCategoryError
        );

    }


    if (!description) {

        showFieldError(
            communityDescriptionInput,
            communityDescriptionError,
            "コミュニティの説明を入力してください。"
        );

        isValid = false;

    } else if (
        description.length >
        SETTINGS.maxDescriptionLength
    ) {

        showFieldError(
            communityDescriptionInput,
            communityDescriptionError,
            "説明は300文字以内で入力してください。"
        );

        isValid = false;

    } else {

        clearFieldError(
            communityDescriptionInput,
            communityDescriptionError
        );

    }


    if (!selectedEmojiInput.value) {

        showToast(
            "コミュニティアイコンを選択してください。",
            "error"
        );

        isValid = false;

    }


    return isValid;

}


/**
 * 入力エラーを表示します。
 *
 * @param {HTMLElement} field
 * @param {HTMLElement} errorElement
 * @param {string} message
 */
function showFieldError(
    field,
    errorElement,
    message
) {

    field.classList.add("invalid");

    field.setAttribute(
        "aria-invalid",
        "true"
    );

    errorElement.textContent = message;
    errorElement.hidden = false;

}


/**
 * 入力エラーを解除します。
 *
 * @param {HTMLElement} field
 * @param {HTMLElement} errorElement
 */
function clearFieldError(
    field,
    errorElement
) {

    field.classList.remove("invalid");

    field.removeAttribute("aria-invalid");

    errorElement.hidden = true;

}


/**
 * 最初のエラー項目に移動します。
 */
function focusFirstInvalidField() {

    const firstInvalidField =
        communityCreateForm.querySelector(
            ".invalid"
        );

    if (!firstInvalidField) {
        return;
    }

    firstInvalidField.focus();

    firstInvalidField.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


/* =========================================
   確認モーダル
========================================= */

/**
 * モーダル関連イベントを登録します。
 */
function bindModalEvents() {

    cancelCreateConfirmButton.addEventListener(
        "click",
        closeCreateConfirmModal
    );


    confirmCreateCommunityButton.addEventListener(
        "click",
        createCommunity
    );


    createConfirmModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                createConfirmModal
            ) {
                closeCreateConfirmModal();
            }

        }
    );

}


/**
 * 作成確認モーダルを開きます。
 */
function openCreateConfirmModal() {

    lastFocusedElement =
        document.activeElement;

    modalCommunityIcon.textContent =
        selectedEmojiInput.value || "🌺";

    modalCommunityName.textContent =
        communityNameInput.value.trim();

    modalCommunityCategory.textContent =
        communityCategorySelect.value;

    createConfirmModal.hidden = false;

    document.body.style.overflow = "hidden";

    window.requestAnimationFrame(() => {
        cancelCreateConfirmButton.focus();
    });

}


/**
 * 作成確認モーダルを閉じます。
 */
function closeCreateConfirmModal() {

    if (isCreatingCommunity) {
        return;
    }

    createConfirmModal.hidden = true;

    document.body.style.overflow = "";

    if (
        lastFocusedElement &&
        typeof lastFocusedElement.focus === "function"
    ) {
        lastFocusedElement.focus();
    }

}


/**
 * キーボード操作を登録します。
 */
function bindKeyboardEvents() {

    document.addEventListener("keydown", event => {

        if (
            event.key === "Escape" &&
            !createConfirmModal.hidden &&
            !isCreatingCommunity
        ) {
            closeCreateConfirmModal();
        }

        if (
            event.key === "Tab" &&
            !createConfirmModal.hidden
        ) {
            trapFocusInsideModal(
                event,
                createConfirmModal
            );
        }

    });

}


/**
 * モーダル内にフォーカスを閉じ込めます。
 *
 * @param {KeyboardEvent} event
 * @param {HTMLElement} modal
 */
function trapFocusInsideModal(event, modal) {

    const focusableElements = [
        ...modal.querySelectorAll(
            [
                "button:not([disabled])",
                "a[href]",
                "input:not([disabled])",
                "select:not([disabled])",
                "textarea:not([disabled])",
                '[tabindex]:not([tabindex="-1"])'
            ].join(",")
        )
    ];

    if (focusableElements.length === 0) {
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
   コミュニティ作成
========================================= */

/**
 * コミュニティを作成して保存します。
 */
function createCommunity() {

    if (isCreatingCommunity) {
        return;
    }

    if (!validateForm()) {

        closeCreateConfirmModal();

        focusFirstInvalidField();

        return;
    }

    isCreatingCommunity = true;

    confirmCreateCommunityButton.disabled = true;

    createConfirmModal.hidden = true;
    creatingModal.hidden = false;

    const newCommunity =
        buildCommunityData();

    try {

        saveCommunity(newCommunity);

        window.setTimeout(() => {

            creatingModal.hidden = true;

            showToast(
                "コミュニティを作成しました。",
                "success"
            );

            window.setTimeout(() => {

                window.location.href =
                    `community_home.html?id=${encodeURIComponent(
                        newCommunity.id
                    )}`;

            }, 700);

        }, 700);

    } catch (error) {

        console.error(
            "コミュニティの保存に失敗しました。",
            error
        );

        isCreatingCommunity = false;

        confirmCreateCommunityButton.disabled = false;

        creatingModal.hidden = true;

        document.body.style.overflow = "";

        showToast(
            getStorageErrorMessage(error),
            "error"
        );

    }

}


/**
 * 保存用のコミュニティデータを作成します。
 *
 * @returns {Object}
 */
function buildCommunityData() {

    const createdAt =
        new Date().toISOString();

    const id =
        generateCommunityId();

    const visibility =
        getSelectedVisibility();

    return {
        id: id,
        name: communityNameInput.value.trim(),
        category: communityCategorySelect.value,
        description:
            communityDescriptionInput.value.trim(),

        icon:
            selectedEmojiInput.value || "🌺",

        cover: selectedCoverImage,

        coverClass:
            getCoverClassByCategory(
                communityCategorySelect.value
            ),

        visibility: visibility,

        rules: getRules(),

        memberCount: 1,
        postCount: 0,

        owner: "りゅうほ",
        ownerId: "current-user",

        members: [
            {
                id: "current-user",
                name: "りゅうほ",
                role: "owner"
            }
        ],

        createdAt: createdAt,
        updatedAt: createdAt,

        isCustom: true,
        isJoined: true
    };

}


/**
 * カテゴリーに対応するカバークラスを返します。
 *
 * @param {string} category
 * @returns {string}
 */
function getCoverClassByCategory(category) {

    const categoryCoverMap = {
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

    return categoryCoverMap[category] ||
        "other-community";

}


/**
 * 一意のコミュニティIDを生成します。
 *
 * @returns {string}
 */
function generateCommunityId() {

    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return `community-${crypto.randomUUID()}`;
    }

    const timestamp =
        Date.now().toString(36);

    const randomText =
        Math.random()
            .toString(36)
            .slice(2, 10);

    return `community-${timestamp}-${randomText}`;

}


/* =========================================
   LocalStorage保存
========================================= */

/**
 * コミュニティ情報をLocalStorageへ保存します。
 *
 * @param {Object} community
 */
function saveCommunity(community) {

    const communities =
        readStorageArray(
            STORAGE_KEYS.communities
        );

    communities.push(community);

    localStorage.setItem(
        STORAGE_KEYS.communities,
        JSON.stringify(communities)
    );


    const joinedCommunities =
        readStorageArray(
            STORAGE_KEYS.joinedCommunities
        );

    const alreadyJoined =
        joinedCommunities.some(item => {

            if (typeof item === "string") {
                return item === community.id;
            }

            return (
                item &&
                item.id === community.id
            );

        });

    if (!alreadyJoined) {

        /*
         既存のcommunity.jsではID文字列の配列を
         使用している想定です。
        */
        joinedCommunities.push(community.id);

        localStorage.setItem(
            STORAGE_KEYS.joinedCommunities,
            JSON.stringify(joinedCommunities)
        );

    }


    localStorage.setItem(
        STORAGE_KEYS.selectedCommunity,
        JSON.stringify(community)
    );

}


/**
 * LocalStorageから配列を取得します。
 *
 * @param {string} key
 * @returns {Array}
 */
function readStorageArray(key) {

    const storedData =
        localStorage.getItem(key);

    if (!storedData) {
        return [];
    }

    try {

        const parsedData =
            JSON.parse(storedData);

        return Array.isArray(parsedData)
            ? parsedData
            : [];

    } catch (error) {

        console.warn(
            `${key}の読み込みに失敗しました。`,
            error
        );

        return [];

    }

}


/**
 * LocalStorageエラーの表示文を返します。
 *
 * @param {unknown} error
 * @returns {string}
 */
function getStorageErrorMessage(error) {

    if (
        error instanceof DOMException &&
        (
            error.name === "QuotaExceededError" ||
            error.name === "NS_ERROR_DOM_QUOTA_REACHED"
        )
    ) {
        return "保存容量が不足しています。カバー画像を小さくするか、画像なしで作成してください。";
    }

    return "コミュニティを保存できませんでした。もう一度お試しください。";

}


/* =========================================
   トースト
========================================= */

/**
 * トーストメッセージを表示します。
 *
 * @param {string} message
 * @param {"success"|"error"|""} type
 */
function showToast(message, type = "") {

    if (!communityCreateToast) {
        return;
    }

    if (toastTimer) {
        window.clearTimeout(toastTimer);
    }

    communityCreateToast.textContent =
        message;

    communityCreateToast.classList.remove(
        "show",
        "success",
        "error"
    );

    if (type) {
        communityCreateToast.classList.add(type);
    }

    communityCreateToast.hidden = false;

    window.requestAnimationFrame(() => {

        communityCreateToast.classList.add(
            "show"
        );

    });

    toastTimer = window.setTimeout(() => {

        communityCreateToast.classList.remove(
            "show"
        );

        window.setTimeout(() => {

            communityCreateToast.hidden = true;

        }, 220);

    }, 2800);

}