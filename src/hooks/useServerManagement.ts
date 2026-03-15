import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { message, Modal } from 'antd'
import {
  fetchServers, fetchRoutes, addServer, updateServer, deleteServer as deleteServerAction,
  testServerConnection as testConnectionThunk, getServerToken, regenerateServerToken,
  selectServers, selectRoutes, selectServersLoading, selectRoutesLoading
} from '../store/serversSlice'
import axios from '../utils/axios'
import type { AppDispatch } from '../store'

export const getStatusType = (status: string) => {
  switch (status) {
    case 'online': return 'success'
    case 'offline': return 'error'
    case 'pending': return 'warning'
    default: return 'default'
  }
}

export const getStatusText = (status: string) => {
  switch (status) {
    case 'online': return '在线'
    case 'offline': return '离线'
    case 'pending': return '待连接'
    default: return '未知'
  }
}

export const formatRouteLabel = (route: any) => {
  if (!route) return '未配置'
  const segments: string[] = []
  if (route.name) segments.push(route.name)
  if (route.domain) segments.push(route.domain)
  if (route.router_mgmt_ip) segments.push(`管理IP:${route.router_mgmt_ip}`)
  if (!segments.length && route.id) segments.push(`ID:${route.id}`)
  return segments.join(' / ')
}

export const formatLastOnline = (lastOnline: string | null) => {
  if (!lastOnline) return '未知'
  return new Date(lastOnline).toLocaleString('zh-CN')
}

