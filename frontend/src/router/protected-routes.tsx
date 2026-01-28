import GlobalErrorHandlerContextProvider from "@/context/globalErrorHandlerContext/globalErrorHandlerContextProvider";
import RootLayout from "@/Layout/ExampleLayout";
import ErrorPage from "@/pages/Error";
import FileUploadV4 from "@/pages/FileUploadV4";
import DocumentEditor from "@/pages/DocumentEditor";
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
        path: 'folder/:folderId', 
        loader: () => {
         console.log("index")
         return true
        },
        element: <ChunkedUploadProvider><FileUploadV4 /></ChunkedUploadProvider>
      },
      {
        path: 'document/:fileId',
        element: <DocumentEditor />
      },
      {
        path: 'document/:fileId/revision/:version',
        element: <DocumentEditor />
      },
  ],
};

const ProtectedRoutes = () => {
  const routes = useRoutes([protectedRouteElements]);
  return routes;
};

export default ProtectedRoutes;
