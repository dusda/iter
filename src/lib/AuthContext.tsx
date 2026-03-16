import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "@/api/supabaseApi";
import { supabase } from "@/api/supabaseClient";

interface AuthError {
  type: "user_not_registered" | "auth_required" | "unknown";
  message: string;
}

interface AppPublicSettings {
  id: string | null;
  public_settings: Record<string, unknown>;
}

export interface AuthContextValue {
  user: any;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: AuthError | null;
  appPublicSettings: AppPublicSettings | null;
  logout: (shouldRedirect?: boolean) => void;
  navigateToLogin: () => void;
  checkAppState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const [appPublicSettings, setAppPublicSettings] =
    useState<AppPublicSettings | null>(null);

  useEffect(() => {
    checkAppState();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAppState();
    });
    return () => subscription?.unsubscribe();
  }, []);

  const checkAppState = async (): Promise<void> => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthenticated(false);
        setUser(null);
        setAuthError(null);
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
        return;
      }
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAppPublicSettings({ id: null, public_settings: {} });
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
    } catch (error) {
      console.error("Auth check failed:", error);
      setAuthError({
        type: error?.message?.includes("Not authenticated")
          ? "auth_required"
          : "unknown",
        message: (error as Error)?.message || "Authentication failed",
      });
      setIsAuthenticated(false);
      setUser(null);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
    }
  };

  const logout = (shouldRedirect: boolean = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      const returnPath = window.location.pathname + window.location.search;
      api.auth.logout(returnPath);
    } else {
      api.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use path + query instead of full URL to avoid malformed routes like /login/http:/localhost...
    const returnPath = window.location.pathname + window.location.search;
    api.auth.redirectToLogin(returnPath);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
