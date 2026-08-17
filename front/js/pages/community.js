"use strict";

import { supabase } from "../supabase.js";

const list = document.getElementById("communityList");
const empty = document.getElementById("communityEmpty");

function escapeHtml(value = "") {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

function renderCommunities(communities) {
  if (!list || !empty) return;

  list.replaceChildren();
  empty.hidden = communities.length > 0;

  const fragment = document.createDocumentFragment();

  communities.forEach((community) => {
    const article = document.createElement("article");
    article.className = "community-card";

    const icon = community.icon_url
      ? `<img src="${escapeHtml(community.icon_url)}" alt="" class="community-card-icon">`
      : `<span class="community-mark" aria-hidden="true">🌺</span>`;

    article.innerHTML = `
      ${icon}
      <h3>${escapeHtml(community.name || "名称未設定")}</h3>
      <p>${escapeHtml(community.description || "説明はまだありません。")}</p>
      <small>${community.is_private ? "非公開コミュニティ" : "公開コミュニティ"}</small>
      <a class="button" href="community/community_home.html?id=${encodeURIComponent(community.id)}">
        コミュニティを見る
      </a>
    `;

    fragment.appendChild(article);
  });

  list.appendChild(fragment);
}

async function loadCommunities() {
  if (!list || !empty) return;

  empty.hidden = true;
  list.innerHTML = '<p>コミュニティを読み込んでいます…</p>';

  const { data, error } = await supabase
    .from("communities")
    .select("id, name, description, icon_url, is_private, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("コミュニティ取得エラー:", error);
    list.innerHTML = `<p style="color:#c62828;">コミュニティを読み込めませんでした：${escapeHtml(error.message)}</p>`;
    return;
  }

  renderCommunities(data || []);
}

function initializeMobileMenu() {
  const button = document.getElementById("mobileMenuButton");
  const drawer = document.getElementById("mobileMenuDrawer");
  const closeButton = document.getElementById("mobileMenuCloseButton");
  const backdrop = document.getElementById("mobileMenuBackdrop");

  if (!button || !drawer) return;

  const close = () => {
    button.classList.remove("open");
    drawer.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("mobile-menu-open");
  };

  const open = () => {
    button.classList.add("open");
    drawer.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("mobile-menu-open");
  };

  button.addEventListener("click", () => {
    drawer.classList.contains("open") ? close() : open();
  });
  closeButton?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
}

document.addEventListener("DOMContentLoaded", () => {
  initializeMobileMenu();
  loadCommunities();
});
