// front/js/api.js
import { supabase } from "./supabase.js";

/* ========================================
   DB機能の段階導入に対応する共通処理
======================================== */

function isPendingDatabaseFeature(error) {
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "");

    return (
        code === "42P01" ||
        code === "42703" ||
        code === "PGRST204" ||
        code === "PGRST205" ||
        message.includes("could not find the table") ||
        message.includes("schema cache") ||
        message.includes("does not exist") ||
        (message.includes("column") && message.includes("not found"))
    );
}

function createPendingFeatureError(featureName) {
    const error = new Error(
        `${featureName}はデータベース準備中です。DB担当メンバーによるテーブル作成後に利用できます。`
    );
    error.name = "PendingDatabaseFeatureError";
    error.isPendingDatabaseFeature = true;
    return error;
}

export function isDatabaseFeaturePending(error) {
    return Boolean(
        error?.isPendingDatabaseFeature ||
        isPendingDatabaseFeature(error)
    );
}

/* ========================================
   ページ間で共有する短時間キャッシュ
======================================== */

/*
 * sessionStorageを使用するため、同じタブ内で
 * ホーム → プロフィール → メッセージと移動しても
 * 取得済みデータを再利用できます。
 *
 * 投稿・プロフィール更新などの書き込み後は、
 * 関係するキャッシュだけを削除します。
 */
const API_CACHE_PREFIX = "okitalk_api_cache:v2:";
const PROFILE_CACHE_TTL = 5 * 60 * 1000;
const LIST_CACHE_TTL = 60 * 1000;
const TIMELINE_CACHE_TTL = 30 * 1000;
const MESSAGE_PROFILE_CACHE_TTL = 2 * 60 * 1000;

/*
 * 同じページ内で同じAPIが同時に呼ばれた場合は、
 * 進行中のPromiseを共有して多重通信を防ぎます。
 */
const pendingRequests = new Map();

function createCacheKey(name, ...parts) {
    return `${API_CACHE_PREFIX}${name}:${parts.map(String).join(":")}`;
}

function readApiCache(key, ttl) {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        const age = Date.now() - Number(cached.savedAt || 0);

        if (age > ttl) {
            sessionStorage.removeItem(key);
            return null;
        }

        return cached.value;
    } catch (error) {
        console.warn("APIキャッシュを読み込めませんでした。", error);
        return null;
    }
}

function writeApiCache(key, value) {
    const serialized = JSON.stringify({ value, savedAt: Date.now() });

    try {
        sessionStorage.setItem(key, serialized);
    } catch (error) {
        // 古いAPIキャッシュを削除して一度だけ再試行します。
        removeApiCacheByPrefix(API_CACHE_PREFIX);
        try {
            sessionStorage.setItem(key, serialized);
        } catch {
            // キャッシュできなくてもDB処理自体は正常に継続します。
        }
    }
}

function removeApiCache(key) {
    try {
        sessionStorage.removeItem(key);
    } catch (error) {
        console.warn("APIキャッシュを削除できませんでした。", error);
    }
}

function removeApiCacheByPrefix(prefix) {
    try {
        const targets = [];

        for (let index = 0; index < sessionStorage.length; index += 1) {
            const key = sessionStorage.key(index);

            if (key?.startsWith(prefix)) {
                targets.push(key);
            }
        }

        targets.forEach((key) => sessionStorage.removeItem(key));
    } catch (error) {
        console.warn("関連キャッシュを削除できませんでした。", error);
    }
}

async function withRequestCache({
    key,
    ttl,
    loader,
    force = false
}) {
    if (!force) {
        const cached = readApiCache(key, ttl);

        if (cached !== null) {
            return cached;
        }
    }

    if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
    }

    const request = Promise.resolve()
        .then(loader)
        .then((value) => {
            writeApiCache(key, value);
            return value;
        })
        .finally(() => {
            pendingRequests.delete(key);
        });

    pendingRequests.set(key, request);
    return request;
}

/*
 * ログアウト時や利用者切替時に呼び出せる
 * 共通キャッシュ削除関数です。
 */
export function clearSharedApiCache() {
    removeApiCacheByPrefix(API_CACHE_PREFIX);
}

