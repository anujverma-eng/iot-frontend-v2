# Organization Creation Flow

## Overview
Users who don't own any organization can now create their own organization directly from the navbar. This addresses the scenario where users have memberships in other organizations but haven't created their own organization yet.

## Flow Description

### Trigger Condition
- User has memberships but **none** with `role: "owner"`
- This indicates they can join other organizations but don't have their own

### UI Changes

#### 1. Single Organization View
When user has ≤1 membership and doesn't own any org:
- **Before**: Shows simple chip with org name
- **After**: Shows "Create Organization" button (warning color to draw attention)

#### 2. Multi-Organization Dropdown
When user has multiple memberships and doesn't own any org:
- **New**: Adds "Create Organization" option at the top of the dropdown (blue highlight)
- **Existing**: Retains "Manage Organizations" option

### Organization Creation Process

1. **User clicks "Create Organization"**
   - Opens `CreateOrganizationModal`
   - Simple form with organization name input
   - Validation for name format and length

2. **Organization Creation** (`createOrgAndActivate` thunk)
   - Creates organization via `POST /organizations`
   - User automatically becomes owner of new org
   - Refetches user profile to get updated memberships
   - Sets new org as active organization
   - Updates user settings to remember new org as default

3. **Post-Creation State**
   - New org becomes active immediately
   - User can now manage sensors, gateways, etc. in their own org
   - Navbar updates to show new org name
   - User no longer sees "Create Organization" option (since they now own an org)

## Technical Implementation

### New Components
- `CreateOrganizationModal`: Reusable modal for org creation
- `organizationUtils`: Utility functions for ownership checks

### Enhanced Components
- `OrgSelector`: Conditionally shows create option based on ownership
- `activeOrgSlice`: New `createOrgAndActivate` thunk for streamlined flow

### Utility Functions
```typescript
canUserCreateOrganization(memberships) // Returns true if user owns no orgs
userOwnsOrganization(memberships)      // Returns true if user owns any org
getUserOwnedOrganizations(memberships) // Returns array of owned orgs
```

### API Integration
- Leverages existing `POST /organizations` endpoint
- Uses existing user settings API for preference management
- Maintains X-Org-Id header consistency

## User Experience

### Before Implementation
- User with no owned orgs had no clear path to create one
- Had to navigate to separate onboarding or management pages
- Unclear how to transition from member to owner

### After Implementation
- **Immediate visibility**: Create option prominently displayed in navbar
- **Single click access**: No navigation required
- **Seamless activation**: New org becomes active immediately
- **Smart defaults**: Automatically sets as preferred org

## Edge Cases Handled

1. **No Memberships**: Handled by existing onboarding flow
2. **Single Membership (Non-Owner)**: Shows create button
3. **Multiple Memberships (No Owner)**: Shows create option in dropdown
4. **Already Owns Organization**: No create option shown
5. **Organization Creation Failure**: Error handling with user feedback

## Benefits

- **Improved User Journey**: Clear path to organization ownership
- **Reduced Friction**: In-context creation without navigation
- **Better Adoption**: Encourages users to create their own organizations
- **Consistent UX**: Integrates seamlessly with existing multi-org flow

## Future Enhancements

1. **Organization Templates**: Pre-configured settings for different industries
2. **Team Invitations**: Invite team members during creation
3. **Billing Integration**: Subscription setup during org creation
4. **Organization Transfer**: Transfer ownership between users
