import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    student_id: "",
    reason: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [orgSlug, setOrgSlug] = useState("");

  useEffect(() => {
    setOrgSlug("test-org");
  }, []);

  const { data: organization } = useQuery({
    queryKey: ["organization", orgSlug],
    queryFn: async () => {
      if (!orgSlug) return null;
      const orgs = await api.entities.Organization.filter({ slug: orgSlug });
      return orgs[0] || null;
    },
    enabled: !!orgSlug,
  });

  const submitRequest = useMutation({
    mutationFn: (data) => api.entities.AccessRequest.create({
      ...data,
      organization_id: organization?.id,
      organization_name: organization?.name
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
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600 mb-4">Please provide an organization identifier</p>
            <p className="text-sm text-slate-500">Add ?org=organization-slug to the URL</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {organization.logo ? (
                <img src={organization.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
              )}
              <span className="font-bold text-slate-800 text-lg">{organization.name}</span>
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
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            {organization.name}
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            {organization.description || "Apply for financial assistance to support your educational journey."}
          </p>
        </div>

        {/* Request Access Form */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {submitted ? "Request Submitted!" : organization.welcome_message || "Request Access"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <p className="text-slate-700 text-lg mb-2">Thank you for your request!</p>
                <p className="text-slate-500">
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
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25"
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
        <div className="text-center mt-8 text-sm text-slate-500">
          <p>Already have an account?{" "}
            <button onClick={handleLogin} className="text-indigo-600 hover:text-indigo-700 font-medium">
              Sign in here
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}