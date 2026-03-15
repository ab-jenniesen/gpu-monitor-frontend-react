import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { message, Modal } from 'antd'
import axios from '../utils/axios'
import { useSelector } from 'react-redux'
import { selectCurrentUser } from '../store/authSlice'

// ==================== 工具函数 ====================

export const getContainerStatusType = (status: string) => {
  switch (status) {
    case 'running': return 'success'
    case 'stopped': return 'warning'
    case 'deleted': return 'error'
    default: return 'default'
  }
}

export const getContainerStatusText = (status: string) => {
  switch (status) {
    case 'running': return '运行中'
    case 'stopped': return '已停止'
    case 'created': return '已创建'
    case 'deleted': return '已删除'
    default: return '未知'
  }
}

export const formatDate = (dateString: string | null) => {
  if (!dateString) return '未知'
  return new Date(dateString).toLocaleString()
}

export const formatMemory = (memoryMb: number | null | undefined) => {
  if (!memoryMb || typeof memoryMb !== 'number' || memoryMb <= 0) return '未知'
  return memoryMb >= 1024 ? `${(memoryMb / 1024).toFixed(1)} GB` : `${memoryMb} MB`
}

const sanitizeTarget = (value: any): string => {
  if (!value && value !== 0) return ''
  const text = String(value).trim()
  if (!text || ['unknown', 'none'].includes(text.toLowerCase())) return ''
  return text
}

export const generatePassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const segments: string[] = []
  for (let s = 0; s < 3; s++) {
    let seg = ''
    for (let i = 0; i < 5; i++) {
      seg += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    segments.push(seg)
  }
  return segments.join('-')
}

export const getSshOptions = (container: any, includeLan = true) => {
  if (!container?.port) return []
  const info = container.network_info || {}
  const options: { key: string; value: string; label: string }[] = []

  const lan = sanitizeTarget(info.lan_ip)
  if (lan && includeLan) options.push({ key: 'lan', value: lan, label: `局域网IP (${lan})` })

  const eduIp = sanitizeTarget(info.edu_ip)
  if (eduIp) options.push({ key: 'edu_ip', value: eduIp, label: `校园网IP (${eduIp})` })

  const eduDomain = sanitizeTarget(info.edu_domain)
  if (eduDomain) options.push({ key: 'edu_domain', value: eduDomain, label: `校园网域名 (${eduDomain})` })

  return options
}

export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  let success = false
  try { success = document.execCommand('copy') } catch {}
  document.body.removeChild(textarea)
  if (!success) throw new Error('copy failed')
  return true
}

// ==================== 接口 ====================

interface ContainerFilter {
  keyword: string
  serverId: string
  status: string
  imageName: string
}

interface Pagination {
  page: number
  pageSize: number
}

// ==================== Hook ====================

