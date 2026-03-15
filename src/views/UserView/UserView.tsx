import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  Row, Col, Avatar, Tag, Select, Button, Empty, Skeleton,
  Tabs, Table, Spin
} from 'antd'
import {
  DesktopOutlined, AppstoreOutlined, PlayCircleOutlined,
  VideoCameraOutlined, DollarOutlined, ReloadOutlined,
  DownOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import axios from '../../utils/axios'
import { selectCurrentUser } from '../../store/authSlice'
import { fetchServers, selectServers } from '../../store/serversSlice'
import { resolveAvatarUrl } from '../../utils/avatar'
import ServersOverview from '../ServersOverview/ServersOverview'
import UserContainers from '../../components/UserContainers/UserContainers'
import ContainerRequestsList from '../../components/ContainerRequestsList/ContainerRequestsList'
import type { AppDispatch } from '../../store'
import type { ColumnsType } from 'antd/es/table'
import './UserView.css'

// ==================== 常量 ====================

const ALLOWED_TRENDS_HOURS = [1, 6, 24, 72, 168, 360, 720, 1440]
const TRENDS_HOURS_STORAGE_KEY = 'user-trend-hours'
const PROCESS_REPORT_TABS = ['daily', 'weekly', 'monthly', 'all']
const PROCESS_REPORT_TAB_STORAGE_KEY = 'user-process-report-tab'

const HOURS_OPTIONS = [
  { label: '1小时', value: 1 },
  { label: '6小时', value: 6 },
  { label: '24小时', value: 24 },
  { label: '3天', value: 72 },
  { label: '7天', value: 168 },
  { label: '15天', value: 360 },
  { label: '30天', value: 720 },
  { label: '60天', value: 1440 },
]

const REPORT_TAB_ITEMS = [
  { key: 'daily', label: '日报' },
  { key: 'weekly', label: '周报' },
  { key: 'monthly', label: '月报' },
  { key: 'all', label: '累计' },
]

// ==================== 工具函数 ====================

function readStoredHours(): number {
  try {
    const stored = localStorage.getItem(TRENDS_HOURS_STORAGE_KEY)
    if (!stored) return 24
    const parsed = parseInt(stored, 10)
    return ALLOWED_TRENDS_HOURS.includes(parsed) ? parsed : 24
  } catch {
    return 24
  }
}

function readStoredProcessReportTab(): string {
  try {
    const stored = localStorage.getItem(PROCESS_REPORT_TAB_STORAGE_KEY)
    return stored && PROCESS_REPORT_TABS.includes(stored) ? stored : 'daily'
  } catch {
    return 'daily'
  }
}

function formatGb(value: any, fractionDigits = 1): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return `${(0).toFixed(fractionDigits)} GB`
  return `${num.toFixed(fractionDigits)} GB`
}

function formatMemoryMb(value: any): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return '0 MB'
  if (num >= 1024) return `${(num / 1024).toFixed(2)} GB`
  return `${num.toFixed(2)} MB`
}

function formatDateTime(value: any): string {
  if (!value) return '未知'
  try {
    return new Date(value).toLocaleString('zh-CN')
  } catch {
    return String(value)
  }
}

function getGroupTagColor(code: string): string {
  switch (code) {
    case 'undergrad': return 'success'
    case 'master': return 'processing'
    case 'phd': return 'warning'
    case 'teacher': return 'error'
    case 'unassigned': return 'default'
    default: return 'default'
  }
}

// ==================== 图表配置生成 ====================

