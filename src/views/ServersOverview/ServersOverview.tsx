// views/ServersOverview/ServersOverview.tsx
import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  Row, Col, Card, Progress, Skeleton, Empty, Button, Tag, Table,
  Tabs, Avatar, Spin, message
} from 'antd'
import {
  WarningFilled, DesktopOutlined, ReloadOutlined, EyeOutlined,
  PlusOutlined, ArrowUpOutlined, ArrowDownOutlined, UserOutlined,
  BarChartOutlined, LineChartOutlined, LinkOutlined,
  LaptopOutlined, ThunderboltOutlined, CloudServerOutlined,
  DatabaseOutlined, HddOutlined
} from '@ant-design/icons'
import axios from '../../utils/axios'
import {
  fetchServers as fetchServersAction,
  fetchServerSystemData as fetchServerSystemDataAction,
  selectServers
} from '../../store/serversSlice'
import { resolveAvatarUrl } from '../../utils/avatar'
import ContainerRequestForm from '../../components/ContainerRequestForm/ContainerRequestForm'
import DanmakuChat from '../../components/DanmakuChat/DanmakuChat'
import type { AppDispatch } from '../../store'
import type { ColumnsType } from 'antd/es/table'
import './ServersOverview.css'

// ==================== 类型定义 ====================

interface ServersOverviewProps {
  embedded?: boolean
  filterServerIds?: string[]
  username?: string
  includeHidden?: boolean
  showHiddenOnly?: boolean
}

// ==================== 工具函数（组件外部，永不重建） ====================

function clampPercentage(value: any): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.round(Math.max(0, Math.min(100, num)) * 100) / 100
}

function getColorForPercentage(percentage: number): string {
  if (percentage < 50) return '#67C23A'
  if (percentage < 80) return '#E6A23C'
  return '#F56C6C'
}

function getTemperatureColor(temperature: number): string {
  if (temperature < 60) return '#67C23A'
  if (temperature < 80) return '#E6A23C'
  return '#F56C6C'
}

function formatGb(value: any, fractionDigits = 1): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return `${(0).toFixed(fractionDigits)} GB`
  return `${num.toFixed(fractionDigits)} GB`
}

function formatTb(value: any, fractionDigits = 2): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return `${(0).toFixed(fractionDigits)} TB`
  return `${(num / 1024).toFixed(fractionDigits)} TB`
}

function formatCoreUsage(used: any, total: any): string {
  const usedNum = Number(used)
  const totalNum = Number(total)
  const safeUsed = Number.isFinite(usedNum) && usedNum > 0 ? usedNum : 0
  const safeTotal = Number.isFinite(totalNum) && totalNum > 0 ? Math.round(totalNum) : 0
  const usedText = safeUsed >= 100 ? safeUsed.toFixed(0) : safeUsed.toFixed(1)
  return `${usedText} / ${safeTotal} 核心`
}

function formatPercentValue(value: any): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0%'
  return `${num.toFixed(2)}%`
}

function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '未知时间'
  return new Date(timestamp).toLocaleString('zh-CN')
}

function formatLastOnline(lastOnline: any): string {
  if (!lastOnline) return '未知时间'
  const now = new Date()
  const lastDate = new Date(lastOnline)
  const diffMs = now.getTime() - lastDate.getTime()
  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHr = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMin < 1) return '刚刚离线'
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHr < 24) return `${diffHr}小时前`
  if (diffDay < 30) return `${diffDay}天前`
  return lastDate.toLocaleDateString('zh-CN')
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function formatMemory(memoryValue: any): string {
  if (memoryValue === undefined || memoryValue === null) return '0 MB'
  if (typeof memoryValue === 'string') {
    const match = memoryValue.match(/(\d+(\.\d+)?)\s*(MB|GB|KB)?/i)
    if (match) {
      const num = parseFloat(match[1])
      if (match[3]) return `${num.toFixed(1)} ${match[3]}`
      if (num >= 1024) return `${(num / 1024).toFixed(1)} GB`
      return `${num.toFixed(1)} MB`
    }
    const num = parseFloat(memoryValue) || 0
    if (num >= 1024) return `${(num / 1024).toFixed(1)} GB`
    return `${num.toFixed(1)} MB`
  }
  const num = Number(memoryValue)
  if (num >= 1024) return `${(num / 1024).toFixed(1)} GB`
  return `${num.toFixed(1)} MB`
}

function formatGiB(bytes: any): string {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value < 0) return '-'
  const gib = value / (1024 ** 3)
  if (gib < 1 && gib > 0) return '<1 GiB'
  return `${Math.round(gib)} GiB`
}

function parseMemoryToBytes(value: any): number | undefined {
  if (value == null) return undefined
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const match = value.trim().match(/([0-9]+(?:\.[0-9]+)?)(\s*)([A-Za-z]+)?/)
  if (!match) return undefined
  const numeric = Number(match[1])
  if (!Number.isFinite(numeric)) return undefined
  const unit = (match[3] || '').toUpperCase()
  const unitMap: Record<string, number> = {
    B: 1, KB: 1024, KIB: 1024, MB: 1024 ** 2, MIB: 1024 ** 2,
    GB: 1024 ** 3, GIB: 1024 ** 3, TB: 1024 ** 4, TIB: 1024 ** 4
  }
  return numeric * (unitMap[unit] || 1)
}

function formatProcessGpuUtilization(value: any): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return '-'
  return `${Math.round(num)}%`
}

function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B/s'
  const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s', 'TiB/s']
  let rate = value
  let idx = 0
  while (rate >= 1024 && idx < units.length - 1) { rate /= 1024; idx++ }
  const digits = rate >= 100 ? 0 : rate >= 10 ? 1 : 2
  return `${rate.toFixed(digits)} ${units[idx]}`
}

