// src/store/membersSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { MembersService, MembershipWithUser, MembersListParams } from '../api/members.service';
import { UserRole } from '../types/User';
import { selectActiveOrgReady, selectActiveOrgId } from './activeOrgSlice';

interface MembersState {
  rows: MembershipWithUser[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
  };
  loading: boolean;
  error: string | null;
  query: {
    search: string;
    sort: string;
    dir: 'asc' | 'desc';
    limit: number;
  };
  updatingId: string | null;
  deletingId: string | null;
}

const initialState: MembersState = {
  rows: [],
  pagination: {
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 20,
  },
  loading: false,
  error: null,
  query: {
    search: '',
    sort: 'createdAt',
    dir: 'desc',
    limit: 20,
  },
  updatingId: null,
  deletingId: null,
};

// Thunks
export const fetchMembers = createAsyncThunk(
  'members/fetchMembers',
  async (params: Partial<MembersListParams> = {}, { getState, rejectWithValue }) => {
    const state = getState() as any;
    
    if (!selectActiveOrgReady(state)) {
      return rejectWithValue('Organization not ready');
    }

    const orgId = selectActiveOrgId(state);
    const currentQuery = state.members.query;
    
    const searchParams = {
      page: params.page ?? state.members.pagination.page,
      limit: params.limit ?? currentQuery.limit,
      search: params.search ?? currentQuery.search,
      sort: params.sort ?? currentQuery.sort,
      dir: params.dir ?? currentQuery.dir,
    };

    try {
      const response = await MembersService.list(orgId, searchParams);
      return { ...response, searchParams };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch members');
    }
  }
);

export const changeRole = createAsyncThunk(
  'members/changeRole',
  async (
    { membershipId, role, permissions }: { 
      membershipId: string; 
      role: UserRole; 
      permissions?: { allow: string[]; deny: string[] } 
    }, 
    { getState, rejectWithValue }
  ) => {
    const state = getState() as any;
    
    if (!selectActiveOrgReady(state)) {
      return rejectWithValue('Organization not ready');
    }

    const orgId = selectActiveOrgId(state);
    
    try {
      await MembersService.updateRole(orgId, membershipId, role, permissions);
      return { membershipId, role, permissions };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update role');
    }
  }
);

export const changePermissions = createAsyncThunk(
  'members/changePermissions',
  async (
    { membershipId, permissions }: { membershipId: string; permissions: { allow: string[]; deny: string[] } },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as any;
    
    if (!selectActiveOrgReady(state)) {
      return rejectWithValue('Organization not ready');
    }

    const orgId = selectActiveOrgId(state);
    
    try {
      await MembersService.updatePermissions(orgId, membershipId, permissions);
      return { membershipId, permissions };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update permissions');
    }
  }
);

export const removeMember = createAsyncThunk(
  'members/removeMember',
  async (membershipId: string, { getState, rejectWithValue }) => {
    const state = getState() as any;
    
    if (!selectActiveOrgReady(state)) {
      return rejectWithValue('Organization not ready');
    }

    const orgId = selectActiveOrgId(state);
    
    try {
      await MembersService.remove(orgId, membershipId);
      return membershipId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to remove member');
    }
  }
);

const membersSlice = createSlice({
  name: 'members',
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<Partial<MembersState['query']>>) => {
      state.query = { ...state.query, ...action.payload };
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchMembers
      .addCase(fetchMembers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMembers.fulfilled, (state, action) => {
        state.loading = false;
        state.rows = action.payload.data;
        state.pagination = action.payload.pagination;
        state.query = { ...state.query, ...action.payload.searchParams };
      })
      .addCase(fetchMembers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // changeRole
      .addCase(changeRole.pending, (state, action) => {
        state.updatingId = action.meta.arg.membershipId;
      })
      .addCase(changeRole.fulfilled, (state, action) => {
        state.updatingId = null;
        const member = state.rows.find(m => m._id === action.payload.membershipId);
        if (member) {
          member.role = action.payload.role;
          if (action.payload.permissions) {
            member.allow = action.payload.permissions.allow;
            member.deny = action.payload.permissions.deny;
          }
        }
      })
      .addCase(changeRole.rejected, (state, action) => {
        state.updatingId = null;
        state.error = action.payload as string;
      })
      
      // changePermissions
      .addCase(changePermissions.pending, (state, action) => {
        state.updatingId = action.meta.arg.membershipId;
      })
      .addCase(changePermissions.fulfilled, (state, action) => {
        state.updatingId = null;
        const member = state.rows.find(m => m._id === action.payload.membershipId);
        if (member) {
          member.allow = action.payload.permissions.allow;
          member.deny = action.payload.permissions.deny;
        }
      })
      .addCase(changePermissions.rejected, (state, action) => {
        state.updatingId = null;
        state.error = action.payload as string;
      })
      
      // removeMember
      .addCase(removeMember.pending, (state, action) => {
        state.deletingId = action.meta.arg;
      })
      .addCase(removeMember.fulfilled, (state, action) => {
        state.deletingId = null;
        state.rows = state.rows.filter(m => m._id !== action.payload);
        state.pagination.total = Math.max(0, state.pagination.total - 1);
      })
      .addCase(removeMember.rejected, (state, action) => {
        state.deletingId = null;
        state.error = action.payload as string;
      });
  },
});

export const { setQuery, setPage, clearError } = membersSlice.actions;
export default membersSlice.reducer;

// Selectors
export const selectMembers = (state: any) => state.members?.rows || [];
export const selectMembersPagination = (state: any) => state.members?.pagination || { page: 1, totalPages: 1, total: 0, limit: 20 };
export const selectMembersLoading = (state: any) => state.members?.loading || false;
export const selectMembersError = (state: any) => state.members?.error || null;
export const selectMembersQuery = (state: any) => state.members?.query || { search: '', sort: 'createdAt', dir: 'desc', limit: 20 };
export const selectMembersUpdatingId = (state: any) => state.members?.updatingId || null;
export const selectMembersDeletingId = (state: any) => state.members?.deletingId || null;
