import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from '../utils/axios'

export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }: {
    rejectWithValue: (value: any) => any
  }) => {
    try {
      const response = await axios.post('/api/login', { username, password })
      const { access_token, user } = response.data

      // 保存到本地存储
      localStorage.setItem('token', access_token)
      localStorage.setItem('userId', user.id)
      localStorage.setItem('username', user.username)
      localStorage.setItem('userRole', user.role)
      localStorage.setItem('isFirstLogin', user.is_first_login || false)
      localStorage.setItem('requiresPasswordChange', user.requires_password_change || false)

      const avatarUrl = (user.avatar_url || '').trim()
      localStorage.setItem('avatarUrl', avatarUrl)
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: avatarUrl }))

      return { access_token, user }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '登录失败，请稍后再试')
    }
  }
)

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { getState, dispatch, rejectWithValue }: {
    getState: () => any
    dispatch: any
    rejectWithValue: (value: any) => any
  }) => {
    const { token } = getState().auth
    if (!token) return rejectWithValue('无 token')

    try {
      const response = await axios.get('/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const user = response.data.user

      localStorage.setItem('username', user.username)
      localStorage.setItem('userRole', user.role)

      const avatarUrl = (user.avatar_url || '').trim()
      localStorage.setItem('avatarUrl', avatarUrl)
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: avatarUrl }))

      return user
    } catch (error: any) {
      if (error.response?.status === 401) {
        dispatch(logout())
      }
      return rejectWithValue(error.response?.data?.msg || '获取用户信息失败')
    }
  }
)

// ==================== 从 localStorage 恢复初始状态 ====================

function loadInitialState() {
  const token = localStorage.getItem('token')
  if (token) {
    return {
      token,
      user: {
        id: localStorage.getItem('userId'),
        username: localStorage.getItem('username'),
        role: localStorage.getItem('userRole'),
        is_first_login: localStorage.getItem('isFirstLogin') === 'true',
        requires_password_change: localStorage.getItem('requiresPasswordChange') === 'true',
        avatar_url: localStorage.getItem('avatarUrl') || ''
      },
      loading: false,
      error: null
    }
  }
  return {
    token: null,
    user: null,
    loading: false,
    error: null
  }
}

// ==================== Slice ====================

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),

  reducers: {
    logout(state) {
      state.token = null
      state.user = null
      state.error = null

      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('username')
      localStorage.removeItem('userRole')
      localStorage.removeItem('isFirstLogin')
      localStorage.removeItem('requiresPasswordChange')
      localStorage.removeItem('avatarUrl')

      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: '' }))
    },

    setAvatarUrl(state, action) {
      const value = (action.payload || '').trim()
      if (state.user) {
        state.user = { ...state.user, avatar_url: value }
      }
      localStorage.setItem('avatarUrl', value)
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: value }))
    },

    clearError(state) {
      state.error = null
    }
  },

  extraReducers: (builder) => {
    builder
      // login
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.token = action.payload.access_token
        state.user = action.payload.user
      })
      .addCase(login.rejected, (state, action: any) => {
        state.loading = false
        state.error = action.payload
      })

      // fetchCurrentUser
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false
      })
  }
})

// ==================== 导出 ====================

export const { logout, setAvatarUrl, clearError } = authSlice.actions

export const selectIsAuthenticated = (state: any) => !!state.auth.token
export const selectIsAdmin = (state: any) => state.auth.user?.role === 'admin'
export const selectCurrentUser = (state: any) => state.auth.user
export const selectAuthLoading = (state: any) => state.auth.loading
export const selectAuthError = (state: any) => state.auth.error

export default authSlice.reducer