function formatBytesValue(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '-'
  if (value === 0) return '0 Bytes'
  return formatBytes(value)
}

function normalizeContainerIdentifier(value: any): string {
  if (!value) return ''
  const source = Array.isArray(value) ? value[0] : value
  if (!source || typeof source !== 'string') return ''
  return source.replace(/^\/+/, '').toLowerCase()
}

function getContainerDisplayName(container: any): string {
  if (!container) return '未知容器'
  const candidates = [container.Name, container.name, ...(Array.isArray(container.Names) ? container.Names : [])].filter(Boolean)
  const name = candidates.length > 0 ? candidates[0] : '未知容器'
  return typeof name === 'string' ? name.replace(/^\/+/, '') || '未知容器' : '未知容器'
}

function toSafePercent(value: any): number {
  const num = Number.parseFloat(value)
  if (!Number.isFinite(num)) return 0
  return Math.min(100, Math.max(0, num))
}

function toNumber(value: any): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const GROUP_LABELS: Record<string, string> = {
  undergrad: '本科生', master: '硕士生', phd: '博士生',
  teacher: '教师', unassigned: '未分组'
}

const GROUP_CLASS_MAP: Record<string, string> = {
  undergrad: 'group-undergrad', master: 'group-master', phd: 'group-phd',
  teacher: 'group-teacher', unassigned: 'group-unassigned'
}

function formatGroupLabel(code: string, entryYear: any): string {
  const groupKey = code || 'unassigned'
  const baseLabel = GROUP_LABELS[groupKey] || GROUP_LABELS.unassigned
  if ((groupKey === 'undergrad' || groupKey === 'master') && entryYear) {
    const yearNum = Number(entryYear)
    if (Number.isFinite(yearNum)) {
      return `${String(yearNum % 100).padStart(2, '0')}级${baseLabel}`
    }
  }
  return baseLabel
}

// 从原始数据中提取服务器监控数据
function extractServerData(data: any) {
  const cpu = data?.cpu
  const gpu = data?.gpu
  const network = data?.network

  return {
    hostname: cpu?.system?.hostname || '未知主机',
    uptime: cpu?.system?.uptime || '未知',
    version: cpu?.system?.version || '未知系统版本',
    cpuInfo: cpu?.cpu_info,
    cpuUsage: cpu?.cpu_info?.percent || 0,
    cpuLoad1: cpu?.cpu_info?.load_percentage?.load1_percent || 0,
    memPercent: cpu?.memory?.percent || 0,
    memUsed: cpu?.memory?.used || 0,
    memTotal: cpu?.memory?.total || 0,
    disks: cpu?.disks || {},
    gpuList: gpu || [],
    gpuCount: gpu?.length || 0,
    network,
    dockerContainers: data?.docker || [],
    hasData: !!data
  }
}

// 计算容器网络行数据
function computeContainerNetworkRows(serverData: any) {
  const containers = serverData?.docker || []
  const network = serverData?.network
  const dockerPortData = network?.['docker-port']

  // port data
  const portData: any[] = []
  if (Array.isArray(dockerPortData)) {
    const dockerMap = containers.reduce((acc: any, item: any) => {
      if (item?.Name) acc[item.Name] = item
      return acc
    }, {})

    dockerPortData.forEach((container: any) => {
      const containerName = Object.keys(container)[0]
      const ports = container[containerName] || {}
      const dockerInfo = dockerMap[containerName] || {}
      portData.push({
        container: containerName,
        ssh: ports.ssh || '-',
        tcp: ports.tcp || '-',
        txRate: dockerInfo.NetTxRateHuman || '-',
        rxRate: dockerInfo.NetRxRateHuman || '-',
        diskWriteRate: dockerInfo.BlkWriteRateHuman || '-',
        diskReadRate: dockerInfo.BlkReadRateHuman || '-',
        netTxBytes: dockerInfo.NetTxBytes || dockerInfo.net_tx_bytes || 0,
        netRxBytes: dockerInfo.NetRxBytes || dockerInfo.net_rx_bytes || 0,
        blkWriteBytes: dockerInfo.BlkWriteBytes || dockerInfo.blk_write_bytes || 0,
        blkReadBytes: dockerInfo.BlkReadBytes || dockerInfo.blk_read_bytes || 0
      })
    })
  }

  const portMap = new Map()
  portData.forEach((item: any) => {
    const key = normalizeContainerIdentifier(item.container)
    if (!portMap.has(key)) portMap.set(key, item)
  })

  const rows: any[] = []
  const usedKeys = new Set()

  containers.forEach((container: any) => {
    const displayName = getContainerDisplayName(container)
    const key = normalizeContainerIdentifier(displayName)
    const port = portMap.get(key)

    const memoryBytes = container.MemUsageBytes ?? container.mem_usage_bytes ?? parseMemoryToBytes(container.MemUsage || container.mem_usage)
    const netTxRateRaw = toNumber(container.NetTxRate ?? container.net_tx_rate)
    const netRxRateRaw = toNumber(container.NetRxRate ?? container.net_rx_rate)
    const netTxBytesRaw = toNumber(container.NetTxBytes ?? container.net_tx_bytes)
    const netRxBytesRaw = toNumber(container.NetRxBytes ?? container.net_rx_bytes)
    const blkWriteRateRaw = toNumber(container.BlkWriteRate ?? container.blk_write_rate)
    const blkReadRateRaw = toNumber(container.BlkReadRate ?? container.blk_read_rate)
    const blkWriteBytesRaw = toNumber(container.BlkWriteBytes ?? container.blk_write_bytes)
    const blkReadBytesRaw = toNumber(container.BlkReadBytes ?? container.blk_read_bytes)

    rows.push({
      key,
      displayName,
      cpuPercent: toSafePercent(container.CPUPerc),
      memoryPercent: toSafePercent(container.MemPerc),
      memoryUsageGiB: formatGiB(memoryBytes),
      gpuMemoryPercent: toSafePercent(container.GPUMemPerc),
      gpuMemoryUsage: container.GPUMemUsage || container.gpu_mem_usage || 0,
      ssh: port?.ssh || '-',
      tcp: port?.tcp || '-',
      txRate: netTxRateRaw > 0 ? formatRate(netTxRateRaw) : (port?.txRate || '-'),
      rxRate: netRxRateRaw > 0 ? formatRate(netRxRateRaw) : (port?.rxRate || '-'),
      diskWriteRate: blkWriteRateRaw > 0 ? formatRate(blkWriteRateRaw) : (port?.diskWriteRate || '-'),
      diskReadRate: blkReadRateRaw > 0 ? formatRate(blkReadRateRaw) : (port?.diskReadRate || '-'),
      netTxRateRaw, netRxRateRaw, netTxBytesRaw, netRxBytesRaw,
      blkWriteRateRaw, blkReadRateRaw, blkWriteBytesRaw, blkReadBytesRaw,
      netTxBytesHuman: formatBytesValue(netTxBytesRaw),
      netRxBytesHuman: formatBytesValue(netRxBytesRaw),
      blkWriteBytesHuman: formatBytesValue(blkWriteBytesRaw),
      blkReadBytesHuman: formatBytesValue(blkReadBytesRaw),
    })
    usedKeys.add(key)
  })

  portData.forEach((item: any) => {
    const key = normalizeContainerIdentifier(item.container)
    if (usedKeys.has(key)) return
    rows.push({
      key,
      displayName: typeof item.container === 'string' ? item.container.replace(/^\/+/, '') : '未知容器',
      cpuPercent: 0, memoryPercent: 0, memoryUsageGiB: '-',
      gpuMemoryPercent: 0, gpuMemoryUsage: 0,
      ssh: item.ssh || '-', tcp: item.tcp || '-',
      txRate: item.txRate || '-', rxRate: item.rxRate || '-',
      diskWriteRate: item.diskWriteRate || '-', diskReadRate: item.diskReadRate || '-',
      netTxRateRaw: 0, netRxRateRaw: 0, netTxBytesRaw: 0, netRxBytesRaw: 0,
      blkWriteRateRaw: 0, blkReadRateRaw: 0, blkWriteBytesRaw: 0, blkReadBytesRaw: 0,
      netTxBytesHuman: '-', netRxBytesHuman: '-',
      blkWriteBytesHuman: '-', blkReadBytesHuman: '-'
    })
  })

  return rows
}