/* ========================================
   プロフィールキャッシュ互換処理
======================================== */

const PROFILE_CACHE_PREFIX = `${API_CACHE_PREFIX}profile:`;
const PROFILE_ENTRY_CACHE_TTL = 30 * 1000;

function readProfileCache(userId) {
    try {
        const raw = sessionStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (
            !cached?.profile ||
            Date.now() - Number(cached.savedAt || 0) > PROFILE_ENTRY_CACHE_TTL
        ) {
            sessionStorage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`);
            return null;
        }

        return cached.profile;
    } catch (error) {
        console.warn("プロフィールキャッシュの読み込みに失敗しました。", error);
        return null;
    }
}

function writeProfileCache(profile) {
    if (!profile?.id) return;

    try {
        sessionStorage.setItem(
            `${PROFILE_CACHE_PREFIX}${profile.id}`,
            JSON.stringify({
                profile,
                savedAt: Date.now()
            })
        );
    } catch {
        // 容量超過時はAPIキャッシュを整理します。キャッシュ失敗は画面動作に影響させません。
        removeApiCacheByPrefix(API_CACHE_PREFIX);
        try {
            sessionStorage.setItem(
                `${PROFILE_CACHE_PREFIX}${profile.id}`,
                JSON.stringify({ profile, savedAt: Date.now() })
            );
        } catch {
            // 保存できない場合はキャッシュを使わず継続します。
        }
    }
}

function clearProfileCache(userId) {
    if (!userId) return;
    sessionStorage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`);
}


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

    clearSharedApiCache();
}

