// src/store/invitesSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { InvitesService, InvitesListParams, CreateInviteRequest } from '../api/invites.service';
import { Invite } from '../api/types';
import { selectActiveOrgReady, selectActiveOrgId } from './activeOrgSlice';

interface InvitesState {
  rows: Invite[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
  };
  loading: boolean;
  error: string | null;
  creating: boolean;
  revokingId: string | null;
  // My invitations state
  myInvitations: {
    rows: Invite[];
    pagination: {
      page: number;
      totalPages: number;
      total: number;
      limit: number;
    };
    loading: boolean;
    error: string | null;
    acceptingToken: string | null;
    decliningToken: string | null;
  };
}

const initialState: InvitesState = {
  rows: [],
  pagination: {
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 20,
  },
  loading: false,
  error: null,
  creating: false,
  revokingId: null,
  // My invitations initial state
  myInvitations: {
    rows: [],
    pagination: {
      page: 1,
      totalPages: 1,
      total: 0,
      limit: 20,
    },
    loading: false,
    error: null,
    acceptingToken: null,
    decliningToken: null,
  },
};

// Thunks
export const fetchInvites = createAsyncThunk(
  'invites/fetchInvites',
  async (params: Partial<InvitesListParams> = {}, { getState, rejectWithValue }) => {
    const state = getState() as any;
    
    if (!selectActiveOrgReady(state)) {
      return rejectWithValue('Organization not ready');
    }

    const orgId = selectActiveOrgId(state);
    
    const searchParams = {
      page: params.page ?? state.invites.pagination.page,
      limit: params.limit ?? 20,
      status: params.status,
      sort: params.sort,
      dir: params.dir,
    };

    try {
      const response = await InvitesService.list(orgId, searchParams);
      return response;
    } catch (error: any) {
      // Pass the entire error object so components can access error.response.data.message
      return rejectWithValue(error);
    }
  }
);

export const createInvite = createAsyncThunk(
  'invites/createInvite',
  async (invite: CreateInviteRequest, { getState, rejectWithValue }) => {
    const state = getState() as any;
    
    if (!selectActiveOrgReady(state)) {
      return rejectWithValue('Organization not ready');
    }

    const orgId = selectActiveOrgId(state);
    
    try {
      const response = await InvitesService.create(orgId, invite);
      return response;
    } catch (error: any) {
      // Pass the entire error object so components can access error.response.data.message
      return rejectWithValue(error);
    }
  }
);

export const revokeInvite = createAsyncThunk(
  'invites/revokeInvite',
  async (tokenId: string, { getState, rejectWithValue }) => {
    const state = getState() as any;
    
    if (!selectActiveOrgReady(state)) {
      return rejectWithValue('Organization not ready');
    }

    const orgId = selectActiveOrgId(state);
    
    try {
      await InvitesService.revoke(orgId, tokenId);
      return tokenId;
    } catch (error: any) {
      // Pass the entire error object so components can access error.response.data.message
      return rejectWithValue(error);
    }
  }
);

// My invitations thunks
export const fetchMyInvitations = createAsyncThunk(
  'invites/fetchMyInvitations',
  async (params: { orgId?: string } = {}, { rejectWithValue }) => {
    try {
      const response = await InvitesService.getMyInvitations(params.orgId);
      return response;
    } catch (error: any) {
      // Pass the entire error object so components can access error.response.data.message
      return rejectWithValue(error);
    }
  }
);

export const acceptInvite = createAsyncThunk(
  'invites/acceptInvite',
  async (token: string, { rejectWithValue }) => {
    try {
      const response = await InvitesService.acceptInvite(token);
      return { token, membership: response };
    } catch (error: any) {
      // Pass the entire error object so components can access error.response.data.message
      return rejectWithValue(error);
    }
  }
);

export const declineInvite = createAsyncThunk(
  'invites/declineInvite',
  async (token: string, { rejectWithValue }) => {
    try {
      await InvitesService.declineInvite(token);
      return token;
    } catch (error: any) {
      // Pass the entire error object so components can access error.response.data.message
      return rejectWithValue(error);
    }
  }
);

