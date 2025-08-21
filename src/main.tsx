import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DemoBanner } from "@/components/DemoBanner";
import { env } from "@/lib/env";
import { ResourcePrioritizer } from "@/lib/performance-optimizations";

const queryClient = new QueryClient();

// Initialize performance optimizations
ResourcePrioritizer.initializeOptimizations();

// Environment validated successfully
console.debug('Environment configuration loaded:', !!env);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={true}
        >
          <TooltipProvider>
            <DemoBanner variant="compact" />
            <App />
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);