export async function getCurrentUser() {
    /*
     * getSession はブラウザ内の認証情報を先に利用するため、
     * ページ移動のたびに認証APIへ問い合わせる待ち時間を減らせます。
     */
    const {
        data: { session },
        error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (session?.user) return session.user;

    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

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
    writeProfileCache(data);
    return data;
}

export async function ensureCurrentProfile(user) {
    const cached = readProfileCache(user.id);
    if (cached) return cached;

    const { data: existing, error: selectError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
        writeProfileCache(existing);
        return existing;
    }

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
    const cached = readProfileCache(userId);
    if (cached) return cached;

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (error) throw error;
    writeProfileCache(data);
    return data;
}

/*
 * 投稿者アイコンへカーソルを合わせた時などに、
 * 次に開くプロフィールを先に取得します。
 */
export async function updateProfile(userId, values) {
    const baseValues = {
        username: values.username,
        display_name: values.displayName,
        bio: values.bio ?? null,
        avatar_url: values.avatarUrl ?? null,
        header_url: values.headerUrl ?? null,
        city: values.city ?? null,
        is_private: Boolean(values.isPrivate)
    };

    let response = await supabase
        .from("profiles")
        .update({
            ...baseValues,
            theme_color: values.themeColor ?? undefined
        })
        .eq("id", userId)
        .select()
        .single();

    if (response.error && isPendingDatabaseFeature(response.error)) {
        response = await supabase
            .from("profiles")
            .update(baseValues)
            .eq("id", userId)
            .select()
            .single();
    }

    if (response.error) throw response.error;

    const updatedProfile = {
        ...response.data,
        theme_color:
            response.data?.theme_color ??
            values.themeColor ??
            "#2589ff"
    };

    clearProfileCache(userId);
    writeProfileCache(updatedProfile);

    /*
     * メッセージ一覧などのプロフィール一覧にも
     * 名前・画像変更を即時反映させます。
     */
    removeApiCacheByPrefix(`${API_CACHE_PREFIX}other-profiles:`);

    return updatedProfile;
}

export async function createPost({ userId, content, locationName = null, locationAddress = null, latitude = null, longitude = null, imageUrl = null, visibility = "public" }) {
    const baseValues = {
        user_id: userId,
        content,
        image_url: imageUrl,
        location_name: locationName,
        location_address: locationAddress,
        latitude,
        longitude
    };

    let response = await supabase
        .from("posts")
        .insert({
            ...baseValues,
            visibility
        })
        .select()
        .single();

    if (response.error && isPendingDatabaseFeature(response.error)) {
        response = await supabase
            .from("posts")
            .insert(baseValues)
            .select()
            .single();
    }

    if (response.error) throw response.error;
    removeApiCacheByPrefix(`${API_CACHE_PREFIX}timeline:`);
    removeApiCache(createCacheKey("user-posts", userId));
    return response.data;
}

export async function uploadPostImage(userId, file) {
    if (!userId || !file) throw new Error("画像ファイルを確認できません。");
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) throw new Error("JPEG・PNG・WebP・GIF画像を選択してください。");
    if (file.size > 5 * 1024 * 1024) throw new Error("投稿画像は5MB以下にしてください。");

    const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${userId}/${crypto.randomUUID()}.${extension || "jpg"}`;
    const { error } = await supabase.storage
        .from("post-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw error;

    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("画像URLを取得できませんでした。");
    return data.publicUrl;
}

export async function getTimelinePosts({ force = false, page = 0, pageSize = 30 } = {}) {
    const safePage = Math.max(0, Number(page) || 0);
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 30));
    const key = createCacheKey("timeline", safePage, safePageSize);

    return withRequestCache({
        key,
        ttl: TIMELINE_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("posts")
                .select("*, profiles:user_id(username, display_name, avatar_url)")
                .order("created_at", { ascending: false })
                .range(safePage * safePageSize, (safePage + 1) * safePageSize - 1);

            if (error) throw error;
            return data ?? [];
        }
    });
}

export async function getUserPosts(userId, { force = false } = {}) {
    const key = createCacheKey("user-posts", userId);

    return withRequestCache({
        key,
        ttl: TIMELINE_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("posts")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data ?? [];
        }
    });
}

export async function searchProfiles(keyword = '') {
    let query = supabase.from('profiles').select('*').order('display_name');
    const term = keyword.trim();
    if (term) query = query.or(`display_name.ilike.%${term}%,username.ilike.%${term}%,bio.ilike.%${term}%`);
    const { data, error } = await query.limit(30);
    if (error) throw error;
    return data ?? [];
}

export async function searchPosts(keyword = '') {
    let query = supabase
        .from('posts')
        .select('*, profiles:user_id(username, display_name, avatar_url)')
        .order('created_at', { ascending: false });
    const term = keyword.trim();
    if (term) query = query.ilike('content', `%${term}%`);
    const { data, error } = await query.limit(40);
    if (error) throw error;
    return data ?? [];
}

export async function deletePost(postId, userId) {
    const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", userId);

    if (error) throw error;

    removeApiCacheByPrefix(`${API_CACHE_PREFIX}timeline:`);
    removeApiCache(createCacheKey("user-posts", userId));
    removeApiCacheByPrefix(`${API_CACHE_PREFIX}liked-posts:`);
    removeApiCacheByPrefix(`${API_CACHE_PREFIX}saved-posts:`);
}

export async function updatePost(postId, userId, values) {
    const { data, error } = await supabase
        .from("posts")
        .update(values)
        .eq("id", postId)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) throw error;

    removeApiCacheByPrefix(`${API_CACHE_PREFIX}timeline:`);
    removeApiCache(createCacheKey("user-posts", userId));
    removeApiCacheByPrefix(`${API_CACHE_PREFIX}liked-posts:`);
    removeApiCacheByPrefix(`${API_CACHE_PREFIX}saved-posts:`);

    return data;
}

export async function createPlace({ userId, name, address, description = null, latitude = null, longitude = null, category = "その他" }) {
    // 現在のDBではスポット情報を public.spots に保存します。
    // 画面側の住所は address、エリア名は city、説明は memo に対応します。
    const { data, error } = await supabase
        .from("spots")
        .insert({
            user_id: userId,
            name,
            category,
            address: address || null,
            memo: description,
            latitude,
            longitude
        })
        .select()
        .single();

    if (error && isPendingDatabaseFeature(error)) {
        throw createPendingFeatureError("ピン追加機能");
    }
    if (error) throw error;

    removeApiCache(createCacheKey("spots"));
    removeApiCache(createCacheKey("user-spots", userId));

    return {
        ...data,
        address: data.address || data.city,
        description: data.memo
    };
}

export async function getPlaces({ force = false } = {}) {
    const key = createCacheKey("spots");

    return withRequestCache({
        key,
        ttl: LIST_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("spots")
                .select("*, profiles:user_id(username, display_name)")
                .order("created_at", { ascending: false });

            if (error && isPendingDatabaseFeature(error)) return [];
            if (error) throw error;

            return (data ?? []).map((spot) => ({
                ...spot,
                address: spot.address || spot.city,
                description: spot.memo
            }));
        }
    });
}

export async function getOtherProfiles(currentUserId, { force = false } = {}) {
    const key = createCacheKey("other-profiles", currentUserId);

    return withRequestCache({
        key,
        ttl: MESSAGE_PROFILE_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .neq("id", currentUserId)
                .order("display_name")
                .limit(50);

            if (error) throw error;

            (data ?? []).forEach(writeProfileCache);
            return data ?? [];
        }
    });
}
export async function getMessages(userId, otherUserId) {
    const { data, error } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
}
export async function sendMessage({ senderId, receiverId, content }) {
    const { data, error } = await supabase.from('messages').insert({ sender_id: senderId, receiver_id: receiverId, content }).select().single();
    if (error) throw error;
    return data;
}
export async function getUnreadMessageCount(userId) {
    const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
}
export async function markConversationRead(userId, senderId) {
    const { error } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('receiver_id', userId)
        .eq('sender_id', senderId)
        .eq('is_read', false);
    if (error) throw error;
}
export function subscribeToIncomingMessages(userId, callback) {
    const channel = supabase.channel(`incoming-messages-${userId}`)
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}`
        }, callback)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
}
export async function getCommunities() {
    const { data, error } = await supabase.from('communities').select('*, profiles:owner_id(username, display_name)').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
}
export async function createCommunity({ ownerId, name, description }) {
    const { data, error } = await supabase.from('communities').insert({ owner_id: ownerId, name, description }).select().single();
    if (error) throw error;
    await supabase.from('community_members').insert({ community_id: data.id, user_id: ownerId });
    return data;
}
export async function joinCommunity(communityId, userId) {
    const { error } = await supabase.from('community_members').upsert({ community_id: communityId, user_id: userId }, { onConflict: 'community_id,user_id' });
    if (error) throw error;

    removeApiCache(createCacheKey("community-members", communityId));
}