export function useContainerManagement() {
  const currentUser = useSelector(selectCurrentUser)
  const currentUserRole = currentUser?.role

  // 数据
  const [containers, setContainers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [servers, setServers] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [storagePaths, setStoragePaths] = useState<any[]>([])
  const [dockerImages, setDockerImages] = useState<any[]>([])
  const [portRanges, setPortRanges] = useState<any[]>([])
  const [serverResources, setServerResources] = useState<any>({
    cpu_cores: '', total_memory_mb: '', gpu_count: '', gpu_devices: []
  })

  // 筛选
  const [filter, setFilter] = useState<ContainerFilter>({
    keyword: '', serverId: '', status: '', imageName: ''
  })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20 })

  // 选择
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])

  // 对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingContainer, setEditingContainer] = useState<any>(null)

  // 终端
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [terminalContext, setTerminalContext] = useState<any>(null)

  // 定时器
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 权限
  const canOperate = useCallback((container: any) => {
    return currentUserRole === 'admin' || !!container?.is_control_enabled
  }, [currentUserRole])

  // 过滤
  const filteredContainers = useMemo(() => {
    const kw = (filter.keyword || '').trim().toLowerCase()
    const { serverId, status, imageName } = filter
    return containers.filter(c => {
      const matchKw = kw ? (c.user_username || '').toLowerCase().includes(kw) : true
      const matchServer = serverId ? String(c.server_id) === String(serverId) : true
      const matchStatus = status ? c.status === status : true
      const matchImage = imageName ? c.image_name === imageName : true
      return matchKw && matchServer && matchStatus && matchImage
    })
  }, [containers, filter])

  const pagedContainers = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize
    return filteredContainers.slice(start, start + pagination.pageSize)
  }, [filteredContainers, pagination])

  const distinctImages = useMemo(() => {
    const names = containers.map(c => c.image_name).filter(Boolean)
    return Array.from(new Set(names))
  }, [containers])

  const validSelectedContainers = useMemo(() => {
    return containers.filter(c => selectedKeys.includes(c.id) && canOperate(c))
  }, [containers, selectedKeys, canOperate])

  // API
  const fetchContainers = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await axios.get('/api/containers')
      setContainers(
        (resp.data.containers || []).map((c: any) => ({ ...c, is_control_enabled: !!c.is_control_enabled }))
      )
    } catch {
      message.error('获取容器列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const resp = await axios.get('/api/users')
      setUsers(resp.data.users || [])
    } catch {
      message.error('获取用户列表失败')
    }
  }, [])

  const fetchServerData = useCallback(async (serverId: string | number) => {
    try {
      const [resResp, spResp, diResp, prResp] = await Promise.all([
        axios.get(`/api/servers/${serverId}/resources`),
        axios.get(`/api/servers/${serverId}/storage_paths`),
        axios.get(`/api/servers/${serverId}/docker_images`),
        axios.get(`/api/servers/${serverId}/port_ranges`),
      ])
      setServerResources(resResp.data || {})
      setStoragePaths(spResp.data.storage_paths || [])
      setDockerImages(diResp.data.docker_images || [])
      setPortRanges(prResp.data.port_ranges || [])
    } catch {
      message.error('获取服务器相关数据失败')
    }
  }, [])

  // 容器操作
  const startContainer = useCallback(async (id: number) => {
    setActionLoading(`start-${id}`)
    try {
      const resp = await axios.post(`/api/containers/${id}/start`)
      message.success(resp.data.msg || '容器启动成功')
      fetchContainers()
    } catch (e: any) {
      message.error(e.response?.data?.msg || '启动容器失败')
    } finally {
      setActionLoading(null)
    }
  }, [fetchContainers])

  const stopContainer = useCallback(async (id: number) => {
    setActionLoading(`stop-${id}`)
    try {
      const resp = await axios.post(`/api/containers/${id}/stop`)
      message.success(resp.data.msg || '容器停止成功')
      fetchContainers()
    } catch (e: any) {
      message.error(e.response?.data?.msg || '停止容器失败')
    } finally {
      setActionLoading(null)
    }
  }, [fetchContainers])

  const deleteContainer = useCallback(async (id: number) => {
    setActionLoading(`delete-${id}`)
    try {
      const resp = await axios.delete(`/api/containers/${id}`)
      message.success(resp.data.msg || '容器记录删除成功')
      fetchContainers()
    } catch (e: any) {
      message.error(e.response?.data?.msg || '删除容器记录失败')
    } finally {
      setActionLoading(null)
    }
  }, [fetchContainers])

  const confirmDelete = useCallback((container: any) => {
    if (container.status !== 'stopped') {
      Modal.warning({
        title: '无法删除',
        content: `容器 "${container.container_name}" 当前状态为 ${container.status || '未知'}，请先停止后再删除。`
      })
      return
    }
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除容器 "${container.container_name}" 吗？此操作不会删除远程服务器上的容器，只会删除记录。`,
      okText: '确定', cancelText: '取消', okType: 'danger',
      onOk: () => deleteContainer(container.id)
    })
  }, [deleteContainer])

  const confirmBatchDelete = useCallback(() => {
    const list = validSelectedContainers
    if (!list.length) { message.warning('请选择可删除的容器'); return }
    const notStopped = list.filter(c => c.status !== 'stopped')
    if (notStopped.length > 0) {
      const detail = notStopped.map(c => ` - ${c.container_name} @ ${c.server_name}（状态: ${c.status}）`).join('\n')
      Modal.warning({ title: '无法批量删除', content: `以下容器未停止：\n${detail}\n\n请先停止后再删除。` })
      return
    }
    const names = list.map(c => `${c.container_name} @ ${c.server_name}`).join(', ')
    Modal.confirm({
      title: '批量删除确认',
      content: `确定批量删除以下容器吗？\n${names}\n\n仅删除记录，不删除远程服务器上的实际容器。`,
      okText: '确定', cancelText: '取消', okType: 'danger',
      onOk: async () => {
        try {
          for (const c of list) await axios.delete(`/api/containers/${c.id}`)
          message.success(`已删除 ${list.length} 个容器记录`)
          setSelectedKeys([])
          fetchContainers()
        } catch { message.error('批量删除容器时出现错误') }
      }
    })
  }, [validSelectedContainers, fetchContainers])

  const toggleControl = useCallback(async (containerId: number, newStatus: boolean) => {
    setActionLoading(`control-${containerId}`)
    try {
      const resp = await axios.put(`/api/admin/containers/${containerId}/control`, { enabled: newStatus })
      message.success(resp.data.msg || '容器控制状态更新成功')
      setContainers(prev => prev.map(c => c.id === containerId ? { ...c, is_control_enabled: newStatus } : c))
    } catch (e: any) {
      message.error(e.response?.data?.msg || '更新容器控制状态失败')
      setContainers(prev => prev.map(c => c.id === containerId ? { ...c, is_control_enabled: !newStatus } : c))
    } finally {
      setActionLoading(null)
    }
  }, [])

  // 创建容器
  const openCreateDialog = useCallback(() => {
    setServerResources({ cpu_cores: '', total_memory_mb: '', gpu_count: '', gpu_devices: [] })
    setStoragePaths([])
    setDockerImages([])
    setPortRanges([])
    fetchUsers()
    setCreateDialogOpen(true)
  }, [fetchUsers])

  const submitCreate = useCallback(async (formData: any) => {
    setSubmitting(true)
    try {
      await axios.post('/api/containers', {
        ...formData,
        cpu_cores: Number(formData.cpu_cores),
        memory_mb: Number(formData.memory_mb),
        port: Number(formData.port),
        port_mappings: (formData.port_mappings || []).map((m: any) => ({
          host_port: Number(m.host_port), container_port: Number(m.container_port)
        })),
        port_range_mappings: (formData.port_range_mappings || []).map((m: any) => ({
          start_port: Number(m.start_port), end_port: Number(m.end_port)
        }))
      })
      message.success('容器创建成功')
      setCreateDialogOpen(false)
      fetchContainers()
      return true
    } catch (e: any) {
      message.error(e.response?.data?.msg || '创建容器失败')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [fetchContainers])

  // 编辑容器
  const openEditDialog = useCallback(async (container: any) => {
    setActionLoading(`edit-${container.id}`)
    try {
      const [detailResp] = await Promise.all([
        axios.get(`/api/containers/${container.id}`)
      ])
      await fetchServerData(container.server_id)
      setEditingContainer(detailResp.data)
      setEditDialogOpen(true)
    } catch {
      message.error('获取容器编辑数据失败')
    } finally {
      setActionLoading(null)
    }
  }, [fetchServerData])

  const submitEdit = useCallback(async (formData: any) => {
    setSubmitting(true)
    try {
      await axios.put(`/api/containers/${formData.id}/update`, {
        ...formData,
        cpu_cores: Number(formData.cpu_cores),
        memory_mb: Number(formData.memory_mb),
        port: Number(formData.port),
        port_mappings: (formData.port_mappings || []).map((m: any) => ({
          host_port: Number(m.host_port), container_port: Number(m.container_port)
        })),
        port_range_mappings: (formData.port_range_mappings || []).map((m: any) => ({
          start_port: Number(m.start_port), end_port: Number(m.end_port)
        }))
      })
      message.success('容器配置更新成功')
      setEditDialogOpen(false)
      fetchContainers()
      return true
    } catch (e: any) {
      message.error(e.response?.data?.msg || '更新容器配置失败')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [fetchContainers])

  // 终端
  const openTerminal = useCallback(async (container: any, host: string) => {
    const sanitizedHost = sanitizeTarget(host)
    if (!sanitizedHost || !container?.port) {
      message.warning(!sanitizedHost ? '请选择有效的连接地址' : '该容器未配置SSH端口')
      return
    }
    try {
      await axios.get(`/api/servers/${container.server_id}/token`)
      setTerminalContext({
        serverId: container.server_id,
        containerId: container.id,
        containerName: container.container_name,
        serverName: container.server_name,
        host: sanitizedHost,
        port: container.port,
        user: 'root'
      })
      setTerminalOpen(true)
    } catch (e: any) {
      message.error(e.response?.data?.msg || '获取服务器令牌失败，无法打开远程终端')
    }
  }, [])

  const handleSshCommand = useCallback(async (option: any, container: any) => {
    if (!option?.value || !container?.port) {
      message.warning(!option?.value ? '未找到可用的目标地址' : '该容器未配置SSH端口')
      return
    }
    const command = `ssh root@${option.value} -p ${container.port}`
    try {
      await copyText(command)
      message.success('SSH 指令已复制到剪贴板')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }, [])

  // 自动刷新
  const stopAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const startAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) return
    refreshTimerRef.current = setInterval(fetchContainers, 30000)
  }, [fetchContainers])

  // 终端打开时暂停刷新
  useEffect(() => {
    if (terminalOpen) {
      stopAutoRefresh()
    } else {
      fetchContainers()
      startAutoRefresh()
    }
  }, [terminalOpen])

  // 初始化
  useEffect(() => {
    fetchContainers()
    startAutoRefresh()
    axios.get('/api/servers').then(resp => setServers(resp.data.servers || [])).catch(() => {})
    fetchUsers()

    return () => stopAutoRefresh()
  }, [])

  // 筛选方法
  const handleFilter = useCallback(() => setPagination(p => ({ ...p, page: 1 })), [])
  const resetFilter = useCallback(() => {
    setFilter({ keyword: '', serverId: '', status: '', imageName: '' })
    setPagination(p => ({ ...p, page: 1 }))
  }, [])

  return {
    currentUserRole, canOperate,
    containers, loading, actionLoading, servers, users,
    storagePaths, dockerImages, portRanges, serverResources,
    filter, setFilter, pagination, setPagination,
    filteredContainers, pagedContainers, distinctImages,
    selectedKeys, setSelectedKeys, validSelectedContainers,
    handleFilter, resetFilter,
    fetchContainers, fetchServerData,
    startContainer, stopContainer, confirmDelete, confirmBatchDelete,
    toggleControl,
    createDialogOpen, setCreateDialogOpen, openCreateDialog, submitCreate,
    editDialogOpen, setEditDialogOpen, editingContainer, openEditDialog, submitEdit,
    submitting,
    terminalOpen, setTerminalOpen, terminalContext, openTerminal, handleSshCommand
  }
}
