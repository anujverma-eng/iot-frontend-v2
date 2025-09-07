// src/utils/organizationUtils.ts

import { MembershipDTO } from '../api/user.service';

/**
 * Check if user owns at least one organization
 * @param memberships Array of user's organization memberships
 * @returns true if user owns at least one org, false otherwise
 */
export const userOwnsOrganization = (memberships: MembershipDTO[] = []): boolean => {
  return memberships.some(membership => membership.role === 'owner');
};

/**
 * Get all organizations owned by the user
 * @param memberships Array of user's organization memberships
 * @returns Array of owned organizations
 */
export const getUserOwnedOrganizations = (memberships: MembershipDTO[] = []): MembershipDTO[] => {
  return memberships.filter(membership => membership.role === 'owner');
};

/**
 * Check if user can create an organization
 * User can create if they don't own any organization yet
 * @param memberships Array of user's organization memberships
 * @returns true if user can create org, false otherwise
 */
export const canUserCreateOrganization = (memberships: MembershipDTO[] = []): boolean => {
  return !userOwnsOrganization(memberships);
};
