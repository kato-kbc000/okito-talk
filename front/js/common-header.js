import { getCurrentUser, ensureCurrentProfile, logoutUser } from './api.js';

const path = window.location.pathname;
const inHomeFolder = path.includes('/html/home/');
const base = inHomeFolder ? '../' : '';

function logoMarkup() {
  return `<div class="pop-logo"><span class="c1">お</span><span class="c2">き</span><span class="c3">と</span><span class="c4">ー</span><span class="c4">ー</span><span class="c4">ー</span><span class="c4">ー</span><span class="c5">く</span></div>`;
}

function active(name) {
  const file = path.split('/').pop();
  return file === name ? ' aria-current="page" class="header-link active"' : ' class="header-link"';
}

async function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  header.innerHTML = `
    <div class="header-inner">
      <a href="${base}home.html" class="site-logo">${logoMarkup()}</a>
      <nav class="header-nav" aria-label="メインナビゲーション">
        <a href="${base}home.html"${active('home.html')}>ホーム</a>
        <a href="${base}home/search.html"${active('search.html')}>検索</a>
        <a href="${base}home/community.html"${active('community.html')}>コミュニティ</a>
        <a href="${base}home.html#mapSection" class="header-link">追加（ピン）</a>
        <a href="${base}home/messages.html"${active('messages.html')}>メッセージ</a>
        <a href="${base}home/profile.html"${active('profile.html')} id="headerAccountLink">マイアカウント</a>
        <button type="button" class="header-logout-button" id="headerLogoutButton">ログアウト</button>
      </nav>
    </div>`;

  try {
    const user = await getCurrentUser();
    if (!user) {
      window.location.replace(`${base}login.html`);
      return;
    }
    const profile = await ensureCurrentProfile(user);
    const account = document.getElementById('headerAccountLink');
    if (account && profile?.display_name) account.title = `${profile.display_name}さんのプロフィール`;
  } catch (error) {
    console.error('ログイン状態の確認に失敗しました。', error);
  }

  document.getElementById('headerLogoutButton')?.addEventListener('click', async () => {
    try {
      await logoutUser();
      localStorage.removeItem('pendingProfile');
      window.location.replace(`${base}login.html`);
    } catch (error) {
      alert(`ログアウトに失敗しました：${error.message}`);
    }
  });
}

initHeader();
