import GlobalErrorHandlerContextProvider from "@/context/globalErrorHandlerContext/globalErrorHandlerContextProvider";
import RootLayout from "@/Layout/ExampleLayout";
import ErrorPage from "@/pages/Error";
import FileUploadV4 from "@/pages/FileUploadV4";
import { ChunkedUploadProvider } from "@/pages/FileUploadV4/context/chunked-upload.context";
import { RouteObject, useRoutes } from "react-router-dom"; 

const protectedRouteElements: RouteObject = {
  path: "/", 
  errorElement: <ErrorPage />, 
  element: (
    <GlobalErrorHandlerContextProvider>
      <RootLayout />
    </GlobalErrorHandlerContextProvider>
  ),
  children: [
      {
        index: true, 
        loader: () => {
         console.log("index")
         return true 
        },
        element: <ChunkedUploadProvider><FileUploadV4 /></ChunkedUploadProvider>,
      },
      {
        path: ':folderId', 
        loader: () => {
         console.log("index")
         return true
        },
        element: <ChunkedUploadProvider><FileUploadV4 /></ChunkedUploadProvider>
      },
  ],
};

const ProtectedRoutes = () => {
  const routes = useRoutes([protectedRouteElements]);
  return routes;
};

export default ProtectedRoutes;