const invitesSlice = createSlice({
  name: 'invites',
  initialState,
  reducers: {
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchInvites
      .addCase(fetchInvites.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInvites.fulfilled, (state, action) => {
        state.loading = false;
        state.rows = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchInvites.rejected, (state, action) => {
        state.loading = false;
        // Handle both string errors and error objects
        state.error = typeof action.payload === 'string' ? action.payload : (action.payload as any)?.message || 'Failed to fetch invites';
      })
      
      // createInvite
      .addCase(createInvite.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createInvite.fulfilled, (state, action) => {
        state.creating = false;
        state.rows.unshift(action.payload);
        state.pagination.total += 1;
      })
      .addCase(createInvite.rejected, (state, action) => {
        state.creating = false;
        // Handle both string errors and error objects
        state.error = typeof action.payload === 'string' ? action.payload : (action.payload as any)?.message || 'Failed to create invite';
      })
      
      // revokeInvite
      .addCase(revokeInvite.pending, (state, action) => {
        state.revokingId = action.meta.arg;
      })
      .addCase(revokeInvite.fulfilled, (state, action) => {
        state.revokingId = null;
        state.rows = state.rows.filter((invite: Invite) => invite._id !== action.payload);
        state.pagination.total = Math.max(0, state.pagination.total - 1);
      })
      .addCase(revokeInvite.rejected, (state, action) => {
        state.revokingId = null;
        // Handle both string errors and error objects
        state.error = typeof action.payload === 'string' ? action.payload : (action.payload as any)?.message || 'Failed to revoke invite';
      })
      
      // fetchMyInvitations
      .addCase(fetchMyInvitations.pending, (state) => {
        state.myInvitations.loading = true;
        state.myInvitations.error = null;
      })
      .addCase(fetchMyInvitations.fulfilled, (state, action) => {
        state.myInvitations.loading = false;
        state.myInvitations.rows = action.payload.data;
        state.myInvitations.pagination = action.payload.pagination;
      })
      .addCase(fetchMyInvitations.rejected, (state, action) => {
        state.myInvitations.loading = false;
        // Handle both string errors and error objects
        state.myInvitations.error = typeof action.payload === 'string' ? action.payload : (action.payload as any)?.message || 'Failed to fetch my invitations';
      })
      
      // acceptInvite
      .addCase(acceptInvite.pending, (state, action) => {
        state.myInvitations.acceptingToken = action.meta.arg;
        state.myInvitations.error = null;
      })
      .addCase(acceptInvite.fulfilled, (state, action) => {
        state.myInvitations.acceptingToken = null;
        // Update the invite status to ACCEPTED
        const invite = state.myInvitations.rows.find((inv: Invite) => inv.token === action.payload.token);
        if (invite) {
          invite.status = 'ACCEPTED' as any;
          invite.acceptedAt = new Date().toISOString();
        }
      })
      .addCase(acceptInvite.rejected, (state, action) => {
        state.myInvitations.acceptingToken = null;
        // Handle both string errors and error objects
        state.myInvitations.error = typeof action.payload === 'string' ? action.payload : (action.payload as any)?.message || 'Failed to accept invite';
      })
      
      // declineInvite
      .addCase(declineInvite.pending, (state, action) => {
        state.myInvitations.decliningToken = action.meta.arg;
        state.myInvitations.error = null;
      })
      .addCase(declineInvite.fulfilled, (state, action) => {
        state.myInvitations.decliningToken = null;
        // Update the invite status to DECLINED
        const invite = state.myInvitations.rows.find((inv: Invite) => inv.token === action.payload);
        if (invite) {
          invite.status = 'DECLINED' as any;
        }
      })
      .addCase(declineInvite.rejected, (state, action) => {
        state.myInvitations.decliningToken = null;
        // Handle both string errors and error objects
        state.myInvitations.error = typeof action.payload === 'string' ? action.payload : (action.payload as any)?.message || 'Failed to decline invite';
      });
  },
});

export const { setPage, clearError } = invitesSlice.actions;
export default invitesSlice.reducer;

// Selectors
export const selectInvites = (state: any) => state.invites?.rows || [];
export const selectInvitesPagination = (state: any) => state.invites?.pagination || { page: 1, totalPages: 1, total: 0, limit: 20 };
export const selectInvitesLoading = (state: any) => state.invites?.loading || false;
export const selectInvitesError = (state: any) => state.invites?.error || null;
export const selectInvitesCreating = (state: any) => state.invites?.creating || false;
export const selectInvitesRevokingId = (state: any) => state.invites?.revokingId || null;

// My invitations selectors
export const selectMyInvitations = (state: any) => state.invites?.myInvitations?.rows || [];
export const selectMyInvitationsPagination = (state: any) => state.invites?.myInvitations?.pagination || { page: 1, totalPages: 1, total: 0, limit: 20 };
export const selectMyInvitationsLoading = (state: any) => state.invites?.myInvitations?.loading || false;
export const selectMyInvitationsError = (state: any) => state.invites?.myInvitations?.error || null;
export const selectMyInvitationsAcceptingToken = (state: any) => state.invites?.myInvitations?.acceptingToken || null;
export const selectMyInvitationsDecliningToken = (state: any) => state.invites?.myInvitations?.decliningToken || null;

// Helper selectors
export const selectPendingMyInvitationsCount = (state: any) => {
  const invitations = selectMyInvitations(state);
  return invitations.filter((invite: Invite) => 
    // Only count invitations that are pending (not yet responded to and not expired)
    invite.status !== 'ACCEPTED' && 
    invite.status !== 'DECLINED' && 
    invite.status !== 'EXPIRED' 
    &&
    new Date(invite.expiresAt) > new Date()
  ).length;
};
