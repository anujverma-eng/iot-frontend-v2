import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { OrgService, OrgDTO } from '../api/org.service';
import { RootState } from '.';

/* ─────────────────  thunks  ───────────────── */
export const fetchOrg = createAsyncThunk('org/fetch', () =>
  OrgService.me(),
);

export const createOrg = createAsyncThunk(
  'org/create',
  async (name: string) => {
    const { data } = await OrgService.create(name);   // POST /organizations
    return data as OrgDTO;
  },
);

/* ─────────────────  state  ─────────────────── */
interface State {
  loading: boolean;
  loaded : boolean;
  error  : string | null;
  data   : OrgDTO | null;
}
const initial: State = { loading: false, loaded: false, error: null, data: null };

/* ─────────────────  slice  ─────────────────── */
const orgSlice = createSlice({
  name: 'org',
  initialState: initial,
  reducers: {
    clear: () => initial,
  },
  extraReducers: builder => {
    /* fetch current org ------------------------------------- */
    builder.addCase(fetchOrg.pending,  s => { s.loading = true;  s.error = null; });
    builder.addCase(fetchOrg.rejected, (s,a)=>{ s.loading = false; s.error = a.error.message??'Error'; });
    builder.addCase(fetchOrg.fulfilled,(s,a)=>{
      s.loading = false; s.loaded = true; s.data = a.payload;
    });

    /* create org ------------------------------------------- */
    builder.addCase(createOrg.pending,  s => { s.loading = true;  s.error = null; });
    builder.addCase(createOrg.rejected, (s,a)=>{ s.loading = false; s.error = a.error.message??'Error'; });
    builder.addCase(createOrg.fulfilled,(s,a: PayloadAction<OrgDTO>)=>{
      s.loading = false; s.loaded = true; s.data = a.payload;
    });
  },
});

export const { clear } = orgSlice.actions;
export default orgSlice.reducer;

/* small selector helpers (optional) */
export const selectOrg   = (st:RootState)=>st.org.data;
export const orgIsLoaded = (st:RootState)=>st.org.loaded;
export const orgIsBusy   = (st:RootState)=>st.org.loading;
