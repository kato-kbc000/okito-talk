// front/js/api.js
import { supabase } from "./supabase.js";

export async function registerUser({ email, password, username, displayName }) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: displayName } }
    });
    if (error) throw error;
    if (!data.user) throw new Error("登録ユーザーを取得できませんでした。");
    return data;
}

export async function loginUser({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user || !data.session) throw new Error("ログインセッションを取得できませんでした。");
    return data;
}

export async function logoutUser() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
}

export async function getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
}

export async function isUsernameTaken(username, excludeUserId = null) {
    let query = supabase.from("profiles").select("id").eq("username", username);
    if (excludeUserId) query = query.neq("id", excludeUserId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data !== null;
}

export async function createProfile({ userId, username, displayName }) {
    const { data, error } = await supabase
        .from("profiles")
        .upsert({ id: userId, username, display_name: displayName }, { onConflict: "id" })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function ensureCurrentProfile(user) {
    const { data: existing, error: selectError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
    if (selectError) throw selectError;
    if (existing) return existing;

    const metadata = user.user_metadata ?? {};
    const base = (user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`)
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 30);

    return createProfile({
        userId: user.id,
        username: metadata.username || base,
        displayName: metadata.display_name || metadata.full_name || base
    });
}

export async function getProfile(userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    return data;
}

export async function updateProfile(userId, values) {
    const allowed = {
        username: values.username,
        display_name: values.displayName,
        bio: values.bio ?? null,
        avatar_url: values.avatarUrl ?? null,
        header_url: values.headerUrl ?? null,
        city: values.city ?? null,
        is_private: Boolean(values.isPrivate)
    };
    const { data, error } = await supabase
        .from("profiles")
        .update(allowed)
        .eq("id", userId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function createPost({ userId, content, locationName = null, locationAddress = null, latitude = null, longitude = null, imageUrl = null }) {
    const { data, error } = await supabase
        .from("posts")
        .insert({
            user_id: userId,
            content,
            image_url: imageUrl,
            location_name: locationName,
            location_address: locationAddress,
            latitude,
            longitude
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function getTimelinePosts() {
    const { data, error } = await supabase
        .from("posts")
        .select("*, profiles:user_id(username, display_name, avatar_url)")
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function getUserPosts(userId) {
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
}
