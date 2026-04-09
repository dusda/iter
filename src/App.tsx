import React, { type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import NavigationTracker from "@/lib/NavigationTracker";
import { pagesConfig } from "./pages.config";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import Login from "./pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AcceptInvite from "@/pages/AcceptInvite";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import { isStaffAppRole } from "@/utils";

const { Pages, Layout } = pagesConfig as {
  Pages: Record<string, React.ComponentType>;
  Layout?: React.ComponentType<{ currentPageName: string; children: ReactNode }>;
};
const HomePageComponent = Pages.Home;
const MyRequestsPageComponent = Pages.MyRequests;

const LayoutWrapper: React.FC<{ children: ReactNode; currentPageName: string }> = ({ children, currentPageName }) =>
  Layout ?
    <Layout currentPageName={currentPageName}>{children}</Layout>
    : <>{children}</>;

const PublicHomePage: React.ComponentType = Pages["PublicHome"] ?? (() => null);

const AuthenticatedApp = () => {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const publicPaths = ['/', '/login', '/forgot-password', '/reset-password', '/accept-invite', '/PublicHome'];
  const isPublicPath = publicPaths.includes(location.pathname) || location.pathname.startsWith('/org/');

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Redirect unauthenticated users to login unless on a public path
  if (!isAuthenticated && !isPublicPath) {
    navigateToLogin();
    return null;
  }

  // Handle authentication errors (don't redirect if already on login page)
  if (authError && !isPublicPath) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/" element={
        !isAuthenticated ? (
          <LayoutWrapper currentPageName="PublicHome">
            <PublicHomePage />
          </LayoutWrapper>
        ) : isStaffAppRole(user?.app_role) ? (
          <LayoutWrapper currentPageName="Home">
            <HomePageComponent />
          </LayoutWrapper>
        ) : (
          <LayoutWrapper currentPageName="MyRequests">
            <MyRequestsPageComponent />
          </LayoutWrapper>
        )
      } />
      <Route path="/org/:orgSlug" element={
        <LayoutWrapper currentPageName="PublicHome">
          <PublicHomePage />
        </LayoutWrapper>
      } />
      <Route path="/Home" element={isAuthenticated ? <Navigate to="/" replace /> : <Navigate to="/login" replace />} />
      {isAuthenticated && user && !isStaffAppRole(user.app_role) ? (
        <Route path="/MyRequests" element={<Navigate to="/" replace />} />
      ) : null}
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

const RootRouterContent: React.FC = () => (
  <>
    <NavigationTracker />
    <AuthenticatedApp />
  </>
);

const router = createBrowserRouter([
  {
    path: "*",
    element: <RootRouterContent />,
  },
]);


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
