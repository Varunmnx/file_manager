// src/router/public-routes.tsx

import GlobalErrorHandlerContextProvider from "@/context/globalErrorHandlerContext/globalErrorHandlerContextProvider";
import RootLayout from "@/Layout/ExampleLayout"; 
import ErrorPage from "@/pages/Error"; 
import FileUploadV4 from "@/pages/FileUploadV4";
import { ChunkedUploadProvider } from "@/pages/FileUploadV4/context/chunked-upload.context";
// import LandingPage from "@/pages/Landing";
import { RouteObject, useRoutes } from "react-router-dom";

enum Path {
  ROOT = "/",
  ContextProvider = "/ContextProvider",
  LOGIN = "/auth/login",
  PRODUCTS = "/products",
  CHUNKED = "/file-upload/chunked",
  MIXED_UPLOAD = "/mixed-upload",
  ChunkedV2 = "/file-upload/chunked-v2",
}

export const publicRoutes: RouteObject[] = [
  {
    element: (
      <GlobalErrorHandlerContextProvider>
        <RootLayout />
      </GlobalErrorHandlerContextProvider>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        path: Path.ROOT,
        element: <ChunkedUploadProvider><FileUploadV4 /></ChunkedUploadProvider>,
      },
      {
        path: Path.ROOT + '/:folderId',
        element: <ChunkedUploadProvider><FileUploadV4 /></ChunkedUploadProvider>,

      }
    ],
  },
];


export const PublicRoutes = () => {
  const routes = useRoutes(publicRoutes);
  return routes;
};


export default PublicRoutes;