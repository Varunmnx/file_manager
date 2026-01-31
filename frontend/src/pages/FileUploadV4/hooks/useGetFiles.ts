import useApiQueryData from "@/hooks/customReactQueryHooks/useApiQueryData"
import { API, Slug } from "@/services"
import { UploadedFile } from "@/types/file.types"

const useGetFiles = (folderId?: string) => {
  return useApiQueryData({
    queryFn: () => {
      return API.get<UploadedFile[]>({
        slug: Slug.GET_ALL_FILES,
        queryParameters: {
          folderId
        }
      })
    },
    queryKey: [Slug.GET_ALL_FILES, folderId]
  })
}

export default useGetFiles