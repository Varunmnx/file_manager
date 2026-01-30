import useApiQueryData from '@/hooks/customReactQueryHooks/useApiQueryData'
import { API, Slug } from '@/services'
import { UploadedFile } from '@/types/file.types'

const queryKey = "useGetHistory"

const useGetHistory = (uploadId?: string) => {
    return useApiQueryData<UploadedFile['activities']>({
        queryFn: () => {
            return API.get({
                slug: Slug.HISTORY + `/${uploadId}/history`
            })
        },
        queryKey: [queryKey, uploadId],
        enabled: !!uploadId
    })
}

export default useGetHistory
