import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API, Slug } from "@/services";

export type SharePermission = "view" | "edit" | "update" | "download";

export interface ShareItem {
    _id: string;
    itemId: any;
    ownerId: any;
    sharedWithId: any;
    permissions: SharePermission[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateSharePayload {
    itemId: string;
    sharedWithEmail: string;
    permissions: SharePermission[];
}

export interface UpdateSharePayload {
    shareId: string;
    permissions: SharePermission[];
}

// Get shares for a specific item (I am the owner)
export function useSharesForItem(itemId: string | null) {
    return useQuery<ShareItem[]>({
        queryKey: ["shares-for-item", itemId],
        queryFn: async () => {
            const res = await API.get<ShareItem[]>({
                slug: `${Slug.SHARE_ITEM}/item/${itemId}`,
            });
            return res || [];
        },
        enabled: !!itemId,
    });
}

// Get items shared with me
export function useSharedWithMe() {
    return useQuery<ShareItem[]>({
        queryKey: ["shared-with-me"],
        queryFn: async () => {
            const res = await API.get<ShareItem[]>({
                slug: Slug.SHARED_WITH_ME,
            });
            return res || [];
        },
    });
}

// Share an item  
export function useShareItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateSharePayload) => {
            return API.post({
                slug: Slug.SHARE_ITEM,
                body: payload,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shares-for-item"] });
            queryClient.invalidateQueries({ queryKey: ["shared-with-me"] });
        },
    });
}

// Update share permissions
export function useUpdateSharePermissions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: UpdateSharePayload) => {
            return API.put({
                slug: `${Slug.SHARE_ITEM}/${payload.shareId}`,
                body: { permissions: payload.permissions },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shares-for-item"] });
        },
    });
}

// Revoke a share
export function useRevokeShare() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (shareId: string) => {
            return API.delete({
                slug: `${Slug.SHARE_ITEM}/${shareId}`,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shares-for-item"] });
            queryClient.invalidateQueries({ queryKey: ["shared-with-me"] });
        },
    });
}
