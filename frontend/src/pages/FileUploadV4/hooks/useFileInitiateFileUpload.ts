import useApiMutateData from '@/hooks/customReactQueryHooks/useApiMutateData'
import { API, Slug } from '@/services'

const mutationKey = "useInitiateFileUpload"

interface Body {
    fileName: string;
    fileSize: number;
    parent?: string[];
    children?: string[];
}

export interface InitiateFileUploadResponse {
  uploadId:string;
  totalChunks: number
}

const useInitiateFileUpload = () => {
  return useApiMutateData({
    mutationFn: (body:Body) => {
        return API.post<InitiateFileUploadResponse>({
            slug: Slug.INITIATE_FILE_UPLOAD,
            body 
        })
    },
    mutationKey: [mutationKey]
  })
}

export default useInitiateFileUpload