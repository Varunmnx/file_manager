import useApiMutateData from '@/hooks/customReactQueryHooks/useApiMutateData'
import { API, Slug } from '@/services' 

const useDeleteAll = () => {
  return  useApiMutateData({
    mutationFn: (body:{uploadIds:string[]}) => {
      return API.delete({
        slug: Slug.GET_ALL_FILES,
        axiosConfig: {
          data: body
        }
      })
    },
    mutationKey: ["useDeleteAll"]
  })
}

export default useDeleteAll