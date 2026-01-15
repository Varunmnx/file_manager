// src/router/public-routes.tsx

import GlobalErrorHandlerContextProvider from "@/context/globalErrorHandlerContext/globalErrorHandlerContextProvider";
import RootLayout from "@/Layout/ExampleLayout"; 
import GoogleLogin from "@/pages/Auth/GoogleLogin";
import ErrorPage from "@/pages/Error"; 
import GoogleRedirector from "@/pages/google";
// import LandingPage from "@/pages/Landing";
import { RouteObject, useRoutes } from "react-router-dom";

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
        path: "/signin",
        element: <GoogleLogin/>
      },
      {
        path:  "/auth/google/callback",
        element: <GoogleRedirector/>,
      }
    ],
  },
];


export const PublicRoutes = () => {
  const routes = useRoutes(publicRoutes);
  return routes;
};


export default PublicRoutes;