import {
  getCurrentUser, ensureCurrentProfile, getCommunity, getCategories, getCommunityMembers,
  updateCommunityRecord, deleteCommunityRecord, uploadCommunityImage,
  setMemberStatus, setMemberRole, leaveCommunity
} from "../../api.js";

/* =========================================
   コミュニティ設定（DB連携版）
   community_settings.html?id=<communities.id>
   オーナー / 管理者のみ利用できます。
========================================= */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const communityId = new URLSearchParams(location.search).get("id");

  const form = $("communitySettingsForm");
  const nameInput = $("communityName");
  const descriptionInput = $("communityDescription");
  const rulesInput = $("communityRules");
  const categorySelect = $("communityCategory");
  const nameCount = $("communityNameCount");
  const descriptionCount = $("communityDescriptionCount");
  const rulesCount = $("communityRulesCount");
  const nameError = $("communityNameError");
  const descriptionError = $("communityDescriptionError");
  const imageInput = $("communityImage");
  const previewImage = $("previewImage");
  const imageFallback = $("imageFallback");
  const removeImageButton = $("removeImageButton");
  const toast = $("toast");
  const memberSearch = $("memberSearch");
  const memberList = $("memberList");
  const memberEmpty = $("memberEmpty");
  const requestList = $("requestList");
  const requestEmpty = $("requestEmpty");
  const modal = $("deleteModal");
  const openDeleteModalButton = $("openDeleteModal");
  const deleteConfirmName = $("deleteConfirmName");
  const confirmDeleteButton = $("confirmDeleteButton");
  const mobileMenuButton = document.querySelector(".mobile-menu-button");
  const headerNav = document.querySelector(".header-nav");

  const ctx = { user: null, community: null, role: null, members: [], imageUrl: "", imageFile: null, imagePreview: "", initial: null, toastTimer: null };

  const VISIBILITY_LABEL = { public: "公開", approval: "承認制", private: "非公開" };
  const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const displayName = (p) => p?.display_name || p?.username || "ユーザー";

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showToast(message, type = "success") {
    clearTimeout(ctx.toastTimer);
    toast.textContent = message;
    toast.classList.toggle("is-error", type === "error");
    toast.classList.add("is-visible");
    ctx.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3000);
  }

  /* ---------- フォーム ---------- */

  const visibilityValue = () => form.querySelector('input[name="visibility"]:checked')?.value || "public";
  const rulesFromText = (text) => text.split("\n").map((line) => line.replace(/^[・\-\s]+/, "").trim()).filter(Boolean).slice(0, 10);

  function getState() {
    return {
      name: nameInput.value.trim(), description: descriptionInput.value.trim(),
      rules: rulesFromText(rulesInput.value), categoryName: categorySelect.value,
      visibility: visibilityValue(), imageUrl: ctx.imagePreview || ctx.imageUrl
    };
  }

  function updateCounts() {
    nameCount.textContent = `${nameInput.value.length} / ${nameInput.maxLength}`;
    descriptionCount.textContent = `${descriptionInput.value.length} / ${descriptionInput.maxLength}`;
    rulesCount.textContent = `${rulesInput.value.length} / ${rulesInput.maxLength}`;
  }

  function updateSummary() {
    $("summaryVisibility").textContent = VISIBILITY_LABEL[visibilityValue()];
    $("summaryCategory").textContent = categorySelect.value;
  }

  function renderImage() {
    const src = ctx.imagePreview || ctx.imageUrl;
    previewImage.hidden = !src;
    imageFallback.hidden = Boolean(src);
    if (src) previewImage.src = src; else previewImage.removeAttribute("src");
  }

  function applyCommunity(c) {
    nameInput.value = c.name;
    descriptionInput.value = c.description || "";
    rulesInput.value = (c.rules || []).map((rule) => `・${rule}`).join("\n");
    if (![...categorySelect.options].some((o) => o.value === c.categoryName)) categorySelect.add(new Option(c.categoryName, c.categoryName));
    categorySelect.value = c.categoryName;
    const radio = form.querySelector(`input[name="visibility"][value="${c.visibility}"]`);
    if (radio) radio.checked = true;
    ctx.imageUrl = c.header_url || "";
    ctx.imageFile = null; ctx.imagePreview = "";
    imageFallback.textContent = c.icon_emoji || "🌺";
    renderImage(); updateCounts(); updateSummary();

    $("sideAvatar").textContent = c.icon_emoji || "🌺";
    $("sideName").textContent = c.name;
    $("summaryCreated").textContent = new Date(c.created_at).toLocaleDateString("ja-JP");
    deleteConfirmName.value = "";
    $("deleteConfirmLabel").textContent = `「${c.name}」と入力`;
    ctx.initial = getState();
  }

  function validate() {
    nameError.textContent = descriptionError.textContent = "";
    nameInput.classList.remove("is-error"); descriptionInput.classList.remove("is-error");
    let valid = true;
    if (!nameInput.value.trim()) { nameError.textContent = "コミュニティ名を入力してください。"; nameInput.classList.add("is-error"); valid = false; }
    if (!descriptionInput.value.trim()) { descriptionError.textContent = "コミュニティの説明を入力してください。"; descriptionInput.classList.add("is-error"); valid = false; }
    if (!valid) form.querySelector(".is-error")?.focus();
    return valid;
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!validate()) { showToast("入力内容を確認してください。", "error"); return; }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const state = getState();
      let headerUrl = ctx.imageUrl || null;
      if (ctx.imageFile) headerUrl = await uploadCommunityImage(ctx.user.id, ctx.imageFile);
      await updateCommunityRecord(communityId, {
        name: state.name, description: state.description, rules: state.rules,
        categoryName: state.categoryName, visibility: state.visibility, headerUrl
      });
      ctx.community = await getCommunity(communityId);
      applyCommunity(ctx.community);
      showToast("コミュニティ設定を保存しました。");
    } catch (error) {
      console.error(error);
      showToast(`保存に失敗しました：${error.message}`, "error");
    } finally { submit.disabled = false; }
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) { showToast("PNG・JPG・WebP形式の画像を選択してください。", "error"); imageInput.value = ""; return; }
    if (file.size > 2 * 1024 * 1024) { showToast("画像サイズは2MB以内にしてください。", "error"); imageInput.value = ""; return; }
    if (ctx.imagePreview) URL.revokeObjectURL(ctx.imagePreview);
    ctx.imageFile = file; ctx.imagePreview = URL.createObjectURL(file);
    renderImage();
    showToast("画像を変更しました。保存ボタンを押してください。");
  }

  function removeImage() {
    if (!ctx.imagePreview && !ctx.imageUrl) { showToast("削除できる画像がありません。", "error"); return; }
    if (ctx.imagePreview) URL.revokeObjectURL(ctx.imagePreview);
    ctx.imagePreview = ""; ctx.imageFile = null; ctx.imageUrl = ""; imageInput.value = "";
    renderImage();
    showToast("画像を削除しました。保存ボタンを押してください。");
  }

  /* ---------- メンバー管理 ---------- */

  function memberRow(member) {
    const p = member.profile;
    const item = make("div", "member-item");
    item.dataset.member = `${displayName(p)} @${p.username || ""}`;
    const avatar = make("div", "avatar");
    if (p.avatar_url) { const img = make("img"); img.src = p.avatar_url; img.alt = ""; img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:inherit"; avatar.append(img); }
    else avatar.textContent = displayName(p).charAt(0);
    const info = make("div", "member-info");
    info.append(make("strong", "", displayName(p)), make("span", "", p.username ? `@${p.username}` : ""));
    item.append(avatar, info);
    return item;
  }

  function renderMembers() {
    const rows = ctx.members.map((member) => {
      const item = memberRow(member);
      const isOwnerRow = member.role === "owner";
      if (isOwnerRow) {
        item.append(make("span", "role-badge owner", "オーナー"));
      } else {
        const select = make("select", "role-select");
        select.setAttribute("aria-label", `${displayName(member.profile)}の権限`);
        select.add(new Option("メンバー", "member")); select.add(new Option("管理者", "admin"));
        select.value = member.role;
        select.disabled = ctx.role !== "owner";
        select.addEventListener("change", async () => {
          try { await setMemberRole(communityId, member.user_id, select.value); member.role = select.value; showToast("権限を変更しました。"); }
          catch (error) { select.value = member.role; showToast(`変更できませんでした：${error.message}`, "error"); }
        });
        const menu = make("button", "member-menu-button", "✕");
        menu.type = "button";
        menu.setAttribute("aria-label", `${displayName(member.profile)}を退会させる`);
        menu.addEventListener("click", async () => {
          if (!window.confirm(`${displayName(member.profile)}さんをコミュニティから削除しますか？`)) return;
          try { await leaveCommunity(communityId, member.user_id); ctx.members = ctx.members.filter((m) => m !== member); renderMembers(); showToast("メンバーを削除しました。"); }
          catch (error) { showToast(`削除できませんでした：${error.message}`, "error"); }
        });
        item.append(select, menu);
      }
      return item;
    });
    memberList.replaceChildren(...rows);
    filterMembers();
  }

  function filterMembers() {
    const keyword = memberSearch.value.trim().toLowerCase();
    let visible = 0;
    memberList.querySelectorAll(".member-item").forEach((item) => {
      const show = item.dataset.member.toLowerCase().includes(keyword);
      item.hidden = !show;
      if (show) visible += 1;
    });
    memberEmpty.hidden = visible !== 0;
    $("sideMembers").textContent = `${ctx.members.length}人のメンバー`;
  }

  function renderRequests(pending) {
    requestEmpty.hidden = pending.length > 0;
    requestList.replaceChildren(...pending.map((member) => {
      const item = memberRow(member);
      const approve = make("button", "button button-primary", "承認");
      const reject = make("button", "button button-secondary", "拒否");
      approve.type = reject.type = "button";
      const act = async (status) => {
        approve.disabled = reject.disabled = true;
        try {
          await setMemberStatus(communityId, member.user_id, status);
          if (status === "approved") { member.status = "approved"; ctx.members.push(member); renderMembers(); }
          item.remove();
          if (!requestList.children.length) requestEmpty.hidden = false;
          showToast(status === "approved" ? "参加を承認しました。" : "参加を拒否しました。");
        } catch (error) { approve.disabled = reject.disabled = false; showToast(`操作できませんでした：${error.message}`, "error"); }
      };
      approve.addEventListener("click", () => act("approved"));
      reject.addEventListener("click", () => act("rejected"));
      item.append(approve, reject);
      return item;
    }));
  }

  /* ---------- 削除 ---------- */

  function openDeleteModal() { modal.hidden = false; document.body.style.overflow = "hidden"; deleteConfirmName.value = ""; confirmDeleteButton.disabled = true; setTimeout(() => deleteConfirmName.focus(), 0); }
  function closeDeleteModal() { modal.hidden = true; document.body.style.overflow = ""; }

  async function deleteCommunity() {
    if (deleteConfirmName.value !== ctx.community.name) return;
    confirmDeleteButton.disabled = true;
    try {
      await deleteCommunityRecord(communityId);
      closeDeleteModal();
      showToast("コミュニティを削除しました。");
      setTimeout(() => { location.href = "../community.html"; }, 800);
    } catch (error) {
      confirmDeleteButton.disabled = false;
      showToast(`削除できませんでした：${error.message}`, "error");
    }
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

  /* ---------- 初期化 ---------- */

  function denyAccess(message) {
    document.querySelector(".main-content").innerHTML = `<section class="page-heading"><div><a class="back-link" href="../community.html">← コミュニティ一覧へ</a><h1>コミュニティ設定</h1><p>${message}</p></div></section>`;
  }

  async function init() {
    try {
      ctx.user = await getCurrentUser();
      if (!ctx.user) { location.replace("../../login.html"); return; }
      await ensureCurrentProfile(ctx.user);

      ctx.community = communityId ? await getCommunity(communityId) : null;
      if (!ctx.community) { denyAccess("コミュニティが見つかりません。"); return; }
      $("backLink").href = `community_home.html?id=${encodeURIComponent(communityId)}`;

      const [categories, members, pending] = await Promise.all([
        getCategories(), getCommunityMembers(communityId), getCommunityMembers(communityId, "pending")
      ]);
      ctx.members = members.filter((m) => m.profile);
      const me = ctx.members.find((m) => m.user_id === ctx.user.id);
      ctx.role = me?.role || (ctx.community.owner_id === ctx.user.id ? "owner" : null);
      if (!["owner", "admin"].includes(ctx.role)) { denyAccess("このページはオーナーと管理者だけが利用できます。"); return; }

      categories.forEach((c) => categorySelect.add(new Option(c.name, c.name)));
      applyCommunity(ctx.community);
      renderMembers();
      renderRequests(pending.filter((m) => m.profile));
      openDeleteModalButton.disabled = ctx.role !== "owner";
      if (ctx.role !== "owner") openDeleteModalButton.title = "オーナーのみ削除できます";
    } catch (error) {
      console.error(error);
      denyAccess(`読み込みに失敗しました：${error.message}`);
    }
  }

  /* ---------- イベント ---------- */

  document.querySelectorAll(".settings-tab").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
  [nameInput, descriptionInput, rulesInput].forEach((input) => input.addEventListener("input", updateCounts));
  form.querySelectorAll('input[name="visibility"]').forEach((radio) => radio.addEventListener("change", updateSummary));
  categorySelect.addEventListener("change", updateSummary);
  form.addEventListener("submit", saveSettings);
  $("resetButton").addEventListener("click", () => { if (ctx.community && window.confirm("保存前の変更を元に戻しますか？")) { applyCommunity(ctx.community); showToast("変更を元に戻しました。"); } });
  imageInput.addEventListener("change", handleImageChange);
  removeImageButton.addEventListener("click", removeImage);
  memberSearch.addEventListener("input", filterMembers);
  openDeleteModalButton.addEventListener("click", openDeleteModal);
  $("closeDeleteModal").addEventListener("click", closeDeleteModal);
  $("cancelDeleteButton").addEventListener("click", closeDeleteModal);
  deleteConfirmName.addEventListener("input", () => { confirmDeleteButton.disabled = !ctx.community || deleteConfirmName.value !== ctx.community.name; });
  confirmDeleteButton.addEventListener("click", deleteCommunity);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeDeleteModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeDeleteModal(); });
  mobileMenuButton?.addEventListener("click", () => {
    const open = headerNav.classList.toggle("is-open");
    mobileMenuButton.setAttribute("aria-expanded", String(open));
  });
  window.addEventListener("beforeunload", (event) => {
    if (ctx.initial && JSON.stringify(getState()) !== JSON.stringify(ctx.initial)) { event.preventDefault(); event.returnValue = ""; }
  });

  init();
})();
