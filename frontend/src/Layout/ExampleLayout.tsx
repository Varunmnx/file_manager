import { Suspense, useLayoutEffect } from "react";
import { Outlet } from "react-router-dom";
import { useGetProfileDetails } from "./hooks/useGetProfile";
import { setProfile } from "@/store/features/profileStore/profileSlice";
import { useAppDispatch } from "@/store";
import FileDetailsCard from "@/pages/FileUploadV4/components/FileDetailsCard";
import { useChunkedUpload } from "@/pages/FileUploadV4/context/chunked-upload.context";

const ExampleLayout = () => {
  const {data} = useGetProfileDetails()
  const { fileDetails } = useChunkedUpload();
  const dispatch = useAppDispatch()
  useLayoutEffect(() => {
    dispatch(setProfile(data))
  },[data, dispatch])
  return (
    <Suspense>
            {fileDetails && <FileDetailsCard />}
      <Outlet />
    </Suspense>
  );
};

export default ExampleLayout;
