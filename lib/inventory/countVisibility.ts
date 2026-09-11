export function canViewInventoryCountSystemData(role: string): boolean {
  return role === "ADMIN";
}
