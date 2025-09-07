// src/store/rolePermissionsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RolePermissionsResponse, RolesService } from '../api/roles.service';
import { UserRole } from '../types/User';

interface RolePermissionsState {
  data: RolePermissionsResponse | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: RolePermissionsState = {
  data: null,
  loading: false,
  error: null,
  lastFetched: null,
};

// Cache for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export const fetchRolePermissions = createAsyncThunk(
  'rolePermissions/fetch',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as any;
    const currentTime = Date.now();
    
    // Check if we have cached data that's still valid
    if (
      state.rolePermissions.data && 
      state.rolePermissions.lastFetched &&
      (currentTime - state.rolePermissions.lastFetched) < CACHE_DURATION
    ) {
      return state.rolePermissions.data;
    }

    try {
      const data = await RolesService.getRolePermissions();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch role permissions');
    }
  }
);

const rolePermissionsSlice = createSlice({
  name: 'rolePermissions',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRolePermissions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRolePermissions.fulfilled, (state, action: PayloadAction<RolePermissionsResponse>) => {
        state.loading = false;
        state.data = action.payload;
        state.lastFetched = Date.now();
        state.error = null;
      })
      .addCase(fetchRolePermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = rolePermissionsSlice.actions;

// Selectors
export const selectRolePermissions = (state: any) => state.rolePermissions.data;
export const selectRolePermissionsLoading = (state: any) => state.rolePermissions.loading;
export const selectRolePermissionsError = (state: any) => state.rolePermissions.error;

export const selectPermissionsForRole = (role: UserRole) => (state: any) => {
  const rolePermissions = state.rolePermissions.data;
  if (!rolePermissions) return [];
  
  return RolesService.getPermissionsForRole(rolePermissions, role);
};

export default rolePermissionsSlice.reducer;