// ========================================
// プロフィール拡張機能（Supabase）
// ========================================

export async function getProfileByUsername(username) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();
    if (error) throw error;
    return data;
}

export async function getFollowState(currentUserId, targetUserId) {
    const [followingResult, followerResult] = await Promise.all([
        supabase.from("follows").select("*").eq("follower_id", currentUserId).eq("following_id", targetUserId).maybeSingle(),
        supabase.from("follows").select("*").eq("follower_id", targetUserId).eq("following_id", currentUserId).maybeSingle()
    ]);

    if (
        isPendingDatabaseFeature(followingResult.error) ||
        isPendingDatabaseFeature(followerResult.error)
    ) {
        return {
            isFollowing: false,
            isFollower: false,
            isMutual: false,
            databasePending: true
        };
    }

    if (followingResult.error) throw followingResult.error;
    if (followerResult.error) throw followerResult.error;

    return {
        isFollowing: Boolean(followingResult.data),
        isFollower: Boolean(followerResult.data),
        isMutual: Boolean(followingResult.data && followerResult.data),
        databasePending: false
    };
}

export async function followUser(followerId, followingId) {
    const { error } = await supabase.from("follows").upsert(
        { follower_id: followerId, following_id: followingId },
        { onConflict: "follower_id,following_id" }
    );

    if (error && isPendingDatabaseFeature(error)) {
        throw createPendingFeatureError("フォロー機能");
    }
    if (error) throw error;

    removeApiCache(createCacheKey("following", followerId));
    removeApiCache(createCacheKey("followers", followingId));
    removeApiCache(createCacheKey("following", followingId));
    removeApiCache(createCacheKey("followers", followerId));
}

