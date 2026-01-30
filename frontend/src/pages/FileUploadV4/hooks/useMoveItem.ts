import { Slug } from "@/services/Api-Endpoints";
import { API } from "@/services/Api";
import useApiMutateData from "@/hooks/customReactQueryHooks/useApiMutateData";

interface MoveItemPayload {
    uploadId: string;
    newParentId: string | null;
}

const useMoveItem = () => {
    return useApiMutateData({
        mutationFn: ({ uploadId, newParentId }: MoveItemPayload) => {
            return API.put({
                slug: `${Slug.MOVE_ITEM}/${uploadId}`,
                body: { newParentId }
            });
        },
        mutationKey: ["moveItem"]
    });
};

export default useMoveItem;
