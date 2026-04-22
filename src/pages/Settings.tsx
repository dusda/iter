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
import { format } from "date-fns";
import { supabase } from "@/api/supabaseClient";
import { toast } from "@/components/ui/use-toast";
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
    listing_visibility: "public" as "public" | "unlisted",
  });
  const [uploading, setUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");
  const queuedSaveRef = useRef<typeof orgForm | null>(null);
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
      setOrgForm({
        name: "",
        logo: "",
        description: "",
        welcome_message: "",
        listing_visibility: "public",
      });
      lastSavedSnapshotRef.current = "";
      return;
    }
    setOrgForm({
      name: selectedOrganization.name || "",
      logo: selectedOrganization.logo || "",
      description: selectedOrganization.description || "",
      welcome_message: selectedOrganization.welcome_message || "",
      listing_visibility:
        selectedOrganization.listing_visibility === "unlisted" ? "unlisted" : "public",
    });
    const snapshot = JSON.stringify({
      name: selectedOrganization.name || "",
      logo: selectedOrganization.logo || "",
      description: selectedOrganization.description || "",
      welcome_message: selectedOrganization.welcome_message || "",
      listing_visibility:
        selectedOrganization.listing_visibility === "unlisted" ? "unlisted" : "public",
    });
    lastSavedSnapshotRef.current = snapshot;
  }, [selectedOrganization]);

  const saveSettings = useMutation({
    mutationFn: async (data: typeof orgForm) => {
      if (!user?.organization_id) throw new Error("No organization selected");
      return api.entities.Organization.update(user.organization_id, {
        name: data.name,
        logo: data.logo,
        description: data.description,
        welcome_message: data.welcome_message,
        listing_visibility: data.listing_visibility,
        updated_date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries();
    },
    onSettled: () => {
      const queued = queuedSaveRef.current;
      if (!queued) return;
      if (saveSettings.isPending) return;
      queuedSaveRef.current = null;
      // Flush the latest queued save (if it's still different).
      const snapshot = JSON.stringify(queued);
      if (snapshot === lastSavedSnapshotRef.current) return;
      saveSettings.mutate(queued, {
        onSuccess: () => {
          lastSavedSnapshotRef.current = snapshot;
          toast({
            title: "Saved",
            description: `Organization updated at ${format(new Date(), "p")}.`,
            className: "border-emerald-700 bg-emerald-600 text-white",
          });
        },
      });
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
    onSuccess: async (_data, organizationId) => {
      await loadUser();
      queryClient.invalidateQueries();
      const orgName =
        organizations.find((o) => o.id === organizationId)?.name ||
        availableOrganizations.find((o) => o.id === organizationId)?.name ||
        "organization";
      toast({
        title: "Organization switched",
        description: `Active organization is now ${orgName}.`,
        className: "border-emerald-700 bg-emerald-600 text-white",
      });
    },
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    const next = { ...orgForm, logo: file_url };
    setOrgForm(next);
    // Upload is a "done" event — save immediately.
    if (user?.organization_id && isAdmin) {
      const snapshot = JSON.stringify(next);
      if (snapshot !== lastSavedSnapshotRef.current && !saveSettings.isPending) {
        saveSettings.mutate(next, {
          onSuccess: () => {
            lastSavedSnapshotRef.current = snapshot;
            toast({
              title: "Saved",
              description: `Organization updated at ${format(new Date(), "p")}.`,
              className: "border-emerald-700 bg-emerald-600 text-white",
            });
          },
        });
      } else if (snapshot !== lastSavedSnapshotRef.current && saveSettings.isPending) {
        queuedSaveRef.current = next;
      }
    }
    setUploading(false);
  };
 
  const saveIfChanged = (next: typeof orgForm) => {
    if (!user?.organization_id) return;
    if (!isAdmin) return;
    const snapshot = JSON.stringify(next);
    if (snapshot === lastSavedSnapshotRef.current) return;
    if (saveSettings.isPending) {
      queuedSaveRef.current = next;
      return;
    }

    saveSettings.mutate(next, {
      onSuccess: () => {
        lastSavedSnapshotRef.current = snapshot;
        toast({
          title: "Saved",
          description: `Organization updated at ${format(new Date(), "p")}.`,
          className: "border-emerald-700 bg-emerald-600 text-white",
        });
      },
    });
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
          <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
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
                  <SelectTrigger className="bg-white dark:bg-slate-900">
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
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No approved organizations found for your account yet.
                  </p>
                ) : null}
              </div>
              {switchOrganization.isPending ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <LoadingSpinner size="sm" />
                  Switching organization…
                </div>
              ) : null}
            </CardContent>
          </Card>

          {!isAdmin ? (
            <div className="text-center py-10">
              <p className="text-slate-500 dark:text-slate-400">Organization settings are restricted to administrators.</p>
            </div>
          ) : null}

          {isAdmin ? (
          <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 dark:bg-slate-900/70 dark:border-slate-800/50">
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!user?.organization_id ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Select an organization above to edit its settings.
                </div>
              ) : null}
              {user?.organization_id && (
                <div className="space-y-2">
                  <Label>Organization ID</Label>
                  <Input
                    value={user.organization_id}
                    disabled
                    className="bg-slate-50 text-slate-500 dark:text-slate-400 dark:bg-slate-900"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Organization Name *</Label>
                <Input
                  value={orgForm.name}
                  onChange={(e) => {
                    setOrgForm({ ...orgForm, name: e.target.value });
                  }}
                  onBlur={(e) => saveIfChanged({ ...orgForm, name: e.target.value })}
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
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 dark:bg-slate-900 dark:border-slate-700">
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
                        className="flex-1 justify-start bg-white dark:bg-slate-900"
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
                        onClick={() => {
                          const next = { ...orgForm, logo: "" };
                          setOrgForm(next);
                          saveIfChanged(next);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                    {uploading ? (
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Uploading…</div>
                    ) : orgForm.logo?.startsWith("placeholder://") ? (
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                  onChange={(e) => {
                    setOrgForm({ ...orgForm, description: e.target.value });
                  }}
                  onBlur={() => saveIfChanged(orgForm)}
                  placeholder="Brief description shown on the public page..."
                  disabled={!user?.organization_id}
                />
              </div>

              <div className="space-y-2">
                <Label>Welcome Message</Label>
                <Input
                  value={orgForm.welcome_message}
                  onChange={(e) => {
                    setOrgForm({ ...orgForm, welcome_message: e.target.value });
                  }}
                  onBlur={() => saveIfChanged(orgForm)}
                  placeholder="Welcome! Request access to get started."
                  disabled={!user?.organization_id}
                />
              </div>

              <div className="space-y-2">
                <Label>Anonymous home directory</Label>
                <Select
                  value={orgForm.listing_visibility}
                  onValueChange={(value: "public" | "unlisted") => {
                    const next = { ...orgForm, listing_visibility: value };
                    setOrgForm(next);
                    saveIfChanged(next);
                  }}
                  disabled={!user?.organization_id}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public — listed on the welcome page</SelectItem>
                    <SelectItem value="unlisted">Unlisted — direct link only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unlisted organizations are hidden from the public organization list; share your org link for access requests.
                </p>
              </div>
            </CardContent>
          </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}