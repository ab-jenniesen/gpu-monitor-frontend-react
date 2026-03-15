import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from '../utils/axios'

// ==================== 类型定义 ====================

interface UsersState {
  users: any[]
  loading: boolean
  error: string | null
}

interface UserData {
  username: string
  password?: string
  role: string
  group?: string
  entry_year?: number | null
  [key: string]: any
}

interface UpdateUserArgs {
  userId: string
  userData: UserData
}

// ==================== 辅助函数 ====================

function extractErrorMessage(error: any, defaultMsg: string): string {
  const errorData = error.response?.data
  if (errorData?.conflicts && Array.isArray(errorData.conflicts)) {
    return `${errorData.msg || '用户名存在冲突'}: ${errorData.conflicts.join('; ')}`
  }
  return errorData?.msg || defaultMsg
}

// ==================== Async Thunks（显式声明泛型参数） ====================

// createAsyncThunk<返回类型, 参数类型>

export const fetchUsers = createAsyncThunk<any[], void>(
  'users/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/users')
      return response.data.users
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '获取用户列表失败')
    }
  }
)

export const addUser = createAsyncThunk<string, UserData>(
  'users/addUser',
  async (userData, { dispatch, rejectWithValue }) => {
    try {
      const response = await axios.post('/api/users', userData)
      await dispatch(fetchUsers())
      return response.data.msg
    } catch (error: any) {
      return rejectWithValue(extractErrorMessage(error, '添加用户失败'))
    }
  }
)

export const updateUser = createAsyncThunk<string, UpdateUserArgs>(
  'users/updateUser',
  async ({ userId, userData }, { dispatch, rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/users/${userId}`, userData)
      await dispatch(fetchUsers())
      return response.data.msg
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '更新用户失败')
    }
  }
)

export const deleteUser = createAsyncThunk<string, string>(
  'users/deleteUser',
  async (userId, { dispatch, rejectWithValue }) => {
    try {
      const response = await axios.delete(`/api/users/${userId}`)
      await dispatch(fetchUsers())
      return response.data.msg
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '删除用户失败')
    }
  }
)

export const addUsers = createAsyncThunk<string, UserData[]>(
  'users/addUsers',
  async (usersData, { dispatch, rejectWithValue }) => {
    try {
      const response = await axios.post('/api/users/batch', { users: usersData })
      await dispatch(fetchUsers())
      return response.data.msg
    } catch (error: any) {
      return rejectWithValue(extractErrorMessage(error, '批量添加用户失败'))
    }
  }
)

// ==================== Slice ====================

const usersSlice = createSlice({
  name: 'users',
  initialState: {
    users: [],
    loading: false,
    error: null
  } as UsersState,

  reducers: {
    clearError(state) {
      state.error = null
    }
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false
        state.users = action.payload
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      .addCase(addUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addUser.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(addUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      .addCase(updateUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateUser.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      .addCase(deleteUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteUser.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

      .addCase(addUsers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addUsers.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(addUsers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  }
})

export const { clearError } = usersSlice.actions

export const selectUsers = (state: { users: UsersState }) => state.users.users
export const selectUsersLoading = (state: { users: UsersState }) => state.users.loading
export const selectUsersError = (state: { users: UsersState }) => state.users.error

export default usersSlice.reducer
