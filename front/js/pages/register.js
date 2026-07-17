// front/js/pages/register.js

import {
    registerUser,
    createProfile,
    isUsernameTaken
} from "../api.js";

/*
 * HTML要素を取得
 */
const form = document.getElementById("register-form");

const usernameInput =
    document.getElementById("username");

const displayNameInput =
    document.getElementById("display-name");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const passwordConfirmInput =
    document.getElementById("password-confirm");

const errorMessage =
    document.getElementById("error-message");

if (!form) {
    throw new Error(
        "register-formが見つかりません。register.htmlを確認してください。"
    );
}

const submitButton =
    form.querySelector('button[type="submit"]');

/**
 * エラーメッセージを表示
 *
 * @param {string} message
 */
function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
        return;
    }

    alert(message);
}

/**
 * エラーメッセージを消す
 */
function clearError() {
    if (errorMessage) {
        errorMessage.textContent = "";
    }
}

/**
 * 登録ボタンの状態を変更
 *
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
    if (!submitButton) {
        return;
    }

    submitButton.disabled = isLoading;

    submitButton.textContent =
        isLoading ? "登録中..." : "会員登録";
}

/**
 * Supabaseのエラーを日本語へ変換
 *
 * @param {Error} error
 * @returns {string}
 */
function getRegisterErrorMessage(error) {
    const message =
        error?.message?.toLowerCase() ?? "";

    const code =
        error?.code?.toLowerCase() ?? "";

    if (
        message.includes("already registered") ||
        message.includes("already been registered")
    ) {
        return "このメールアドレスはすでに登録されています。";
    }

    if (
        message.includes("duplicate key") &&
        message.includes("username")
    ) {
        return "このユーザー名はすでに使用されています。";
    }

    if (
        code === "23505" &&
        message.includes("username")
    ) {
        return "このユーザー名はすでに使用されています。";
    }

    if (message.includes("invalid email")) {
        return "メールアドレスの形式が正しくありません。";
    }

    if (
        message.includes("password") &&
        (
            message.includes("least") ||
            message.includes("characters")
        )
    ) {
        return "パスワードの文字数が不足しています。";
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

    if (message.includes("rate limit")) {
        return "登録操作が多すぎます。少し時間を空けてからお試しください。";
    }

    if (
        message.includes("failed to fetch") ||
        message.includes("network")
    ) {
        return "Supabaseへ接続できませんでした。インターネット接続と設定を確認してください。";
    }

    return `会員登録に失敗しました：${
        error?.message ?? "原因不明のエラー"
    }`;
}

/**
 * フォーム送信処理
 */
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const username =
        usernameInput.value.trim();

    const displayName =
        displayNameInput.value.trim();

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;

    const passwordConfirm =
        passwordConfirmInput.value;

    /*
     * 未入力チェック
     */
    if (
        username === "" ||
        displayName === "" ||
        email === "" ||
        password === "" ||
        passwordConfirm === ""
    ) {
        showError(
            "すべての項目を入力してください。"
        );
        return;
    }

    /*
     * ユーザー名チェック
     */
    const usernamePattern =
        /^[a-zA-Z0-9_]+$/;

    if (!usernamePattern.test(username)) {
        showError(
            "ユーザー名は半角英数字とアンダースコアで入力してください。"
        );
        return;
    }

    if (username.length > 30) {
        showError(
            "ユーザー名は30文字以内で入力してください。"
        );
        return;
    }

    /*
     * 表示名チェック
     */
    if (displayName.length > 50) {
        showError(
            "表示名は50文字以内で入力してください。"
        );
        return;
    }

    /*
     * パスワードチェック
     */
    if (password.length < 8) {
        showError(
            "パスワードは8文字以上で入力してください。"
        );
        return;
    }

    if (password !== passwordConfirm) {
        showError(
            "確認用パスワードが一致していません。"
        );
        return;
    }

    try {
        setLoading(true);

        /*
         * ユーザー名の重複確認
         */
        const usernameTaken =
            await isUsernameTaken(username);

        if (usernameTaken) {
            showError(
                "このユーザー名はすでに使用されています。"
            );
            return;
        }

        /*
         * Supabase Authへ登録
         */
        const authResult =
            await registerUser({
                username,
                displayName,
                email,
                password
            });

        const user =
            authResult.user;

        console.log(
            "Auth登録成功:",
            user
        );

        /*
         * 登録直後にセッションがある場合、
         * profilesテーブルへ登録する
         *
         * メール確認が有効な場合は、
         * sessionがnullになる可能性があります。
         */
        if (authResult.session) {
            const profile =
                await createProfile({
                    userId: user.id,
                    username,
                    displayName
                });

            console.log(
                "プロフィール登録成功:",
                profile
            );
        } else {
            /*
             * メール確認が有効で、
             * 登録直後にプロフィールを作れない場合に備えて
             * ログイン後に使う情報を一時保存
             */
            localStorage.setItem(
                "pendingProfile",
                JSON.stringify({
                    userId: user.id,
                    username,
                    displayName
                })
            );

            console.log(
                "プロフィール情報を一時保存しました。"
            );
        }

        alert(
            authResult.session
                ? "会員登録が完了しました。ログインしてください。"
                : "確認メールを送信しました。メール確認後にログインしてください。"
        );

        /*
         * register.htmlとlogin.htmlは
         * front/html直下にある
         */
        window.location.href =
            "./login.html";
    } catch (error) {
        console.error(
            "新規登録エラー:",
            error
        );

        showError(
            getRegisterErrorMessage(error)
        );
    } finally {
        setLoading(false);
    }
});