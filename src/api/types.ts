// src/api/types.ts
import { UserRole } from '../types/User';

export interface ApiResponse<T> {
  status: number;
  success: boolean;
  message: string;
  data: T | null;
  from: 'iot-backend';
  error: unknown | null;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Team Management Types
export interface Member {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  permissions?: Record<string, string>;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    profileImage?: string;
    lastActiveAt?: string;
  };
}

export enum InviteStatus {
  CREATED = 'CREATED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  BOUNCED = 'BOUNCED',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  DECLINED = 'DECLINED'
}

export interface Invite {
  _id: string;
  id?: string; // For backward compatibility
  email: string;
  role: UserRole;
  status: InviteStatus;
  orgId: {
    _id: string;
    name: string;
  };
  allow: string[];
  deny: string[];
  token: string;
  invitedBy: string | {
    _id: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  revokedAt?: string;
  deliveryAt?: string;
  lastEmailMessageId?: string;
  __v?: number;
}

export interface Permission {
  key: string;
  name: string;
  description: string;
  category: string;
}

/**
 * Unwraps the backend's enveloped response format
 * @param response The enveloped API response
 * @returns The unwrapped data if successful
 * @throws Error if the response indicates failure
 */
export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (response.success && response.data !== null) {
    return response.data;
  }
  
  // Determine the best error message to throw
  const errorMessage = response.message || 
                      (response.error ? String(response.error) : 'API request failed');
  throw new Error(errorMessage);
}
