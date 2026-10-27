import {
  getCurrentUser, logoutUser, getUnreadMessageCount, subscribeToIncomingMessages
} from './api.js';

/*
 * サイドバー付きページ共通の処理
 *  - [data-logout] ボタンでログアウト
 *  - [data-unread-badge] に未読メッセージ数を表示（新着はリアルタイム更新）
 *    ※ home / messages は各ページ側で同じ処理をしているため、バッジ要素を置かなければ何もしません。
 */

const LOGIN_URL = new URL('../html/login.html', import.meta.url).href;
const BASE_TITLE = document.title.replace(/^\(\d+\)\s*/, '');

document.querySelectorAll('[data-logout]').forEach((button) => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await logoutUser();
      window.location.replace(LOGIN_URL);
    } catch (error) {
      button.disabled = false;
      alert(`ログアウトに失敗しました：${error.message}`);
    }
  });
});

async function initUnreadBadge() {
  const badges = document.querySelectorAll('[data-unread-badge]');
  if (!badges.length) return;
  try {
    const user = await getCurrentUser();
    if (!user) return;
    const refresh = async () => {
      const count = await getUnreadMessageCount(user.id);
      badges.forEach((badge) => {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.hidden = count === 0;
      });
      document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE;
    };
    await refresh();
    subscribeToIncomingMessages(user.id, refresh);
  } catch (error) {
    console.warn('未読メッセージ数を取得できませんでした。', error);
  }
}

initUnreadBadge();
