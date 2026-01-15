import { Suspense, useLayoutEffect } from "react";
import { Outlet } from "react-router-dom";
import { useGetProfileDetails } from "./hooks/useGetProfile";
import { setProfile } from "@/store/features/profileStore/profileSlice";
import { useAppDispatch } from "@/store";

const ExampleLayout = () => {
  const {data} = useGetProfileDetails()
  const dispatch = useAppDispatch()
  useLayoutEffect(() => {
    dispatch(setProfile(data))
  },[data, dispatch])
  return (
    <Suspense>
      <Outlet />
    </Suspense>
  );
};

export default ExampleLayout;
