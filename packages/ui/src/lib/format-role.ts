export function formatRole(role?: string) {
  if (!role) return "Unknown";
  return role
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}
