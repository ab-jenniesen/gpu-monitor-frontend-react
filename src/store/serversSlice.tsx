import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import axios from '../utils/axios'

interface ServersState {
  servers: any[]
  routes: any[]
  currentServer: any | null
  loading: boolean
  routesLoading: boolean
  error: string | null
}

function createServerThunk<Args = void>(
  typePrefix: string,
  requestFn: (args: Args) => Promise<any>
) {
  return createAsyncThunk<any, Args>(typePrefix, async (args, { rejectWithValue }) => {
    try {
      return await requestFn(args)
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '请求失败')
    }
  })
}

// ==================== Async Thunks ====================

export const fetchServers = createServerThunk(
  'servers/fetchServers',
  async () => {
    const response = await axios.get('/api/servers')
    return response.data.servers
  }
)

export const fetchServerDetails = createServerThunk<string>(
  'servers/fetchServerDetails',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}`)
    return response.data.server
  }
)

export const addServer = createAsyncThunk(
  'servers/addServer',
  async (serverData: any, { dispatch, rejectWithValue }) => {
    try {
      const response = await axios.post('/api/servers', serverData)
      await dispatch(fetchServers())
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '添加服务器失败')
    }
  }
)

export const updateServer = createAsyncThunk(
  'servers/updateServer',
  async ({ serverId, serverData }: { serverId: string; serverData: any }, { dispatch, rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/servers/${serverId}`, serverData)
      await dispatch(fetchServers())
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '更新服务器失败')
    }
  }
)

export const deleteServer = createAsyncThunk(
  'servers/deleteServer',
  async (serverId: string, { dispatch, rejectWithValue }) => {
    try {
      const response = await axios.delete(`/api/servers/${serverId}`)
      await dispatch(fetchServers())
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '删除服务器失败')
    }
  }
)

export const testServerConnection = createServerThunk<string>(
  'servers/testServerConnection',
  async (serverId) => {
    const response = await axios.post(`/api/servers/${serverId}/test`, {})
    return response.data
  }
)

export const getServerToken = createServerThunk<string>(
  'servers/getServerToken',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}/token`)
    return response.data.auth_token
  }
)

export const regenerateServerToken = createServerThunk<string>(
  'servers/regenerateServerToken',
  async (serverId) => {
    const response = await axios.post(`/api/servers/${serverId}/token/regenerate`, {})
    return response.data
  }
)

export const fetchServerSystemData = createServerThunk<string>(
  'servers/fetchServerSystemData',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}/system_data`)
    return response.data
  }
)

// ---------- 路由管理 ----------

export const fetchRoutes = createServerThunk(
  'servers/fetchRoutes',
  async () => {
    const response = await axios.get('/api/routes')
    return response.data.routes || []
  }
)

export const createRoute = createAsyncThunk(
  'servers/createRoute',
  async (routeData: any, { dispatch, rejectWithValue }) => {
    try {
      await axios.post('/api/routes', routeData)
      await dispatch(fetchRoutes())
      return true
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '创建路由失败')
    }
  }
)

export const updateRoute = createAsyncThunk(
  'servers/updateRoute',
  async ({ routeId, routeData }: { routeId: string; routeData: any }, { dispatch, rejectWithValue }) => {
    try {
      await axios.put(`/api/routes/${routeId}`, routeData)
      await dispatch(fetchRoutes())
      return true
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '更新路由失败')
    }
  }
)

export const deleteRoute = createAsyncThunk(
  'servers/deleteRoute',
  async (routeId: string, { dispatch, rejectWithValue }) => {
    try {
      await axios.delete(`/api/routes/${routeId}`)
      await dispatch(fetchRoutes())
      return true
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.msg || '删除路由失败')
    }
  }
)

// ---------- 存储路径管理 ----------

export const fetchServerStoragePaths = createServerThunk<string>(
  'servers/fetchServerStoragePaths',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}/storage_paths`)
    return response.data.storage_paths
  }
)

export const addServerStoragePath = createServerThunk<{ serverId: string; pathData: any }>(
  'servers/addServerStoragePath',
  async ({ serverId, pathData }) => {
    const response = await axios.post(`/api/servers/${serverId}/storage_paths`, pathData)
    return response.data
  }
)

export const updateServerStoragePath = createServerThunk<{ serverId: string; pathId: string; pathData: any }>(
  'servers/updateServerStoragePath',
  async ({ serverId, pathId, pathData }) => {
    const response = await axios.put(`/api/servers/${serverId}/storage_paths/${pathId}`, pathData)
    return response.data
  }
)

export const deleteServerStoragePath = createServerThunk<{ serverId: string; pathId: string }>(
  'servers/deleteServerStoragePath',
  async ({ serverId, pathId }) => {
    const response = await axios.delete(`/api/servers/${serverId}/storage_paths/${pathId}`)
    return response.data
  }
)

export const detectServerStoragePaths = createServerThunk<string>(
  'servers/detectServerStoragePaths',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}/detect_storage_paths`)
    return response.data.storage_paths
  }
)

