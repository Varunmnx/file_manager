import useApiMutateData from '@/hooks/customReactQueryHooks/useApiMutateData'
import { API, Slug } from '@/services'

const mutationKey = "useUpdateActivity"

interface UpdateActivityPayload {
    uploadId: string;
}

const useUpdateActivity = () => {
    return useApiMutateData({
        mutationFn: ({ uploadId }: UpdateActivityPayload) => {
            return API.post({
                slug: `${Slug.UPDATE_ACTIVITY}/${uploadId}/activity`,
                body: {}
            })
        },
        mutationKey: [mutationKey]
    })
}

export default useUpdateActivity;
