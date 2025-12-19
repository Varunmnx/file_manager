import useApiMutateData from '@/hooks/customReactQueryHooks/useApiMutateData'
import { API, Slug } from '@/services'
import { UploadedFile } from '@/types/file.types'

const mutationKey = "useFileGetStatus"


const useFileGetStatus = () => {
  return useApiMutateData({
    mutationFn: (uploadId:string) => {
        return API.get<UploadedFile>({
            slug: Slug.FILE_STATUS  + `/${uploadId}` 
        })
    },
    mutationKey: [mutationKey]
  })
}

export default useFileGetStatus