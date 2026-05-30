"use client";

import { Button, Input, Label } from "@booking/ui";

export interface UserFormState {
  email: string;
  name: string;
  password: string;
  role: string;
  projectIds: string[];
  isActive: boolean;
}

export interface AdminFormState {
  email: string;
  name: string;
  password: string;
  role: "PROJECT_ADMIN" | "SUPER_ADMIN";
  projectIds: string[];
}

interface ProjectCheckboxesProps {
  projects: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ProjectCheckboxes({ projects, selectedIds, onChange }: ProjectCheckboxesProps) {
  return (
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
      {projects.length === 0 && <p className="text-sm text-gray-400">No projects available</p>}
    </div>
  );
}

interface UserFormFieldsProps {
  form: UserFormState;
  onChange: (form: UserFormState) => void;
  projects: Array<{ id: string; name: string }>;
  isSuperAdmin: boolean;
  includePasswordDefault?: boolean;
}

export function UserFormFields({
  form,
  onChange,
  projects,
  isSuperAdmin,
  includePasswordDefault = true,
}: UserFormFieldsProps) {
  return (
    <>
      <div>
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
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
          onChange={(e) => onChange({ ...form, password: e.target.value })}
        />
      </div>
      <div>
        <Label>Role</Label>
        <select
          className="w-full rounded-lg border p-2"
          value={form.role}
          onChange={(e) => onChange({ ...form, role: e.target.value })}
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
          projects={projects}
          selectedIds={form.projectIds}
          onChange={(projectIds) => onChange({ ...form, projectIds })}
        />
      </div>
      {!includePasswordDefault && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
      )}
    </>
  );
}

interface AddAdminFormProps {
  form: AdminFormState;
  onChange: (form: AdminFormState) => void;
  projects: Array<{ id: string; name: string }>;
  submitting: boolean;
  onSubmit: () => void;
}

export function AddAdminForm({ form, onChange, projects, submitting, onSubmit }: AddAdminFormProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Admin accounts can access the Admin Panel. Choose Super Admin for full access or Project
        Admin for assigned projects only.
      </p>
      <div>
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <Label>Password</Label>
        <Input
          type="password"
          value={form.password}
          placeholder="Min 8 characters"
          onChange={(e) => onChange({ ...form, password: e.target.value })}
        />
      </div>
      <div>
        <Label>Role</Label>
        <select
          className="w-full rounded-lg border p-2"
          value={form.role}
          onChange={(e) =>
            onChange({ ...form, role: e.target.value as "PROJECT_ADMIN" | "SUPER_ADMIN" })
          }
        >
          <option value="PROJECT_ADMIN">Project Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>
      {form.role === "PROJECT_ADMIN" && (
        <div>
          <Label>Assigned Projects</Label>
          <ProjectCheckboxes
            projects={projects}
            selectedIds={form.projectIds}
            onChange={(projectIds) => onChange({ ...form, projectIds })}
          />
        </div>
      )}
      <Button className="w-full" disabled={submitting} onClick={onSubmit}>
        {submitting ? "Creating..." : "Create Admin"}
      </Button>
    </div>
  );
}

interface UserActionsProps {
  onEdit: () => void;
  onToggleActive: () => void;
  isActive: boolean;
}

export function UserActions({ onEdit, onToggleActive, isActive }: UserActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={onEdit}>
        Edit
      </Button>
      <Button size="sm" variant="outline" onClick={onToggleActive}>
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}
