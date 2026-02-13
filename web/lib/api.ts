const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Typed API client for the DareMe backend.
 * Handles auth token injection and error formatting.
 */
class ApiClient {
    private getToken: (() => Promise<string | null>) | null = null;

    /** Set the auth token getter (call this from Providers) */
    setTokenGetter(getter: () => Promise<string | null>) {
        this.getToken = getter;
    }

    private async request<T>(
        method: string,
        path: string,
        options?: { body?: any; query?: Record<string, string> }
    ): Promise<T> {
        const url = new URL(`${API_BASE}${path}`);
        if (options?.query) {
            Object.entries(options.query).forEach(([k, v]) => {
                if (v !== undefined && v !== "") url.searchParams.set(k, v);
            });
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.getToken) {
            const token = await this.getToken();
            if (token) headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(url.toString(), {
            method,
            headers,
            body: options?.body ? JSON.stringify(options.body) : undefined,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new ApiError(res.status, error.error || "Request failed", error.details);
        }

        return res.json();
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    login() {
        return this.request<{ user: User }>("POST", "/api/auth/login");
    }

    // ── Users ─────────────────────────────────────────────────────────────
    getMe() {
        return this.request<{ user: User }>("GET", "/api/users/me");
    }

    updateProfile(data: { displayName?: string; bio?: string; avatarUrl?: string }) {
        return this.request<{ user: User }>("PATCH", "/api/users/me", { body: data });
    }

    getUser(id: string) {
        return this.request<{ user: User }>("GET", `/api/users/${id}`);
    }

    getUserByHandle(handle: string) {
        return this.request<{ user: User }>("GET", `/api/users/handle/${handle.replace('@', '')}`);
    }

    getUserByWallet(address: string) {
        return this.request<{ user: User }>("GET", `/api/users/wallet/${address}`);
    }

    getUserDares(id: string, role: "created" | "accepted" = "created", page = 1) {
        return this.request<PaginatedDares>("GET", `/api/users/${id}/dares`, {
            query: { role, page: String(page) },
        });
    }

    // ── Dares ─────────────────────────────────────────────────────────────
    createDare(data: CreateDareInput) {
        return this.request<{ dare: Dare }>("POST", "/api/dares", { body: data });
    }

    getDares(filters?: DareFilters) {
        const query: Record<string, string> = {};
        if (filters?.status) query.status = filters.status;
        if (filters?.dareType) query.dareType = filters.dareType;
        if (filters?.category) query.category = filters.category;
        if (filters?.search) query.search = filters.search;
        if (filters?.sort) query.sort = filters.sort;
        if (filters?.page) query.page = String(filters.page);
        if (filters?.limit) query.limit = String(filters.limit);
        return this.request<PaginatedDares>("GET", "/api/dares", { query });
    }

    getTrending() {
        return this.request<{ dares: Dare[] }>("GET", "/api/dares/trending");
    }

    getDare(id: string) {
        return this.request<{ dare: Dare }>("GET", `/api/dares/${id}`);
    }

    // ── Proofs ────────────────────────────────────────────────────────────
    submitProof(dareId: string, data: { mediaUrl: string; mediaType: "VIDEO" | "IMAGE"; proofHash: string; caption?: string }) {
        return this.request<{ proof: Proof }>("POST", `/api/dares/${dareId}/proof`, { body: data });
    }

    getProofs(dareId: string) {
        return this.request<{ proofs: Proof[] }>("GET", `/api/dares/${dareId}/proofs`);
    }

    // ── Upload ────────────────────────────────────────────────────────────
    getPresignedUrl(contentType: string, fileSize: number) {
        return this.request<{ uploadUrl: string; fileKey: string; publicUrl: string }>(
            "GET",
            "/api/upload/presigned-url",
            { query: { contentType, fileSize: String(fileSize) } }
        );
    }

    // ── Notifications ─────────────────────────────────────────────────────
    getNotifications(page = 1) {
        return this.request<PaginatedNotifications>("GET", "/api/notifications", {
            query: { page: String(page) },
        });
    }

    getUnreadCount() {
        return this.request<{ count: number }>("GET", "/api/notifications/unread-count");
    }

    markAsRead(id: string) {
        return this.request<{ success: boolean }>("PATCH", `/api/notifications/${id}/read`);
    }

    markAllAsRead() {
        return this.request<{ success: boolean }>("PATCH", "/api/notifications/read-all");
    }
}

export const api = new ApiClient();

// ── Error Class ───────────────────────────────────────────────────────────
export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public details?: any
    ) {
        super(message);
    }
}

// ── Types ─────────────────────────────────────────────────────────────────
export interface User {
    id: string;
    privyId: string;
    walletAddress: string | null;
    xHandle: string | null;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    createdAt: string;
}

export interface Dare {
    id: string;
    onChainId: string;
    darePDA: string;
    vaultPDA?: string;
    title: string;
    description: string;
    descriptionHash?: string;
    status: DareStatus;
    dareType: DareType;
    winnerSelection?: string;
    amount: string; // lamports as string (BigInt serialized)
    deadline: string;
    category: string | null;
    tags: string[];
    targetXHandle: string | null;
    createdAt: string;
    acceptedAt: string | null;
    completedAt: string | null;
    refusedAt: string | null;
    challenger: DareUser;
    daree: DareUser | null;
    proofs?: Proof[];
    _count?: { proofs: number };
}

export interface DareUser {
    id: string;
    displayName: string | null;
    xHandle: string | null;
    avatarUrl: string | null;
    walletAddress?: string | null;
}

export interface Proof {
    id: string;
    mediaUrl: string;
    mediaType: "VIDEO" | "IMAGE";
    proofHash: string;
    caption: string | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    submitter: DareUser;
}

export interface Notification {
    id: string;
    type: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
    dare: { id: string; title: string; onChainId: string; darePDA: string } | null;
}

export type DareStatus =
    | "CREATED"
    | "ACTIVE"
    | "PROOF_SUBMITTED"
    | "COMPLETED"
    | "EXPIRED"
    | "CANCELLED"
    | "REJECTED"
    | "REFUSED";

export type DareType = "DIRECT_DARE" | "PUBLIC_BOUNTY";

export interface DareFilters {
    status?: DareStatus;
    dareType?: DareType;
    category?: string;
    search?: string;
    sort?: "newest" | "amount" | "deadline";
    page?: number;
    limit?: number;
}

export interface CreateDareInput {
    onChainId: number;
    darePDA: string;
    vaultPDA: string;
    title: string;
    description: string;
    amount: number;
    dareType: DareType;
    winnerSelection: "CHALLENGER_SELECT" | "COMMUNITY_VOTE";
    deadline: string;
    category?: string;
    tags?: string[];
    targetXHandle?: string;
}

export interface PaginatedDares {
    dares: Dare[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PaginatedNotifications {
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
