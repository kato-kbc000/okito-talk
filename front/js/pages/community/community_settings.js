import { supabase } from '../../supabase.js';

(() => {
  "use strict";

  const STORAGE_KEY = "okitalk-community-settings";
  const communityId = new URLSearchParams(location.search).get('id');
  const DELETE_CONFIRM_TEXT = "沖縄の海が好き";

  const form = document.getElementById("communitySettingsForm");
  const nameInput = document.getElementById("communityName");
  const descriptionInput = document.getElementById("communityDescription");
  const rulesInput = document.getElementById("communityRules");
  const categorySelect = document.getElementById("communityCategory");

  const nameCount = document.getElementById("communityNameCount");
  const descriptionCount = document.getElementById("communityDescriptionCount");
  const rulesCount = document.getElementById("communityRulesCount");

  const nameError = document.getElementById("communityNameError");
  const descriptionError = document.getElementById("communityDescriptionError");

  const imageInput = document.getElementById("communityImage");
  const previewImage = document.getElementById("previewImage");
  const imageFallback = document.getElementById("imageFallback");
  const removeImageButton = document.getElementById("removeImageButton");

  const summaryVisibility = document.getElementById("summaryVisibility");
  const summaryCategory = document.getElementById("summaryCategory");
  const toast = document.getElementById("toast");

  const resetButton = document.getElementById("resetButton");
  const memberSearch = document.getElementById("memberSearch");
  const memberItems = [...document.querySelectorAll(".member-item")];
  const memberEmpty = document.getElementById("memberEmpty");

  const modal = document.getElementById("deleteModal");
  const openDeleteModalButton = document.getElementById("openDeleteModal");
  const closeDeleteModalButton = document.getElementById("closeDeleteModal");
  const cancelDeleteButton = document.getElementById("cancelDeleteButton");
  const deleteConfirmName = document.getElementById("deleteConfirmName");
  const confirmDeleteButton = document.getElementById("confirmDeleteButton");

  const mobileMenuButton = document.querySelector(".mobile-menu-button");
  const headerNav = document.querySelector(".header-nav");

  let initialState = null;
  let toastTimer = null;
  let imageDataUrl = "";

  function updateCharacterCount(input, output) {
    output.textContent = `${input.value.length} / ${input.maxLength}`;
  }

  function updateAllCharacterCounts() {
    updateCharacterCount(nameInput, nameCount);
    updateCharacterCount(descriptionInput, descriptionCount);
    updateCharacterCount(rulesInput, rulesCount);
  }

  function visibilityLabel(value) {
    const labels = {
      public: "公開",
      approval: "承認制",
      private: "非公開"
    };
    return labels[value] || "公開";
  }

  function getState() {
    const visibility = form.querySelector('input[name="visibility"]:checked')?.value || "public";

    return {
      communityName: nameInput.value.trim(),
      communityDescription: descriptionInput.value.trim(),
      communityRules: rulesInput.value.trim(),
      communityCategory: categorySelect.value,
      communityArea: document.getElementById("communityArea").value,
      visibility,
      memberPosting: document.getElementById("memberPosting").checked,
      joinNotification: document.getElementById("joinNotification").checked,
      imageDataUrl
    };
  }

  function applyState(state) {
    if (!state) return;

    nameInput.value = state.communityName ?? nameInput.value;
    descriptionInput.value = state.communityDescription ?? descriptionInput.value;
    rulesInput.value = state.communityRules ?? rulesInput.value;
    categorySelect.value = state.communityCategory ?? categorySelect.value;
    document.getElementById("communityArea").value =
      state.communityArea ?? document.getElementById("communityArea").value;

    const visibilityRadio = form.querySelector(
      `input[name="visibility"][value="${state.visibility || "public"}"]`
    );
    if (visibilityRadio) visibilityRadio.checked = true;

    document.getElementById("memberPosting").checked =
      state.memberPosting ?? true;
    document.getElementById("joinNotification").checked =
      state.joinNotification ?? true;

    imageDataUrl = state.imageDataUrl || "";
    renderImagePreview();
    updateSummary();
    updateAllCharacterCounts();
  }

  function renderImagePreview() {
    if (imageDataUrl) {
      previewImage.src = imageDataUrl;
      previewImage.hidden = false;
      imageFallback.hidden = true;
    } else {
      previewImage.removeAttribute("src");
      previewImage.hidden = true;
      imageFallback.hidden = false;
    }
  }

  function updateSummary() {
    const visibility = form.querySelector('input[name="visibility"]:checked')?.value;
    summaryVisibility.textContent = visibilityLabel(visibility);
    summaryCategory.textContent = categorySelect.value;
  }

  function validateForm() {
    let valid = true;

    nameError.textContent = "";
    descriptionError.textContent = "";
    nameInput.classList.remove("is-error");
    descriptionInput.classList.remove("is-error");

    if (!nameInput.value.trim()) {
      nameError.textContent = "コミュニティ名を入力してください。";
      nameInput.classList.add("is-error");
      valid = false;
    }

    if (!descriptionInput.value.trim()) {
      descriptionError.textContent = "コミュニティの説明を入力してください。";
      descriptionInput.classList.add("is-error");
      valid = false;
    }

    if (!valid) {
      const firstError = form.querySelector(".is-error");
      firstError?.focus();
    }

    return valid;
  }

  function showToast(message, type = "success") {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("is-error", type === "error");
    toast.classList.add("is-visible");

    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3000);
  }

  async function loadSavedSettings() {
    try {
      if (communityId) {
        const { data, error } = await supabase
          .from('communities')
          .select('name,description,is_private,header_url')
          .eq('id', communityId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          applyState({
            communityName: data.name,
            communityDescription: data.description || '',
            visibility: data.is_private ? 'private' : 'public',
            imageDataUrl: data.header_url || ''
          });
        }
      }
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved && !communityId) {
        const parsed = JSON.parse(saved);
        applyState(parsed);
      }

      initialState = getState();
    } catch (error) {
      console.error("設定の読み込みに失敗しました。", error);
      initialState = getState();
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    if (!validateForm()) {
      showToast("入力内容を確認してください。", "error");
      return;
    }

    const state = getState();

    try {
      if (communityId) {
        const { error } = await supabase
          .from('communities')
          .update({
            name: state.communityName,
            description: state.communityDescription,
            is_private: state.visibility === 'private',
            header_url: state.imageDataUrl || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', communityId);
        if (error) throw error;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      initialState = state;
      updateSummary();
      showToast("コミュニティ設定を保存しました。");
    } catch (error) {
      console.error("設定の保存に失敗しました。", error);
      showToast("保存に失敗しました。画像サイズを小さくして再度お試しください。", "error");
    }
  }

  function resetSettings() {
    const accepted = window.confirm("保存前の変更を元に戻しますか？");
    if (!accepted) return;

    applyState(initialState);
    clearValidationErrors();
    showToast("変更を元に戻しました。");
  }

  function clearValidationErrors() {
    nameError.textContent = "";
    descriptionError.textContent = "";
    nameInput.classList.remove("is-error");
    descriptionInput.classList.remove("is-error");
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      showToast("PNG・JPG・WebP形式の画像を選択してください。", "error");
      imageInput.value = "";
      return;
    }

    if (file.size > maxSize) {
      showToast("画像サイズは5MB以内にしてください。", "error");
      imageInput.value = "";
      return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
      imageDataUrl = String(reader.result);
      renderImagePreview();
      showToast("画像を変更しました。保存ボタンを押してください。");
    });

    reader.addEventListener("error", () => {
      showToast("画像の読み込みに失敗しました。", "error");
    });

    reader.readAsDataURL(file);
  }

  function removeImage() {
    if (!imageDataUrl) {
      showToast("削除できる画像がありません。", "error");
      return;
    }

    imageDataUrl = "";
    imageInput.value = "";
    renderImagePreview();
    showToast("画像を削除しました。保存ボタンを押してください。");
  }

  function switchTab(tabName) {
    document.querySelectorAll(".settings-tab").forEach((button) => {
      const active = button.dataset.tab === tabName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });

    document.querySelectorAll(".settings-panel").forEach((panel) => {
      const active = panel.id === `panel-${tabName}`;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  function filterMembers() {
    const keyword = memberSearch.value.trim().toLowerCase();
    let visibleCount = 0;

    memberItems.forEach((item) => {
      const memberText = item.dataset.member.toLowerCase();
      const isVisible = memberText.includes(keyword);
      item.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    memberEmpty.hidden = visibleCount !== 0;
  }

  function openDeleteModal() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    deleteConfirmName.value = "";
    confirmDeleteButton.disabled = true;
    window.setTimeout(() => deleteConfirmName.focus(), 0);
  }

  function closeDeleteModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    openDeleteModalButton.focus();
  }

  function updateDeleteButton() {
    confirmDeleteButton.disabled = deleteConfirmName.value !== DELETE_CONFIRM_TEXT;
  }

  function deleteCommunity() {
    if (deleteConfirmName.value !== DELETE_CONFIRM_TEXT) return;

    localStorage.removeItem(STORAGE_KEY);
    closeDeleteModal();
    showToast("デモ：コミュニティを削除しました。");

    // バックエンド実装後は、ここで削除APIを呼び出してから
    // コミュニティ一覧へ遷移させてください。
    // location.href = "community_home.html";
  }

  function setupUnsavedChangesWarning() {
    window.addEventListener("beforeunload", (event) => {
      if (!initialState) return;

      const changed = JSON.stringify(getState()) !== JSON.stringify(initialState);
      if (!changed) return;

      event.preventDefault();
      event.returnValue = "";
    });
  }

  document.querySelectorAll(".settings-tab").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  [nameInput, descriptionInput, rulesInput].forEach((input) => {
    input.addEventListener("input", updateAllCharacterCounts);
  });

  nameInput.addEventListener("input", () => {
    if (nameInput.value.trim()) {
      nameError.textContent = "";
      nameInput.classList.remove("is-error");
    }
  });

  descriptionInput.addEventListener("input", () => {
    if (descriptionInput.value.trim()) {
      descriptionError.textContent = "";
      descriptionInput.classList.remove("is-error");
    }
  });

  form.querySelectorAll('input[name="visibility"]').forEach((radio) => {
    radio.addEventListener("change", updateSummary);
  });

  categorySelect.addEventListener("change", updateSummary);
  form.addEventListener("submit", saveSettings);
  resetButton.addEventListener("click", resetSettings);
  imageInput.addEventListener("change", handleImageChange);
  removeImageButton.addEventListener("click", removeImage);
  memberSearch.addEventListener("input", filterMembers);

  openDeleteModalButton.addEventListener("click", openDeleteModal);
  closeDeleteModalButton.addEventListener("click", closeDeleteModal);
  cancelDeleteButton.addEventListener("click", closeDeleteModal);
  deleteConfirmName.addEventListener("input", updateDeleteButton);
  confirmDeleteButton.addEventListener("click", deleteCommunity);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeDeleteModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeDeleteModal();
  });

  document.getElementById("transferButton").addEventListener("click", () => {
    showToast("管理者変更機能はバックエンド接続後に利用できます。");
  });

  document.getElementById("helpLink").addEventListener("click", (event) => {
    event.preventDefault();
    showToast("ヘルプページは現在準備中です。");
  });

  document.querySelectorAll(".member-menu-button").forEach((button) => {
    button.addEventListener("click", () => {
      showToast("メンバー操作メニューはバックエンド接続後に利用できます。");
    });
  });

  mobileMenuButton.addEventListener("click", () => {
    const isOpen = headerNav.classList.toggle("is-open");
    mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
    mobileMenuButton.setAttribute("aria-label", isOpen ? "メニューを閉じる" : "メニューを開く");
  });

  loadSavedSettings();
  updateAllCharacterCounts();
  updateSummary();
  setupUnsavedChangesWarning();
})();
