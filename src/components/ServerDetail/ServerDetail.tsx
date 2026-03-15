import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { Skeleton, Empty, Button, Tag, Card, message } from 'antd'
import {
  WarningFilled,
  DesktopOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { fetchServerDetails, fetchServerSystemData } from '../../store/serversSlice'
import type { AppDispatch } from '../../store'
import CpuMonitor from '../CpuMonitor/CpuMonitor'
import GpuMonitor from '../GpuMonitor/GpuMonitor'
import NetworkMonitor from '../NetworkMonitor/NetworkMonitor'
import DockerMonitor from '../DockerMonitor/DockerMonitor'
import './ServerDetail.css'

interface ServerDetailProps {
  serverId: string
}

export default function ServerDetail({ serverId }: ServerDetailProps) {
  const dispatch = useDispatch<AppDispatch>()

  const [serverData, setServerData] = useState<any>(null)
  const [systemData, setSystemData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ==================== 格式化 CPU 数据 ====================

  const formattedCpuData = useMemo(() => {
    if (!systemData?.cpu) {
      return {
        info: {
          brand: 'Unknown CPU',
          arch: 'Unknown',
          count: 0,
          physical_count: 0,
          freq_current: 0,
          freq_max: 0
        },
        usage: 0,
        percent: [],
        memory: { total: 0, used: 0, percent: 0 },
        system: { hostname: 'Unknown', platform: 'Unknown', uptime: 'Unknown' },
        disks: {}
      }
    }

    const cpuData = systemData.cpu

    return {
      info: {
        brand: cpuData.cpu_info?.brand || 'Unknown CPU',
        arch: cpuData.cpu_info?.arch || 'Unknown',
        count: cpuData.cpu_info?.count || 0,
        physical_count: cpuData.cpu_info?.physical_count || 0,
        freq_current: cpuData.cpu_info?.freq_current || 0,
        freq_max: cpuData.cpu_info?.freq_max || 0
      },
      usage: cpuData.cpu_info?.percent || 0,
      percent: cpuData.cpu_info?.per_cpu_percent || [],
      load1_percent: cpuData.cpu_info?.load_percentage?.load1_percent || 0,
      memory: {
        total: cpuData.memory?.total || 0,
        used: cpuData.memory?.used || 0,
        percent: cpuData.memory?.percent || 0
      },
      system: {
        hostname: cpuData.system?.hostname || 'Unknown',
        platform: cpuData.system?.platform || 'Unknown',
        uptime: cpuData.system?.uptime || 'Unknown'
      },
      disks: cpuData.disks || {}
    }
  }, [systemData])

  // ==================== 状态辅助函数 ====================

  const getStatusType = (status: string) => {
    switch (status) {
      case 'online': return 'success'
      case 'offline': return 'error'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return '在线'
      case 'offline': return '离线'
      default: return '未知'
    }
  }

  // ==================== 数据获取 ====================

  const fetchSystemDataOnly = useCallback(async () => {
    try {
      const result = await dispatch(fetchServerSystemData(serverId)).unwrap()
      setSystemData(result)
    } catch (err) {
      console.error('获取系统监控数据失败:', err)
    }
  }, [dispatch, serverId])

  const fetchServerData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const server = await dispatch(fetchServerDetails(serverId)).unwrap()
      setServerData(server)
      await fetchSystemDataOnly()
    } catch (err) {
      console.error('获取服务器数据失败:', err)
      setError('获取服务器数据失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [dispatch, serverId, fetchSystemDataOnly])

  // ==================== 自动刷新 ====================

  const setupAutoRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    refreshIntervalRef.current = setInterval(async () => {
      try {
        const result = await dispatch(fetchServerSystemData(serverId)).unwrap()
        setSystemData(result)
      } catch (err) {
        console.error('实时获取系统监控数据失败:', err)
      }
    }, 1000)
  }, [dispatch, serverId])

  // ==================== 生命周期 ====================

  useEffect(() => {
    if (serverId) {
      fetchServerData()
      setupAutoRefresh()
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [serverId, fetchServerData, setupAutoRefresh])

  // ==================== 渲染：加载状态 ====================

  if (loading) {
    return (
      <div className="server-detail">
        <div className="loading-container">
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      </div>
    )
  }

  // ==================== 渲染：错误状态 ====================

  if (error) {
    return (
      <div className="server-detail">
        <div className="error-container">
          <Empty
            image={<WarningFilled className="empty-icon" />}
            description={error}
          >
            <Button type="primary" onClick={fetchServerData}>重试</Button>
          </Empty>
        </div>
      </div>
    )
  }

  // ==================== 渲染：空数据状态 ====================

  if (!serverData) {
    return (
      <div className="server-detail">
        <div className="empty-container">
          <Empty
            image={<DesktopOutlined className="empty-icon" />}
            description="暂无服务器数据"
          />
        </div>
      </div>
    )
  }

  // ==================== 渲染：正常内容 ====================

  return (
    <div className="server-detail">
      <div className="server-content">
        {/* 服务器基本信息卡片 */}
        <Card
          className="server-info-card"
          hoverable
          title={
            <div className="card-header">
              <div className="server-title">
                <h2>{serverData.name}</h2>
                <Tag color={getStatusType(serverData.status)}>
                  {getStatusText(serverData.status)}
                </Tag>
              </div>
              <div className="server-actions">
                <Button
                  type="primary"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={fetchServerData}
                >
                  刷新数据
                </Button>
              </div>
            </div>
          }
        >
          <div className="server-info-row">
            <div className="info-col">
              <div className="info-label">IP地址:</div>
              <div className="info-value">*.*.*.*</div>
            </div>
            <div className="info-col">
              <div className="info-label">端口:</div>
              <div className="info-value">{serverData.port}</div>
            </div>
            <div className="info-col">
              <div className="info-label">最后在线:</div>
              <div className="info-value">{serverData.last_online || '未知'}</div>
            </div>
            <div className="info-col">
              <div className="info-label">GPU数量:</div>
              <div className="info-value">
                {systemData?.gpu ? systemData.gpu.length : 0}
              </div>
            </div>
            <div className="info-col">
              <div className="info-label">采集间隔:</div>
              <div className="info-value">
                {serverData.collection_interval
                  ? `${serverData.collection_interval} 秒`
                  : '默认'}
              </div>
            </div>
            <div className="info-col">
              <div className="info-label">路由:</div>
              <div className="info-value route-info">
                <div>
                  {serverData.route?.domain || '未配置'}
                </div>
                {serverData.route?.router_mgmt_ip && (
                  <div className="info-sub">
                    管理IP: {serverData.route.router_mgmt_ip}
                  </div>
                )}
                {serverData.route?.ddns_url && (
                  <div className="info-sub">
                    DDNS: {serverData.route.ddns_url}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* 系统监控 */}
        {systemData && (
          <div className="monitor-section">
            <CpuMonitor cpuData={formattedCpuData} />
            <GpuMonitor gpuData={systemData.gpu} />
            <NetworkMonitor networkData={systemData.network} />
            <DockerMonitor dockerData={systemData.docker} />
          </div>
        )}
      </div>
    </div>
  )
}
