// src/store/activeOrgSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserService, UserSettings } from '../api/user.service';
import { OrgService } from '../api/org.service';
import { fetchProfile } from './profileSlice';
import { createOrg } from './orgSlice';

interface ActiveOrgState {
  status: 'idle' | 'resolving' | 'ready' | 'error';
  orgId: string | null;
  orgName: string;
  error: string | null;
  showOrgPicker: boolean;
}

const initial: ActiveOrgState = {
  status: 'idle',
  orgId: null,
  orgName: '',
  error: null,
  showOrgPicker: false,
};

/* ---------- Thunks ---------- */
export const resolveInitialActiveOrg = createAsyncThunk(
  'activeOrg/resolveInitial',
  async (_, { getState, dispatch }) => {
    const state = getState() as any;
    
    // 1. Ensure profile is loaded
    if (!state.profile.loaded) {
      await dispatch(fetchProfile()).unwrap();
    }
    
    // Get updated state after profile fetch
    const updatedState = getState() as any;
    const memberships = updatedState.profile.data?.memberships || [];
    
    // 2. If no memberships, leave idle (onboarding will redirect)
    if (memberships.length === 0) {
      return { type: 'no-memberships' as const };
    }
    
    // 3. Get user settings to check for default org
    let userSettings: UserSettings;
    try {
      userSettings = await UserService.getMySettings();
    } catch (error) {
      // If no settings exist, create default
      userSettings = {
        userId: updatedState.profile.data?.user.id || '',
        orgChoiceMode: 'remember'
      };
    }
    
    // 4. Decide the org
    if (memberships.length === 1) {
      // Exactly one membership - pick it and finalize
      const orgId = memberships[0].orgId;
      const orgName = memberships[0].orgName;
      
      // Check if no default org set (handle both string and object cases)
      const hasDefaultOrg = userSettings.defaultOrgId && (
        typeof userSettings.defaultOrgId === 'string' 
          ? userSettings.defaultOrgId 
          : (userSettings.defaultOrgId as any)?._id || (userSettings.defaultOrgId as any)?.id
      );
      
      if (!hasDefaultOrg) {
        await UserService.updateMySettings({
          defaultOrgId: orgId,
          orgChoiceMode: 'remember'
        }, orgId); // Pass orgId explicitly for X-Org-Id header
      }
      
      return { type: 'single-org' as const, orgId, orgName };
    } else {
      // Multiple memberships
      // Handle case where backend returns defaultOrgId as object instead of string
      const defaultOrgId = typeof userSettings.defaultOrgId === 'string' 
        ? userSettings.defaultOrgId 
        : (userSettings.defaultOrgId as any)?._id || (userSettings.defaultOrgId as any)?.id;
      
      if (defaultOrgId && 
          memberships.some((m: any) => m.orgId === defaultOrgId)) {
        // Valid default org exists - find the org name
        const membership = memberships.find((m: any) => m.orgId === defaultOrgId);
        const orgName = membership?.orgName || '';
        
        return { type: 'default-org' as const, orgId: defaultOrgId, orgName };
      } else {
        // Need to show picker
        return { type: 'needs-picker' as const };
      }
    }
  }
);

export const selectOrgAndFinalize = createAsyncThunk(
  'activeOrg/selectAndFinalize',
  async (params: string | { orgId: string, rememberChoice?: boolean }, { getState, dispatch }) => {
    // Handle both legacy string parameter and new object parameter
    const orgId = typeof params === 'string' ? params : params.orgId;
    const rememberChoice = typeof params === 'object' ? params.rememberChoice : undefined;
    
    // Ensure orgId is a string
    const orgIdStr = typeof orgId === 'string' ? orgId : String(orgId);
    
    // Get current user settings to understand their preference
    let shouldUpdateSettings = false;
    
    if (rememberChoice !== undefined) {
      // This call is from org picker modal - respect the user's explicit choice
      shouldUpdateSettings = rememberChoice;
    } else {
      // This call is from org selector dropdown - check existing user preference
      try {
        const currentSettings = await UserService.getMySettings();
        shouldUpdateSettings = currentSettings.orgChoiceMode === 'remember';
      } catch (error) {
        shouldUpdateSettings = false;
      }
    }
    
    // Only set as default if user wants to remember their choice
    if (shouldUpdateSettings) {
      await UserService.updateMySettings({
        defaultOrgId: orgIdStr,
        orgChoiceMode: 'remember'
      }, orgIdStr); // Pass orgId explicitly for X-Org-Id header
    }
    // If shouldUpdateSettings is false, don't update settings - just proceed with org selection
    
    // Get org name from profile memberships
    const state = getState() as any;
    const memberships = state.profile.data?.memberships || [];
    const membership = memberships.find((m: any) => m.orgId === orgIdStr);
    const orgName = membership?.orgName || '';
    
    await dispatch(fetchProfile()).unwrap();
    
    return { orgId: orgIdStr, orgName };
  }
);

