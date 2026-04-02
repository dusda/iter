import React, { useState, useEffect } from "react";
import { api } from "@/api/supabaseApi";
import PageHeader from "@/components/shared/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Shield,
  Save,
  CheckCircle,
  KeyRound
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    phone: "",
    school_id: ""
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
    setFormData({
      phone: currentUser.phone || "",
      school_id: currentUser.school_id || ""
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await api.auth.updateMe({
      phone: formData.phone,
      school_id: formData.school_id
    });
    await loadUser();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters.",
        variant: "warning",
      });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Passwords don’t match",
        description: "Please re-enter your new password.",
        variant: "warning",
      });
      return;
    }
    setPasswordSaving(true);
    try {
      await api.auth.changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast({
        title: "Password updated",
        description: "Your password has been changed.",
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Couldn’t update your password.";
      toast({
        title: "Couldn’t change password",
        description: message,
        variant: "destructive",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const roleColors = {
    student: "bg-blue-100 text-blue-800 border-blue-200",
    reviewer: "bg-amber-100 text-amber-800 border-amber-200",
    approver: "bg-purple-100 text-purple-800 border-purple-200",
    fund_manager: "bg-emerald-100 text-emerald-800 border-emerald-200",
    admin: "bg-rose-100 text-rose-800 border-rose-200"
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your account settings"
      />

      {/* Profile Card */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50 overflow-hidden">
        <div className="h-24 bg-linear-to-r from-indigo-600 to-violet-600"></div>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center -mt-12 pb-6">
            <div className="w-24 h-24 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center">
              <div className="w-20 h-20 bg-linear-to-br from-indigo-100 to-violet-100 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-indigo-700">
                  {user.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"}
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mt-4">{user.full_name}</h2>
            <p className="text-slate-500">{user.email}</p>
            <Badge 
              variant="outline" 
              className={`mt-3 capitalize ${roleColors[user.app_role] || roleColors.student}`}
            >
              <Shield className="w-3 h-3 mr-1" />
              {(user.app_role || "student").replace("_", " ")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Update your contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Full Name
              </Label>
              <Input
                value={user.full_name || ""}
                disabled
                className="bg-slate-50"
              />
              <p className="text-xs text-slate-500">Contact admin to change your name</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                Email
              </Label>
              <Input
                value={user.email || ""}
                disabled
                className="bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                Phone Number
              </Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-slate-400" />
                School ID
              </Label>
              <Input
                value={formData.school_id}
                onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                placeholder="Enter your student ID"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t">
            {saved && (
              <span className="text-emerald-600 flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4" />
                Changes saved
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-slate-500" />
            Change password
          </CardTitle>
          <CardDescription>
            Enter your current password, then choose a new one (at least 8 characters).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="profile-current-password">Current password</Label>
              <Input
                id="profile-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-new-password">New password</Label>
              <Input
                id="profile-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-confirm-new-password">Confirm new password</Label>
              <Input
                id="profile-confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmNewPassword}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {passwordSaving ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <KeyRound className="w-4 h-4 mr-2" />
              )}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Stats */}
      <Card className="bg-white/70 backdrop-blur-xs border-slate-200/50">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Role</p>
              <p className="font-medium capitalize">{(user.app_role || "student").replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <p className="font-medium capitalize">{user.status || "active"}</p>
            </div>
            <div>
              <p className="text-slate-500">Member Since</p>
              <p className="font-medium">
                {user.created_date ? new Date(user.created_date).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Account Type</p>
              <p className="font-medium capitalize">{user.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}