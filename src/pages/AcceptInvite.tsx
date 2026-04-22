import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

export default function AcceptInvite() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasInviteSession, setHasInviteSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const type = url.searchParams.get("type");
        const tokenHash =
          url.searchParams.get("token_hash") ?? url.searchParams.get("token");

        // Establish a session from the invite link (depends on the configured auth flow).
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type: type as any,
            token_hash: tokenHash,
          });
          if (error) throw error;
        }

        // Clean auth params from the URL after processing.
        if (code || tokenHash || type) {
          url.searchParams.delete("code");
          url.searchParams.delete("token_hash");
          url.searchParams.delete("token");
          url.searchParams.delete("type");
          url.searchParams.delete("next");
          window.history.replaceState({}, "", url.toString());
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;
        setHasInviteSession(Boolean(data?.session?.user));
      } catch {
        if (!isMounted) return;
        setHasInviteSession(false);
      } finally {
        if (!isMounted) return;
        setIsReady(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters.",
        variant: "warning",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don’t match",
        description: "Please re-enter your password.",
        variant: "warning",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();

      toast({
        title: "Welcome!",
        description: "Your password is set. Sign in with your email and password.",
      });
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast({
        title: "Couldn’t set password",
        description: err?.message || "Please request a new invite and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accept your invite</CardTitle>
          <CardDescription>
            {isReady && !hasInviteSession
              ? "This invite link is invalid or expired."
              : "Set a password to finish creating your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isReady ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin dark:border-slate-800"></div>
            </div>
          ) : !hasInviteSession ? (
            <div className="space-y-3">
              <Button className="w-full" asChild>
                <Link to="/forgot-password">Request a reset link</Link>
              </Button>
              <div className="text-center">
                <Button variant="link" size="sm" asChild className="px-0">
                  <Link to="/login">Back to sign in</Link>
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving…" : "Set password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

