import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/supabaseApi";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { GraduationCap, LogIn, Send, CheckCircle } from "lucide-react";

export default function PublicHome() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    student_id: "",
    reason: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const orgSlugFromPath = (params.orgSlug || "").trim();
  const legacyOrgSlug = (searchParams.get("org") || "").trim();
  const orgSlug = orgSlugFromPath || legacyOrgSlug;

  // Back-compat: migrate old `?org=slug` links to `/org/slug`
  useEffect(() => {
    if (!orgSlugFromPath && legacyOrgSlug) {
      navigate(`/org/${encodeURIComponent(legacyOrgSlug)}`, { replace: true });
    }
  }, [legacyOrgSlug, navigate, orgSlugFromPath]);

  const { data: organization } = useQuery({
    queryKey: ["organization", orgSlug],
    queryFn: async () => {
      if (!orgSlug) return null;
      const orgs = await api.entities.Organization.filter({ slug: orgSlug });
      return orgs[0] || null;
    },
    enabled: !!orgSlug,
  });

  const { data: organizations = [], isLoading: isLoadingOrganizations } = useQuery<any[]>({
    queryKey: ["organizations-public"],
    queryFn: async () => {
      const orgs = await api.entities.Organization.list("name");
      return (orgs || []).filter(
        (o) =>
          o?.status !== "inactive" &&
          o?.listing_visibility !== "unlisted"
      );
    },
    enabled: !orgSlug,
  });

  const submitRequest = useMutation({
    mutationFn: (data: typeof formData) =>
      api.entities.AccessRequest.create({
        ...data,
        organization_id: organization?.id,
        organization_name: organization?.name,
      }),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitRequest.mutateAsync(formData);
  };

  const handleLogin = () => {
    api.auth.redirectToLogin(createPageUrl("Home"));
  };

  if (!orgSlug) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30">
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 dark:bg-slate-900/80 dark:border-slate-800/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="font-bold text-slate-800 text-lg dark:text-slate-100">Select your organization</div>
              <Button onClick={handleLogin} variant="outline">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">Welcome</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Choose your organization to request access.
            </p>
          </div>

          {isLoadingOrganizations ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : organizations.length === 0 ? (
            <Card className="max-w-xl">
              <CardContent className="pt-6">
                <p className="text-slate-700 font-medium dark:text-slate-200">No organizations found.</p>
                <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                  Ask an administrator to create an organization, or browse with `?org=your-org-slug`.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => navigate(`/org/${encodeURIComponent(org.slug)}`)}
                  className="text-left"
                >
                  <Card className="h-full bg-white/70 backdrop-blur-xs border-slate-200/50 shadow-sm hover:shadow-md transition-shadow dark:bg-slate-900/70 dark:border-slate-800/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        {org.logo ? (
                          <img
                            src={org.logo}
                            alt={`${org.name} logo`}
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-linear-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                            <GraduationCap className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate dark:text-slate-50">{org.name}</div>
                          <div className="text-sm text-slate-600 mt-1 line-clamp-3 dark:text-slate-300">
                            {org.description || "Apply for financial assistance to support your educational journey."}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-700 font-medium mb-2 dark:text-slate-200">Organization not found</p>
            <p className="text-sm text-slate-500 mb-4 dark:text-slate-400">
              The organization slug <span className="font-mono">{orgSlug}</span> doesn’t match any organization.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/`)}
              >
                Choose organization
              </Button>
              <Button type="button" onClick={handleLogin} className="bg-indigo-600 hover:bg-indigo-700">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 dark:bg-slate-900/80 dark:border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {organization.logo ? (
                <img src={organization.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
              )}
              <span className="font-bold text-slate-800 text-lg dark:text-slate-100">{organization.name}</span>
            </div>
            <Button onClick={handleLogin} variant="outline">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* Hero Section */}
        <div className="text-center mb-12">
          {organization.logo && (
            <div className="flex justify-center mb-8">
              <img src={organization.logo} alt="Logo" className="w-24 h-24 rounded-2xl object-cover shadow-xl" />
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 dark:text-slate-50">
            {organization.name}
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto dark:text-slate-300">
            {organization.description || "Apply for financial assistance to support your educational journey."}
          </p>
        </div>

        {/* Request Access Form */}
        <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 shadow-xl dark:bg-slate-900/70 dark:border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {submitted ? "Request Submitted!" : organization.welcome_message || "Request Access"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4 dark:text-emerald-400" />
                <p className="text-slate-700 text-lg mb-2 dark:text-slate-200">Thank you for your request!</p>
                <p className="text-slate-500 dark:text-slate-400">
                  An administrator will review your request and contact you via email at{" "}
                  <span className="font-medium">{formData.email}</span>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      required
                      placeholder="John Doe"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      required
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      placeholder="(123) 456-7890"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Student ID</Label>
                    <Input
                      placeholder="Your student ID"
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Why do you need access? *</Label>
                  <Textarea
                    required
                    rows={4}
                    placeholder="Please explain why you're requesting access to the student fund application system..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitRequest.isPending}
                  className="w-full bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25"
                >
                  {submitRequest.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Request Access
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
          <p>Already have an account?{" "}
            <button onClick={handleLogin} className="text-indigo-600 hover:text-indigo-700 font-medium dark:text-indigo-400 dark:hover:text-indigo-300">
              Sign in here
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}