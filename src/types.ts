export type UserRole = 'admin' | 'supervisor' | 'employee' | 'pending';

export interface RolePermissions {
  canViewAllSheets: boolean;
  canApproveTransactions: boolean;
  canAddTransactionsToOthers: boolean;
  canDeleteTransactions: boolean;
  canManageUsers: boolean;
}

export type PermissionsConfig = Record<'admin' | 'supervisor' | 'employee', RolePermissions>;

export interface UserProfile {
  uid: string;
  name: string;
  jobNumber: string;
  email: string;
  role: UserRole;
  createdAt: string;
  password?: string;
  allowDelete?: boolean;
}

export interface Transaction {
  id: string;
  date: string; // Format: YYYY-MM-DD or standard date string
  notes: string;
  custody: number; // العهدة
  allowance: number; // البدل
  addedBy: string; // User UID who created this entry
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string; // ISO date string
}
