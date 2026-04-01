import React, { useRef, useState, useEffect } from "react";
import { api } from "@/api/supabaseApi";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Upload } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/api/supabaseClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function resolveLogoSrc(logoValue: string) {
  const raw = String(logoValue || "").trim();
  if (!raw) return null;
  if (raw.startsWith("placeholder://")) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  // Treat as Supabase Storage key/path.
  const { data } = supabase.storage.from("uploads").getPublicUrl(raw);
  return data?.publicUrl || null;
}

export default function Settings() {
  const [user, setUser] = useState(null);
  const [orgForm, setOrgForm] = useState({
    name: "",
    logo: "",
    description: "",
    welcome_message: "",
  });
  const [uploading, setUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
  };

  const isAdmin = user?.app_role === "admin" || user?.app_role === "super_admin";
  const isSuperAdmin = user?.app_role === "super_admin";
  const logoSrc = React.useMemo(() => resolveLogoSrc(orgForm.logo), [orgForm.logo]);

  const { data: organizations = [] } = useQuery<any[]>({
    queryKey: ["organizations"],
    queryFn: () => api.entities.Organization.list("name"),
    enabled: !!user,
  });

  const { data: approvedAccessRequests = [] } = useQuery<any[]>({
    queryKey: ["approvedAccessRequests", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return api.entities.AccessRequest.filter({ email: user.email, status: "approved" }, "-created_date");
    },
    enabled: !!user?.email && !isSuperAdmin,
  });

  const allowedOrganizationIds = React.useMemo(() => {
    if (!user) return new Set<string>();
    if (isSuperAdmin) return new Set<string>(organizations.map((o) => o.id));
    const ids = new Set<string>();
    if (user.organization_id) ids.add(user.organization_id);
    for (const req of approvedAccessRequests) {
      if (req?.organization_id) ids.add(req.organization_id);
    }
    return ids;
  }, [approvedAccessRequests, isSuperAdmin, organizations, user]);

  const availableOrganizations = isSuperAdmin
    ? organizations
    : organizations.filter((o) => allowedOrganizationIds.has(o.id));

  const selectedOrganization = React.useMemo(() => {
    if (!user?.organization_id) return null;
    return organizations.find((o) => o.id === user.organization_id) || null;
  }, [organizations, user?.organization_id]);

  useEffect(() => {
    if (!selectedOrganization) {
      setOrgForm({ name: "", logo: "", description: "", welcome_message: "" });
      return;
    }
    setOrgForm({
      name: selectedOrganization.name || "",
      logo: selectedOrganization.logo || "",
      description: selectedOrganization.description || "",
      welcome_message: selectedOrganization.welcome_message || "",
    });
  }, [selectedOrganization]);

  const saveSettings = useMutation({
    mutationFn: async (data: typeof orgForm) => {
      if (!user?.organization_id) throw new Error("No organization selected");
      return api.entities.Organization.update(user.organization_id, {
        name: data.name,
        logo: data.logo,
        description: data.description,
        welcome_message: data.welcome_message,
        updated_date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries();
      alert("Organization saved successfully!");
    },
  });

  const switchOrganization = useMutation({
    mutationFn: async (organizationId: string) => {
      const updated = await api.auth.updateMe({
        organization_id: organizationId || null,
        updated_at: new Date().toISOString(),
      });
      return updated;
    },
    onSuccess: async () => {
      await loadUser();
      queryClient.invalidateQueries();
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    setOrgForm({ ...orgForm, logo: file_url });
    setUploading(false);
  };

  const handleSave = () => {
    saveSettings.mutate(orgForm);
  };



  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Settings"
        description="Manage organization settings and access requests"
      />

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
        </TabsList>

        {/* Organization Settings */}
        <TabsContent value="organization">
          <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
            <CardHeader>
              <CardTitle>Active Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select
                  value={user.organization_id || ""}
                  onValueChange={(value) => switchOrganization.mutate(value)}
                  disabled={switchOrganization.isPending || availableOrganizations.length === 0}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={availableOrganizations.length ? "Select an organization" : "No organizations available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrganizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isSuperAdmin && availableOrganizations.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No approved organizations found for your account yet.
                  </p>
                ) : null}
              </div>
              {switchOrganization.isPending ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <LoadingSpinner size="sm" />
                  Switching organization…
                </div>
              ) : null}
            </CardContent>
          </Card>

          {!isAdmin ? (
            <div className="text-center py-10">
              <p className="text-slate-500">Organization settings are restricted to administrators.</p>
            </div>
          ) : null}

          {isAdmin ? (
          <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!user?.organization_id ? (
                <div className="text-sm text-slate-500">
                  Select an organization above to edit its settings.
                </div>
              ) : null}
              {user?.organization_id && (
                <div className="space-y-2">
                  <Label>Organization ID</Label>
                  <Input
                    value={user.organization_id}
                    disabled
                    className="bg-slate-50 text-slate-500"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Organization Name *</Label>
                <Input
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                  placeholder="Acme University"
                  disabled={!user?.organization_id}
                />
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    {logoSrc ? (
                      <img
                        src={logoSrc}
                        alt="Organization logo"
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200 bg-white"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-500">
                        No logo
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploading || !user?.organization_id}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 justify-start bg-white"
                        disabled={uploading || !user?.organization_id}
                        onClick={() => logoFileInputRef.current?.click()}
                      >
                        {orgForm.logo ? "Replace logo…" : "Choose logo…"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
                        disabled={uploading || !user?.organization_id || !orgForm.logo}
                        onClick={() => setOrgForm({ ...orgForm, logo: "" })}
                      >
                        Remove
                      </Button>
                    </div>
                    {uploading ? (
                      <div className="mt-1 text-xs text-slate-500">Uploading…</div>
                    ) : orgForm.logo?.startsWith("placeholder://") ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Logo set (storage not configured in this environment)
                      </div>
                    ) : null}
                  </div>
                  {uploading && <LoadingSpinner size="sm" />}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={orgForm.description}
                  onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                  placeholder="Brief description shown on the public page..."
                  disabled={!user?.organization_id}
                />
              </div>

              <div className="space-y-2">
                <Label>Welcome Message</Label>
                <Input
                  value={orgForm.welcome_message}
                  onChange={(e) => setOrgForm({ ...orgForm, welcome_message: e.target.value })}
                  placeholder="Welcome! Request access to get started."
                  disabled={!user?.organization_id}
                />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleSave}
                  disabled={saveSettings.isPending || !user?.organization_id || !orgForm.name}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {saveSettings.isPending ? <LoadingSpinner size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}