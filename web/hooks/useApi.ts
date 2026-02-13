"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Dare, type DareFilters, type User, type Notification, type PaginatedDares } from "../lib/api";

// ── useUser ───────────────────────────────────────────────────────────────
export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUser = useCallback(async () => {
        try {
            setLoading(true);
            const { user } = await api.getMe();
            setUser(user);
            setError(null);
        } catch (err: any) {
            setError(err.message);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    return { user, loading, error, refetch: fetchUser };
}

// ── useDareFeed ───────────────────────────────────────────────────────────
export function useDareFeed(filters: DareFilters = {}) {
    const [data, setData] = useState<PaginatedDares | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDares = useCallback(async () => {
        try {
            setLoading(true);
            const result = await api.getDares(filters);
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [JSON.stringify(filters)]);

    useEffect(() => {
        fetchDares();
    }, [fetchDares]);

    return { data, loading, error, refetch: fetchDares };
}

// ── useDare ───────────────────────────────────────────────────────────────
export function useDare(id: string | null) {
    const [dare, setDare] = useState<Dare | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDare = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const { dare } = await api.getDare(id);
            setDare(dare);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDare();
    }, [fetchDare]);

    return { dare, loading, error, refetch: fetchDare };
}

// ── useNotifications ──────────────────────────────────────────────────────
export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const [list, count] = await Promise.all([
                api.getNotifications(),
                api.getUnreadCount(),
            ]);
            setNotifications(list.notifications);
            setUnreadCount(count.count);
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markRead = async (id: string) => {
        await api.markAsRead(id);
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
    };

    const markAllRead = async () => {
        await api.markAllAsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    return { notifications, unreadCount, loading, refetch: fetchNotifications, markRead, markAllRead };
}

// ── useTrending ───────────────────────────────────────────────────────────
export function useTrending() {
    const [dares, setDares] = useState<Dare[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getTrending()
            .then(({ dares }) => setDares(dares))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return { dares, loading };
}
