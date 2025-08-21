import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { CompatibilityProvider } from "@/components/CompatibilityChecker";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AuthErrorBoundary } from "@/components/auth/AuthErrorBoundary";
import { Layout } from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { lazy, Suspense } from 'react';
import { ChunkLoadErrorBoundary } from '@/components/ChunkLoadErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { isFeatureEnabled } from '@/lib/features';

// Lazy load all route components for better performance
const Index = lazy(() => import('./pages/Index'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Auth = lazy(() => import('./pages/Auth'));
const Sessions = lazy(() => import('./pages/Sessions'));
const Friends = lazy(() => import('./pages/Friends'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Settings = lazy(() => import('./pages/Settings'));
const RoomJoin = lazy(() => import('./pages/RoomJoin'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 3,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Helper component to wrap lazy routes with loading
const LazyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
    <ChunkLoadErrorBoundary>
      {children}
    </ChunkLoadErrorBoundary>
  </Suspense>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <CompatibilityProvider>
          <AuthErrorBoundary>
            <AuthProvider>
              <UserProfileProvider>
                <TooltipProvider>
                <Sonner />
                <BrowserRouter
                  basename={import.meta.env.PROD ? '/dungeon-whisperer-app' : '/'}
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true
                  }}
                >
                  <Routes>
                    {/* Public auth route */}
                    <Route path="/auth" element={
                      <LazyRoute>
                        <Auth />
                      </LazyRoute>
                    } />
                    
                    {/* Room join route - Context-7 Doc Assist compliance */}
                    <Route path="/rooms/:sessionId/join" element={
                      <LazyRoute>
                        <RoomJoin />
                      </LazyRoute>
                    } />
                    
                    {/* Canonical session route */}
                    <Route path="/table/:sessionId" element={
                      <LazyRoute>
                        <AuthGuard>
                          <Layout>
                            <Index />
                          </Layout>
                        </AuthGuard>
                      </LazyRoute>
                    } />
                    
                    {/* Protected routes with AuthGuard */}
                    <Route path="/" element={
                      <LazyRoute>
                        <AuthGuard>
                          <Layout>
                            <Index />
                          </Layout>
                        </AuthGuard>
                      </LazyRoute>
                    } />
                    <Route path="/maindashboard" element={
                      <LazyRoute>
                        <AuthGuard>
                          <Layout>
                            <Dashboard />
                          </Layout>
                        </AuthGuard>
                      </LazyRoute>
                    } />
                    <Route path="/sessions" element={
                      <LazyRoute>
                        <AuthGuard>
                          <Layout>
                            <Sessions />
                          </Layout>
                        </AuthGuard>
                      </LazyRoute>
                    } />
                    {isFeatureEnabled('SOCIAL_FEATURES') && (
                      <Route path="/friends" element={
                        <LazyRoute>
                          <AuthGuard>
                            <Layout>
                              <Friends />
                            </Layout>
                          </AuthGuard>
                        </LazyRoute>
                      } />
                    )}
                     <Route path="/inbox" element={
                       <LazyRoute>
                         <AuthGuard>
                           <Layout>
                             <Inbox />
                           </Layout>
                         </AuthGuard>
                       </LazyRoute>
                     } />
                     <Route path="/dm/:roomId" element={
                       <LazyRoute>
                         <AuthGuard>
                           <Layout>
                             <Inbox />
                           </Layout>
                         </AuthGuard>
                       </LazyRoute>
                     } />
                    <Route path="/settings" element={
                      <LazyRoute>
                        <AuthGuard>
                          <Layout>
                            <Settings />
                          </Layout>
                        </AuthGuard>
                      </LazyRoute>
                    } />
                    <Route path="*" element={
                      <LazyRoute>
                        <AuthGuard>
                          <Layout>
                            <NotFound />
                          </Layout>
                        </AuthGuard>
                      </LazyRoute>
                    } />
                  </Routes>
                  <ConnectionStatus />
                </BrowserRouter>
                </TooltipProvider>
              </UserProfileProvider>
            </AuthProvider>
          </AuthErrorBoundary>
        </CompatibilityProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;