export const createOrgAndActivate = createAsyncThunk(
  'activeOrg/createOrgAndActivate',
  async (orgName: string, { dispatch }) => {
    // 1. Create the organization
    const newOrg = await dispatch(createOrg(orgName)).unwrap();
    
    // 2. Refetch profile to get updated memberships with the new org
    await dispatch(fetchProfile()).unwrap();
    
    // 3. Set the newly created org as active (user is owner so no X-Org-Id needed for settings)
    const orgId = typeof newOrg._id === 'string' ? newOrg._id : String(newOrg._id);
    
    await UserService.updateMySettings({
      defaultOrgId: orgId,
      orgChoiceMode: 'remember'
    }, orgId);
    
    return { 
      orgId: orgId, 
      orgName: newOrg.name 
    };
  }
);

/* ---------- Slice ---------- */
const activeOrgSlice = createSlice({
  name: 'activeOrg',
  initialState: initial,
  reducers: {
    setOrgId: (state, action: PayloadAction<string | null>) => {
      state.orgId = action.payload;
    },
    setOrgName: (state, action: PayloadAction<string>) => {
      state.orgName = action.payload;
    },
    setStatus: (state, action: PayloadAction<ActiveOrgState['status']>) => {
      state.status = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clear: () => initial,
  },
  extraReducers: (builder) => {
    /* ── resolveInitialActiveOrg ─────────────────────────────────── */
    builder.addCase(resolveInitialActiveOrg.pending, (state) => {
      state.status = 'resolving';
      state.error = null;
      state.showOrgPicker = false;
    });
    builder.addCase(resolveInitialActiveOrg.fulfilled, (state, action) => {
      const result = action.payload;
      
      if (result.type === 'no-memberships') {
        state.status = 'ready'; // Mark as ready (resolution complete)
        state.orgId = null;
        state.showOrgPicker = false;
        return;
      }
      
      if (result.type === 'needs-picker') {
        state.status = 'resolving'; // Stay in resolving until picker selects
        state.showOrgPicker = true; // Show the org picker modal
        return;
      }
      
      // Single org or default org - complete immediately
      if (result.type === 'single-org' || result.type === 'default-org') {
        state.orgId = result.orgId || null;
        state.orgName = result.orgName || '';
        state.status = 'ready';
        state.error = null;
        state.showOrgPicker = false;
      }
    });
    builder.addCase(resolveInitialActiveOrg.rejected, (state, action) => {
      state.status = 'error';
      state.error = action.error.message || 'Failed to resolve initial org';
      state.showOrgPicker = false;
    });
    
    /* ── selectOrgAndFinalize ─────────────────────────────────── */
    builder.addCase(selectOrgAndFinalize.pending, (state) => {
      state.status = 'resolving';
    });
    builder.addCase(selectOrgAndFinalize.fulfilled, (state, action) => {
      state.orgId = action.payload.orgId;
      state.orgName = action.payload.orgName;
      state.status = 'ready';
      state.error = null;
      state.showOrgPicker = false; // Hide picker after selection
    });
    builder.addCase(selectOrgAndFinalize.rejected, (state, action) => {
      state.status = 'error';
      state.error = action.error.message || 'Failed to finalize org selection';
      state.showOrgPicker = false;
    });

    /* ── createOrgAndActivate ──────────────────────────────────── */
    builder.addCase(createOrgAndActivate.pending, (state) => {
      state.status = 'resolving';
    });
    builder.addCase(createOrgAndActivate.fulfilled, (state, action) => {
      state.orgId = action.payload.orgId;
      state.orgName = action.payload.orgName;
      state.status = 'ready';
      state.error = null;
      state.showOrgPicker = false; // Hide picker after org creation
    });
    builder.addCase(createOrgAndActivate.rejected, (state, action) => {
      state.status = 'error';
      state.error = action.error.message || 'Failed to create organization';
      state.showOrgPicker = false;
    });
  },
});

export const { setOrgId, setOrgName, setStatus, setError, clear } = activeOrgSlice.actions;
export default activeOrgSlice.reducer;

/* ─────────────────  selectors  ─────────────────── */
export const selectActiveOrgId = (state: any) => state.activeOrg.orgId;
export const selectActiveOrgReady = (state: any) => 
  state.activeOrg.status === 'ready' && !!state.activeOrg.orgId;
export const selectActiveOrgName = (state: any) => state.activeOrg.orgName;
export const selectActiveOrgStatus = (state: any) => state.activeOrg.status;
export const selectShowOrgPicker = (state: any) => state.activeOrg.showOrgPicker;
