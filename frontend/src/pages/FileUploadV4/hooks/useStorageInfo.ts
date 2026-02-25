import { useQuery } from "@tanstack/react-query";
import { API, Slug } from "@/services";

export interface StorageInfo {
    storageUsed: number;
    storageLimit: number;
}

export function useStorageInfo() {
    return useQuery<StorageInfo>({
        queryKey: ["storage-info"],
        queryFn: async () => {
            const res = await API.get<StorageInfo>({
                slug: Slug.STORAGE_INFO,
            });
            return res!;
        },
        staleTime: 30_000,
    });
}
