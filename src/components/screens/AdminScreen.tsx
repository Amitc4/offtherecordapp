import { useState } from "react";
import { Search, Shield, ShieldOff, Pencil, X, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAdminUsers, useUpdateRole, useUpdateUser, AdminUser } from "@/hooks/useAdmin";
import { toast } from "sonner";

const AdminScreen = () => {
  const { data: users, isLoading } = useAdminUsers();
  const updateRole = useUpdateRole();
  const updateUser = useUpdateUser();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    display_name: string;
    email: string;
    phone: string;
    password: string;
  }>({ display_name: "", email: "", phone: "", password: "" });

  const filtered = users?.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.display_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    );
  });

  const handleToggleAdmin = async (user: AdminUser) => {
    const isAdmin = user.roles.includes("admin");
    try {
      await updateRole.mutateAsync({
        user_id: user.id,
        role: "admin",
        grant: !isAdmin,
      });
      toast.success(isAdmin ? "Admin role removed" : "Admin role granted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startEdit = (user: AdminUser) => {
    setEditingUser(user.id);
    setEditForm({
      display_name: user.display_name || "",
      email: user.email || "",
      phone: user.phone || "",
      password: "",
    });
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    try {
      const updates: Record<string, string> = { user_id: editingUser };
      if (editForm.display_name) updates.display_name = editForm.display_name;
      if (editForm.email) updates.email = editForm.email;
      if (editForm.phone) updates.phone = editForm.phone;
      if (editForm.password) updates.password = editForm.password;

      await updateUser.mutateAsync(updates as any);
      toast.success("User updated");
      setEditingUser(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="mb-4 font-display text-xl font-bold text-foreground">Admin Panel</h1>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 font-body text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered?.map((user) => {
            const isAdmin = user.roles.includes("admin");
            const isEditing = editingUser === user.id;

            return (
              <div key={user.id} className="rounded-xl bg-card p-3 vinyl-shadow">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Display name"
                      value={editForm.display_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                      className="font-body text-sm"
                    />
                    <Input
                      placeholder="Email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      className="font-body text-sm"
                    />
                    <Input
                      placeholder="Phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      className="font-body text-sm"
                    />
                    <Input
                      placeholder="New password (leave blank to keep)"
                      type="password"
                      value={editForm.password}
                      onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                      className="font-body text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={updateUser.isPending} className="flex-1 font-body text-xs">
                        <Check size={14} className="mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingUser(null)} className="font-body text-xs">
                        <X size={14} className="mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                      {(user.display_name || user.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-sm font-semibold text-foreground">
                        {user.display_name || "No name"}
                        {isAdmin && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 font-body text-[10px] font-bold text-primary">
                            ADMIN
                          </span>
                        )}
                      </p>
                      <p className="truncate font-body text-xs text-muted-foreground">{user.email}</p>
                      {user.phone && (
                        <p className="truncate font-body text-xs text-muted-foreground">{user.phone}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(user)}
                      >
                        <Pencil size={14} className="text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleToggleAdmin(user)}
                        disabled={updateRole.isPending}
                      >
                        {isAdmin ? (
                          <ShieldOff size={14} className="text-destructive" />
                        ) : (
                          <Shield size={14} className="text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered?.length === 0 && (
            <p className="py-8 text-center font-body text-sm text-muted-foreground">No users found</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminScreen;
