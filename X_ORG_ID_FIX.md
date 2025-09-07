# Fix: X-Org-Id Header Missing in updateMySettings API Calls

## Problem Description
The `updateMySettings` API calls were receiving 403 errors from the backend because the `X-Org-Id` header was not being included in the requests. This was happening due to a timing issue where the calls were made before the Redux store had the active organization ID set.

## Root Cause Analysis
1. **Timing Issue**: The `updateMySettings` calls in `activeOrgSlice.resolveInitialActiveOrg` thunk were happening before `state.activeOrg.orgId` was set
2. **Missing Context**: The HTTP interceptor in `http.ts` reads `activeOrgId` from Redux store, but during organization resolution, this value is still `null`
3. **API Dependency**: The backend requires `X-Org-Id` header for all organization-scoped operations including user settings updates

## Solution Implemented

### 1. Enhanced UserService.updateMySettings Method
Modified the method to accept an optional `orgId` parameter:

```typescript
async updateMySettings(request: UpdateUserSettingsRequest, orgId?: string): Promise<UserSettings> {
  const config = orgId ? { headers: { 'X-Org-Id': orgId } } : {};
  const response = await http.put<ApiResponse<UserSettings>>("/settings/me", request, config);
  return unwrapApiResponse(response.data);
}
```

### 2. Updated All Call Sites
Modified all components that call `updateMySettings` to explicitly pass the `orgId`:

**activeOrgSlice.ts:**
- `resolveInitialActiveOrg`: Pass the orgId when setting default org for single-org users
- `selectOrgAndFinalize`: Pass the orgId when finalizing org selection

**OrgPickerModal.tsx:**
- Pass `selectedOrgId` when updating user preferences

**OrgSelector.tsx:**
- Pass the target `orgId` when switching organizations

**OrganizationPreferences.tsx:**
- Pass the relevant `orgId` when updating default org or choice mode

### 3. Debug Logging
Added debug logging to track when `X-Org-Id` headers are being sent:
- Set `VITE_DEBUG_ORG_REQUESTS=true` in `.env`
- HTTP interceptor logs all requests with header status
- Debug component shows whether org context is available

## Files Modified
1. `src/api/user.service.ts` - Enhanced updateMySettings method
2. `src/store/activeOrgSlice.ts` - Updated thunk calls
3. `src/components/OrgPickerModal.tsx` - Updated settings calls
4. `src/components/OrgSelector.tsx` - Updated settings calls  
5. `src/components/OrganizationPreferences.tsx` - Updated settings calls
6. `src/components/DebugActiveOrg.tsx` - Added header status indicator
7. `.env` - Added debug flag

## Benefits
- ✅ **Fixes 403 Errors**: All `updateMySettings` calls now include proper `X-Org-Id` header
- ✅ **Robust Organization Resolution**: Handles timing issues during org context establishment  
- ✅ **Consistent API Behavior**: All organization-scoped calls follow same header pattern
- ✅ **Better Debugging**: Debug logging helps identify header issues
- ✅ **Future-Proof**: Explicit orgId passing prevents similar issues with new features

## Testing
1. **Single Organization Users**: Default org setting during first login
2. **Multi-Organization Users**: Org picker and preference updates  
3. **Organization Switching**: Changing active org through selector
4. **Settings Page**: Updating org preferences and choice mode

The fix ensures that all user settings API calls include the required `X-Org-Id` header, preventing 403 errors and enabling proper multi-organization functionality.