// ---------- 磁盘分区管理 ----------

export const fetchServerDiskPartitions = createServerThunk<string>(
  'servers/fetchServerDiskPartitions',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}/disk_partitions`)
    return response.data.partitions
  }
)

export const mountPartition = createServerThunk<{ serverId: string; mountData: any }>(
  'servers/mountPartition',
  async ({ serverId, mountData }) => {
    const response = await axios.post(`/api/servers/${serverId}/mount_partition`, mountData)
    return response.data
  }
)

export const unmountPartition = createServerThunk<{ serverId: string; unmountData: any }>(
  'servers/unmountPartition',
  async ({ serverId, unmountData }) => {
    const response = await axios.post(`/api/servers/${serverId}/unmount_partition`, unmountData)
    return response.data
  }
)

export const createPartition = createServerThunk<{ serverId: string; partitionData: any }>(
  'servers/createPartition',
  async ({ serverId, partitionData }) => {
    const response = await axios.post(`/api/servers/${serverId}/create_partition`, partitionData)
    return response.data
  }
)

// ---------- 端口范围管理 ----------

export const fetchServerPortRanges = createServerThunk<string>(
  'servers/fetchServerPortRanges',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}/port_ranges`)
    return response.data.port_ranges
  }
)

export const addServerPortRange = createServerThunk<{ serverId: string; rangeData: any }>(
  'servers/addServerPortRange',
  async ({ serverId, rangeData }) => {
    const response = await axios.post(`/api/servers/${serverId}/port_ranges`, rangeData)
    return response.data
  }
)

export const updateServerPortRange = createServerThunk<{ serverId: string; rangeId: string; rangeData: any }>(
  'servers/updateServerPortRange',
  async ({ serverId, rangeId, rangeData }) => {
    const response = await axios.put(`/api/servers/${serverId}/port_ranges/${rangeId}`, rangeData)
    return response.data
  }
)

export const deleteServerPortRange = createServerThunk<{ serverId: string; rangeId: string }>(
  'servers/deleteServerPortRange',
  async ({ serverId, rangeId }) => {
    const response = await axios.delete(`/api/servers/${serverId}/port_ranges/${rangeId}`)
    return response.data
  }
)

export const detectServerPortRanges = createServerThunk<string>(
  'servers/detectServerPortRanges',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}/detect_port_ranges`)
    return response.data.port_ranges
  }
)

// ---------- Docker 镜像管理 ----------

export const fetchServerDockerImages = createServerThunk<string>(
  'servers/fetchServerDockerImages',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}/docker_images`)
    return response.data.docker_images
  }
)

export const detectServerDockerImages = createServerThunk<string>(
  'servers/detectServerDockerImages',
  async (serverId) => {
    const response = await axios.get(`/api/servers/${serverId}/detect_docker_images`)
    return response.data.docker_images
  }
)

export const addServerDockerImage = createServerThunk<{ serverId: string; imageData: any }>(
  'servers/addServerDockerImage',
  async ({ serverId, imageData }) => {
    const response = await axios.post(`/api/servers/${serverId}/docker_images`, imageData)
    return response.data
  }
)

export const deleteServerDockerImage = createServerThunk<{ serverId: string; imageId: string }>(
  'servers/deleteServerDockerImage',
  async ({ serverId, imageId }) => {
    const response = await axios.delete(`/api/servers/${serverId}/docker_images/${imageId}`)
    return response.data
  }
)

export const pullDockerImage = createServerThunk<{ serverId: string; imageData: any }>(
  'servers/pullDockerImage',
  async ({ serverId, imageData }) => {
    const response = await axios.post(`/api/servers/${serverId}/pull_docker_image`, imageData)
    return response.data
  }
)

export const getDockerTaskStatus = createServerThunk<{ serverId: string; taskId: string }>(
  'servers/getDockerTaskStatus',
  async ({ serverId, taskId }) => {
    const response = await axios.get(`/api/servers/${serverId}/docker_tasks/${taskId}`)
    return response.data
  }
)

// ==================== 路由相关 thunk 集合（用于 matcher 排除） ====================