function makeChartOption(
  series: any[],
  seriesName: string,
  yAxisName: string,
  lineColor: string,
  areaColorStart: string,
  areaColorEnd: string,
  unit: string,
  selectedHours: number
) {
  const xAxisFormatter = (value: number) => {
    const date = new Date(value)
    if (selectedHours <= 24) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }

  return {
    tooltip: {
      trigger: 'axis',
      formatter(params: any) {
        const date = new Date(params[0].value[0])
        const timeStr = date.toLocaleString('zh-CN', {
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        })
        return `${timeStr}<br/>${params[0].seriesName}: ${params[0].value[1]}${unit}`
      }
    },
    xAxis: {
      type: 'time',
      axisLabel: { fontSize: 12, color: '#666', formatter: xAxisFormatter, interval: 0, rotate: 45 },
      splitLine: { show: true, lineStyle: { color: '#f0f0f0', type: 'dashed' } }
    },
    yAxis: {
      type: 'value',
      name: yAxisName,
      nameTextStyle: { fontSize: 12, color: '#666', padding: [0, 0, 0, 10] },
      axisLabel: { fontSize: 12, color: '#666' },
      splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } }
    },
    series: [{
      name: seriesName,
      type: 'line',
      data: series,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: lineColor, width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: areaColorStart },
            { offset: 1, color: areaColorEnd }
          ]
        }
      }
    }],
    grid: { left: '11%', right: '10%', top: '15%', bottom: '25%' }
  }
}

// ==================== 组件 ====================

