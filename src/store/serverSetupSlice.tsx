import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from '../utils/axios'

export const generateSetup = createAsyncThunk(
  'serverSetup/generate',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/server-setup/generate', payload)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '生成一键配置脚本失败')
    }
  }
)

const serverSetupSlice = createSlice({
  name: 'serverSetup',
  initialState: {
    loading: false,
    result: null,
    error: null
  },

  reducers: {
    reset(state) {
      state.result = null
      state.error = null
    }
  },

  extraReducers: (builder) => {
    builder
      .addCase(generateSetup.pending, (state) => {
        state.loading = true
        state.error = null
        state.result = null
      })
      .addCase(generateSetup.fulfilled, (state, action) => {
        state.loading = false
        state.result = action.payload
      })
      .addCase(generateSetup.rejected, (state, action: any) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { reset } = serverSetupSlice.actions

export const selectSetupResult = (state: any) => state.serverSetup.result
export const selectSetupLoading = (state: any) => state.serverSetup.loading
export const selectSetupError = (state: any) => state.serverSetup.error

export default serverSetupSlice.reducer