export async function unfollowUser(followerId, followingId) {
    const { error } = await supabase.from("follows").delete()
        .eq("follower_id", followerId)
        .eq("following_id", followingId);

    if (error && isPendingDatabaseFeature(error)) {
        throw createPendingFeatureError("フォロー機能");
    }
    if (error) throw error;

    removeApiCache(createCacheKey("following", followerId));
    removeApiCache(createCacheKey("followers", followingId));
    removeApiCache(createCacheKey("following", followingId));
    removeApiCache(createCacheKey("followers", followerId));
}

export async function getFollowing(userId, { force = false } = {}) {
    const key = createCacheKey("following", userId);

    return withRequestCache({
        key,
        ttl: LIST_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("follows")
                .select("created_at, profile:following_id(*)")
                .eq("follower_id", userId)
                .order("created_at", { ascending: false });

            if (error && isPendingDatabaseFeature(error)) return [];
            if (error) throw error;

            const profiles =
                (data ?? [])
                    .map((row) => row.profile)
                    .filter(Boolean);

            profiles.forEach(writeProfileCache);
            return profiles;
        }
    });
}

export async function getFollowers(userId, { force = false } = {}) {
    const key = createCacheKey("followers", userId);

    return withRequestCache({
        key,
        ttl: LIST_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("follows")
                .select("created_at, profile:follower_id(*)")
                .eq("following_id", userId)
                .order("created_at", { ascending: false });

            if (error && isPendingDatabaseFeature(error)) return [];
            if (error) throw error;

            const profiles =
                (data ?? [])
                    .map((row) => row.profile)
                    .filter(Boolean);

            profiles.forEach(writeProfileCache);
            return profiles;
        }
    });
}

export async function getMutualFollows(userId) {
    const [following, followers] = await Promise.all([getFollowing(userId), getFollowers(userId)]);
    const followerIds = new Set(followers.map(profile => profile.id));
    return following.filter(profile => followerIds.has(profile.id));
}


export async function getPostEngagement(postIds, userId) {
    const ids = [...new Set((postIds || []).filter(Boolean))];
    if (!ids.length) {
        return { likedIds: new Set(), savedIds: new Set(), likeCounts: new Map() };
    }

    const [likesResult, bookmarksResult] = await Promise.all([
        supabase.from("likes").select("user_id,post_id").in("post_id", ids),
        userId
            ? supabase.from("bookmarks").select("user_id,post_id").eq("user_id", userId).in("post_id", ids)
            : Promise.resolve({ data: [], error: null })
    ]);

    if (likesResult.error) throw likesResult.error;
    if (bookmarksResult.error) throw bookmarksResult.error;

    const likedIds = new Set();
    const savedIds = new Set();
    const likeCounts = new Map(ids.map(id => [id, 0]));

    for (const row of likesResult.data || []) {
        likeCounts.set(row.post_id, (likeCounts.get(row.post_id) || 0) + 1);
        if (userId && row.user_id === userId) likedIds.add(row.post_id);
    }

    for (const row of bookmarksResult.data || []) {
        savedIds.add(row.post_id);
    }

    return { likedIds, savedIds, likeCounts };
}

export async function getPostLikeCount(postId) {
    const { count, error } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
    if (error) throw error;
    return count ?? 0;
}

export async function getLikedPosts(userId, { force = false } = {}) {
    const key = createCacheKey("liked-posts", userId);

    return withRequestCache({
        key,
        ttl: LIST_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("likes")
                .select("created_at, post:post_id(*, profiles:user_id(username,display_name,avatar_url))")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error && isPendingDatabaseFeature(error)) return [];
            if (error) throw error;

            return (data ?? []).map((row) => row.post).filter(Boolean);
        }
    });
}

export async function getSavedPosts(userId, { force = false } = {}) {
    const key = createCacheKey("saved-posts", userId);

    return withRequestCache({
        key,
        ttl: LIST_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("bookmarks")
                .select("created_at, post:post_id(*, profiles:user_id(username,display_name,avatar_url))")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error && isPendingDatabaseFeature(error)) return [];
            if (error) throw error;

            return (data ?? []).map((row) => row.post).filter(Boolean);
        }
    });
}

