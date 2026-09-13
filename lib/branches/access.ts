/** `null` representa acceso total (ADMIN); una lista limita por sucursal. */
export function isBranchAllowed(
  allowedBranchIds: string[] | null,
  branchId: string,
): boolean {
  return allowedBranchIds === null || allowedBranchIds.includes(branchId);
}
