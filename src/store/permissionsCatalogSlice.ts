// src/store/permissionsCatalogSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { PermissionsService, PermissionsCatalog } from '../api/permissions.service';

interface PermissionsCatalogState {
  loading: boolean;
  error: string | null;
  categories: any[];
  permissionsMap: Record<string, Record<string, string>>;
  allPermissions: string[];
}

const initialState: PermissionsCatalogState = {
  loading: false,
  error: null,
  categories: [],
  permissionsMap: {},
  allPermissions: [],
};

// Thunks
export const fetchCatalog = createAsyncThunk(
  'permissionsCatalog/fetchCatalog',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as any;
    
    // Skip if already loaded
    if (state.permissionsCatalog.categories.length > 0) {
      return state.permissionsCatalog;
    }

    try {
      const response = await PermissionsService.getCatalog();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch permissions catalog');
    }
  }
);

const permissionsCatalogSlice = createSlice({
  name: 'permissionsCatalog',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCatalog.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCatalog.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload.categories;
        state.permissionsMap = action.payload.permissions;
        state.allPermissions = action.payload.allPermissions;
      })
      .addCase(fetchCatalog.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = permissionsCatalogSlice.actions;
export default permissionsCatalogSlice.reducer;

// Selectors
export const selectPermissionsCategories = (state: any) => state.permissionsCatalog?.categories || [];
export const selectPermissionsMap = (state: any) => state.permissionsCatalog?.permissionsMap || {};
export const selectAllPermissions = (state: any) => state.permissionsCatalog?.allPermissions || [];
export const selectPermissionsCatalogLoading = (state: any) => state.permissionsCatalog?.loading || false;
export const selectPermissionsCatalogError = (state: any) => state.permissionsCatalog?.error || null;
