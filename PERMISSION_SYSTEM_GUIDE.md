# Permission System Implementation Guide

## 🚀 Complete Permission System Setup

This guide shows how to implement the comprehensive permission system in your IoT platform.

## 📁 Files Created

### Core System Files
- `src/constants/permissions.ts` - Permission constants and route mappings
- `src/utils/permissions.ts` - Utility functions for permission checks
- `src/hooks/usePermissions.ts` - Custom hooks for permission management
- `src/components/PermissionWrapper.tsx` - Component-level permission wrapper
- `src/components/PermissionGuard.tsx` - Page-level permission guard
- `src/components/ProtectedRoute.tsx` - Route protection component
- `src/routes/PermissionProtectedRoute.tsx` - Route-level permission protection

### Enhanced Files
- `src/store/profileSlice.ts` - Added permission selectors
- `src/store/activeOrgSlice.ts` - Fixed profile refresh on org switch

## 🔧 How to Implement

### 1. Update Your Router

Replace your current dashboard routes with permission-protected versions:

```tsx
// In your router.tsx file
import { ProtectedRoute } from "../components/ProtectedRoute";
import { PERMISSIONS } from "../constants/permissions";

// Example: Protect sensors route
<Route 
  path="sensors" 
  element={
    <ProtectedRoute permission={PERMISSIONS.SENSORS.VIEW}>
      <SensorsPage />
    </ProtectedRoute>
  } 
/>

// Example: Protect team management
<Route 
  path="team" 
  element={
    <ProtectedRoute permission={PERMISSIONS.TEAMS.VIEW_MEMBERS}>
      <TeamPage />
    </ProtectedRoute>
  } 
/>
```

### 2. Add Permissions to Your Components

#### Basic Permission Wrapping
```tsx
import { PermissionWrapper } from "../components/PermissionWrapper";
import { PERMISSIONS } from "../constants/permissions";

// Hide/show buttons based on permissions
<PermissionWrapper permission={PERMISSIONS.SENSORS.CREATE}>
  <Button>Add Sensor</Button>
</PermissionWrapper>

// Show disabled state for unauthorized users
<PermissionWrapper 
  permission={PERMISSIONS.SENSORS.DELETE}
  fallback={<Button isDisabled>Delete</Button>}
  showFallback={true}
>
  <Button color="danger">Delete</Button>
</PermissionWrapper>
```

#### Using Permission Hooks
```tsx
import { usePermissions } from "../hooks/usePermissions";
import { PERMISSIONS } from "../constants/permissions";

const MyComponent = () => {
  const { hasPermission, hasAnyPermission } = usePermissions();
  
  const canViewLive = hasPermission(PERMISSIONS.SENSORS.LIVE);
  const canManageTeam = hasAnyPermission([
    PERMISSIONS.TEAMS.MANAGE_ROLES,
    PERMISSIONS.TEAMS.MANAGE_PERMISSIONS
  ]);
  
  return (
    <div>
      {canViewLive && <LiveDataButton />}
      {canManageTeam && <ManageTeamButton />}
    </div>
  );
};
```

### 3. Protect Your Pages

#### Automatic Route Protection
```tsx
// Your page will automatically be protected based on route
const SensorsPage = () => {
  // This page is automatically protected by /dashboard/sensors route permissions
  return <div>Sensors content</div>;
};
```

#### Manual Page Protection
```tsx
import { PermissionGuard } from "../components/PermissionGuard";

const CustomPage = () => {
  return (
    <PermissionGuard permission={PERMISSIONS.SENSORS.VIEW} pageName="Sensors">
      <div>Your sensor content here</div>
    </PermissionGuard>
  );
};
```

## 🎯 Implementation Priorities

### Phase 1: Critical Security Fix ✅
- [x] Fixed profile refresh on organization switch
- [x] Ensured currentOrg permissions update when switching

### Phase 2: Core Infrastructure ✅
- [x] Permission constants and utilities
- [x] Permission hooks and selectors
- [x] Basic wrapper components

### Phase 3: Route Protection (Next)
1. Update your router.tsx with ProtectedRoute components
2. Add route permissions to critical pages

### Phase 4: Component-Level Protection (Next)
1. Add PermissionWrapper to sensitive buttons/actions
2. Implement conditional UI based on permissions
3. Add fallback states for unauthorized users

### Phase 5: Advanced Features (Later)
1. Permission-based navigation menus
2. Dynamic permission loading
3. Permission audit logging

## 🔍 Permission Categories

### Navigation & Pages
- `home.view` - Access to home page
- `dashboard.view` - Access to dashboard
- `sensors.view` - Access to sensors page
- `gateways.view` - Access to gateways page
- `teams.view.members` - Access to team page
- `settings.view` - Access to settings

### Sensor Management
- `sensors.live` - View live sensor data
- `sensors.add` - Create new sensors
- `sensors.update` - Edit sensor properties
- `sensors.delete` - Delete sensors

### Gateway Management
- `gateways.details` - View gateway details
- `gateways.add` - Add new gateways
- `gateways.update` - Edit gateway properties
- `gateways.delete` - Delete gateways

### Team Management
- `teams.remove.members` - Remove team members
- `teams.roles` - Manage user roles
- `teams.permissions` - Manage user permissions

### Invitation Management
- `invites.view` - View invitations
- `invites.create` - Send invitations
- `invites.revoke` - Revoke invitations

### Settings
- `settings.rename_org` - Rename organization
- `settings.update_sensor_offline_time` - Update sensor settings

## 🛡️ Security Best Practices

1. **Always check permissions on both frontend and backend**
2. **Use PermissionWrapper for UI elements**
3. **Use ProtectedRoute for page access**
4. **Provide clear feedback for denied access**
5. **Test with different user roles**

## 🧪 Testing Your Implementation

1. **Create test users with different permissions**
2. **Verify route protection works**
3. **Test organization switching updates permissions**
4. **Ensure fallback states display correctly**
5. **Check that denied pages show proper error messages**

## 📝 Migration Checklist

- [ ] Update router with ProtectedRoute components
- [ ] Add PermissionWrapper to sensitive UI elements
- [ ] Replace role-based checks with permission-based checks
- [ ] Test all user roles and permission combinations
- [ ] Update navigation to respect permissions
- [ ] Add fallback states for denied access
- [ ] Verify organization switching updates permissions correctly

## 🎨 Customization

You can customize the permission denied page, fallback components, and error messages by modifying:
- `PermissionGuard.tsx` - Page-level denied access UI
- `PermissionWrapper.tsx` - Component-level fallback rendering
- `permissions.ts` - Permission constants and mappings

The system is designed to be flexible and extensible for future permission requirements.