// 计算 IO 汇总
function computeIoTotals(networkRows: any[]) {
  const totals = networkRows.reduce((acc, row) => {
    acc.netTxRate += row.netTxRateRaw || 0
    acc.netRxRate += row.netRxRateRaw || 0
    acc.netTxBytes += row.netTxBytesRaw || 0
    acc.netRxBytes += row.netRxBytesRaw || 0
    acc.blkWriteRate += row.blkWriteRateRaw || 0
    acc.blkReadRate += row.blkReadRateRaw || 0
    acc.blkWriteBytes += row.blkWriteBytesRaw || 0
    acc.blkReadBytes += row.blkReadBytesRaw || 0
    return acc
  }, { netTxRate: 0, netRxRate: 0, netTxBytes: 0, netRxBytes: 0, blkWriteRate: 0, blkReadRate: 0, blkWriteBytes: 0, blkReadBytes: 0 })

  return {
    netTxRateHuman: formatRate(totals.netTxRate),
    netRxRateHuman: formatRate(totals.netRxRate),
    netTxBytesHuman: formatBytesValue(totals.netTxBytes),
    netRxBytesHuman: formatBytesValue(totals.netRxBytes),
    blkWriteRateHuman: formatRate(totals.blkWriteRate),
    blkReadRateHuman: formatRate(totals.blkReadRate),
    blkWriteBytesHuman: formatBytesValue(totals.blkWriteBytes),
    blkReadBytesHuman: formatBytesValue(totals.blkReadBytes)
  }
}

// ==================== 表格列定义（组件外部，永不重建） ====================