export function useServerManagement(siteSettings: any) {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const servers = useSelector(selectServers)
  const routes = useSelector(selectRoutes)
  const serversLoading = useSelector(selectServersLoading)

  // 对话框
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [configureDialogOpen, setConfigureDialogOpen] = useState(false)
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false)
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 服务器详情
  const [selectedServer, setSelectedServer] = useState<any>(null)

  // 服务器 token
  const [currentServerId, setCurrentServerId] = useState<number | null>(null)
  const [currentServerToken, setCurrentServerToken] = useState('')
  const [currentServerInstallCommand, setCurrentServerInstallCommand] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [activeInstallTab, setActiveInstallTab] = useState('auto')

  // 终端
  const [terminalServer, setTerminalServer] = useState<any>(null)

  // 代理安装
  const [installingAgents, setInstallingAgents] = useState<Record<number, boolean>>({})

  // 批量操作
  const [selectedServerKeys, setSelectedServerKeys] = useState<React.Key[]>([])
  const [batchProcessing, setBatchProcessing] = useState(false)

  // 编辑中的服务器ID
  const [editingServerId, setEditingServerId] = useState<number | null>(null)

  // 加载服务器和路由
  const loadServers = useCallback(async () => {
    await Promise.all([
      dispatch(fetchServers()),
      dispatch(fetchRoutes())
    ])
  }, [dispatch])

  // 生成安装命令
  const buildInstallCommand = useCallback((token: string, serverId: number) => {
    const baseUrl = siteSettings.serverUrl || window.location.origin
    let cmd = `curl -sSL ${baseUrl}/api/agent/install_script | sudo bash -s -- --server-url=${baseUrl} --auth-token=${token} --server-id=${serverId}`
    const server = (servers || []).find((s: any) => s.id === serverId)
    if (server?.route?.domain) cmd += ` --router-domain=${server.route.domain}`
    if (server?.collection_interval) cmd += ` --collection-interval=${server.collection_interval}`
    return cmd
  }, [servers, siteSettings])

  // 提交添加服务器
  const submitAdd = useCallback(async (values: any) => {
    setSubmitting(true)
    const serverData: any = {
      name: values.name,
      ip_address: values.ip_address,
      port: values.port,
      username: values.username,
      display_order: values.display_order,
      is_visible: values.is_visible ? 1 : 0,
      route_id: values.route_id ?? null,
      collection_interval: values.collection_interval ?? null
    }
    if (values.auth_type === 'password') serverData.password = values.password
    else serverData.ssh_key = values.ssh_key

    try {
      const response = await dispatch(addServer(serverData)).unwrap()
      message.success('服务器添加成功')
      setAddDialogOpen(false)

      if (response?.server_id && response?.auth_token) {
        setCurrentServerId(response.server_id)
        setCurrentServerToken(response.auth_token)
        if (response.install_command) setCurrentServerInstallCommand(response.install_command)
        setTokenDialogOpen(true)
      }
      return true
    } catch (error: any) {
      message.error(error || '添加服务器失败')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [dispatch])

  // 提交编辑服务器
  const submitEdit = useCallback(async (values: any) => {
    if (!editingServerId) return false
    setSubmitting(true)
    const serverData: any = {
      name: values.name,
      ip_address: values.ip_address,
      port: values.port,
      username: values.username,
      display_order: values.display_order,
      is_visible: values.is_visible ? 1 : 0,
      route_id: values.route_id ?? null
    }
    if (values.collection_interval !== undefined) {
      serverData.collection_interval = values.collection_interval === null || values.collection_interval === '' ? null : Number(values.collection_interval)
    }
    if (values.auth_type === 'password' && values.password) serverData.password = values.password
    else if (values.auth_type === 'ssh_key' && values.ssh_key) serverData.ssh_key = values.ssh_key

    try {
      await dispatch(updateServer({ serverId: String(editingServerId), serverData })).unwrap()
      message.success('服务器信息更新成功')
      setEditDialogOpen(false)
      return true
    } catch (error: any) {
      message.error(error || '更新服务器失败')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [dispatch, editingServerId])

  // 打开编辑
  const openEdit = useCallback((server: any) => {
    setEditingServerId(server.id)
    setEditDialogOpen(true)
  }, [])

  // 删除服务器
  const confirmDelete = useCallback((server: any) => {
    Modal.confirm({
      title: '警告',
      content: `确定要删除服务器 "${server.name}" 吗？此操作不可恢复！`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteServerAction(String(server.id))).unwrap()
          message.success('服务器删除成功')
        } catch (error: any) {
          message.error(error || '删除服务器失败')
        }
      }
    })
  }, [dispatch])

  // 测试连接
  const testConnection = useCallback(async (serverId: number) => {
    try {
      const result = await dispatch(testConnectionThunk(String(serverId))).unwrap()
      message.success(result.msg || '连接测试成功')
      await loadServers()
    } catch (error: any) {
      message.error(error || '连接测试失败')
    }
  }, [dispatch, loadServers])

  // 显示 token
  const showServerToken = useCallback(async (serverId: number) => {
    try {
      setCurrentServerId(serverId)
      const token = await dispatch(getServerToken(String(serverId))).unwrap()
      setCurrentServerToken(token)
      setCurrentServerInstallCommand(buildInstallCommand(token, serverId))
      setTokenDialogOpen(true)
    } catch (error: any) {
      message.error(error || '获取认证令牌失败')
    }
  }, [dispatch, buildInstallCommand])

  // 重新生成 token
  const confirmRegenerateToken = useCallback(() => {
    Modal.confirm({
      title: '警告',
      content: '重新生成令牌将使当前令牌失效，所有使用旧令牌的代理程序将无法连接。确定要继续吗？',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        if (!currentServerId) return
        try {
          const result = await dispatch(regenerateServerToken(String(currentServerId))).unwrap()
          setCurrentServerToken(result.auth_token)
          setCurrentServerInstallCommand(buildInstallCommand(result.auth_token, currentServerId))
          message.success('认证令牌已重新生成')
        } catch (error: any) {
          message.error(error || '重新生成令牌失败')
        }
      }
    })
  }, [dispatch, currentServerId, buildInstallCommand])

  // 复制
  const copyToken = useCallback(() => {
    navigator.clipboard.writeText(currentServerToken)
      .then(() => message.success('认证令牌已复制到剪贴板'))
      .catch(() => message.error('复制失败，请手动复制'))
  }, [currentServerToken])

  const copyInstallCommand = useCallback(() => {
    navigator.clipboard.writeText(currentServerInstallCommand)
      .then(() => message.success('安装命令已复制到剪贴板'))
      .catch(() => message.error('复制失败，请手动复制'))
  }, [currentServerInstallCommand])

  // 更新显示顺序
  const updateServerOrder = useCallback(async (serverId: number, displayOrder: number) => {
    try {
      await axios.put(`/api/servers/${serverId}`, { display_order: displayOrder })
      message.success('服务器显示顺序更新成功')
    } catch (error: any) {
      message.error('更新服务器显示顺序失败: ' + (error.response?.data?.msg || error.message))
    }
  }, [])

  // 更新可见性
  const updateServerVisibility = useCallback(async (serverId: number, isVisible: boolean) => {
    try {
      await axios.put(`/api/servers/${serverId}`, { is_visible: isVisible ? 1 : 0 })
      message.success(`服务器已${isVisible ? '显示' : '隐藏'}在概览中`)
    } catch (error: any) {
      message.error('更新服务器可见性失败: ' + (error.response?.data?.msg || error.message))
    }
  }, [])

  // 安装代理
  const installAgent = useCallback(async (server: any) => {
    if (!server?.id) return
    setInstallingAgents(prev => ({ ...prev, [server.id]: true }))
    try {
      const response = await axios.post(`/api/servers/${server.id}/install_agent`, {})
      if (response.data.success) {
        message.success(response.data.message || '代理安装成功，正在重启')
        // 重启代理
        const restartResp = await axios.post(`/api/servers/${server.id}/restart_agent`, {})
        if (restartResp.data.success) {
          message.success(restartResp.data.msg || 'GPU监控代理已重启')
        }
        await loadServers()
      } else {
        message.error(response.data.message || '代理安装失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '远程安装代理失败')
    } finally {
      setInstallingAgents(prev => ({ ...prev, [server.id]: false }))
    }
  }, [loadServers])

  // 打开终端
  const openTerminal = useCallback(async (server: any) => {
    try {
      await axios.get(`/api/servers/${server.id}/token`)
      setTerminalServer(server)
      setTerminalDialogOpen(true)
    } catch {
      message.error('获取服务器令牌失败，无法使用远程终端')
    }
  }, [])

  // 跳转资源管理
  const goToResources = useCallback((serverId: number) => {
    navigate(`/server/${serverId}/resources`)
  }, [navigate])

  // 重启服务器
  const restartServer = useCallback(async (serverId: number) => {
    Modal.confirm({
      title: '重启确认',
      content: '确定要重启此服务器吗？服务器将立即关闭并重新启动，所有运行中的任务将被中断。',
      okText: '确认重启',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await axios.post(`/api/servers/${serverId}/restart`)
          if (response.data.success) {
            message.success(response.data.msg || '服务器重启命令已发送')
            await loadServers()
          } else {
            message.error(response.data.msg || '服务器重启失败')
          }
        } catch (error: any) {
          message.error('操作失败: ' + (error.message || '未知错误'))
        }
      }
    })
  }, [loadServers])

  // 重启代理
  const restartAgent = useCallback(async (serverId: number) => {
    Modal.confirm({
      title: '重启确认',
      content: '确定要重启此服务器的GPU监控代理吗？',
      okText: '确认重启',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await axios.post(`/api/servers/${serverId}/restart_agent`)
          if (response.data.success) {
            message.success(response.data.msg || 'GPU监控代理重启成功')
            await loadServers()
          } else {
            message.error(response.data.msg || 'GPU监控代理重启失败')
          }
        } catch (error: any) {
          message.error('操作失败: ' + (error.message || '未知错误'))
        }
      }
    })
  }, [loadServers])

  // 批量操作
  const handleBatchOperation = useCallback(async (command: string) => {
    const selected = (servers || []).filter((s: any) => selectedServerKeys.includes(s.id))
    if (selected.length === 0) {
      message.warning('请先选择要操作的服务器')
      return
    }

    const nameMap: Record<string, string> = {
      batchInstallAgent: '批量安装代理',
      batchRestartAgent: '批量重启代理',
      batchTest: '批量测试连接'
    }

    Modal.confirm({
      title: nameMap[command] || '批量操作',
      content: `确定要为选中的 ${selected.length} 台服务器执行此操作吗？`,
      okText: '确认执行',
      cancelText: '取消',
      onOk: async () => {
        setBatchProcessing(true)
        let successCount = 0
        let failureCount = 0

        for (const server of selected) {
          try {
            if (command === 'batchInstallAgent') {
              const resp = await axios.post(`/api/servers/${server.id}/install_agent`, {})
              if (resp.data.success) successCount++; else failureCount++
            } else if (command === 'batchRestartAgent') {
              const resp = await axios.post(`/api/servers/${server.id}/restart_agent`)
              if (resp.data.success) successCount++; else failureCount++
            } else if (command === 'batchTest') {
              await dispatch(testConnectionThunk(String(server.id))).unwrap()
              successCount++
            }
          } catch {
            failureCount++
          }
        }

        const msg = `${nameMap[command]}完成：成功 ${successCount}/${selected.length}，失败 ${failureCount}/${selected.length}`
        if (failureCount === 0) message.success(msg)
        else if (successCount === 0) message.error(msg)
        else message.warning(msg)

        setSelectedServerKeys([])
        setBatchProcessing(false)
        await loadServers()
      }
    })
  }, [dispatch, servers, selectedServerKeys, loadServers])

  return {
    servers, routes, serversLoading, loadServers,
    addDialogOpen, setAddDialogOpen,
    editDialogOpen, setEditDialogOpen, editingServerId, openEdit,
    configureDialogOpen, setConfigureDialogOpen,
    tokenDialogOpen, setTokenDialogOpen,
    terminalDialogOpen, setTerminalDialogOpen,
    submitting,
    selectedServer, setSelectedServer,
    currentServerId, currentServerToken, currentServerInstallCommand,
    showToken, setShowToken, activeInstallTab, setActiveInstallTab,
    terminalServer,
    installingAgents,
    selectedServerKeys, setSelectedServerKeys, batchProcessing,
    submitAdd, submitEdit, confirmDelete, testConnection,
    showServerToken, confirmRegenerateToken,
    copyToken, copyInstallCommand,
    updateServerOrder, updateServerVisibility,
    installAgent, openTerminal, goToResources,
    restartServer, restartAgent, handleBatchOperation
  }
}