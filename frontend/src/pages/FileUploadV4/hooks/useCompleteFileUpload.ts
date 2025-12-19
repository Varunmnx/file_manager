import useApiMutateData from "@/hooks/customReactQueryHooks/useApiMutateData";
import { API, Slug } from "@/services";

export function useCompleteFileUpload(){
    return useApiMutateData({
        mutationFn: (uploadId:string) => {
            return API.post({
                slug: Slug.COMPLETE_UPLOAD,
                body: {uploadId} 
            })
        },
        mutationKey: ["useCompleteFileUpload"]
    })
}