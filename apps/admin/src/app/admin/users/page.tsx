"use client";

import { useEffect, useState } from "react";
import { Button, Label, Modal, PageHeader, Card, CardContent, FilterBar } from "@booking/ui";
import {
  UserFormFields,
  AddAdminForm,
  ProjectCheckboxes,
  UserActions,
} from "@/components/users/user-form-fields";
import { toast, Toaster } from "sonner";
import { formatApiError } from "@/lib/format-api-error";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useAdminProject } from "@/hooks/use-admin-project";

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
  const { projects } = useAdminProject();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [importProjectIds, setImportProjectIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  const load = async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (activeFilter) params.set("isActive", activeFilter);
    if (projectFilter) params.set("projectId", projectFilter);
    const q = params.toString();
    const uRes = await fetch(`/api/users${q ? `?${q}` : ""}`);
    const uData = await uRes.json();
    setUsers(uData.users ?? []);
  };

  useEffect(() => {
    load();
  }, [search, roleFilter, activeFilter, projectFilter]);

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

      <div className="mb-4">
        <FilterBar
          filters={[]}
          values={{ role: roleFilter, isActive: activeFilter, projectId: projectFilter }}
          onChange={(key, value) => {
            if (key === "role") setRoleFilter(value);
            if (key === "isActive") setActiveFilter(value);
            if (key === "projectId") setProjectFilter(value);
          }}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name or email..."
          extraSelects={[
            {
              key: "role",
              label: "All roles",
              options: [
                { value: "SALES_EXEC", label: "Sales Executive" },
                { value: "SALES_MANAGER", label: "Sales Manager" },
                { value: "PROJECT_ADMIN", label: "Project Admin" },
                { value: "SUPER_ADMIN", label: "Super Admin" },
              ],
            },
            {
              key: "isActive",
              label: "All statuses",
              options: [
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
            },
            {
              key: "projectId",
              label: "All projects",
              options: projects.map((p) => ({ value: p.id, label: p.name })),
            },
          ]}
          onClearAll={() => {
            setSearch("");
            setRoleFilter("");
            setActiveFilter("");
            setProjectFilter("");
          }}
        />
      </div>

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
                <UserActions
                  onEdit={() => openEdit(u)}
                  onToggleActive={() => toggleActive(u)}
                  isActive={u.isActive}
                />
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
                      <UserActions
                  onEdit={() => openEdit(u)}
                  onToggleActive={() => toggleActive(u)}
                  isActive={u.isActive}
                />
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
          <UserFormFields
            form={form}
            onChange={setForm}
            projects={projects}
            isSuperAdmin={isSuperAdmin}
          />
          <Button className="w-full" disabled={submitting} onClick={handleCreate}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </Modal>

      <Modal open={showAddAdmin} onOpenChange={setShowAddAdmin} title="Add Admin">
        <AddAdminForm
          form={adminForm}
          onChange={setAdminForm}
          projects={projects}
          submitting={submitting}
          onSubmit={handleCreateAdmin}
        />
      </Modal>

      <Modal open={showEdit} onOpenChange={setShowEdit} title="Edit User">
        <div className="space-y-3">
          <UserFormFields
            form={form}
            onChange={setForm}
            projects={projects}
            isSuperAdmin={isSuperAdmin}
            includePasswordDefault={false}
          />
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
              projects={projects}
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
