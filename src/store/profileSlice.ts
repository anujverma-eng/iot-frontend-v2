// src/store/profileSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
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
export default slice.reducer;
