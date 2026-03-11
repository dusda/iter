import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '@/api/supabaseApi';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAppState();
    });
    return () => subscription?.unsubscribe();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      const { data: { session } } = await supabase.auth.getSession();
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
      console.error('Auth check failed:', error);
      setAuthError({
        type: error?.message?.includes('Not authenticated') ? 'auth_required' : 'unknown',
        message: error?.message || 'Authentication failed',
      });
      setIsAuthenticated(false);
      setUser(null);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      api.auth.logout(window.location.href);
    } else {
      api.auth.logout();
    }
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
