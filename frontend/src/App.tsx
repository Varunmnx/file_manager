import "./index.css";
import { BrowserRouter } from "react-router-dom";
import PublicRoutes from "./router/public-routes";
import ProtectedRoutes from "./router/protected-routes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { store } from "./store";
import { Toaster } from "sonner";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { isValidToken } from "./utils/jwt";
import { StorageKeys } from "./utils";

function App() {
  const [authenticated, setAuthenticated] = useState<
    "idle" | "failed" | "success"
  >("idle");
  const client = new QueryClient();

  const checkAuth = useCallback(() => {
    const tkn = localStorage.getItem(StorageKeys.TOKEN);
    const isTknValid = isValidToken(tkn as string);
    const skipFor = ["/signin", "/signup", "/auth/google/callback"];
    setAuthenticated(isTknValid ? "success" : "failed");
    if (skipFor.includes(window.location.pathname)) return;
    if (!tkn) {
      window.location.href = "/signin";
    }
    if (!isTknValid) {
      window.location.href = "/signin";
    }
  }, []);

  useLayoutEffect(() => {
    const REVALIDATE_DURATION = 5 * 60 * 1000; // 5 minutes
    const interval = setInterval(checkAuth, REVALIDATE_DURATION);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Provider store={store}>
        <QueryClientProvider client={client}>
          {authenticated == "success" ? (
            <ProtectedRoutes />
          ) : authenticated == "failed" ? (
            <PublicRoutes />
          ) : (
            "Loading..."
          )}
        </QueryClientProvider>
      </Provider>
    </BrowserRouter>
  );
}

export default App;
