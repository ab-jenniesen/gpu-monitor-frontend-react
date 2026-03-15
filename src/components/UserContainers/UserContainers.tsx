import {
  useState, useEffect, useRef, useMemo, useCallback,
  forwardRef, useImperativeHandle
} from 'react'
import { useSelector } from 'react-redux'
import { Table, Tag, Button, Empty, Modal, message, Spin, Dropdown } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import {
  PlayCircleOutlined, PauseCircleOutlined, DesktopOutlined,
  LinkOutlined, KeyOutlined, WarningOutlined, CaretDownOutlined
} from '@ant-design/icons'
import { selectCurrentUser } from '../../store/authSlice'
import axios from '../../utils/axios'
import TerminalDialog from '../TerminalDialog/TerminalDialog'
import './UserContainers.css'

// ==================== 工具函数 ====================

function getStatusType(status: string): string {
  switch (status) {
    case 'running': return 'success'
    case 'stopped': return 'error'
    case 'creating': return 'warning'
    case 'error': return 'error'
    default: return 'default'
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'running': return '运行中'
    case 'stopped': return '已停止'
    case 'creating': return '创建中'
    case 'error': return '错误'
    default: return '未知'
  }
}

function formatMemory(memoryMb: number | null | undefined): string {
  if (!memoryMb || memoryMb === 0) return '-'
  if (memoryMb >= 1024) return `${(memoryMb / 1024).toFixed(1)}GB`
  return `${memoryMb}MB`
}

function sanitizeTarget(value: any): string {
  if (!value && value !== 0) return ''
  const text = String(value).trim()
  if (!text || ['unknown', 'none'].includes(text.toLowerCase())) return ''
  return text
}

interface SshOption {
  key: string
  value: string
  label: string
}

function getSshOptions(container: any, includeLan = true): SshOption[] {
  if (!container?.port) return []
  const info = container.network_info || {}
  const options: SshOption[] = []

  const lan = sanitizeTarget(info.lan_ip)
  if (lan && includeLan) {
    options.push({ key: 'lan', value: lan, label: `局域网IP (${lan})` })
  }

  const eduIp = sanitizeTarget(info.edu_ip)
  if (eduIp) {
    options.push({ key: 'edu_ip', value: eduIp, label: `校园网IP (${eduIp})` })
  }

  const eduDomain = sanitizeTarget(info.edu_domain)
  if (eduDomain) {
    options.push({ key: 'edu_domain', value: eduDomain, label: `校园网域名 (${eduDomain})` })
  }

  return options
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fallback */ }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let success = false
  try {
    success = document.execCommand('copy')
  } catch (err) {
    console.error('执行复制命令失败:', err)
  }

  document.body.removeChild(textarea)
  if (!success) throw new Error('execCommand copy failed')
  return true
}

// ==================== 组件类型 ====================

export interface UserContainersRef {
  containers: any[]
  fetchData: () => Promise<void>
}

// ==================== 组件 ====================

