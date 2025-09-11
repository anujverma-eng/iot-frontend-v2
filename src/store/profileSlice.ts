// src/store/profileSlice.ts
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { MeDTO, UserService } from '../api/user.service';

export const fetchProfile = createAsyncThunk('profile/fetch', () =>
  UserService.me(),
);

interface State {
  loading: boolean;
  loaded : boolean;
  error  : string | null;
  data   : MeDTO | null;
}
const initial: State = { loading: false, loaded: false, error: null, data: null };

const slice = createSlice({
  name: 'profile',
  initialState: initial,
  reducers: {
    clear: () => initial,
  },
  extraReducers: b => {
    b.addCase(fetchProfile.pending,  s => { s.loading = true;  s.error = null; });
    b.addCase(fetchProfile.rejected, (s,a)=>{ s.loading = false; s.error = a.error.message??'Error';});
    b.addCase(fetchProfile.fulfilled,(s,a)=>{
      s.loading = false;
      s.loaded  = true;
      s.data    = a.payload;
    });
  },
});

// Base selectors
const selectActiveOrgId = (state: any) => state.activeOrg?.orgId;
const selectActiveOrgStatus = (state: any) => state.activeOrg?.status;
const selectProfileData = (state: any) => state.profile.data;
const selectProfileLoaded = (state: any) => state.profile.loaded;
const selectProfileLoading = (state: any) => state.profile.loading;

// Memoized Permission Selectors
export const selectCurrentUserPermissions = createSelector(
  [selectActiveOrgId, selectProfileData, selectActiveOrgStatus, selectProfileLoaded],
  (activeOrgId, profileData, activeOrgStatus, profileLoaded) => {
    // Don't return permissions if profile isn't loaded or org isn't resolved
    if (!profileLoaded || activeOrgStatus === 'resolving' || activeOrgStatus === 'idle') {
      return [];
    }
    
    if (!activeOrgId) {
      return [];
    }
    
    const memberships = profileData?.memberships || [];
    const membership = memberships.find((m: any) => m.orgId === activeOrgId);
    return membership?.permissions?.effective || [];
  }
);

export const selectCurrentUserRole = createSelector(
  [selectActiveOrgId, selectProfileData, selectActiveOrgStatus, selectProfileLoaded],
  (activeOrgId, profileData, activeOrgStatus, profileLoaded) => {
    if (!profileLoaded || activeOrgStatus === 'resolving' || activeOrgStatus === 'idle') {
      return null;
    }
    
    if (!activeOrgId) return null;
    
    const memberships = profileData?.memberships || [];
    const membership = memberships.find((m: any) => m.orgId === activeOrgId);
    return membership?.role || null;
  }
);

// Loading state selector
export const selectPermissionsLoading = createSelector(
  [selectProfileLoading, selectActiveOrgStatus, selectProfileLoaded],
  (profileLoading, activeOrgStatus, profileLoaded) => {
    return profileLoading || !profileLoaded || activeOrgStatus === 'resolving' || activeOrgStatus === 'idle';
  }
);

export const selectUserPermissionsForOrg = (orgId: string) => (state: any): string[] => {
  const membership = state.profile.data?.memberships?.find((m: any) => m.orgId === orgId);
  return membership?.permissions?.effective || [];
};

export const selectAllUserMemberships = (state: any) => {
  return state.profile.data?.memberships || [];
};

export const selectCurrentOrgMembership = (state: any) => {
  const currentOrgId = state.activeOrg?.orgId;
  const memberships = state.profile.data?.memberships || [];
  return memberships.find((m: any) => m.orgId === currentOrgId) || null;
};

export default slice.reducer;