const routeThunks = [createRoute, updateRoute, deleteRoute, fetchRoutes]

// ==================== Slice ====================

const serversSlice = createSlice({
  name: 'servers',
  initialState: {
    servers: [],
    routes: [],
    currentServer: null,
    loading: false,
    routesLoading: false,
    error: null
  } as ServersState,

  reducers: {
    clearCurrentServer(state) {
      state.currentServer = null
    },
    clearError(state) {
      state.error = null
    }
  },

  extraReducers: (builder) => {
    builder
      // ==========================================
      // 1. 需要写入特定 state 字段的 fulfilled（单独处理）
      // ==========================================

      .addCase(fetchServers.fulfilled, (state, action) => {
        state.loading = false
        state.servers = action.payload
      })

      .addCase(fetchServerDetails.fulfilled, (state, action) => {
        state.loading = false
        state.currentServer = action.payload
      })

      .addCase(fetchRoutes.fulfilled, (state, action) => {
        state.routesLoading = false
        state.routes = action.payload
      })

      // ==========================================
      // 2. 路由相关 thunk：控制 routesLoading
      // ==========================================

      // --- fetchRoutes ---
      .addCase(fetchRoutes.pending, (state) => {
        state.routesLoading = true
        state.error = null
      })
      .addCase(fetchRoutes.rejected, (state, action) => {
        state.routesLoading = false
        state.error = action.payload as string
      })

      // --- createRoute ---
      .addCase(createRoute.pending, (state) => {
        state.routesLoading = true
        state.error = null
      })
      .addCase(createRoute.fulfilled, (state) => {
        state.routesLoading = false
      })
      .addCase(createRoute.rejected, (state, action) => {
        state.routesLoading = false
        state.error = action.payload as string
      })

      // --- updateRoute ---
      .addCase(updateRoute.pending, (state) => {
        state.routesLoading = true
        state.error = null
      })
      .addCase(updateRoute.fulfilled, (state) => {
        state.routesLoading = false
      })
      .addCase(updateRoute.rejected, (state, action) => {
        state.routesLoading = false
        state.error = action.payload as string
      })

      // --- deleteRoute ---
      .addCase(deleteRoute.pending, (state) => {
        state.routesLoading = true
        state.error = null
      })
      .addCase(deleteRoute.fulfilled, (state) => {
        state.routesLoading = false
      })
      .addCase(deleteRoute.rejected, (state, action) => {
        state.routesLoading = false
        state.error = action.payload as string
      })

      // ==========================================
      // 3. 其余所有 servers/ thunk：统一 matcher 处理 loading/error
      //    排除路由相关（已单独处理）和已单独处理 fulfilled 的
      // ==========================================

      // --- pending: 设置 loading = true ---
      .addMatcher(
        (action): action is PayloadAction =>
          action.type.startsWith('servers/') &&
          action.type.endsWith('/pending') &&
          !routeThunks.some((t) => t.pending.match(action)),
        (state) => {
          state.loading = true
          state.error = null
        }
      )

      // --- fulfilled: 设置 loading = false ---
      // 排除 fetchServers 和 fetchServerDetails（已单独处理 fulfilled）
      .addMatcher(
        (action): action is PayloadAction =>
          action.type.startsWith('servers/') &&
          action.type.endsWith('/fulfilled') &&
          !routeThunks.some((t) => t.fulfilled.match(action)) &&
          !fetchServers.fulfilled.match(action) &&
          !fetchServerDetails.fulfilled.match(action),
        (state) => {
          state.loading = false
        }
      )

      // --- rejected: 设置 loading = false + error ---
      .addMatcher(
        (action): action is PayloadAction<string> =>
          action.type.startsWith('servers/') &&
          action.type.endsWith('/rejected') &&
          !routeThunks.some((t) => t.rejected.match(action)),
        (state, action) => {
          state.loading = false
          state.error = action.payload
        }
      )
  }
})

// ==================== 导出 ====================

export const { clearCurrentServer, clearError } = serversSlice.actions

// Selectors
export const selectServers = (state: { servers: ServersState }) => state.servers.servers
export const selectRoutes = (state: { servers: ServersState }) => state.servers.routes
export const selectCurrentServer = (state: { servers: ServersState }) => state.servers.currentServer
export const selectServersLoading = (state: { servers: ServersState }) => state.servers.loading
export const selectRoutesLoading = (state: { servers: ServersState }) => state.servers.routesLoading
export const selectServersError = (state: { servers: ServersState }) => state.servers.error

export default serversSlice.reducer
