import {
  getCurrentUser, ensureCurrentProfile, logoutUser,
  getUnreadMessageCount, subscribeToIncomingMessages
} from './api.js';

/*
 * 共通ヘッダー
 *
 * 使い方: ページに <header class="site-header"></header> を置き、
 * Supabase CDN の後でこのファイルを type="module" で読み込みます。
 * リンクは、このファイル自身の場所を基準に組み立てるため、
 * ページがどの階層にあっても壊れません。
 */

const HTML_ROOT = new URL('../html/', import.meta.url);
const href = (file) => new URL(file, HTML_ROOT).href;
const IMAGE_ROOT = new URL('../../images/', import.meta.url);
const currentFile = window.location.pathname.split('/').pop();

const NAV_ITEMS = [
  { file: 'home.html', label: 'ホーム' },
  { file: 'home/search.html', label: '検索' },
  { file: 'home/community.html', label: 'コミュニティ', alsoActive: /\/community\// },
    { file: 'home/messages.html', label: 'メッセージ', badge: true },
  { file: 'home/profile.html', label: 'マイアカウント', id: 'headerAccountLink' }
];

const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.5 4.5"/>',
  community: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 19c.2-4 2.2-6 5.5-6s5.3 2 5.5 6"/><path d="M14.5 14c3.4-.7 5.7 1 6 4.5"/>',
  messages: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c.4-4.3 3-6.5 7.5-6.5s7.1 2.2 7.5 6.5"/>',
  logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="m16 8 4 4-4 4"/><path d="M20 12H9"/>'
};

const SIDE_ITEMS = [
  { file: 'home.html', label: 'ホーム', icon: 'home' },
  { file: 'home/search.html', label: '検索', icon: 'search' },
  { file: 'home/community.html', label: 'コミュニティ', icon: 'community', alsoActive: /\/community\// },
  { file: 'home/messages.html', label: 'メッセージ', icon: 'messages', badge: true },
  { file: 'home/profile.html', label: 'マイアカウント', icon: 'profile' }
];

/** ホームと同じ左メニュー。<aside class="side-menu" data-common-sidebar></aside> に描画する。 */
function renderSidebar() {
  const aside = document.querySelector('[data-common-sidebar]');
  if (!aside) return;
  const icon = (name) => `<span class="side-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[name]}</svg></span>`;
  const links = SIDE_ITEMS.map((item) => {
    const active = isActive(item);
    return `<a href="${href(item.file)}" class="side-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}>
      ${active ? '<span class="active-line" aria-hidden="true"></span>' : ''}${icon(item.icon)}
      <span class="side-label">${item.label}</span>
      ${item.badge ? '<span class="side-notification" data-unread-badge hidden>0</span>' : ''}
    </a>`;
  }).join('');
  aside.innerHTML = `
    <div class="side-background" aria-hidden="true"><img src="${new URL('okinawa-sidebar.png', IMAGE_ROOT).href}" alt=""></div>
    <nav class="side-navigation">
      ${links}
      <button type="button" class="side-link side-logout" data-sidebar-logout>${icon('logout')}<span class="side-label">ログアウト</span></button>
    </nav>`;
}

/** スマホ用：画面下部のタブバー（幅760px以下でだけ表示される） */
function renderMobileTabbar() {
  if (document.querySelector('.mobile-tabbar')) return;
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  const nav = document.createElement('nav');
  nav.className = 'mobile-tabbar';
  nav.setAttribute('aria-label', 'スマホ用メニュー');
  nav.innerHTML = SIDE_ITEMS.map((item) => {
    const active = isActive(item);
    return `<a href="${href(item.file)}" class="mobile-tab${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}>
      ${svg(item.icon)}<span>${item.label.replace('マイアカウント', 'マイ').replace('コミュニティ', 'コミュニティ')}</span>
      ${item.badge ? '<i class="mobile-tab-badge" data-unread-badge hidden>0</i>' : ''}
    </a>`;
  }).join('') + `<button type="button" class="mobile-tab mobile-tab-logout" data-mobile-logout>${svg('logout')}<span>ログアウト</span></button>`;
  document.body.append(nav);
  nav.querySelector('[data-mobile-logout]')?.addEventListener('click', logout);
  document.body.classList.add('has-mobile-tabbar');
}

function logoMarkup() {
  return `<div class="pop-logo"><span class="c1">お</span><span class="c2">き</span><span class="c3">と</span><span class="c4">ー</span><span class="c4">ー</span><span class="c4">ー</span><span class="c4">ー</span><span class="c5">く</span></div>`;
}

function isActive(item) {
  if (item.noActive) return false;
  const target = item.file.split('#')[0].split('/').pop();
  if (target === currentFile) return true;
  return Boolean(item.alsoActive?.test(window.location.pathname));
}

function navLink(item) {
  const active = isActive(item);
  const idAttr = item.id ? ` id="${item.id}"` : '';
  const aria = active ? ' aria-current="page"' : '';
  return `<a href="${href(item.file)}" class="header-link${active ? ' active' : ''}"${aria}${idAttr}>${item.label}${item.badge ? '<span class="header-badge" id="headerUnreadBadge" hidden>0</span>' : ''}</a>`;
}

async function logout() {
  try {
    await logoutUser();
    window.location.replace(href('login.html'));
  } catch (error) {
    alert(`ログアウトに失敗しました：${error.message}`);
  }
}

async function initHeader() {
  renderSidebar();
  renderMobileTabbar();
  document.querySelector('[data-sidebar-logout]')?.addEventListener('click', logout);
  const header = document.querySelector('.site-header');
  if (!header) return;

  header.innerHTML = `
    <div class="header-inner">
      <a href="${href('home.html')}" class="site-logo" aria-label="おきとーーーーーーく ホーム">${logoMarkup()}</a>
      <nav class="header-nav" aria-label="メインナビゲーション">
        ${NAV_ITEMS.map(navLink).join('')}
        <button type="button" class="header-logout-button" id="headerLogoutButton">ログアウト</button>
      </nav>
    </div>`;

  try {
    const user = await getCurrentUser();
    if (!user) {
      window.location.replace(href('login.html'));
      return;
    }
    const profile = await ensureCurrentProfile(user);
    const account = document.getElementById('headerAccountLink');
    if (account && profile?.display_name) {
      account.title = `${profile.display_name}さんのプロフィール`;
    }
    initUnreadBadge(user.id);
  } catch (error) {
    console.error('ログイン状態の確認に失敗しました。', error);
  }

  document.getElementById('headerLogoutButton')?.addEventListener('click', async () => {
    try {
      await logoutUser();
      window.location.replace(href('login.html'));
    } catch (error) {
      alert(`ログアウトに失敗しました：${error.message}`);
    }
  });
}

async function initUnreadBadge(userId) {
  const badges = [document.getElementById('headerUnreadBadge'), ...document.querySelectorAll('[data-unread-badge]')].filter(Boolean);
  if (!badges.length) return;
  const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
  const refresh = async () => {
    try {
      const count = await getUnreadMessageCount(userId);
      badges.forEach((badge) => {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.hidden = count === 0;
      });
      document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
    } catch (error) {
      console.warn('未読メッセージ数を取得できませんでした。', error);
    }
  };
  await refresh();
  subscribeToIncomingMessages(userId, refresh);
}

initHeader();
