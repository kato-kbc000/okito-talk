// front/js/pages/login.js

import {
    loginUser,
    createProfile
} from "../api.js";

/*
 * HTML要素を取得
 */
const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

if (!form) {
    throw new Error(
        "loginFormが見つかりません。login.htmlを確認してください。"
    );
}

const submitButton =
    form.querySelector('button[type="submit"]');

/**
 * ログインボタンの状態を変更
 *
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
    if (!submitButton) {
        return;
    }

    submitButton.disabled = isLoading;

    submitButton.textContent =
        isLoading ? "ログイン中..." : "ログイン";
}

/**
 * Supabaseエラーを日本語へ変換
 *
 * @param {Error} error
 * @returns {string}
 */
function getLoginErrorMessage(error) {
    const message =
        error?.message?.toLowerCase() ?? "";

    const code =
        error?.code?.toLowerCase() ?? "";

    if (
        message.includes("invalid login credentials") ||
        message.includes("invalid credentials")
    ) {
        return "メールアドレスまたはパスワードが正しくありません。";
    }

    if (message.includes("email not confirmed")) {
        return "メールアドレスの確認が完了していません。確認メールをご確認ください。";
    }

    if (message.includes("invalid email")) {
        return "メールアドレスの形式が正しくありません。";
    }

    if (
        message.includes("row-level security") ||
        message.includes("violates row-level security")
    ) {
        return "プロフィールを保存できませんでした。SupabaseのRLS設定を確認してください。";
    }

    if (
        message.includes("permission denied") ||
        message.includes("not authorized")
    ) {
        return "プロフィールを登録する権限がありません。Supabaseのポリシーを確認してください。";
    }

    if (
        code === "23505" ||
        message.includes("duplicate key")
    ) {
        return "プロフィール情報はすでに登録されています。";
    }

    if (message.includes("rate limit")) {
        return "ログイン操作が多すぎます。少し時間を空けてからお試しください。";
    }

    if (
        message.includes("failed to fetch") ||
        message.includes("network")
    ) {
        return "Supabaseへ接続できませんでした。インターネット接続と設定を確認してください。";
    }

    return `ログインに失敗しました：${
        error?.message ?? "原因不明のエラー"
    }`;
}

/**
 * localStorageに一時保存したプロフィールを
 * profilesテーブルへ登録
 *
 * @param {Object} user
 */
async function createPendingProfile(user) {
    const pendingProfileJson =
        localStorage.getItem("pendingProfile");

    if (!pendingProfileJson) {
        return;
    }

    let pendingProfile;

    try {
        pendingProfile =
            JSON.parse(pendingProfileJson);
    } catch (error) {
        console.error(
            "プロフィール一時データの読み込みに失敗しました:",
            error
        );

        localStorage.removeItem("pendingProfile");
        return;
    }

    /*
     * 別ユーザーの一時データを
     * 誤って登録しないように確認
     */
    if (pendingProfile.userId !== user.id) {
        console.warn(
            "ログインユーザーと一時保存されたユーザーIDが一致しません。"
        );
        return;
    }

    try {
        const profile =
            await createProfile({
                userId: user.id,
                username: pendingProfile.username,
                displayName: pendingProfile.displayName
            });

        console.log(
            "プロフィール登録成功:",
            profile
        );

        /*
         * profilesへの登録成功後に削除
         */
        localStorage.removeItem("pendingProfile");
    } catch (error) {
        const message =
            error?.message?.toLowerCase() ?? "";

        const code =
            error?.code ?? "";

        /*
         * すでにプロフィールが存在する場合は
         * エラー扱いにせず一時データを削除
         */
        if (
            code === "23505" ||
            message.includes("duplicate key")
        ) {
            console.log(
                "プロフィールはすでに登録されています。"
            );

            localStorage.removeItem("pendingProfile");
            return;
        }

        throw error;
    }
}

/**
 * ログイン処理
 */
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;

    /*
     * 未入力チェック
     */
    if (email === "" || password === "") {
        alert(
            "メールアドレスとパスワードを入力してください。"
        );
        return;
    }

    try {
        setLoading(true);

        /*
         * Supabase Authでログイン
         */
        const result =
            await loginUser({
                email,
                password
            });

        const user =
            result.user;

        console.log(
            "ログイン成功:",
            user
        );

        /*
         * 登録時にprofilesへ保存できなかった場合、
         * ログイン後にprofilesへ登録する
         */
        await createPendingProfile(user);

        /*
         * login.htmlとloading.htmlは
         * front/html直下にある
         */
        window.location.href =
            "./loading.html";
    } catch (error) {
        console.error(
            "ログインエラー:",
            error
        );

        alert(
            getLoginErrorMessage(error)
        );
    } finally {
        setLoading(false);
    }
});