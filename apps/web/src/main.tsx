import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { registerCrestlySW } from "@/lib/pwa-register";
import { installFriendlyZod } from "@/lib/zod-friendly";

// Swap Zod's developer-y default messages ("Expected number, received nan")
// for plain-English copy ("Must be a number") before any form schema fires.
installFriendlyZod();

// Crestly Design System — must load BEFORE the app so components
// can rely on the CSS variables and class names being available.
import "../../../packages/design/src/styles/tokens.css";
import "../../../packages/design/src/styles/components.css";
import "./index.css";

registerCrestlySW();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
