"use client";

import { useEffect, useState } from "react";
import { Button, Input, Label, Modal, PageHeader, Card, CardContent } from "@booking/ui";
import { toast, Toaster } from "sonner";
import { formatApiError } from "@/lib/format-api-error";
import { useAdminSession } from "@/hooks/use-admin-session";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  projects: Array<{ id: string; name: string }>;
}

const emptyForm = {
  email: "",
  name: "",
  password: "",
  role: "SALES_EXEC",
  projectIds: [] as string[],
  isActive: true,
};

const emptyAdminForm = {
  email: "",
  name: "",
  password: "",
  role: "PROJECT_ADMIN" as "PROJECT_ADMIN" | "SUPER_ADMIN",
  projectIds: [] as string[],
};

function roleBadge(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return { label: "Super Admin", className: "bg-purple-100 text-purple-800" };
    case "PROJECT_ADMIN":
      return { label: "Project Admin", className: "bg-indigo-100 text-indigo-800" };
    case "SALES_MANAGER":
      return { label: "Sales Manager", className: "bg-blue-100 text-blue-800" };
    default:
      return { label: "Sales Executive", className: "bg-gray-100 text-gray-700" };
  }
}

export default function UsersPage() {
  const { isSuperAdmin } = useAdminSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [importProjectIds, setImportProjectIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [uRes, pRes] = await Promise.all([fetch("/api/users"), fetch("/api/projects")]);
    const uData = await uRes.json();
    const pData = await pRes.json();
    setUsers(uData.users ?? []);
    setProjects(pData.projects ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      name: user.name,
      password: "",
      role: user.role,
      projectIds: user.projects.map((p) => p.id),
      isActive: user.isActive,
    });
    setShowEdit(true);
  };

  const handleCreate = async () => {
    if (!form.password || form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      toast.success("User created");
      setShowCreate(false);
      setForm(emptyForm);
      load();
    } else {
      toast.error(formatApiError(data.error, "Failed to create user"));
    }
  };

  const handleCreateAdmin = async () => {
    if (!adminForm.password || adminForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminForm),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      toast.success("Admin account created");
      setShowAddAdmin(false);
      setAdminForm(emptyAdminForm);
      load();
    } else {
      toast.error(formatApiError(data.error, "Failed to create admin"));
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
      projectIds: form.projectIds,
      isActive: form.isActive,
    };
    if (form.password) payload.password = form.password;

    setSubmitting(true);
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      toast.success("User updated");
      setShowEdit(false);
      setEditingUser(null);
      load();
    } else {
      toast.error(formatApiError(data.error, "Failed to update user"));
    }
  };

  const handleImport = async () => {
    if (importProjectIds.length === 0) {
      toast.error("Select at least one project for imported users");
      return;
    }
    const csv = `email,name,role,password\nsales1@demo.com,Sales One,SALES_EXEC,password123\nsales2@demo.com,Sales Two,SALES_EXEC,password123`;
    const rows = csv.split("\n").slice(1).map((line) => {
      const [email, name, role, password] = line.split(",");
      return { email, name, role, password, projectIds: importProjectIds };
    });
    setSubmitting(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ import: true, users: rows }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      toast.success("Users imported");
      setShowImport(false);
      load();
    } else {
      toast.error(formatApiError(data.error, "Import failed"));
    }
  };

  const toggleActive = async (user: UserRow) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(user.isActive ? "User deactivated" : "User activated");
      load();
    } else {
      toast.error(formatApiError(data.error, "Failed to update user status"));
    }
  };

  const ProjectCheckboxes = ({
    selectedIds,
    onChange,
  }: {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
  }) => (
    <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3">
      {projects.map((p) => (
        <label key={p.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selectedIds.includes(p.id)}
            onChange={(e) => {
              onChange(
                e.target.checked
                  ? [...selectedIds, p.id]
                  : selectedIds.filter((id) => id !== p.id)
              );
            }}
          />
          {p.name}
        </label>
      ))}
      {projects.length === 0 && (
        <p className="text-sm text-gray-400">No projects available</p>
      )}
    </div>
  );

  const UserFormFields = ({
    includePasswordDefault = true,
  }: {
    includePasswordDefault?: boolean;
  }) => (
    <>
      <div>
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <Label>
          {includePasswordDefault ? "Password" : "New Password (leave blank to keep current)"}
        </Label>
        <Input
          type="password"
          value={form.password}
          placeholder={includePasswordDefault ? "Min 6 characters" : "Unchanged"}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      <div>
        <Label>Role</Label>
        <select
          className="w-full rounded-lg border p-2"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="SALES_EXEC">Sales Executive</option>
          <option value="SALES_MANAGER">Sales Manager</option>
          {isSuperAdmin && (
            <>
              <option value="PROJECT_ADMIN">Project Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </>
          )}
        </select>
      </div>
      <div>
        <Label>Assigned Projects</Label>
        <ProjectCheckboxes
          selectedIds={form.projectIds}
          onChange={(projectIds) => setForm({ ...form, projectIds })}
        />
      </div>
      {!includePasswordDefault && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
      )}
    </>
  );

  const UserActions = ({ user }: { user: UserRow }) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
        Edit
      </Button>
      <Button size="sm" variant="outline" onClick={() => toggleActive(user)}>
        {user.isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="User Management"
        description="Manage sales users and admin accounts"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setImportProjectIds([]);
                setShowImport(true);
              }}
            >
              Import CSV
            </Button>
            {isSuperAdmin && (
              <Button
                variant="outline"
                onClick={() => {
                  setAdminForm(emptyAdminForm);
                  setShowAddAdmin(true);
                }}
              >
                Add Admin
              </Button>
            )}
            <Button
              onClick={() => {
                setForm(emptyForm);
                setShowCreate(true);
              }}
            >
              Add User
            </Button>
          </>
        }
      />

      <div className="space-y-3 lg:hidden">
        {users.map((u) => {
          const badge = roleBadge(u.role);
          return (
            <Card key={u.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Projects: {u.projects.map((p) => p.name).join(", ") || "—"}
                </p>
                <p className={`text-sm ${u.isActive ? "text-emerald-600" : "text-gray-400"}`}>
                  {u.isActive ? "Active" : "Inactive"}
                </p>
                <UserActions user={u} />
              </CardContent>
            </Card>
          );
        })}
        {users.length === 0 && <p className="text-gray-500">No users yet.</p>}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Projects</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const badge = roleBadge(u.role);
                return (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {u.projects.map((p) => p.name).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={u.isActive ? "text-emerald-600" : "text-gray-400"}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <UserActions user={u} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showCreate} onOpenChange={setShowCreate} title="Create User">
        <div className="space-y-3">
          <UserFormFields />
          <Button className="w-full" disabled={submitting} onClick={handleCreate}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </Modal>

      <Modal open={showAddAdmin} onOpenChange={setShowAddAdmin} title="Add Admin">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Admin accounts can access the Admin Panel. Choose Super Admin for full access or Project
            Admin for assigned projects only.
          </p>
          <div>
            <Label>Name</Label>
            <Input
              value={adminForm.name}
              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={adminForm.email}
              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={adminForm.password}
              placeholder="Min 8 characters"
              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
            />
          </div>
          <div>
            <Label>Role</Label>
            <select
              className="w-full rounded-lg border p-2"
              value={adminForm.role}
              onChange={(e) =>
                setAdminForm({
                  ...adminForm,
                  role: e.target.value as "PROJECT_ADMIN" | "SUPER_ADMIN",
                })
              }
            >
              <option value="PROJECT_ADMIN">Project Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          {adminForm.role === "PROJECT_ADMIN" && (
            <div>
              <Label>Assigned Projects</Label>
              <ProjectCheckboxes
                selectedIds={adminForm.projectIds}
                onChange={(projectIds) => setAdminForm({ ...adminForm, projectIds })}
              />
            </div>
          )}
          <Button className="w-full" disabled={submitting} onClick={handleCreateAdmin}>
            {submitting ? "Creating..." : "Create Admin"}
          </Button>
        </div>
      </Modal>

      <Modal open={showEdit} onOpenChange={setShowEdit} title="Edit User">
        <div className="space-y-3">
          <UserFormFields includePasswordDefault={false} />
          <Button className="w-full" disabled={submitting} onClick={handleEdit}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Modal>

      <Modal open={showImport} onOpenChange={setShowImport} title="Import Users">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Imported users will be sales roles only and assigned to the selected projects.
          </p>
          <div>
            <Label>Assign to Projects</Label>
            <ProjectCheckboxes
              selectedIds={importProjectIds}
              onChange={setImportProjectIds}
            />
          </div>
          <Button className="w-full" disabled={submitting} onClick={handleImport}>
            {submitting ? "Importing..." : "Import Demo CSV"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
