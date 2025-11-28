import useApiQueryData from "@/hooks/customReactQueryHooks/useApiQueryData"
import { API, Slug } from "@/services"
import { UploadedFile } from "@/types/file.types"

const useGetFiles = () => {
  return useApiQueryData({
    queryFn: () => {
      return API.get<UploadedFile[]>({
         slug: Slug.GET_ALL_FILES
      })
    },
    queryKey: [Slug.GET_ALL_FILES]
  })
}

export default useGetFiles