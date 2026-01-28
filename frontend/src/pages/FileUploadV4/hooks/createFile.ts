import useApiMutateData from "@/hooks/customReactQueryHooks/useApiMutateData";
import { API, Slug } from "@/services";

const mutationKey = "useCreateFile";

interface Body {
  fileName: string;
  parent?: string
}

export interface CreateFileResponse {
  uploadId: string;
}

const useCreateFile = () => {
  return useApiMutateData({
    mutationFn: (body: Body) => {
      return API.post<CreateFileResponse>({
        slug: Slug.CREATE_FILE,
        body,
      });
    },
    mutationKey: [mutationKey],
  });
};

export default useCreateFile;
