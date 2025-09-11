// src/store/permissionsCatalogSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { PermissionsService, PermissionsCatalog } from '../api/permissions.service';
import { initializePermissions } from '../constants/permissions';

interface PermissionsCatalogState {
  data: PermissionsCatalog | null;
  loading: boolean;
  error: string | null;
  categories: any[];
  permissionsMap: Record<string, Record<string, string>>;
  allPermissions: string[];
}

const initialState: PermissionsCatalogState = {
  data: null,
  loading: false,
  error: null,
  categories: [],
  permissionsMap: {},
  allPermissions: [],
};

// Fetch permissions catalog and initialize dynamic permissions
export const fetchCatalog = createAsyncThunk(
  'permissionsCatalog/fetchCatalog',
  async (_, { getState, rejectWithValue }) => {
    try {
      // Check if already loaded to avoid unnecessary requests
      const state = getState() as any;
      if (state.permissionsCatalog.categories.length > 0) {
        return state.permissionsCatalog;
      }

      const response = await PermissionsService.getCatalog();
      
      // Initialize the global permissions object
      initializePermissions(response);
      
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
        state.data = action.payload;
        state.categories = action.payload.categories || [];
        state.permissionsMap = action.payload.permissions || {};
        state.allPermissions = action.payload.allPermissions || [];
        state.error = null;
      })
      .addCase(fetchCatalog.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = permissionsCatalogSlice.actions;

// Selectors
export const selectPermissionsCatalog = (state: any) => state.permissionsCatalog.data;
export const selectPermissionsCatalogLoading = (state: any) => state.permissionsCatalog.loading;
export const selectPermissionsCatalogError = (state: any) => state.permissionsCatalog.error;
export const selectPermissionsCategories = (state: any) => state.permissionsCatalog.categories;
export const selectAllPermissions = (state: any) => state.permissionsCatalog.allPermissions;
export const selectPermissionsMap = (state: any) => state.permissionsCatalog.permissionsMap;

export default permissionsCatalogSlice.reducer;