export default function UserView() {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const currentUser = useSelector(selectCurrentUser)
  const servers = useSelector(selectServers)

  // ---------- 基础状态 ----------
  const username = currentUser?.username || localStorage.getItem('username') || ''
  const rawAvatarUrl = currentUser?.avatar_url ?? localStorage.getItem('avatarUrl') ?? ''
  const welcomeAvatarUrl = resolveAvatarUrl(rawAvatarUrl, username || 'user', 96)
  const avatarInitial = (username ? username.charAt(0) : '用').toUpperCase()

  const [selectedServer] = useState<any>(null)
  const [showServerOverviewCard] = useState(false)
  const [showServerOverview, setShowServerOverview] = useState(false)
  const [showMyServers, setShowMyServers] = useState(true)

  // ---------- 站点设置 ----------
  const [siteSettings, setSiteSettings] = useState({
    name: 'GPU共享服务平台',
    logo: 'https://lank.myzr.org:88/i/2024/05/29/66571d8de15ea.png',
    subtitle: '高效、安全的资源管理平台'
  })

  // ---------- 资源统计 ----------
  const [resourceStats, setResourceStats] = useState({
    serverCount: 0,
    containerCount: 0,
    unregisteredServerCount: 0,
    unregisteredContainerCount: 0,
    processCount: 0
  })

  // ---------- 容器统计 ----------
  const [containerStats, setContainerStats] = useState({
    avg_cpu_usage: 0,
    total_gpu_usage: 0,
    total_memory_gb: 0,
    active_containers: 0,
    total_process_count: 0
  })

  // ---------- 用户分组 ----------
  const [userGroup, setUserGroup] = useState({
    group: '',
    entry_year: null as number | null,
    display_label: ''
  })

  // ---------- 趋势数据 ----------
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [selectedHours, setSelectedHours] = useState(readStoredHours)
  const [trendsData, setTrendsData] = useState({
    cpu_series: [] as any[],
    gpu_series: [] as any[],
    memory_series: [] as any[]
  })

  // ---------- 进程报表 ----------
  const [processReports, setProcessReports] = useState<any>(null)
  const [processReportsLoading, setProcessReportsLoading] = useState(false)
  const [processReportActive, setProcessReportActive] = useState(readStoredProcessReportTab)

  // ---------- 子组件 ref ----------
  const userContainersRef = useRef<any>(null)

  // ---------- 用户容器所在服务器 ID ----------
  const userContainerServerIds = useMemo(() => {
    const containers = userContainersRef.current?.containers
    if (!containers) return [] as string[]
    const ids = containers
      .filter((c: any) => c.user_username === username)
      .map((c: any) => c.server_id)
    return [...new Set(ids)] as string[]
  }, [userContainersRef.current?.containers, username])

  // ---------- 是否有隐藏服务器 ----------
  const hasHiddenServers = useMemo(() => {
    return servers.some((server: any) => {
      if (server.is_visible) return false
      return userContainerServerIds.includes(server.id)
    })
  }, [servers, userContainerServerIds])

  // ---------- 趋势数据是否有值 ----------
  const hasTrendsData = useMemo(() => {
    return trendsData.cpu_series.length > 0 ||
      trendsData.gpu_series.length > 0 ||
      trendsData.memory_series.length > 0
  }, [trendsData])

  // ---------- 当前报表 ----------
  const currentProcessReport = useMemo(() => {
    if (!processReports) return null
    return processReports[processReportActive] || null
  }, [processReports, processReportActive])

  // ==================== API 请求 ====================

  const fetchSiteSettings = useCallback(async () => {
    try {
      const response = await axios.get('/api/settings/site')
      setSiteSettings({
        name: response.data.site_name,
        logo: response.data.site_logo,
        subtitle: response.data.site_subtitle
      })
    } catch (error) {
      console.error('获取站点设置失败:', error)
    }
  }, [])

  const fetchResourceStats = useCallback(async () => {
    try {
      const response = await axios.get('/api/user/stats')
      setResourceStats({
        serverCount: response.data.server_count || 0,
        containerCount: response.data.container_count || 0,
        unregisteredServerCount: response.data.unregistered_server_count || 0,
        unregisteredContainerCount: response.data.unregistered_container_count || 0,
        processCount: response.data.process_count || 0
      })
      setUserGroup({
        group: response.data.group || '',
        entry_year: response.data.entry_year || null,
        display_label: response.data.display_label || ''
      })
    } catch (error) {
      console.error('获取资源统计失败:', error)
      setResourceStats({ serverCount: 0, containerCount: 0, unregisteredServerCount: 0, unregisteredContainerCount: 0, processCount: 0 })
      setUserGroup({ group: '', entry_year: null, display_label: '' })
    }
  }, [])

  const fetchContainerStats = useCallback(async () => {
    try {
      const response = await axios.get('/api/user/container-stats')
      setContainerStats({
        avg_cpu_usage: response.data.avg_cpu_usage || 0,
        total_gpu_usage: response.data.total_gpu_usage || 0,
        total_memory_gb: response.data.total_memory_gb || 0,
        active_containers: response.data.active_containers || 0,
        total_process_count: response.data.total_process_count || 0
      })
    } catch (error) {
      console.error('获取容器统计数据失败:', error)
      setContainerStats({ avg_cpu_usage: 0, total_gpu_usage: 0, total_memory_gb: 0, active_containers: 0, total_process_count: 0 })
    }
  }, [])

  const fetchProcessReports = useCallback(async () => {
    setProcessReportsLoading(true)
    try {
      const response = await axios.get('/api/user/process_reports')
      const data = response.data
      setProcessReports(data)
      if (data) {
        const availableTabs = PROCESS_REPORT_TABS.filter(tab => data[tab])
        if (availableTabs.length && !availableTabs.includes(processReportActive)) {
          setProcessReportActive(availableTabs[0])
        }
      }
    } catch (error) {
      console.error('获取进程报表失败:', error)
      setProcessReports(null)
    } finally {
      setProcessReportsLoading(false)
    }
  }, [processReportActive])

  const fetchTrendsData = useCallback(async () => {
    setTrendsLoading(true)
    try {
      const response = await axios.get('/api/user/container-trends', {
        params: { hours: selectedHours }
      })
      setTrendsData({
        cpu_series: response.data.cpu_series || [],
        gpu_series: response.data.gpu_series || [],
        memory_series: response.data.memory_series || []
      })
    } catch (error) {
      console.error('获取趋势数据失败:', error)
      setTrendsData({ cpu_series: [], gpu_series: [], memory_series: [] })
    } finally {
      setTrendsLoading(false)
    }
  }, [selectedHours])

  // ==================== 副作用 ====================

  // 初始化数据
  useEffect(() => {
    fetchSiteSettings()
    fetchResourceStats()
    fetchContainerStats()
    fetchProcessReports()
    fetchTrendsData()
    dispatch(fetchServers())

    // 自动刷新定时器
    const statsTimer = setInterval(() => {
      fetchResourceStats()
      fetchContainerStats()
      fetchProcessReports()
    }, 30000)

    const trendsTimer = setInterval(() => {
      fetchTrendsData()
    }, 120000)

    return () => {
      clearInterval(statsTimer)
      clearInterval(trendsTimer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // selectedHours 变化时持久化 + 重新获取数据
  useEffect(() => {
    try {
      localStorage.setItem(TRENDS_HOURS_STORAGE_KEY, String(selectedHours))
    } catch { /* ignore */ }
    fetchTrendsData()
  }, [selectedHours]) // eslint-disable-line react-hooks/exhaustive-deps

  // processReportActive 变化时持久化
  useEffect(() => {
    try {
      localStorage.setItem(PROCESS_REPORT_TAB_STORAGE_KEY, processReportActive)
    } catch { /* ignore */ }
  }, [processReportActive])

  // ==================== 图表配置 (memoized) ====================

  const cpuChartOption = useMemo(() =>
    makeChartOption(trendsData.cpu_series, 'CPU使用率', 'CPU使用率(%)', '#667eea',
      'rgba(102, 126, 234, 0.3)', 'rgba(102, 126, 234, 0.05)', '%', selectedHours),
    [trendsData.cpu_series, selectedHours]
  )

  const gpuChartOption = useMemo(() =>
    makeChartOption(trendsData.gpu_series, 'GPU使用率', 'GPU使用率(%)', '#f5576c',
      'rgba(245, 87, 108, 0.3)', 'rgba(245, 87, 108, 0.05)', '%', selectedHours),
    [trendsData.gpu_series, selectedHours]
  )

  const memoryChartOption = useMemo(() =>
    makeChartOption(trendsData.memory_series, '显存使用', '显存使用量(GB)', '#00f2fe',
      'rgba(0, 242, 254, 0.3)', 'rgba(0, 242, 254, 0.05)', 'GB', selectedHours),
    [trendsData.memory_series, selectedHours]
  )

  // ==================== 表格列配置 ====================

  const processColumns: ColumnsType<any> = [
    { title: '程序', dataIndex: 'command', ellipsis: true, width: 200 },
    { title: '容器', dataIndex: 'container_name', ellipsis: true, width: 160 },
    { title: '服务器', dataIndex: 'server_name', ellipsis: true, width: 160 },
    {
      title: '运行时长', width: 140,
      render: (_, record) => record.max_running_human
    },
    {
      title: '显存峰值', width: 140,
      render: (_, record) => formatMemoryMb(record.max_gpu_memory_mb)
    },
    {
      title: '最后活跃', dataIndex: 'last_seen', width: 160,
      render: (value) => formatDateTime(value)
    }
  ]

  // ==================== 渲染 ====================

  return (
    <div className="user-container">
      <div className="main-content">

        {/* ========== 欢迎卡片 + 右侧面板 ========== */}
        {!selectedServer && (
          <Row gutter={20} className="equal-height-cards">

            {/* ---------- 左侧欢迎卡片 ---------- */}
            <Col xs={24} sm={24} md={8} lg={6} xl={6}>
              <div className="welcome-card-wrapper">
                <div className="welcome-card-header">
                  <span>欢迎使用</span>
                </div>
                <div className="welcome-card-body">
                  <div className="welcome-content">
                    <Avatar size={110} className="user-avatar" src={welcomeAvatarUrl}>
                      {avatarInitial}
                    </Avatar>
                    <h3>{username || '用户'}</h3>

                    {userGroup.display_label && (
                      <Tag color={getGroupTagColor(userGroup.group)} className="user-group-tag">
                        {userGroup.display_label}
                      </Tag>
                    )}

                    <p>您已成功登录{siteSettings.name}</p>

                    <div className="resource-stats">
                      <div className="stat-item">
                        <DesktopOutlined />
                        <div className="stat-info">
                          <span className="stat-number">{resourceStats.serverCount}</span>
                          <span className="stat-label">
                            台服务器
                            {resourceStats.unregisteredServerCount > 0 && (
                              <span>（{resourceStats.unregisteredServerCount}台非注册）</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="stat-item">
                        <AppstoreOutlined />
                        <div className="stat-info">
                          <span className="stat-number">{resourceStats.containerCount}</span>
                          <span className="stat-label">
                            个容器
                            {resourceStats.unregisteredContainerCount > 0 && (
                              <span>（{resourceStats.unregisteredContainerCount}个非注册）</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="stat-item">
                        <PlayCircleOutlined />
                        <div className="stat-info">
                          <span className="stat-number">{containerStats.total_process_count}</span>
                          <span className="stat-label">个任务正在运行</span>
                        </div>
                      </div>

                      {/* 资源详情统计 */}
                      <div className="resource-detail-stats">
                        <div className="stat-item-detailed">
                          <div className="stat-icon cpu">
                            <DesktopOutlined />
                          </div>
                          <div className="stat-data">
                            <div className="stat-value">{containerStats.avg_cpu_usage}%</div>
                            <div className="stat-label">平均CPU占用</div>
                          </div>
                        </div>

                        <div className="stat-item-detailed">
                          <div className="stat-icon gpu">
                            <VideoCameraOutlined />
                          </div>
                          <div className="stat-data">
                            <div className="stat-value">{containerStats.total_gpu_usage}%</div>
                            <div className="stat-label">总GPU占用</div>
                          </div>
                        </div>

                        <div className="stat-item-detailed">
                          <div className="stat-icon memory">
                            <DollarOutlined />
                          </div>
                          <div className="stat-data">
                            <div className="stat-value">{containerStats.total_memory_gb}GB</div>
                            <div className="stat-label">总显存使用</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Col>

            {/* ---------- 右侧面板 ---------- */}
            <Col xs={24} sm={24} md={16} lg={18} xl={18}>
              <div className="quick-access-panel">

                {/* ===== 资源趋势图表 ===== */}
                <Spin spinning={trendsLoading}>
                  <div className="trends-card">
                    <div className="trends-card-header">
                      <span>资源趋势</span>
                      <div className="chart-controls">
                        <Select
                          value={selectedHours}
                          onChange={(val) => setSelectedHours(val)}
                          size="small"
                          style={{ width: 120 }}
                          options={HOURS_OPTIONS}
                        />
                        <Button
                          onClick={fetchTrendsData}
                          icon={<ReloadOutlined />}
                          shape="circle"
                          size="small"
                          loading={trendsLoading}
                        />
                      </div>
                    </div>
                    <div className="trends-card-body">
                      {!trendsLoading && !hasTrendsData ? (
                        <div className="trends-empty">
                          <Empty description="暂无运行中的容器，暂无趋势数据" styles={{ image: { height: 80 } }} />
                        </div>
                      ) : (
                        <div className="charts-content">
                          <Row gutter={20}>
                            <Col span={8}>
                              <div className="chart-item">
                                <h4>CPU占用率趋势</h4>
                                <ReactECharts option={cpuChartOption} style={{ height: 200 }} />
                              </div>
                            </Col>
                            <Col span={8}>
                              <div className="chart-item">
                                <h4>GPU占用率趋势</h4>
                                <ReactECharts option={gpuChartOption} style={{ height: 200 }} />
                              </div>
                            </Col>
                            <Col span={8}>
                              <div className="chart-item">
                                <h4>显存使用趋势</h4>
                                <ReactECharts option={memoryChartOption} style={{ height: 200 }} />
                              </div>
                            </Col>
                          </Row>
                        </div>
                      )}
                    </div>
                  </div>
                </Spin>

                {/* ===== 任务运行报表 ===== */}
                <Spin spinning={processReportsLoading}>
                  <div className="process-report-card">
                    <div className="process-report-card-header">
                      <span>我的任务运行报表</span>
                      {processReports?.meta?.generated_at && (
                        <div className="process-report-meta">
                          更新于 {formatDateTime(processReports.meta.generated_at)}
                        </div>
                      )}
                    </div>
                    <div className="process-report-card-body">
                      {processReportsLoading && !processReports ? (
                        <div className="process-report-loading">
                          <Skeleton active paragraph={{ rows: 3 }} />
                        </div>
                      ) : (
                        <>
                          <Tabs
                            activeKey={processReportActive}
                            onChange={setProcessReportActive}
                            className="process-report-tabs"
                            items={REPORT_TAB_ITEMS}
                          />

                          {currentProcessReport && (
                            <>
                              <div className="report-grid">
                                <div className="report-item">
                                  <div className="report-label">任务数量</div>
                                  <div className="report-value">{currentProcessReport.process_count || 0}</div>
                                </div>
                                <div className="report-item">
                                  <div className="report-label">运行时长总计</div>
                                  <div className="report-value">{currentProcessReport.total_runtime_human || '0秒'}</div>
                                </div>
                                <div className="report-item">
                                  <div className="report-label">平均运行时长</div>
                                  <div className="report-value">{currentProcessReport.average_runtime_human || '0秒'}</div>
                                </div>
                                <div className="report-item">
                                  <div className="report-label">显存总量</div>
                                  <div className="report-value">{formatGb(currentProcessReport.total_gpu_memory_gb, 2)}</div>
                                </div>
                                <div className="report-item">
                                  <div className="report-label">平均显存峰值</div>
                                  <div className="report-value">{currentProcessReport.average_gpu_memory_human || '0 MB'}</div>
                                </div>
                              </div>

                              {currentProcessReport.processes?.length > 0 && (
                                <div className="report-table-wrapper">
                                  <Table
                                    dataSource={currentProcessReport.processes}
                                    columns={processColumns}
                                    size="small"
                                    className="process-detail-table"
                                    rowKey={(row) => `${row.server_id}-${row.container_name}-${row.pid}-${row.process_instance}`}
                                    pagination={false}
                                    scroll={{ x: 960 }}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Spin>

                {/* ===== 我的容器 ===== */}
                <div className="containers-card">
                  <div className="containers-card-header">
                    <span>我的容器</span>
                  </div>
                  <div className="containers-card-body">
                    <UserContainers ref={userContainersRef} />
                  </div>
                </div>

                {/* ===== 我的申请记录 ===== */}
                <div className="requests-card">
                  <div className="requests-card-header">
                    <span>我的申请记录</span>
                  </div>
                  <div className="requests-card-body">
                    <ContainerRequestsList />
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        )}

        {/* ========== 隐藏的服务器 ========== */}
        {hasHiddenServers && (
          <Row gutter={20} className="my-servers-section">
            <Col span={24}>
              <div className="servers-card collapsible-card">
                <div
                  className="card-header server-overview-header"
                  onClick={() => setShowMyServers(!showMyServers)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="title-with-icon">
                    <DesktopOutlined />
                    <span>隐藏的服务器</span>
                  </div>
                  <DownOutlined className={`expand-icon ${showMyServers ? 'is-expanded' : ''}`} />
                </div>
                {showMyServers && (
                  <div className="servers-card-body">
                    <ServersOverview
                      embedded
                      showHiddenOnly
                      filterServerIds={userContainerServerIds}
                      username={username}
                      includeHidden
                    />
                  </div>
                )}
              </div>
            </Col>
          </Row>
        )}

        {/* ========== 服务器概览 ========== */}
        {showServerOverviewCard && (
          <Row gutter={20} className="server-overview-section">
            <Col span={24}>
              <div className="servers-card collapsible-card">
                <div
                  className="card-header server-overview-header"
                  onClick={() => setShowServerOverview(!showServerOverview)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="title-with-icon">
                    <DesktopOutlined />
                    <span>服务器概览</span>
                  </div>
                  <DownOutlined className={`expand-icon ${showServerOverview ? 'is-expanded' : ''}`} />
                </div>
                {showServerOverview && (
                  <div className="servers-card-body">
                    <ServersOverview embedded />
                  </div>
                )}
              </div>
            </Col>
          </Row>
        )}
      </div>
    </div>
  )
}