const UserContainers = forwardRef<UserContainersRef>((_, ref) => {
  const currentUser = useSelector(selectCurrentUser)
  const username = currentUser?.username || localStorage.getItem('username') || ''
  const authToken = currentUser?.token || localStorage.getItem('token') || ''

  // ---------- 状态 ----------
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [containers, setContainers] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // 密码对话框
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false)
  const [currentContainer, setCurrentContainer] = useState<any>(null)
  const [containerPassword, setContainerPassword] = useState('')

  // 终端对话框
  const [terminalDialogVisible, setTerminalDialogVisible] = useState(false)
  const [terminalContext, setTerminalContext] = useState<any>(null)

  // 定时器 ref
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------- 派生数据 ----------
  const userContainers = useMemo(() => {
    return containers.filter(c => c.user_username === username)
  }, [containers, username])

  const terminalDisplayName = useMemo(() => {
    if (!terminalContext) return ''
    const { containerName, serverName } = terminalContext
    if (containerName && serverName) return `${containerName} @ ${serverName}`
    return containerName || serverName || ''
  }, [terminalContext])

  const terminalDisplayAddress = useMemo(() => {
    if (!terminalContext) return ''
    const { host, port } = terminalContext
    if (host && port) return `${host}:${port}`
    return host || ''
  }, [terminalContext])

  // ---------- 暴露给父组件 ----------
  useImperativeHandle(ref, () => ({
    containers,
    fetchData
  }), [containers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- API 请求 ----------
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get('/api/containers')
      setContainers(response.data.containers || [])
    } catch (err) {
      console.error('获取容器数据失败:', err)
      setError('获取容器数据失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  const startContainer = useCallback(async (containerId: string) => {
    setActionLoading(`start-${containerId}`)
    try {
      await axios.post(`/api/containers/${containerId}/start`)
      message.success('容器启动成功')
      fetchData()
    } catch (err: any) {
      console.error('启动容器失败:', err)
      message.error(err.response?.data?.msg || '启动容器失败')
    } finally {
      setActionLoading(null)
    }
  }, [fetchData])

  const stopContainer = useCallback(async (containerId: string) => {
    setActionLoading(`stop-${containerId}`)
    try {
      await axios.post(`/api/containers/${containerId}/stop`)
      message.success('容器停止成功')
      fetchData()
    } catch (err: any) {
      console.error('停止容器失败:', err)
      message.error(err.response?.data?.msg || '停止容器失败')
    } finally {
      setActionLoading(null)
    }
  }, [fetchData])

  const showPassword = useCallback((container: any) => {
    setCurrentContainer(container)
    setContainerPassword(container.root_password || '未设置密码')
    setPasswordDialogVisible(true)
  }, [])

  const handleCopyPassword = useCallback(async () => {
    try {
      await copyText(containerPassword)
      message.success('密码已复制到剪贴板')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }, [containerPassword])

  const handleSshCommand = useCallback(async (option: SshOption, container: any) => {
    if (!option?.value) {
      message.warning('未找到可用的目标地址')
      return
    }
    if (!container?.port) {
      message.warning('该容器未配置SSH端口')
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

  const openRemoteTerminal = useCallback(async (container: any, host: string) => {
    const sanitizedHost = sanitizeTarget(host)
    if (!sanitizedHost) {
      message.warning('请选择有效的连接地址')
      return
    }
    if (!container?.port) {
      message.warning('该容器未配置SSH端口')
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
      setTerminalDialogVisible(true)
    } catch (err: any) {
      console.error('获取服务器令牌失败:', err)
      message.error(err.response?.data?.msg || '获取服务器令牌失败，无法打开远程终端')
    }
  }, [])

  const handleRemoteLogin = useCallback((option: SshOption, container: any) => {
    if (!option?.value) {
      message.warning('未找到可用的目标地址')
      return
    }
    openRemoteTerminal(container, option.value)
  }, [openRemoteTerminal])

  const notifyMissingNetwork = useCallback(() => {
    message.warning('暂时无法获取服务器网络信息，请稍后再试')
  }, [])

  // ---------- 自动刷新 ----------
  const stopAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const startAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) return
    refreshTimerRef.current = setInterval(() => {
      fetchData()
    }, 30000)
  }, [fetchData])

  // 终端对话框关闭时刷新数据并恢复自动刷新
  useEffect(() => {
    if (terminalDialogVisible) {
      stopAutoRefresh()
    } else {
      fetchData()
      startAutoRefresh()
    }
  }, [terminalDialogVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  // 初始化
  useEffect(() => {
    fetchData()
    startAutoRefresh()
    return () => stopAutoRefresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- 表格列 ----------
  const columns: ColumnsType<any> = useMemo(() => [
    {
      title: '容器名称',
      dataIndex: 'container_name',
      width: 120
    },
    {
      title: '服务器',
      dataIndex: 'server_name',
      width: 140
    },
    {
      title: '镜像',
      dataIndex: 'image_name',
      width: 200
    },
    {
      title: 'CPU',
      dataIndex: 'cpu_cores',
      width: 60,
      align: 'center'
    },
    {
      title: '内存',
      width: 80,
      align: 'center',
      render: (_, record) => formatMemory(record.memory_mb)
    },
    {
      title: 'SSH',
      dataIndex: 'port',
      width: 70
    },
    {
      title: '状态',
      width: 80,
      render: (_, record) => (
        <Tag color={getStatusType(record.status)}>
          {getStatusText(record.status)}
        </Tag>
      )
    },
    {
      title: '操作',
      width: 420,
      render: (_, record) => {
        const remoteOptions = getSshOptions(record, false)
        const sshOptions = getSshOptions(record)

        const remoteMenuItems: MenuProps['items'] = remoteOptions.map(opt => ({
          key: `remote-${opt.key}`,
          label: opt.label,
          onClick: () => handleRemoteLogin(opt, record)
        }))

        const sshMenuItems: MenuProps['items'] = sshOptions.map(opt => ({
          key: opt.key,
          label: opt.label,
          onClick: () => handleSshCommand(opt, record)
        }))

        return (
          <div className="container-actions">
            {/* 启动 / 停止 */}
            {record.status !== 'running' ? (
              <Button
                size="small"
                type="primary"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                icon={<PlayCircleOutlined />}
                loading={actionLoading === `start-${record.id}`}
                onClick={() => startContainer(record.id)}
              >
                启动
              </Button>
            ) : (
              <Button
                size="small"
                type="primary"
                style={{ background: '#faad14', borderColor: '#faad14' }}
                icon={<PauseCircleOutlined />}
                loading={actionLoading === `stop-${record.id}`}
                onClick={() => stopContainer(record.id)}
              >
                停止
              </Button>
            )}

            {/* 远程登录 */}
            {remoteOptions.length > 0 ? (
              <Dropdown menu={{ items: remoteMenuItems }} trigger={['click']}>
                <Button size="small" type="primary" className="ssh-button">
                  <DesktopOutlined />
                  <span>远程登录</span>
                  <CaretDownOutlined className="dropdown-icon" />
                </Button>
              </Dropdown>
            ) : (
              <Button
                size="small"
                type="primary"
                className="ssh-button ssh-button--disabled"
                onClick={notifyMissingNetwork}
              >
                <DesktopOutlined />
                <span>远程登录</span>
              </Button>
            )}

            {/* SSH 指令 */}
            {sshOptions.length > 0 ? (
              <Dropdown menu={{ items: sshMenuItems }} trigger={['click']}>
                <Button size="small" type="primary" className="ssh-button">
                  <LinkOutlined />
                  <span>SSH指令</span>
                  <CaretDownOutlined className="dropdown-icon" />
                </Button>
              </Dropdown>
            ) : (
              <Button
                size="small"
                type="primary"
                className="ssh-button ssh-button--disabled"
                onClick={notifyMissingNetwork}
              >
                <LinkOutlined />
                <span>SSH指令</span>
              </Button>
            )}

            {/* 查看密码 */}
            <Button
              size="small"
              icon={<KeyOutlined />}
              loading={actionLoading === `password-${record.id}`}
              onClick={() => showPassword(record)}
            >
              查看密码
            </Button>
          </div>
        )
      }
    }
  ], [actionLoading, startContainer, stopContainer, handleRemoteLogin, handleSshCommand, showPassword, notifyMissingNetwork])

  // ==================== 渲染 ====================

  return (
    <div className="user-containers">
      <Spin spinning={loading}>
        {error ? (
          <div className="error-container">
            <Empty
              image={<WarningOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />}
              description={error}
            >
              <Button type="primary" onClick={fetchData}>重试</Button>
            </Empty>
          </div>
        ) : userContainers.length === 0 ? (
          <div className="empty-container">
            <Empty
              image={<AppstoreIcon />}
              description="暂无容器信息，这里显示的是新系统下创建的容器，可执行启动、停止、查看密码的操作。"
            />
          </div>
        ) : (
          <div className="containers-table-wrapper">
            <Table
              dataSource={userContainers}
              columns={columns}
              rowKey="id"
              bordered
              pagination={false}
              scroll={{ x: 1100 }}
            />
          </div>
        )}
      </Spin>

      {/* 密码对话框 */}
      <Modal
        open={passwordDialogVisible}
        title="容器密码"
        width={400}
        centered
        destroyOnHidden
        onCancel={() => setPasswordDialogVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPasswordDialogVisible(false)}>
            关闭
          </Button>,
          <Button key="copy" type="primary" onClick={handleCopyPassword}>
            复制密码
          </Button>
        ]}
      >
        <div className="password-container">
          <p><strong>容器名称：</strong>{currentContainer?.container_name || ''}</p>
          <p><strong>容器密码：</strong>{containerPassword}</p>
        </div>
      </Modal>

      {/* 终端对话框 */}
      {terminalContext && authToken && (
        <TerminalDialog
          open={terminalDialogVisible}
          onClose={() => setTerminalDialogVisible(false)}
          serverId={terminalContext.serverId}
          containerId={terminalContext.containerId}
          serverName={terminalDisplayName || '容器远程登录'}
          serverAddress={terminalDisplayAddress}
          serverUser={terminalContext.user || 'root'}
          targetHost={terminalContext.host}
          targetPort={terminalContext.port}
          loginUsername={terminalContext.user || 'root'}
          authToken={authToken}
        />
      )}
    </div>
  )
})

// 空状态图标组件
function AppstoreIcon() {
  return (
    <div style={{ fontSize: 40, marginBottom: 10, color: '#909399' }}>
      <svg viewBox="0 0 1024 1024" width="40" height="40" fill="currentColor">
        <path d="M888 64H136c-39.8 0-72 32.2-72 72v752c0 39.8 32.2 72 72 72h752c39.8 0 72-32.2 72-72V136c0-39.8-32.2-72-72-72zM440 896H168V584h272v312zm0-384H168V200h272v312zm416 384H512V584h344v312zm0-384H512V200h344v312z" />
      </svg>
    </div>
  )
}

UserContainers.displayName = 'UserContainers'

export default UserContainers
