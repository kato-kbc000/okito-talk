// login.js

const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const password = document
        .getElementById("password")
        .value;

    // 入力チェック
    if (email === "" || password === "") {
        alert("メールアドレスとパスワードを入力してください。");
        return;
    }

    // ----------------------------
    // TODO：Supabaseでログイン
    // ----------------------------

    /*
    const { data, error } =
        await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

    if (error) {
        alert("ログインに失敗しました。");
        console.error(error);
        return;
    }
    */

    // 現在はログイン成功扱い
    console.log({
        email,
        password
    });

    // ローディング画面へ移動
    window.location.href = "loading.html";
});