import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Shield, Pencil, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: string;
  email: string;
  phone: string;
  display_name: string;
  avatar_url: string;
  role: string;
  created_at: string;
}

const callAdmin = async (body: Record<string, any>) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke("admin-users", {
    body,
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

const AdminScreen = () => {
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ display_name: "", email: "", phone: "", password: "" });
  const [roleUser, setRoleUser] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const res = await callAdmin({ action: "list_users", search: search || undefined });
      return (res.users || []) as AdminUser[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (params: Record<string, any>) => callAdmin({ action: "update_user", ...params }),
    onSuccess: () => {
      toast({ title: "User updated" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setEditUser(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: async (params: { target_user_id: string; role: string }) => callAdmin({ action: "set_role", ...params }),
    onSuccess: () => {
      toast({ title: "Role updated" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setRoleUser(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditForm({ display_name: u.display_name, email: u.email, phone: u.phone, password: "" });
  };

  const openRole = (u: AdminUser) => {
    setRoleUser(u);
    setNewRole(u.role);
  };

  const handleSaveEdit = () => {
    if (!editUser) return;
    const params: Record<string, any> = { target_user_id: editUser.id };
    if (editForm.display_name !== editUser.display_name) params.display_name = editForm.display_name;
    if (editForm.email !== editUser.email) params.email = editForm.email;
    if (editForm.phone !== editUser.phone) params.phone = editForm.phone;
    if (editForm.password) params.password = editForm.password;
    updateMutation.mutate(params);
  };

  return (
    <div className="p-4 space-y-4 overflow-x-hidden">
      <div className="flex items-center gap-2">
        <Users size={24} className="shrink-0 text-primary" />
        <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">User Management</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No users found.</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 sm:gap-3 rounded-lg bg-card p-3 border border-border">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground">
                {(u.display_name || u.email)?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-medium text-foreground">
                  {u.display_name || "No name"}
                </p>
                <p className="truncate font-body text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px] px-1.5">
                  {u.role}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => openRole(u)} title="Change role" className="h-9 w-9">
                  <Shield size={16} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Edit user" className="h-9 w-9">
                  <Pencil size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Display Name</Label>
              <Input value={editForm.display_name} onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>New Password (leave blank to keep)</Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role dialog */}
      <Dialog open={!!roleUser} onOpenChange={(o) => !o && setRoleUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Change Role</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Changing role for <strong>{roleUser?.display_name || roleUser?.email}</strong>
          </p>
          <RadioGroup value={newRole} onValueChange={setNewRole} className="space-y-2 py-4">
            <div className="flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-secondary/50" onClick={() => setNewRole("admin")}>
              <RadioGroupItem value="admin" id="role-admin" />
              <Label htmlFor="role-admin" className="cursor-pointer flex-1 m-0">
                <p className="font-medium text-foreground">Admin</p>
                <p className="text-xs text-muted-foreground">Full access to user management</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-secondary/50" onClick={() => setNewRole("user")}>
              <RadioGroupItem value="user" id="role-user" />
              <Label htmlFor="role-user" className="cursor-pointer flex-1 m-0">
                <p className="font-medium text-foreground">User</p>
                <p className="text-xs text-muted-foreground">Regular access to app features</p>
              </Label>
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRoleUser(null)}>Cancel</Button>
            <Button
              onClick={() => roleUser && roleMutation.mutate({ target_user_id: roleUser.id, role: newRole })}
              disabled={roleMutation.isPending}
            >
              {roleMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminScreen;
