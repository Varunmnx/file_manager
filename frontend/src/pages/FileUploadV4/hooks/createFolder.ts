import useApiMutateData from "@/hooks/customReactQueryHooks/useApiMutateData";
import { API, Slug } from "@/services";

const mutationKey = "useInitiateFileUpload";

interface Body {
  folderName: string;
  folderSize: number; 
  parent?: string
}

export interface InitiateFileUploadResponse {
  uploadId: string;
  totalChunks: number;
}

const useCreateFolder = () => {
  return useApiMutateData({
    mutationFn: (body: Body) => {
      return API.post<InitiateFileUploadResponse>({
        slug: Slug.CREATE_FOLDER,
        body,
      });
    },
    mutationKey: [mutationKey],
  });
};

export default useCreateFolder;
