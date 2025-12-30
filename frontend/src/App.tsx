import "./index.css";
import { BrowserRouter } from "react-router-dom";
import PublicRoutes from "./router/public-routes";
import AuthRoutes from "./router/auth-routes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { store } from "./store";
import { Toaster } from "sonner";

function App() {
  const authenticated = false
  const client = new QueryClient()
  return (
    <BrowserRouter>
<Toaster position="top-right" />
    <Provider store={store}>
      <QueryClientProvider client={client}>
          { authenticated ? <AuthRoutes/> :<PublicRoutes />}
      </QueryClientProvider>
    </Provider>
    </BrowserRouter>
  )
}

export default App;
