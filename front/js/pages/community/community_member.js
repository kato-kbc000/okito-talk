import { supabase } from "../../supabase.js";
import { getCurrentUser } from "../../api.js";

const $ = (id) => document.getElementById(id);
const communityId = new URLSearchParams(location.search).get("communityId") || new URLSearchParams(location.search).get("id");

let currentUser = null;
let community = null;
let members = [];
let followingIds = new Set();
let locationRows = new Map();

function setMessage(text, type = "") {
    const element = $("locationMessage");
    if (!element) {
        if (text && type === "error") console.warn(text);
        return;
    }
    element.textContent = text;
    element.className = `form-message ${type}`.trim();
}

function avatarInitial(profile) {
    return (profile?.display_name || profile?.username || "沖").trim().charAt(0).toUpperCase();
}

async function loadCommunity() {
    if (!communityId) throw new Error("コミュニティIDが指定されていません。");

    const { data, error } = await supabase
        .from("communities")
        .select("id, name, description, icon_url, owner_id")
        .eq("id", communityId)
        .single();

    if (error) throw error;
    community = data;

    $("communityName").textContent = data.name;
    const back = document.querySelector(".back-link");
    if (back) back.href = `community_home.html?id=${encodeURIComponent(communityId)}`;
    $("communityDescription").textContent = data.description || "説明はまだありません。";

    if (data.icon_url) {
        $("communityIcon").innerHTML = `<img src="${data.icon_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
    }
}

async function loadMembers() {
    const { data, error } = await supabase
        .from("community_members")
        .select(`
            community_id,
            user_id,
            role,
            joined_at,
            profiles:user_id (
                id,
                username,
                display_name,
                bio,
                avatar_url,
                city
            )
        `)
        .eq("community_id", communityId)
        .eq("status", "approved")
        .order("joined_at", { ascending: true });

    if (error) throw error;
    members = data || [];
    $("memberCount").textContent = `${members.length}人のメンバー`;
}

async function loadFollows() {
    const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUser.id);

    if (error) {
        if (["42P01", "PGRST205"].includes(error.code)) return;
        throw error;
    }

    followingIds = new Set((data || []).map((row) => row.following_id));
}

async function loadLocations() {
    const { data, error } = await supabase
        .from("community_location_shares")
        .select("user_id, label, latitude, longitude, expires_at")
        .eq("community_id", communityId)
        .gt("expires_at", new Date().toISOString());

    if (error) {
        if (["42P01", "PGRST205"].includes(error.code)) return;
        throw error;
    }

    locationRows = new Map((data || []).map((row) => [row.user_id, row]));
    $("onlineCount").textContent = `位置共有 ${locationRows.size}人`;

}

function matchesFilter(member, keyword, filter) {
    const profile = member.profiles || {};
    const searchText = `${profile.display_name || ""} ${profile.username || ""} ${profile.bio || ""}`.toLowerCase();
    if (keyword && !searchText.includes(keyword)) return false;
    if (filter === "sharing" && !locationRows.has(member.user_id)) return false;
    if (filter === "following" && !followingIds.has(member.user_id)) return false;
    if (filter === "owner" && member.user_id !== community.owner_id && member.role !== "owner") return false;
    return true;
}

function renderMembers() {
    const keyword = $("memberSearch").value.trim().toLowerCase();
    const filter = $("memberFilter").value;
    const visibleMembers = members.filter((member) => matchesFilter(member, keyword, filter));
    const list = $("memberList");
    list.innerHTML = "";

    $("loadingState").hidden = true;
    $("emptyState").hidden = visibleMembers.length > 0;

    visibleMembers.forEach((member) => {
        const profile = member.profiles || {};
        const fragment = $("memberCardTemplate").content.cloneNode(true);
        const card = fragment.querySelector(".member-card");
        const avatar = fragment.querySelector(".member-avatar");
        const roleBadge = fragment.querySelector(".role-badge");
        const followButton = fragment.querySelector(".follow-button");
        const profileButton = fragment.querySelector(".profile-button");
        const messageButton = fragment.querySelector(".message-button");
        const locationArea = fragment.querySelector(".member-location");
        const locationLink = fragment.querySelector(".location-link");

        card.dataset.userId = member.user_id;
        fragment.querySelector(".member-name").textContent = profile.display_name || profile.username || "ユーザー";
        fragment.querySelector(".member-username").textContent = profile.username ? `@${profile.username}` : "";
        fragment.querySelector(".member-bio").textContent = profile.bio || profile.city || "プロフィールはまだありません。";

        if (profile.avatar_url) {
            const img = document.createElement("img");
            img.src = profile.avatar_url;
            img.alt = `${profile.display_name || "メンバー"}のアイコン`;
            avatar.appendChild(img);
        } else {
            avatar.textContent = avatarInitial(profile);
        }

        const isOwner = member.user_id === community.owner_id || member.role === "owner";
        if (isOwner || member.role === "admin") {
            roleBadge.textContent = isOwner ? "オーナー" : "管理者";
            roleBadge.classList.add("visible");
        }

        const locationData = locationRows.get(member.user_id);
        if (locationData) {
            locationArea.hidden = false;
            locationLink.textContent = locationData.label || "位置情報を表示";
            locationLink.href = `community_home.html?id=${encodeURIComponent(communityId)}#communityMapSection`;
            locationLink.removeAttribute("target");
        }

        profileButton.href = `../profile.html?userId=${encodeURIComponent(member.user_id)}`;
        messageButton.href = `../messages.html?userId=${encodeURIComponent(member.user_id)}`;

        if (member.user_id === currentUser.id) {
            followButton.hidden = true;
            messageButton.hidden = true;
        } else {
            updateFollowButton(followButton, followingIds.has(member.user_id));
            followButton.addEventListener("click", () => toggleFollow(member.user_id, followButton));
        }

        list.appendChild(fragment);
    });
}

function updateFollowButton(button, isFollowing) {
    button.textContent = isFollowing ? "フォロー中" : "フォロー";
    button.classList.toggle("following", isFollowing);
}

async function toggleFollow(targetUserId, button) {
    button.disabled = true;
    const isFollowing = followingIds.has(targetUserId);

    try {
        if (isFollowing) {
            const { error } = await supabase
                .from("follows")
                .delete()
                .eq("follower_id", currentUser.id)
                .eq("following_id", targetUserId);
            if (error) throw error;
            followingIds.delete(targetUserId);
        } else {
            const { error } = await supabase
                .from("follows")
                .insert({ follower_id: currentUser.id, following_id: targetUserId });
            if (error) throw error;
            followingIds.add(targetUserId);
        }
        updateFollowButton(button, !isFollowing);
    } catch (error) {
        alert(`フォロー操作に失敗しました：${error.message}`);
    } finally {
        button.disabled = false;
    }
}

async function initialize() {
    try {
        currentUser = await getCurrentUser();
        if (!currentUser) {
            location.replace("../../login.html");
            return;
        }

        await loadCommunity();
        await Promise.all([loadMembers(), loadFollows(), loadLocations()]);
        renderMembers();
    } catch (error) {
        console.error(error);
        $("loadingState").textContent = `読み込みに失敗しました：${error.message}`;
    }
}

$("memberSearch").addEventListener("input", renderMembers);
$("memberFilter").addEventListener("change", renderMembers);
document.addEventListener("DOMContentLoaded", initialize);
