const form = document.getElementById("registerForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const displayName = document.getElementById("displayName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // 入力チェック
    if(
        username === "" ||
        displayName === "" ||
        email === "" ||
        password === "" ||
        confirmPassword === ""
    ){
        alert("すべて入力してください。");
        return;
    }

    if(password.length < 8){
        alert("パスワードは8文字以上にしてください。");
        return;
    }

    if(password !== confirmPassword){
        alert("パスワードが一致しません。");
        return;
    }

    console.log({
        username,
        displayName,
        email,
        password
    });

    // TODO
    // Supabase Auth登録

    // TODO
    // profilesテーブルへ登録

    alert("登録完了！（仮）");

    location.href = "../timeline.html";

});