export async function setPostLiked(userId, postId, liked) {
    const query = liked
        ? supabase.from("likes").upsert(
            { user_id: userId, post_id: postId },
            { onConflict: "user_id,post_id" }
        )
        : supabase.from("likes").delete()
            .eq("user_id", userId)
            .eq("post_id", postId);

    const { error } = await query;
    if (error && isPendingDatabaseFeature(error)) {
        throw createPendingFeatureError("いいね機能");
    }
    if (error) throw error;

    removeApiCache(createCacheKey("liked-posts", userId));
    removeApiCacheByPrefix(`${API_CACHE_PREFIX}timeline:`);
    removeApiCacheByPrefix(`${API_CACHE_PREFIX}user-posts:`);
}

export async function setPostSaved(userId, postId, saved) {
    const query = saved
        ? supabase.from("bookmarks").upsert(
            { user_id: userId, post_id: postId },
            { onConflict: "user_id,post_id" }
        )
        : supabase.from("bookmarks").delete()
            .eq("user_id", userId)
            .eq("post_id", postId);

    const { error } = await query;
    if (error && isPendingDatabaseFeature(error)) {
        throw createPendingFeatureError("保存機能");
    }
    if (error) throw error;

    removeApiCache(createCacheKey("saved-posts", userId));
}

export async function getUserPlaces(userId) {
    const { data, error } = await supabase
        .from("spots")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((spot) => ({
        ...spot,
        address: spot.city,
        description: spot.memo
    }));
}

export async function deletePlace(placeId, userId) {
    const { error } = await supabase
        .from("spots")
        .delete()
        .eq("id", placeId)
        .eq("user_id", userId);

    if (error) throw error;

    removeApiCache(createCacheKey("spots"));
    removeApiCache(createCacheKey("user-spots", userId));
}

export async function getProfileSettings(userId, { force = false } = {}) {
    const key = createCacheKey("profile-settings", userId);

    return withRequestCache({
        key,
        ttl: LIST_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("profile_settings")
                .select("*")
                .eq("user_id", userId)
                .maybeSingle();

            if (error && isPendingDatabaseFeature(error)) {
                return {
                    user_id: userId,
                    location_sharing: false,
                    databasePending: true
                };
            }

            if (error) throw error;

            return data ?? {
                user_id: userId,
                location_sharing: false,
                databasePending: false
            };
        }
    });
}

export async function saveProfileSettings(userId, values) {
    const { data, error } = await supabase
        .from("profile_settings")
        .upsert({
            user_id: userId,
            location_sharing: Boolean(values.locationSharing),
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id" })
        .select()
        .single();

    if (error && isPendingDatabaseFeature(error)) {
        throw createPendingFeatureError("プロフィール設定");
    }
    if (error) throw error;

    removeApiCache(createCacheKey("profile-settings", userId));
    return data;
}

export async function getLocationShareTargets(ownerId, { force = false } = {}) {
    const key = createCacheKey("location-share-targets", ownerId);

    return withRequestCache({
        key,
        ttl: LIST_CACHE_TTL,
        force,
        loader: async () => {
            const { data, error } = await supabase
                .from("location_shares")
                .select("profile:shared_with_user_id(*)")
                .eq("user_id", ownerId);

            if (error && isPendingDatabaseFeature(error)) return [];
            if (error) throw error;

            const profiles =
                (data ?? [])
                    .map((row) => row.profile)
                    .filter(Boolean);

            profiles.forEach(writeProfileCache);
            return profiles;
        }
    });
}

export async function replaceLocationShareTargets(ownerId, targetIds) {
    const { error: deleteError } = await supabase
        .from("location_shares")
        .delete()
        .eq("user_id", ownerId);

    if (deleteError && isPendingDatabaseFeature(deleteError)) {
        throw createPendingFeatureError("位置情報共有");
    }
    if (deleteError) throw deleteError;

    const uniqueIds = [...new Set(targetIds)]
        .filter(id => id && id !== ownerId);

    if (!uniqueIds.length) return;

    const { error } = await supabase
        .from("location_shares")
        .insert(
            uniqueIds.map(id => ({
                user_id: ownerId,
                shared_with_user_id: id
            }))
        );

    if (error && isPendingDatabaseFeature(error)) {
        throw createPendingFeatureError("位置情報共有");
    }
    if (error) throw error;
}
