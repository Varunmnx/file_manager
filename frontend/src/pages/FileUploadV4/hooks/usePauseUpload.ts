import useApiMutateData from '@/hooks/customReactQueryHooks/useApiMutateData'
import { API, Slug } from '@/services' 

const usePauseUpload = () => {
   return  useApiMutateData({
      mutationFn: (body:{uploadId:string,chunkIndex:number}) => {
        return API.put({
          slug: Slug.PAUSE_UPLOAD + `/${body.uploadId}`,
          queryParameters: {
            chunkIndex: body.chunkIndex
          }
        })
      },
      mutationKey: ["useDeleteAll"]
    })
}

export default usePauseUpload