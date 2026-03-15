import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { message, Modal } from 'antd'
import axios from '../utils/axios'
import { logout } from '../store/authSlice'
import { useDispatch } from 'react-redux'
import type { AppDispatch } from '../store'

interface BackupConfig {
  id: number
  webdav_url: string
  webdav_username: string
  webdav_password: string
  webdav_root_path: string
  is_default: boolean
}

interface ScheduleSettings {
  enabled: boolean
  interval_hours: number
  interval_minutes: number
  retain_count: number
  last_run: string
  next_run: string
}

interface WebdavBackups {
  manual: any[]
  scheduled: any[]
  config_id: number | null
}

interface ConfigForm {
  id: number | null
  webdav_url: string
  webdav_username: string
  webdav_password: string
  webdav_root_path: string
  set_as_default: boolean
}

export const formatConfigLabel = (config: BackupConfig) => {
  const base = config.webdav_url || '(未配置URL)'
  const root = config.webdav_root_path ? ` (${config.webdav_root_path})` : ''
  const suffix = config.is_default ? ' [默认]' : ''
  return `${base}${root}${suffix}`
}

export const formatFileSize = (bytes: number) => {
  if (!bytes && bytes !== 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`
}

export function useBackupManagement(isSuperAdmin: boolean) {
  const dispatch = useDispatch<AppDispatch>()

  // WebDAV 配置
  const [backupConfigs, setBackupConfigs] = useState<BackupConfig[]>([])
  const [configListLoading, setConfigListLoading] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [defaultConfigId, setDefaultConfigId] = useState<number | null>(null)

  // 配置对话框
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [configDialogMode, setConfigDialogMode] = useState<'create' | 'edit'>('create')
  const [configFormLoading, setConfigFormLoading] = useState(false)
  const [testConfigLoading, setTestConfigLoading] = useState(false)
  const [configForm, setConfigForm] = useState<ConfigForm>({
    id: null, webdav_url: '', webdav_username: '', webdav_password: '',
    webdav_root_path: '/gpu-monitor-backups', set_as_default: false
  })

  // 加载状态
  const [setDefaultLoadingId, setSetDefaultLoadingId] = useState<number | null>(null)
  const [deleteConfigLoadingId, setDeleteConfigLoadingId] = useState<number | null>(null)
  const [testSelectedConfigLoading, setTestSelectedConfigLoading] = useState(false)
  const [backupToWebdavLoading, setBackupToWebdavLoading] = useState(false)
  const [exportToLocalLoading, setExportToLocalLoading] = useState(false)
  const [loadWebdavBackupsLoading, setLoadWebdavBackupsLoading] = useState(false)
  const [restoreBackupLoading, setRestoreBackupLoading] = useState(false)
  const [importBackupLoading, setImportBackupLoading] = useState(false)

  // 定时备份
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    enabled: false, interval_hours: 24, interval_minutes: 0,
    retain_count: 10, last_run: '', next_run: ''
  })
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [saveScheduleLoading, setSaveScheduleLoading] = useState(false)
  const scheduleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // WebDAV 备份列表
  const [webdavBackups, setWebdavBackups] = useState<WebdavBackups>({ manual: [], scheduled: [], config_id: null })

  // 本地备份
  const [localBackups, setLocalBackups] = useState<any[]>([])
  const [loadLocalBackupsLoading, setLoadLocalBackupsLoading] = useState(false)
  const [restoringLocalName, setRestoringLocalName] = useState('')
  const [deletingLocalName, setDeletingLocalName] = useState('')

  // 文件上传 ref
  const uploadFileRef = useRef<HTMLInputElement>(null)

  // 计算属性
  const selectedConfig = useMemo(
    () => backupConfigs.find(c => c.id === selectedConfigId) || null,
    [backupConfigs, selectedConfigId]
  )
  const manualWebdavBackups = useMemo(() => webdavBackups.manual || [], [webdavBackups])
  const scheduledWebdavBackups = useMemo(() => webdavBackups.scheduled || [], [webdavBackups])

  // 辅助
  const ensureSelectedConfig = useCallback(() => {
    if (!selectedConfigId) {
      message.warning('请先选择一个WebDAV配置')
      return false
    }
    const cfg = backupConfigs.find(c => c.id === selectedConfigId)
    if (!cfg?.webdav_url) {
      message.warning('当前配置未填写服务器URL，请先完善配置')
      return false
    }
    return true
  }, [selectedConfigId, backupConfigs])

  const resetConfigForm = useCallback(() => {
    setConfigForm({
      id: null, webdav_url: '', webdav_username: '', webdav_password: '',
      webdav_root_path: '/gpu-monitor-backups', set_as_default: false
    })
  }, [])

  // ==================== 配置 CRUD ====================

  const fetchBackupConfigs = useCallback(async () => {
    if (!isSuperAdmin) return
    setConfigListLoading(true)
    try {
      const resp = await axios.get('/api/backup/settings')
      const configs = resp.data.configs || []
      setBackupConfigs(configs)
      setDefaultConfigId(resp.data.default_config_id || null)
      setWebdavBackups({ manual: [], scheduled: [], config_id: null })

      if (!configs.length) {
        setSelectedConfigId(null)
      } else {
        setSelectedConfigId(prev => {
          if (!prev || !configs.some((c: BackupConfig) => c.id === prev)) {
            return resp.data.default_config_id || configs[0].id
          }
          return prev
        })
      }
    } catch (e: any) {
      message.error(e.response?.data?.msg || '获取备份配置失败')
    } finally {
      setConfigListLoading(false)
    }
  }, [isSuperAdmin])

  const openCreateConfigDialog = useCallback(() => {
    resetConfigForm()
    setConfigForm(prev => ({ ...prev, set_as_default: backupConfigs.length === 0 }))
    setConfigDialogMode('create')
    setConfigDialogOpen(true)
  }, [resetConfigForm, backupConfigs])

  const openEditConfigDialog = useCallback((config: BackupConfig) => {
    setConfigForm({
      id: config.id,
      webdav_url: config.webdav_url,
      webdav_username: config.webdav_username,
      webdav_password: config.webdav_password,
      webdav_root_path: config.webdav_root_path,
      set_as_default: !!config.is_default
    })
    setConfigDialogMode('edit')
    setConfigDialogOpen(true)
  }, [])

  const testConfigConnection = useCallback(async () => {
    if (!configForm.webdav_url) {
      message.warning('请先填写WebDAV服务器URL')
      return
    }
    setTestConfigLoading(true)
    try {
      await axios.post('/api/backup/test-webdav', {
        webdav_url: configForm.webdav_url,
        webdav_username: configForm.webdav_username,
        webdav_password: configForm.webdav_password,
        webdav_root_path: configForm.webdav_root_path
      })
      message.success('连接测试成功')
    } catch (e: any) {
      message.error(e.response?.data?.msg || 'WebDAV连接测试失败')
    } finally {
      setTestConfigLoading(false)
    }
  }, [configForm])

  const saveConfig = useCallback(async () => {
    if (!configForm.webdav_url) {
      message.warning('WebDAV服务器URL不能为空')
      return
    }
    setConfigFormLoading(true)
    try {
      const data = {
        webdav_url: configForm.webdav_url,
        webdav_username: configForm.webdav_username,
        webdav_password: configForm.webdav_password,
        webdav_root_path: configForm.webdav_root_path,
        set_as_default: configForm.set_as_default
      }
      if (configDialogMode === 'edit' && configForm.id) {
        await axios.put(`/api/backup/settings/${configForm.id}`, data)
        message.success('备份配置已更新')
      } else {
        await axios.post('/api/backup/settings', data)
        message.success('备份配置已创建')
      }
      setConfigDialogOpen(false)
      await fetchBackupConfigs()
    } catch (e: any) {
      message.error(e.response?.data?.msg || '保存备份配置失败')
    } finally {
      setConfigFormLoading(false)
    }
  }, [configForm, configDialogMode, fetchBackupConfigs])

  const setDefaultConfig = useCallback(async (config: BackupConfig) => {
    setSetDefaultLoadingId(config.id)
    try {
      await axios.post(`/api/backup/settings/${config.id}/default`, {})
      message.success('默认配置已更新')
      await fetchBackupConfigs()
    } catch (e: any) {
      message.error(e.response?.data?.msg || '设置默认配置失败')
    } finally {
      setSetDefaultLoadingId(null)
    }
  }, [fetchBackupConfigs])

  const confirmDeleteConfig = useCallback((config: BackupConfig) => {
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除配置「${config.webdav_url}」吗？`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        setDeleteConfigLoadingId(config.id)
        try {
          await axios.delete(`/api/backup/settings/${config.id}`)
          message.success('备份配置已删除')
          await fetchBackupConfigs()
        } catch (e: any) {
          message.error(e.response?.data?.msg || '删除备份配置失败')
        } finally {
          setDeleteConfigLoadingId(null)
        }
      }
    })
  }, [fetchBackupConfigs])

  const testSelectedConfigConnection = useCallback(async () => {
    if (!ensureSelectedConfig()) return
    setTestSelectedConfigLoading(true)
    try {
      await axios.post('/api/backup/test-webdav', { config_id: selectedConfigId })
      message.success('选中配置连接测试成功')
    } catch (e: any) {
      message.error(e.response?.data?.msg || 'WebDAV连接测试失败')
    } finally {
      setTestSelectedConfigLoading(false)
    }
  }, [ensureSelectedConfig, selectedConfigId])

  // ==================== 定时备份 ====================

  const fetchScheduleSettings = useCallback(async () => {
    if (!isSuperAdmin) return
    setScheduleLoading(true)
    try {
      const resp = await axios.get('/api/backup/schedule')
      setScheduleSettings({
        enabled: !!resp.data.enabled,
        interval_hours: Number(resp.data.interval_hours ?? 24),
        interval_minutes: Number(resp.data.interval_minutes ?? 0),
        retain_count: Number(resp.data.retain_count ?? 10),
        last_run: resp.data.last_run || '',
        next_run: resp.data.next_run || ''
      })
    } catch (e: any) {
      message.error(e.response?.data?.msg || '获取定时备份设置失败')
    } finally {
      setScheduleLoading(false)
    }
  }, [isSuperAdmin])

  const startScheduleRefreshTimer = useCallback(() => {
    if (scheduleTimerRef.current) clearInterval(scheduleTimerRef.current)
    if (!isSuperAdmin || !scheduleSettings.enabled) return
    scheduleTimerRef.current = setInterval(() => {
      fetchScheduleSettings()
    }, 30000)
  }, [isSuperAdmin, scheduleSettings.enabled, fetchScheduleSettings])

  const stopScheduleRefreshTimer = useCallback(() => {
    if (scheduleTimerRef.current) {
      clearInterval(scheduleTimerRef.current)
      scheduleTimerRef.current = null
    }
  }, [])

  const saveScheduleSettings = useCallback(async () => {
    if (!isSuperAdmin) return
    let hours = Math.max(0, Math.min(168, scheduleSettings.interval_hours || 0))
    let minutes = Math.max(0, Math.min(59, scheduleSettings.interval_minutes || 0))
    const retain = Math.max(1, Math.min(500, scheduleSettings.retain_count || 10))
    if (hours === 0 && minutes === 0) minutes = 1

    setSaveScheduleLoading(true)
    try {
      const resp = await axios.post('/api/backup/schedule', {
        enabled: scheduleSettings.enabled,
        interval_hours: hours,
        interval_minutes: minutes,
        retain_count: retain
      })
      if (resp.data) {
        setScheduleSettings({
          enabled: !!resp.data.enabled,
          interval_hours: Number(resp.data.interval_hours ?? 24),
          interval_minutes: Number(resp.data.interval_minutes ?? 0),
          retain_count: Number(resp.data.retain_count ?? 10),
          last_run: resp.data.last_run || '',
          next_run: resp.data.next_run || ''
        })
      }
      message.success('定时备份设置已保存')
    } catch (e: any) {
      message.error(e.response?.data?.msg || '保存定时备份设置失败')
    } finally {
      setSaveScheduleLoading(false)
    }
  }, [isSuperAdmin, scheduleSettings])

  // ==================== 备份操作 ====================

  const backupToWebDAV = useCallback(async () => {
    if (!ensureSelectedConfig()) return
    Modal.confirm({
      title: '确认备份',
      content: '确定要创建备份并上传到WebDAV吗？',
      onOk: async () => {
        setBackupToWebdavLoading(true)
        try {
          const resp = await axios.post('/api/backup/webdav', { config_id: selectedConfigId })
          message.success(resp.data.msg || '备份成功')
        } catch (e: any) {
          message.error(e.response?.data?.msg || 'WebDAV备份失败')
        } finally {
          setBackupToWebdavLoading(false)
        }
      }
    })
  }, [ensureSelectedConfig, selectedConfigId])

  const exportToLocal = useCallback(async () => {
    Modal.confirm({
      title: '确认导出',
      content: '确定要导出备份文件到本地吗？',
      onOk: async () => {
        setExportToLocalLoading(true)
        try {
          const resp = await axios.get('/api/backup/export', { responseType: 'blob' })
          const blob = new Blob([resp.data], { type: 'application/zip' })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `backup_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.gpumon`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          message.success('备份文件导出成功')
        } catch (e: any) {
          message.error(e.response?.data?.msg || '导出备份失败')
        } finally {
          setExportToLocalLoading(false)
        }
      }
    })
  }, [])

  // ==================== WebDAV 恢复 ====================

  const loadWebDAVBackups = useCallback(async () => {
    if (!ensureSelectedConfig()) return
    setLoadWebdavBackupsLoading(true)
    try {
      const resp = await axios.get('/api/backup/webdav/list', { params: { config_id: selectedConfigId } })
      setWebdavBackups({
        manual: resp.data.manual || [],
        scheduled: resp.data.scheduled || [],
        config_id: resp.data.config_id ?? selectedConfigId
      })
      message.success('备份列表加载成功')
    } catch (e: any) {
      message.error(e.response?.data?.msg || '获取备份列表失败')
    } finally {
      setLoadWebdavBackupsLoading(false)
    }
  }, [ensureSelectedConfig, selectedConfigId])

  const restoreFromWebDAV = useCallback(async (type: string, name: string) => {
    if (!ensureSelectedConfig()) return
    Modal.confirm({
      title: '确认恢复',
      content: `确定要从WebDAV恢复备份文件 "${name}" 吗？此操作将覆盖当前所有数据！`,
      okText: '确定恢复',
      okType: 'danger',
      onOk: async () => {
        setRestoreBackupLoading(true)
        try {
          const resp = await axios.post('/api/backup/webdav/restore', {
            type, name, config_id: selectedConfigId
          })
          message.success(resp.data.msg || '恢复成功')
          Modal.info({
            title: '恢复完成',
            content: '数据恢复成功，请重新登录以确保数据同步。',
            onOk: () => {
              dispatch(logout())
              window.location.reload()
            }
          })
        } catch (e: any) {
          message.error(e.response?.data?.msg || '恢复失败')
        } finally {
          setRestoreBackupLoading(false)
        }
      }
    })
  }, [ensureSelectedConfig, selectedConfigId, dispatch])

  // ==================== 本地备份 ====================

  const loadLocalBackups = useCallback(async () => {
    if (!isSuperAdmin) return
    setLoadLocalBackupsLoading(true)
    try {
      const resp = await axios.get('/api/backup/local/list')
      setLocalBackups(resp.data.files || [])
    } catch (e: any) {
      message.error(e.response?.data?.msg || '获取本地备份列表失败')
    } finally {
      setLoadLocalBackupsLoading(false)
    }
  }, [isSuperAdmin])

  const restoreLocalBackup = useCallback((row: any) => {
    if (!row) return
    Modal.confirm({
      title: '确认恢复',
      content: `确定要从本地备份 "${row.name}" 恢复吗？当前数据将被覆盖。`,
      okText: '确定恢复',
      okType: 'danger',
      onOk: async () => {
        setRestoringLocalName(row.name)
        try {
          await axios.post('/api/backup/local/restore', { name: row.name })
          message.success('本地备份恢复成功')
          await loadLocalBackups()
          Modal.info({
            title: '恢复完成',
            content: '数据恢复成功，请重新登录以确保数据同步。',
            onOk: () => {
              dispatch(logout())
              window.location.reload()
            }
          })
        } catch (e: any) {
          message.error(e.response?.data?.msg || '恢复本地备份失败')
        } finally {
          setRestoringLocalName('')
        }
      }
    })
  }, [dispatch, loadLocalBackups])

  const deleteLocalBackup = useCallback((row: any) => {
    if (!row) return
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除本地备份 "${row.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        setDeletingLocalName(row.name)
        try {
          await axios.delete(`/api/backup/local/${encodeURIComponent(row.name)}`)
          message.success('本地备份已删除')
          await loadLocalBackups()
        } catch (e: any) {
          message.error(e.response?.data?.msg || '删除本地备份失败')
        } finally {
          setDeletingLocalName('')
        }
      }
    })
  }, [loadLocalBackups])

  const triggerLocalRestore = useCallback(() => {
    uploadFileRef.current?.click()
  }, [])

  const handleLocalRestore = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    Modal.confirm({
      title: '确认恢复',
      content: `确定要从本地文件 "${file.name}" 恢复备份吗？此操作将覆盖当前所有数据！`,
      okText: '确定恢复',
      okType: 'danger',
      onOk: async () => {
        setImportBackupLoading(true)
        try {
          const formData = new FormData()
          formData.append('backup_file', file)
          const resp = await axios.post('/api/backup/restore', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
          message.success(resp.data.msg || '恢复成功')
          await loadLocalBackups()
          Modal.info({
            title: '恢复完成',
            content: '数据恢复成功，请重新登录以确保数据同步。',
            onOk: () => {
              dispatch(logout())
              window.location.reload()
            }
          })
        } catch (e: any) {
          message.error(e.response?.data?.msg || '恢复失败')
        } finally {
          setImportBackupLoading(false)
          event.target.value = ''
        }
      }
    })
  }, [dispatch, loadLocalBackups])

  // 切换配置时清空备份列表
  useEffect(() => {
    setWebdavBackups({ manual: [], scheduled: [], config_id: null })
  }, [selectedConfigId])

  // 清理定时器
  useEffect(() => {
    return () => stopScheduleRefreshTimer()
  }, [stopScheduleRefreshTimer])

  return {
    // 配置
    backupConfigs, configListLoading, selectedConfigId, setSelectedConfigId,
    selectedConfig, defaultConfigId,
    configDialogOpen, setConfigDialogOpen, configDialogMode,
    configForm, setConfigForm, configFormLoading, testConfigLoading,
    setDefaultLoadingId, deleteConfigLoadingId,
    testSelectedConfigLoading,
    fetchBackupConfigs, openCreateConfigDialog, openEditConfigDialog,
    testConfigConnection, saveConfig, setDefaultConfig, confirmDeleteConfig,
    testSelectedConfigConnection,
    // 定时备份
    scheduleSettings, setScheduleSettings, scheduleLoading, saveScheduleLoading,
    fetchScheduleSettings, saveScheduleSettings,
    startScheduleRefreshTimer, stopScheduleRefreshTimer,
    // 备份操作
    backupToWebdavLoading, exportToLocalLoading,
    backupToWebDAV, exportToLocal,
    // WebDAV 恢复
    loadWebdavBackupsLoading, restoreBackupLoading,
    manualWebdavBackups, scheduledWebdavBackups,
    loadWebDAVBackups, restoreFromWebDAV,
    // 本地备份
    localBackups, loadLocalBackupsLoading, restoringLocalName, deletingLocalName,
    loadLocalBackups, restoreLocalBackup, deleteLocalBackup,
    // 文件上传
    uploadFileRef, triggerLocalRestore, handleLocalRestore, importBackupLoading
  }
}
