import { FileTypeIconMap } from "@/utils/fileTypeIcons"; 

export const checkAndRetrieveExtension = (fileName: string) => {
    const keyPairValues = Object.entries(FileTypeIconMap).find(([key, value]) => {
      const extension = fileName.split('.').pop();
      if (extension && value?.extensions?.includes(extension)) {
        return key;
      }
    });
    if(!keyPairValues) return "";
    const [key] = keyPairValues as unknown as [string, { extensions: string[] }];
    if (!key) return "";
    return key;
  }