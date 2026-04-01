import React, { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    organization_name: "",
    organization_logo: "",
    organization_description: "",
    welcome_message: ""
  });
  const [uploading, setUploading] = useState(false);
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

  const { data: settings, isLoading } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      const allSettings = await api.entities.AppSettings.list();
      return allSettings[0];
    },
    enabled: isAdmin,
  });



  useEffect(() => {
    if (settings) {
      setFormData({
        organization_name: settings.organization_name || "",
        organization_logo: settings.organization_logo || "",
        organization_description: settings.organization_description || "",
        welcome_message: settings.welcome_message || ""
      });
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (settings) {
        return api.entities.AppSettings.update(settings.id, data);
      } else {
        return api.entities.AppSettings.create({ ...data, is_singleton: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      alert("Settings saved successfully!");
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
    setFormData({ ...formData, organization_logo: file_url });
    setUploading(false);
  };

  const handleSave = () => {
    saveSettings.mutate(formData);
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
                  value={formData.organization_name}
                  onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                  placeholder="Acme University"
                />
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {formData.organization_logo && (
                    <img src={formData.organization_logo} alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                    />
                  </div>
                  {uploading && <LoadingSpinner size="sm" />}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={formData.organization_description}
                  onChange={(e) => setFormData({ ...formData, organization_description: e.target.value })}
                  placeholder="Brief description shown on the public page..."
                />
              </div>

              <div className="space-y-2">
                <Label>Welcome Message</Label>
                <Input
                  value={formData.welcome_message}
                  onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                  placeholder="Welcome! Request access to get started."
                />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleSave}
                  disabled={saveSettings.isPending || !formData.organization_name}
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