const CONTAINER_NETWORK_COLUMNS: ColumnsType<any> = [
  {
    title: '容器', dataIndex: 'displayName', width: 80,
    render: (text) => (
      <div className="container-name-cell">
        <UserOutlined />
        <span>{text}</span>
      </div>
    )
  },
  {
    title: 'CPU', width: 90,
    render: (_, row) => (
      <Progress
        percent={row.cpuPercent}
        strokeColor={getColorForPercentage(row.cpuPercent)}
        size="small"
        format={() => `${row.cpuPercent.toFixed(1)}%`}
      />
    )
  },
  {
    title: '内存', width: 90,
    render: (_, row) => (
      <Progress
        percent={row.memoryPercent}
        strokeColor={getColorForPercentage(row.memoryPercent)}
        size="small"
        format={() => row.memoryUsageGiB}
      />
    )
  },
  {
    title: '显存', width: 90,
    render: (_, row) => (
      <Progress
        percent={row.gpuMemoryPercent}
        strokeColor={getColorForPercentage(row.gpuMemoryPercent)}
        size="small"
        format={() => formatMemory(row.gpuMemoryUsage)}
      />
    )
  },
  {
    title: 'SSH', width: 70, align: 'center' as const,
    render: (_, row) => row.ssh && row.ssh !== '-'
      ? <Tag color="success">{row.ssh}</Tag>
      : <span>-</span>
  },
  {
    title: '网络 (上传/下载)', width: 170,
    render: (_, row) => (
      <div className="traffic-double">
        <div className="traffic-row traffic-row--current">
          <div className="traffic-cell">
            <ArrowUpOutlined className="traffic-icon traffic-icon--upload" />
            <span className="traffic-value traffic-value--upload">{row.txRate || '-'}</span>
          </div>
          <div className="traffic-cell traffic-cell--down">
            <span className="traffic-value traffic-value--download">{row.rxRate || '-'}</span>
            <ArrowDownOutlined className="traffic-icon traffic-icon--download" />
          </div>
        </div>
        <div className="traffic-row traffic-row--muted">
          <div className="traffic-cell">
            <span className="traffic-value traffic-value--muted">{row.netTxBytesHuman || '-'}</span>
          </div>
          <div className="traffic-cell traffic-cell--down">
            <span className="traffic-value traffic-value--muted">{row.netRxBytesHuman || '-'}</span>
          </div>
        </div>
      </div>
    )
  },
  {
    title: '磁盘 (读取/写入)', width: 170,
    render: (_, row) => (
      <div className="traffic-double">
        <div className="traffic-row traffic-row--current">
          <div className="traffic-cell">
            <ArrowUpOutlined className="traffic-icon traffic-icon--read" />
            <span className="traffic-value traffic-value--read">{row.diskReadRate || '-'}</span>
          </div>
          <div className="traffic-cell traffic-cell--down">
            <span className="traffic-value traffic-value--write">{row.diskWriteRate || '-'}</span>
            <ArrowDownOutlined className="traffic-icon traffic-icon--write" />
          </div>
        </div>
        <div className="traffic-row traffic-row--muted">
          <div className="traffic-cell">
            <span className="traffic-value traffic-value--muted">{row.blkReadBytesHuman || '-'}</span>
          </div>
          <div className="traffic-cell traffic-cell--down">
            <span className="traffic-value traffic-value--muted">{row.blkWriteBytesHuman || '-'}</span>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'TCP', width: 90,
    render: (_, row) => <span>{row.tcp || '-'}</span>
  }
]

const GPU_PROCESS_COLUMNS: ColumnsType<any> = [
  { title: 'PID', dataIndex: 'pid', width: 75 },
  { title: '用户', dataIndex: 'username', width: 60 },
  { title: '运行时间', dataIndex: 'running_time', width: 77 },
  {
    title: '显存', width: 90,
    render: (_, row) => <span className="table-badge">{row.gpu_memory || row.memory_usage || '0'}</span>
  },
  {
    title: 'GPU占用', width: 80,
    render: (_, row) => <span className="table-badge gpu-usage">{formatProcessGpuUtilization(row.gpu_sm_utilization)}</span>
  },
  { title: '命令', dataIndex: 'command', width: 300, ellipsis: true }
]

// ==================== ServerCard 子组件（memo 避免不必要的重渲染） ====================

interface ServerCardProps {
  server: any
  serverData: any
  onRequestContainer: (server: any) => void
  onViewDetail: (serverId: string) => void
}

const ServerCard = memo(function ServerCard({
  server,
  serverData,
  onRequestContainer,
  onViewDetail
}: ServerCardProps) {
  const sd = useMemo(() => extractServerData(serverData), [serverData])
  const isOffline = server.status === 'offline'
  const networkRows = useMemo(() => computeContainerNetworkRows(serverData), [serverData])
  const ioTotals = useMemo(() => computeIoTotals(networkRows), [networkRows])

  return (
    <Card className={`server-card ${isOffline ? 'offline-server' : ''}`} hoverable>
      {/* 离线覆盖层 */}
      {isOffline && (
        <div className="offline-overlay">
          <div className="offline-message">
            <div className="offline-icon">🔴</div>
            <div className="offline-server-name">{sd.hostname}</div>
            <div className="offline-text">服务器离线</div>
            <div className="offline-time">{formatLastOnline(server.last_online)}</div>
          </div>
        </div>
      )}

      {/* 服务器头部 */}
      <div className="server-header">
        <div className="server-title">
          <h2>{sd.hostname}</h2>
        </div>
        {sd.hasData && (
          <div className="server-system-info">
            <span className="uptime">运行时间: {sd.uptime}</span>
            <span className="platform">{sd.version}</span>
          </div>
        )}
        <div className="server-actions">
          <Button onClick={() => onRequestContainer(server)} disabled={isOffline}>
            <PlusOutlined /><span>申请容器</span>
          </Button>
          <Button type="primary" onClick={() => onViewDetail(server.id)} disabled={isOffline} style={{ marginLeft: 8 }}>
            <EyeOutlined /><span>查看详情</span>
          </Button>
        </div>
      </div>

      {/* 监控数据 */}
      {sd.hasData ? (
        <div className="server-monitoring">
          <Row gutter={20}>
            {/* CPU 监控 */}
            <Col xs={24} sm={24} md={6} lg={6} xl={6}>
              <div className="monitor-section">
                <h3 className="section-title"><LaptopOutlined /><span>CPU监控</span></h3>

                {sd.cpuInfo && (
                  <div className="cpu-info">
                    <div className="cpu-specs">
                      <div className="cpu-header">
                        <div className="cpu-model">{sd.cpuInfo.brand || '未知处理器'}</div>
                        <div className="cpu-arch">{sd.cpuInfo.arch || '未知架构'}</div>
                      </div>
                      <div className="cpu-metrics">
                        <div className="metric-item">
                          <div className="metric-icon">💻</div>
                          <div className="metric-content">
                            <div className="metric-label">核心数量</div>
                            <div className="metric-value">
                              <span className="main-value">{sd.cpuInfo.count || 0}</span>
                              <span className="sub-value">({sd.cpuInfo.physical_count || 0}物理)</span>
                            </div>
                          </div>
                        </div>
                        <div className="metric-item">
                          <div className="metric-icon">⚡</div>
                          <div className="metric-content">
                            <div className="metric-label">频率</div>
                            <div className="metric-value">
                              <span className="main-value">{sd.cpuInfo.freq_current?.toFixed(0) || 0}</span>
                              <span className="sub-value">/ {sd.cpuInfo.freq_max || 0} MHz</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="stat-row">
                  <span className="stat-label">CPU使用率:</span>
                  <Progress
                    percent={Math.min(100, Math.max(0, sd.cpuUsage))}
                    strokeColor={getColorForPercentage(sd.cpuUsage)}
                    size="small"
                    format={() => `${sd.cpuUsage.toFixed(1)}%`}
                  />
                </div>
                <div className="stat-row">
                  <span className="stat-label">系统负载:</span>
                  <Progress
                    percent={Math.min(100, Math.max(0, sd.cpuLoad1))}
                    strokeColor={getColorForPercentage(sd.cpuLoad1)}
                    size="small"
                    format={() => `${sd.cpuLoad1.toFixed(1)}%`}
                  />
                </div>
                <div className="stat-row">
                  <span className="stat-label">内存使用:</span>
                  <Progress
                    percent={Math.min(100, Math.max(0, sd.memPercent))}
                    strokeColor={getColorForPercentage(sd.memPercent)}
                    size="small"
                    format={() => `${sd.memUsed.toFixed(2)} GB / ${sd.memTotal.toFixed(2)} GB`}
                  />
                </div>

                <div className="section-subtitle">
                  <HddOutlined /><span>磁盘信息</span>
                </div>
                {Object.keys(sd.disks).length > 0 ? (
                  <div className="disk-info">
                    {Object.entries(sd.disks).map(([diskKey, disk]: [string, any]) => {
                      const diskPercent = disk.usage?.total
                        ? (disk.usage.used / disk.usage.total * 100)
                        : (disk.usage?.percent || 0)
                      return (
                        <div key={diskKey} className="disk-item">
                          <div className="disk-label">{diskKey}</div>
                          <Progress
                            percent={Math.min(100, Math.max(0, diskPercent))}
                            strokeColor={getColorForPercentage(diskPercent)}
                            size="small"
                            format={() => `${disk.usage?.used || 0} ${disk.usage?.unit || 'GB'} / ${disk.usage?.total || 0} ${disk.usage?.unit || 'GB'} (${diskPercent.toFixed(2)}%)`}
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="no-data-small">无磁盘信息</div>
                )}
              </div>
            </Col>

            {/* GPU 监控 */}
            <Col xs={24} sm={24} md={6} lg={6} xl={6}>
              <div className="monitor-section">
                <h3 className="section-title"><DesktopOutlined /><span>GPU监控</span></h3>
                {sd.gpuCount > 0 ? sd.gpuList.map((gpu: any, index: number) => {
                  const memPercent = gpu.memory_used && gpu.memory_total
                    ? Math.round(gpu.memory_used / gpu.memory_total * 100) : 0
                  const tempPercent = Math.round((gpu.temperature || 0) / 120 * 100)
                  return (
                    <div key={index} className="gpu-item">
                      <div className="gpu-header">
                        <div className="gpu-name">
                          <span className="gpu-model">{gpu.name || `GPU ${index}`}</span>
                          {gpu.device_id && <span className="gpu-id">ID: {gpu.device_id}</span>}
                        </div>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">使用率:</span>
                        <Progress
                          percent={Math.min(100, Math.max(0, gpu.utilization || 0))}
                          strokeColor={getColorForPercentage(gpu.utilization || 0)}
                          size="small"
                          format={() => `${gpu.utilization || 0}%`}
                        />
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">显存:</span>
                        <Progress
                          percent={Math.min(100, Math.max(0, memPercent))}
                          strokeColor={getColorForPercentage(memPercent)}
                          size="small"
                          format={() => `${gpu.memory_used || 0} MB / ${gpu.memory_total || 0} MB`}
                        />
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">温度:</span>
                        <Progress
                          percent={Math.min(100, Math.max(0, tempPercent))}
                          strokeColor={getTemperatureColor(gpu.temperature || 0)}
                          size="small"
                          format={() => `${gpu.temperature || 0}°C`}
                        />
                      </div>
                      {gpu.processes?.length > 0 ? (
                        <div className="gpu-processes">
                          <div className="process-header">进程信息:</div>
                          <Table
                            dataSource={gpu.processes}
                            columns={GPU_PROCESS_COLUMNS}
                            size="small"
                            pagination={false}
                            rowKey={(row) => `${row.pid}-${index}`}
                            scroll={{ x: 600 }}
                            className="custom-table"
                          />
                        </div>
                      ) : (
                        <div className="no-data-small">无GPU进程</div>
                      )}
                    </div>
                  )
                }) : (
                  <div className="no-data">无GPU设备</div>
                )}
              </div>
            </Col>

            {/* 容器与网络 */}
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <div className="monitor-section">
                <h3 className="section-title"><LinkOutlined /><span>容器与网络</span></h3>
                {(sd.network || networkRows.length > 0) ? (
                  <>
                    {sd.network && (
                      <div className="network-info">
                        <div className="network-cards">
                          <div className="network-card">
                            <div className="network-icon">🏠</div>
                            <div className="network-content">
                              <div className="network-label">局域网</div>
                              <div className="network-value">{sd.network['lan-ip'] || '未知'}</div>
                            </div>
                          </div>
                          <div className="network-card">
                            <div className="network-icon">🌐</div>
                            <div className="network-content">
                              <div className="network-label">校园网IP</div>
                              <div className="network-value">{sd.network['edu-ip'] || '未知'}</div>
                            </div>
                          </div>
                          <div className="network-card">
                            <div className="network-icon">🔗</div>
                            <div className="network-content">
                              <div className="network-label">域名</div>
                              <div className="network-value">{sd.network['edu-domain'] || '未知'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {networkRows.length > 0 ? (
                      <div className="container-network-table">
                        {/* IO 汇总卡片 */}
                        <div className="container-summary-cards">
                          <div className="summary-card network-summary">
                            <div className="summary-header">
                              <div className="summary-icon">🌐</div>
                              <div className="summary-title">容器网络</div>
                            </div>
                            <div className="summary-metrics">
                              <div className="metric-row">
                                <div className="metric-label">总流量</div>
                                <div className="metric-value">
                                  <span className="upload-value">↑ {ioTotals.netTxBytesHuman}</span>
                                  <span className="download-value">↓ {ioTotals.netRxBytesHuman}</span>
                                </div>
                              </div>
                              <div className="metric-row">
                                <div className="metric-label">当前速率</div>
                                <div className="metric-value">
                                  <span className="upload-rate">↑ {ioTotals.netTxRateHuman}</span>
                                  <span className="download-rate">↓ {ioTotals.netRxRateHuman}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="summary-card disk-summary">
                            <div className="summary-header">
                              <div className="summary-icon">💾</div>
                              <div className="summary-title">容器磁盘</div>
                            </div>
                            <div className="summary-metrics">
                              <div className="metric-row">
                                <div className="metric-label">总读写</div>
                                <div className="metric-value">
                                  <span className="read-value">↑ {ioTotals.blkReadBytesHuman}</span>
                                  <span className="write-value">↓ {ioTotals.blkWriteBytesHuman}</span>
                                </div>
                              </div>
                              <div className="metric-row">
                                <div className="metric-label">当前速率</div>
                                <div className="metric-value">
                                  <span className="read-rate">↑ {ioTotals.blkReadRateHuman}</span>
                                  <span className="write-rate">↓ {ioTotals.blkWriteRateHuman}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Table
                          dataSource={networkRows}
                          columns={CONTAINER_NETWORK_COLUMNS}
                          size="small"
                          pagination={false}
                          rowKey="key"
                          scroll={{ x: 900 }}
                          className="custom-table"
                        />
                      </div>
                    ) : (
                      <div className="no-data-small">暂无容器网络数据</div>
                    )}
                  </>
                ) : (
                  <div className="no-data">无容器或网络数据</div>
                )}
              </div>
            </Col>
          </Row>
        </div>
      ) : (
        <div className="server-loading">
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      )}
    </Card>
  )
})

// ==================== 主组件 ====================

export default function ServersOverview({
  embedded = false,
  filterServerIds = [],
  username: propUsername = '',
  includeHidden = false,
  showHiddenOnly = false
}: ServersOverviewProps) {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const storeServers = useSelector(selectServers)

  const [servers, setServers] = useState<any[]>([])
  const [serverSystemData, setServerSystemData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 全局指标
  const [globalMetrics, setGlobalMetrics] = useState<any>(null)
  const [globalMetricsLoading, setGlobalMetricsLoading] = useState(false)

  // 进程报表
  const [processReports, setProcessReports] = useState<any>(null)
  const [processReportsLoading, setProcessReportsLoading] = useState(false)
  const [processReportActive, setProcessReportActive] = useState('daily')

  // 容器申请
  const [containerRequestVisible, setContainerRequestVisible] = useState(false)
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 序列化 storeServers 用于深度比较
  const storeServersJson = useMemo(
    () => JSON.stringify(storeServers),
    [storeServers]
  )

  // ==================== 数据获取 ====================

  // 批量获取所有服务器系统数据（一次性 setState）
  const fetchAllSystemData = useCallback(async (serverList: any[]) => {
    const results: Record<string, any> = {}

    await Promise.allSettled(
      serverList.map(async (server) => {
        try {
          const result = await dispatch(fetchServerSystemDataAction(String(server.id))).unwrap()
          results[server.id] = result
        } catch (err) {
          console.error(`获取服务器 ${server.id} 的系统数据失败:`, err)
        }
      })
    )

    // 一次性更新，只触发一次渲染
    if (Object.keys(results).length > 0) {
      setServerSystemData(prev => ({ ...prev, ...results }))
    }
  }, [dispatch])

  const fetchGlobalMetrics = useCallback(async () => {
    if (embedded) return
    try {
      setGlobalMetricsLoading(true)
      const response = await axios.get('/api/servers/aggregate_metrics')
      setGlobalMetrics(response.data)
    } catch (err) {
      console.error('获取全局服务器指标失败:', err)
    } finally {
      setGlobalMetricsLoading(false)
    }
  }, [embedded])

  const fetchProcessReports = useCallback(async () => {
    if (embedded) return
    try {
      setProcessReportsLoading(true)
      const response = await axios.get('/api/process_reports')
      setProcessReports(response.data)
    } catch (err) {
      console.error('获取进程报表失败:', err)
    } finally {
      setProcessReportsLoading(false)
    }
  }, [embedded])

  const fetchAllData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    setError(null)

    try {
      await dispatch(fetchServersAction()).unwrap()
    } catch (err) {
      console.error('获取服务器列表失败:', err)
      setError('获取服务器列表失败，请稍后重试')
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [dispatch])

  // storeServers 变化后同步本地 servers + 批量获取系统数据
  useEffect(() => {
    const parsed: any[] = JSON.parse(storeServersJson)
    const visibleServers = includeHidden
      ? parsed
      : parsed.filter((s: any) => s.is_visible)

    // 避免不必要的更新
    setServers(prev => {
      const newJson = JSON.stringify(visibleServers)
      if (JSON.stringify(prev) === newJson) return prev
      return visibleServers
    })

    // 批量获取系统数据
    fetchAllSystemData(visibleServers)

    if (!embedded) {
      fetchGlobalMetrics()
      fetchProcessReports()
    }
  }, [storeServersJson, includeHidden, embedded, fetchAllSystemData, fetchGlobalMetrics, fetchProcessReports])

  // 初始化 + 自动刷新
  useEffect(() => {
    fetchAllData(true)

    const refreshTime = 2000
    refreshIntervalRef.current = setInterval(() => {
      fetchAllData(false)
    }, refreshTime)

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== 过滤服务器 ====================

  const filteredServers = useMemo(() => {
    const getDockerContainers = (serverId: string) => serverSystemData[serverId]?.docker || []

    if (showHiddenOnly) {
      return servers.filter(server => {
        if (server.is_visible) return false
        if (filterServerIds.length > 0) return filterServerIds.includes(server.id)
        if (propUsername?.trim()) {
          const containers = getDockerContainers(server.id)
          const uname = propUsername.toLowerCase()
          return containers.some((c: any) => {
            const name = c.Names || c.name || c.Name || ''
            const arr = Array.isArray(name) ? name : [name]
            return arr.some((n: string) => n.toLowerCase().includes(uname))
          })
        }
        return false
      })
    }

    if (filterServerIds.length === 0 && !propUsername) return servers

    return servers.filter(server => {
      const matchesId = filterServerIds.includes(server.id)
      let matchesContainer = false
      if (propUsername?.trim()) {
        const containers = getDockerContainers(server.id)
        const uname = propUsername.toLowerCase()
        matchesContainer = containers.some((c: any) => {
          const name = c.Names || c.name || c.Name || ''
          const arr = Array.isArray(name) ? name : [name]
          return arr.some((n: string) => n.toLowerCase().includes(uname))
        })
      }
      return matchesId || matchesContainer
    })
  }, [servers, serverSystemData, showHiddenOnly, filterServerIds, propUsername])

  // ==================== 报表相关 ====================

  const currentProcessReport = useMemo(() => {
    if (!processReports) return null
    return processReports[processReportActive] || null
  }, [processReports, processReportActive])

  const currentProcessRanking = useMemo(() => {
    if (!currentProcessReport?.top_gpu_memory_users) return []
    return currentProcessReport.top_gpu_memory_users
  }, [currentProcessReport])

  // ==================== 稳定的事件处理函数 ====================

  const onRequestContainer = useCallback((server: any) => {
    setSelectedServerId(server.id)
    setContainerRequestVisible(true)
  }, [])

  const onViewDetail = useCallback((serverId: string) => {
    navigate(`/server/${serverId}`)
  }, [navigate])

  const onContainerRequestSubmitted = useCallback(() => {
    message.success('容器申请已提交，请等待管理员审批')
  }, [])

  // ==================== 渲染 ====================

  if (loading) {
    return (
      <div className="servers-overview-wrapper">
        <div className="loading-container"><Skeleton active paragraph={{ rows: 10 }} /></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="servers-overview-wrapper">
        <div className="error-container">
          <Empty description={error} image={<WarningFilled style={{ fontSize: 48, color: '#ff4d4f' }} />}>
            <Button type="primary" onClick={() => fetchAllData(true)}>重试</Button>
          </Empty>
        </div>
      </div>
    )
  }

  return (
    <div className="servers-overview-wrapper">
      <div className={`servers-overview ${embedded ? 'embedded-mode' : ''}`}>
        <div className={`main-content ${embedded ? 'embedded-main' : ''}`}>

          {/* ========== 全局资源概览（非嵌入模式） ========== */}
          {!embedded && (
            <div className="global-metrics-container">
              <Card className="global-metrics-card" hoverable>
                <div className="global-metrics-header">
                  <div className="global-metrics-title">
                    <BarChartOutlined />
                    <span>全局资源概览</span>
                  </div>
                  <div className="global-metrics-meta">
                    {globalMetrics?.meta?.servers_with_data !== undefined && (
                      <Tag color="success">实时 {globalMetrics?.meta?.servers_with_data ?? 0} 台</Tag>
                    )}
                    {processReports?.meta?.generated_at && (
                      <span className="global-metrics-updated">
                        更新于 {formatTimestamp(processReports.meta.generated_at)}
                      </span>
                    )}
                  </div>
                </div>

                {globalMetricsLoading && !globalMetrics ? (
                  <div className="global-metrics-loading"><Skeleton active paragraph={{ rows: 3 }} /></div>
                ) : (
                  <div className="global-gauge-grid">
                    {[
                      { title: 'CPU占用率', key: 'cpu', sub: () => formatCoreUsage(globalMetrics?.cpu?.used_cores, globalMetrics?.cpu?.total_cores) },
                      { title: '内存占用率', key: 'memory', sub: () => `${formatGb(globalMetrics?.memory?.used_gb)} / ${formatGb(globalMetrics?.memory?.total_gb)}` },
                      { title: '存储占用率', key: 'storage', sub: () => `${formatTb(globalMetrics?.storage?.used_gb)} / ${formatTb(globalMetrics?.storage?.total_gb)}` },
                      { title: 'CPU负载', key: 'cpu_load', sub: () => globalMetrics?.cpu_load?.status || '暂无数据' },
                      { title: 'GPU占用率', key: 'gpu', sub: () => `${Number(globalMetrics?.gpu?.gpu_count || 0)} 块显卡` },
                      { title: '显存占用率', key: 'vram', sub: () => `${formatGb(globalMetrics?.vram?.used_gb)} / ${formatGb(globalMetrics?.vram?.total_gb)}` },
                    ].map(item => {
                      const pct = clampPercentage(globalMetrics?.[item.key]?.percentage)
                      return (
                        <div key={item.key} className="gauge-item">
                          <div className="gauge-title">{item.title}</div>
                          <Progress
                            type="dashboard"
                            percent={pct}
                            strokeColor={getColorForPercentage(pct)}
                            strokeWidth={12}
                            size={{ width: 120}}
                            format={(p) => `${(p ?? 0).toFixed(1)}%`}
                          />
                          <div className="gauge-subtitle">{item.sub()}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ========== 任务运行报表（非嵌入模式） ========== */}
          {!embedded && (
            <div className="process-report-container">
              <Card className="process-report-card" hoverable>
                {processReportsLoading && !processReports ? (
                  <div className="process-report-body process-report-body--loading">
                    <div className="process-report-main">
                      <div className="process-report-header">
                        <div className="process-report-title">
                          <LineChartOutlined /><span>任务运行报表</span>
                        </div>
                        <div className="process-report-meta">数据加载中...</div>
                      </div>
                      <Skeleton active paragraph={{ rows: 3 }} />
                    </div>
                    <div className="process-report-ranking ranking-empty">
                      <div className="ranking-title"><BarChartOutlined /><span>显存占用排行</span></div>
                      <div className="ranking-placeholder">加载中...</div>
                    </div>
                  </div>
                ) : (
                  <div className="process-report-body">
                    <div className="process-report-main">
                      <div className="process-report-header">
                        <div className="process-report-title">
                          <LineChartOutlined /><span>任务运行报表</span>
                        </div>
                        {processReports?.meta?.generated_at && (
                          <div className="process-report-meta">
                            更新于 {formatTimestamp(processReports.meta.generated_at)}
                          </div>
                        )}
                      </div>

                      <Tabs
                        activeKey={processReportActive}
                        onChange={setProcessReportActive}
                        className="process-report-tabs"
                        items={[
                          { key: 'daily', label: '日报' },
                          { key: 'weekly', label: '周报' },
                          { key: 'monthly', label: '月报' },
                          { key: 'all', label: '累计' },
                        ]}
                      />

                      <div className="process-report-summary">
                        {currentProcessReport ? (
                          <div className="report-grid">
                            <div className="report-item">
                              <div className="report-label">任务数量</div>
                              <div className="report-value">{currentProcessReport.process_count || 0}</div>
                            </div>
                            <div className="report-item">
                              <div className="report-label">平均CPU占用率</div>
                              <div className="report-value">{formatPercentValue(currentProcessReport.avg_cpu_usage)}</div>
                            </div>
                            <div className="report-item">
                              <div className="report-label">平均GPU占用率</div>
                              <div className="report-value">{formatPercentValue(currentProcessReport.avg_gpu_utilization)}</div>
                            </div>
                            <div className="report-item">
                              <div className="report-label">显存总量</div>
                              <div className="report-value">{formatGb(currentProcessReport.total_gpu_memory_gb, 2)}</div>
                              <div className="report-hint">基于历史进程峰值 (GB)</div>
                            </div>
                            <div className="report-item">
                              <div className="report-label">运行时长总计</div>
                              <div className="report-value">{currentProcessReport.total_runtime_human || '0秒'}</div>
                            </div>
                          </div>
                        ) : (
                          <Empty description="暂无进程历史数据" style={{ height: 80 }} />
                        )}
                      </div>
                    </div>

                    <div className={`process-report-ranking ${!currentProcessRanking.length ? 'ranking-empty' : ''}`}>
                      <div className="ranking-title"><BarChartOutlined /><span>显存占用排行</span></div>
                      {currentProcessRanking.length > 0 ? (
                        <div className="ranking-list">
                          {currentProcessRanking.map((item: any) => (
                            <div key={item.user_id} className="ranking-item">
                              <div className={`ranking-index ${item.rank <= 3 ? 'top-three' : ''}`}>{item.rank}</div>
                              <Avatar
                                size={36}
                                src={resolveAvatarUrl(item.avatar_url, item.username || 'user', 120)}
                                className="ranking-avatar"
                                icon={<UserOutlined />}
                              />
                              <div className="ranking-info">
                                <div className="ranking-header">
                                  <div className="ranking-name" title={item.username || '未知用户'}>
                                    {item.username || '未知用户'}
                                  </div>
                                  <span
                                    className={`ranking-group ${GROUP_CLASS_MAP[item.user_group || 'unassigned'] || 'group-unassigned'}`}
                                    title={formatGroupLabel(item.user_group, item.entry_year)}
                                  >
                                    {formatGroupLabel(item.user_group, item.entry_year)}
                                  </span>
                                </div>
                                <div className="ranking-stats">
                                  <span className="ranking-metric">{formatMemory(item.total_gpu_memory_mb || 0)}</span>
                                  <span className="ranking-divider">·</span>
                                  <span className="ranking-metric">{item.process_count || 0} 个任务</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="ranking-placeholder">暂无排行数据</div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ========== 服务器列表 ========== */}
          {filteredServers.length > 0 ? (
            <div className="servers-grid">
              {filteredServers.map((server: any) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  serverData={serverSystemData[server.id]}
                  onRequestContainer={onRequestContainer}
                  onViewDetail={onViewDetail}
                />
              ))}
            </div>
          ) : (
            <div className="empty-container" style={{ padding: '15px 0' }}>
              <Empty
                description={propUsername ? '您当前没有使用任何服务器' : '暂无服务器数据'}
                image={<DesktopOutlined style={{ fontSize: 40, marginBottom: 10 }} />}
                style={{ height: 60 }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 容器申请表单 */}
      <ContainerRequestForm
        visible={containerRequestVisible}
        onClose={() => setContainerRequestVisible(false)}
        servers={servers}
        selectedServerId={selectedServerId}
        onSubmitted={onContainerRequestSubmitted}
      />

      {/* 弹幕聊天 */}
      <DanmakuChat disabled={embedded} />
    </div>
  )
}
