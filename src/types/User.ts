export enum UserRole {
  OWNER   = 'owner',
  ADMIN   = 'admin',
  MEMBER  = 'member',
  VIEWER  = 'viewer',
}

/** What we keep in Redux once a user is authenticated */
export interface AuthUser {
  email : string;
  role  : UserRole;
  orgId?: string;
  emailVerified: boolean;
  features: string[];
}