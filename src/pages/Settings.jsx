import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: settings, isLoading } = useQuery({
    queryKey: ["appSettings"],
    queryFn: async () => {
      const allSettings = await base44.entities.AppSettings.list();
      return allSettings[0];
    },
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
    mutationFn: async (data) => {
      if (settings) {
        return base44.entities.AppSettings.update(settings.id, data);
      } else {
        return base44.entities.AppSettings.create({ ...data, is_singleton: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["appSettings"]);
      alert("Settings saved successfully!");
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
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

  if (user.app_role !== "admin") {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Access restricted to administrators</p>
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
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}