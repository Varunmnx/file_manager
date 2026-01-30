import { lazy, Suspense } from "react";
import { RouteObject, useRoutes } from "react-router-dom";
import GlobalErrorHandlerContextProvider from "@/context/globalErrorHandlerContext/globalErrorHandlerContextProvider";
import RootLayout from "@/Layout/ExampleLayout";
import ErrorPage from "@/pages/Error";
import { ChunkedUploadProvider } from "@/pages/FileUploadV4/context/chunked-upload.context";
 
const FileUploadV4 = lazy(() => import("@/pages/FileUploadV4"));
const DocumentEditor = lazy(() => import("@/pages/DocumentEditor"));
 
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-lg">Loading...</div>
  </div>
);
 
const LazyRouteWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingFallback />}>
    {children}
  </Suspense>
);
 
const protectedRouteElements: RouteObject = {
  path: "/",
  errorElement: <ErrorPage />,
  element: (
    <GlobalErrorHandlerContextProvider>
      <ChunkedUploadProvider>
        <RootLayout />
      </ChunkedUploadProvider>
    </GlobalErrorHandlerContextProvider>
  ),
  children: [
    {
      index: true, 
      element: (
        <LazyRouteWrapper>
          <FileUploadV4 />
        </LazyRouteWrapper>
      ),
    },
    {
      path: "folder/:folderId", 
      element: (
        <LazyRouteWrapper>
          <FileUploadV4 />
        </LazyRouteWrapper>
      ),
    },
    {
      path: "document/:fileId",
      element: (
        <LazyRouteWrapper>
          <DocumentEditor />
        </LazyRouteWrapper>
      ),
    },
    {
      path: "document/:fileId/revision/:version",
      element: (
        <LazyRouteWrapper>
          <DocumentEditor />
        </LazyRouteWrapper>
      ),
    },
  ],
};

const ProtectedRoutes = () => {
  const routes = useRoutes([protectedRouteElements]);
  return routes;
};

export default ProtectedRoutes;