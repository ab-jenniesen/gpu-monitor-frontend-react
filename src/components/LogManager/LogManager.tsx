import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Card, Table, Tag, Button, Form, Input, Select, DatePicker, Space, Modal,
  Descriptions, Pagination, Spin, Row, Col, message
} from 'antd'
import { SearchOutlined, ReloadOutlined, BarChartOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from '../../utils/axios'
import * as echarts from 'echarts/core'
import {
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, DatasetComponent, TransformComponent
} from 'echarts/components'
import { BarChart, PieChart, LineChart } from 'echarts/charts'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import './LogManager.css'

const { RangePicker } = DatePicker

echarts.use([
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, DatasetComponent, TransformComponent,
  BarChart, PieChart, LineChart,
  LabelLayout, UniversalTransition,
  CanvasRenderer
])

// ==================== 常量 ====================

const actionTypes = [
  { value: 'login', label: '登录' },
  { value: 'logout', label: '登出' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  { value: 'view', label: '查看' },
  { value: 'backup', label: '备份' },
  { value: 'restore', label: '恢复' },
  { value: 'export', label: '导出' },
  { value: 'change_password', label: '修改密码' },
  { value: 'password_change', label: '激活' },
  { value: 'start', label: '启动' },
  { value: 'stop', label: '停止' }
]

const resourceTypes = [
  { value: 'user', label: '用户' },
  { value: 'user_avatar', label: '修改头像' },
  { value: 'server', label: '服务器' },
  { value: 'network_route', label: '路由' },
  { value: 'logs', label: '日志' },
  { value: 'announcement', label: '公告' },
  { value: 'container', label: '容器' },
  { value: 'container_request', label: '容器申请' },
  { value: 'docker_image', label: 'Docker 镜像' },
  { value: 'storage_path', label: '存储路径' },
  { value: 'port_range', label: '端口范围' },
  { value: 'settings', label: '系统设置' },
  { value: 'webdav_config', label: '备份配置' },
  { value: 'system_backup', label: '系统备份' }
]

// ==================== 辅助函数 ====================

const getActionTypeLabel = (type: string) => actionTypes.find(i => i.value === type)?.label || type
const getResourceTypeLabel = (type: string) => resourceTypes.find(i => i.value === type)?.label || type

const getActionTypeTagColor = (type: string) => {
  const map: Record<string, string> = {
    login: 'green', logout: 'default', create: 'blue', update: 'orange',
    delete: 'red', view: 'default', backup: 'blue', restore: 'green',
    export: 'default', change_password: 'orange', password_change: 'green',
    start: 'green', stop: 'red'
  }
  return map[type] || 'default'
}

const getStatusTagColor = (status: string) => {
  const map: Record<string, string> = {
    success: 'green', failed: 'red', pending: 'orange', error: 'red'
  }
  return map[status] || 'default'
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    success: '成功', failed: '失败', pending: '进行中', error: '错误'
  }
  return map[status] || status
}

const getLogDescription = (log: any) => {
  try {
    if (log.details) {
      let details = log.details
      if (typeof details === 'string') details = JSON.parse(details)
      if (details.description) return details.description
    }
    return `${getActionTypeLabel(log.action_type)}${getResourceTypeLabel(log.resource_type)}`
  } catch {
    return `${getActionTypeLabel(log.action_type)}${getResourceTypeLabel(log.resource_type)}`
  }
}

const formatDetails = (details: any) => {
  if (typeof details === 'string') {
    try { return JSON.stringify(JSON.parse(details), null, 2) } catch { return details }
  }
  return JSON.stringify(details, null, 2)
}

const formatDateTime = (dateTimeString: string) => {
  if (!dateTimeString) return ''
  try {
    const sourceDate = new Date(dateTimeString)
    const utcTime = sourceDate.getTime() + sourceDate.getTimezoneOffset() * 60000
    const date = new Date(utcTime + 8 * 3600000)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  } catch {
    return dateTimeString
  }
}

// ==================== 组件 ====================

export interface LogManagerRef {
  refreshLogs: () => void
  confirmCleanup: (mode: string, days?: number) => void
}

interface LogManagerProps {
  isActive?: boolean
}

const LogManager = forwardRef<LogManagerRef, LogManagerProps>(({ isActive = false }, ref) => {
  const [searchParams] = useSearchParams()

  // 状态
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showStats] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)

  // 筛选
  const [filterUsername, setFilterUsername] = useState('')
  const [filterActionType, setFilterActionType] = useState<string | undefined>(undefined)
  const [filterResourceType, setFilterResourceType] = useState<string | undefined>(undefined)
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined)
  const [filterDateRange, setFilterDateRange] = useState<any>(null)

  // 分页
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [total, setTotal] = useState(0)

  // 统计
  const [statsDays, setStatsDays] = useState(7)

  // 日志详情
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentLog, setCurrentLog] = useState<any>(null)
  const [deleteLogLoading, setDeleteLogLoading] = useState(false)

  // 图表
  const chartRefs = useRef<Record<string, echarts.ECharts | null>>({
    actionTypeChart: null,
    resourceTypeChart: null,
    userChart: null,
    dateChart: null
  })

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSuperAdmin = useMemo(
    () => localStorage.getItem('username') === 'admin' && localStorage.getItem('userRole') === 'admin',
    []
  )

  // ==================== 获取日志 ====================

  const fetchLogs = useCallback(async (p?: number, pp?: number) => {
    setLoading(true)
    try {
      const params: any = { page: p ?? page, per_page: pp ?? perPage }
      if (filterUsername) params.username = filterUsername
      if (filterActionType) params.action_type = filterActionType
      if (filterResourceType) params.resource_type = filterResourceType
      if (filterStatus) params.status = filterStatus
      if (filterDateRange && filterDateRange.length === 2) {
        params.start_date = filterDateRange[0].format('YYYY-MM-DD')
        params.end_date = filterDateRange[1].format('YYYY-MM-DD')
      }

      const response = await axios.get('/api/logs', { params })
      setLogs(response.data.logs)

      if (response.data.pagination) {
        setTotal(response.data.pagination.total)
        setPage(response.data.pagination.page)
        setPerPage(response.data.pagination.per_page)
      } else {
        setTotal(response.data.total)
        setPage(response.data.page)
        setPerPage(response.data.per_page)
      }
    } catch (error: any) {
      console.error('获取日志失败:', error)
      message.error('获取日志失败: ' + (error.response?.data?.msg || error.message))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, filterUsername, filterActionType, filterResourceType, filterStatus, filterDateRange])

  // ==================== 日志统计 ====================

  const fetchLogStats = useCallback(async (days?: number) => {
    setStatsLoading(true)
    try {
      const response = await axios.get('/api/logs/stats', {
        params: { days: days ?? statsDays }
      })
      renderCharts(response.data.stats)
    } catch (error: any) {
      console.error('获取日志统计失败:', error)
      message.error('获取日志统计失败: ' + (error.response?.data?.msg || error.message))
    } finally {
      setStatsLoading(false)
    }
  }, [statsDays])

  // ==================== 图表 ====================

  const destroyCharts = useCallback(() => {
    Object.keys(chartRefs.current).forEach(key => {
      const chart = chartRefs.current[key]
      if (chart && typeof chart.dispose === 'function') {
        chart.dispose()
      }
      chartRefs.current[key] = null
    })
  }, [])

  const initChart = useCallback((elementId: string, initFn: (chart: echarts.ECharts) => void, retry = 0) => {
    const element = document.getElementById(elementId)
    if (element && element.clientWidth > 0 && element.clientHeight > 0) {
      const chart = echarts.init(element)
      initFn(chart)
      chartRefs.current[elementId] = chart
    } else if (retry < 5) {
      setTimeout(() => initChart(elementId, initFn, retry + 1), 200 * (retry + 1))
    }
  }, [])

  const renderCharts = useCallback((stats: any) => {
    destroyCharts()

    setTimeout(() => {
      if (!showStats) return

      // 操作类型饼图
      initChart('action-type-chart', (chart) => {
        const data = Object.entries(stats.by_action).map(([key, value]) => ({
          name: getActionTypeLabel(key), value
        }))
        chart.setOption({
          tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} ({d}%)' },
          legend: { orient: 'vertical', left: 'left', data: data.map(i => i.name) },
          series: [{
            name: '操作类型', type: 'pie', radius: '60%', center: ['50%', '50%'],
            data,
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } }
          }]
        })
      })

      // 资源类型饼图
      initChart('resource-type-chart', (chart) => {
        const data = Object.entries(stats.by_resource).map(([key, value]) => ({
          name: getResourceTypeLabel(key), value
        }))
        chart.setOption({
          tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} ({d}%)' },
          legend: { orient: 'vertical', left: 'left', data: data.map(i => i.name) },
          series: [{
            name: '资源类型', type: 'pie', radius: '60%', center: ['50%', '50%'],
            data,
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } }
          }]
        })
      })

      // 用户操作排行柱状图
      initChart('user-chart', (chart) => {
        const data = Object.entries(stats.by_user)
          .map(([key, value]) => ({ name: key, value }))
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 10)
        chart.setOption({
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          xAxis: { type: 'category', data: data.map(i => i.name), axisLabel: { rotate: 45, interval: 0 } },
          yAxis: { type: 'value' },
          series: [{ name: '操作次数', type: 'bar', data: data.map(i => i.value), itemStyle: { color: '#409EFF' } }]
        })
      })

      // 日期趋势折线图
      initChart('date-chart', (chart) => {
        const data = Object.entries(stats.by_date)
          .map(([key, value]) => ({ name: key, value }))
          .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime())
        chart.setOption({
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: data.map(i => i.name), axisLabel: { rotate: 45, interval: 0 } },
          yAxis: { type: 'value' },
          series: [{
            name: '操作次数', type: 'line', data: data.map(i => i.value), smooth: true,
            itemStyle: { color: '#67C23A' },
            areaStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(103,194,58,0.5)' },
                  { offset: 1, color: 'rgba(103,194,58,0.1)' }
                ]
              }
            }
          }]
        })
      })
    }, 200)
  }, [destroyCharts, initChart, showStats])

  // ==================== 调度刷新 ====================

  const scheduleRefresh = useCallback((delay = 200) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    setLogs([])
    refreshTimerRef.current = setTimeout(async () => {
      refreshTimerRef.current = null
      await fetchLogs(1, perPage)
      if (showStats) await fetchLogStats()
    }, delay)
  }, [fetchLogs, fetchLogStats, perPage, showStats])

  // ==================== 删除单条日志 ====================

  const deleteCurrentLog = useCallback(async () => {
    if (!isSuperAdmin || !currentLog || deleteLogLoading) return

    Modal.confirm({
      title: '删除确认',
      content: '确定要删除该条日志吗？此操作不可恢复。',
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        setDeleteLogLoading(true)
        try {
          await axios.delete(`/api/logs/${currentLog.id}`)
          message.success('日志已删除')
          setDetailVisible(false)
          setCurrentLog(null)
          await fetchLogs()
        } catch (error: any) {
          message.error(error.response?.data?.msg || '删除日志失败')
        } finally {
          setDeleteLogLoading(false)
        }
      }
    })
  }, [isSuperAdmin, currentLog, deleteLogLoading, fetchLogs])

  // ==================== 清理日志 ====================

  const confirmCleanup = useCallback(async (mode: string, days?: number) => {
    let scopeText = '全部日志'
    if (mode === 'older_than_days') {
      scopeText = days === 30 ? '一个月以前的日志' : days === 7 ? '一个星期以前的日志' : `${days}天以前的日志`
    }

    Modal.confirm({
      title: '清理日志确认',
      content: `将删除【${scopeText}】。确定要继续吗？`,
      okText: '确认清理',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const payload: any = { mode }
          if (mode === 'older_than_days' && days) payload.days = days
          const resp = await axios.post('/api/logs/cleanup', payload)
          const deleted = resp.data?.deleted_count ?? 0
          message.success(`清理完成，删除 ${deleted} 条`)
          await fetchLogs()
          if (showStats) await fetchLogStats()
        } catch (error: any) {
          message.error('清理失败: ' + (error.response?.data?.msg || error.message))
        }
      }
    })
  }, [fetchLogs, fetchLogStats, showStats])

  // ==================== 暴露给父组件 ====================

  useImperativeHandle(ref, () => ({
    refreshLogs: () => {
      fetchLogs()
      if (showStats) fetchLogStats()
    },
    confirmCleanup
  }), [fetchLogs, fetchLogStats, showStats, confirmCleanup])

  // ==================== 生命周期 ====================

  // isActive 变化时刷新
  useEffect(() => {
    if (isActive) {
      scheduleRefresh(0)
    }
  }, [isActive])

  // URL tab 参数变化
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'logs' && isActive) {
      scheduleRefresh()
    }
  }, [searchParams])

  // 窗口 resize
  useEffect(() => {
    const handleResize = () => {
      Object.values(chartRefs.current).forEach(chart => {
        if (chart && typeof chart.resize === 'function') chart.resize()
      })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      destroyCharts()
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [destroyCharts])

  // 统计天数变化
  useEffect(() => {
    if (showStats && isActive) fetchLogStats(statsDays)
  }, [statsDays])

  // ==================== 操作 ====================

  const handleFilter = () => {
    setPage(1)
    fetchLogs(1, perPage)
  }

  const resetFilter = () => {
    setFilterUsername('')
    setFilterActionType(undefined)
    setFilterResourceType(undefined)
    setFilterStatus(undefined)
    setFilterDateRange(null)
    setPage(1)
    fetchLogs(1, perPage)
  }

  // ==================== 表格列 ====================

  const columns = [
    { title: '用户名', dataIndex: 'username', width: 120 },
    {
      title: '操作类型', dataIndex: 'action_type', width: 100,
      render: (type: string) => <Tag color={getActionTypeTagColor(type)}>{getActionTypeLabel(type)}</Tag>
    },
    {
      title: '资源类型', dataIndex: 'resource_type', width: 100,
      render: (type: string) => <Tag>{getResourceTypeLabel(type)}</Tag>
    },
    { title: '资源ID', dataIndex: 'resource_id', width: 80 },
    {
      title: '操作描述', width: 360, ellipsis: true,
      render: (_: any, record: any) => getLogDescription(record)
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (status: string) => <Tag color={getStatusTagColor(status)}>{getStatusLabel(status)}</Tag>
    },
    { title: 'IP地址', dataIndex: 'ip_address', width: 160 },
    {
      title: '操作时间', width: 160, sorter: true,
      render: (_: any, record: any) => formatDateTime(record.created_at)
    },
    {
      title: '详情', width: 100, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button size="small" type="primary" onClick={() => { setCurrentLog(record); setDetailVisible(true) }}>
          详情
        </Button>
      )
    }
  ]

  // ==================== 渲染 ====================

  return (
    <div className="log-manager">
      <div className="log-list">
        {/* 筛选区域 */}
        <Card className="filter-card" hoverable>
          <Row gutter={20}>
            <Col xs={24} sm={12} md={6}>
              <div className="filter-item">
                <label>用户名</label>
                <Input
                  value={filterUsername}
                  onChange={(e) => setFilterUsername(e.target.value)}
                  placeholder="搜索用户名"
                  allowClear
                  onClear={handleFilter}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="filter-item">
                <label>操作类型</label>
                <Select
                  value={filterActionType}
                  onChange={setFilterActionType}
                  placeholder="选择操作类型"
                  allowClear
                  style={{ width: '100%' }}
                >
                  {actionTypes.map(item => (
                    <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="filter-item">
                <label>资源类型</label>
                <Select
                  value={filterResourceType}
                  onChange={setFilterResourceType}
                  placeholder="选择资源类型"
                  allowClear
                  style={{ width: '100%' }}
                >
                  {resourceTypes.map(item => (
                    <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="filter-item">
                <label>状态</label>
                <Select
                  value={filterStatus}
                  onChange={setFilterStatus}
                  placeholder="选择状态"
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Select.Option value="success">成功</Select.Option>
                  <Select.Option value="failed">失败</Select.Option>
                </Select>
              </div>
            </Col>
          </Row>
          <Row gutter={20} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12}>
              <div className="filter-item">
                <label>时间范围</label>
                <RangePicker
                  value={filterDateRange}
                  onChange={setFilterDateRange}
                  style={{ width: '100%' }}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} className="filter-buttons">
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleFilter}>搜索</Button>
                <Button icon={<ReloadOutlined />} onClick={resetFilter}>重置</Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 日志表格 */}
        <Card className="table-card" hoverable>
          <Table
            loading={loading}
            dataSource={logs}
            columns={columns}
            rowKey="id"
            bordered
            scroll={{ x: 1400 }}
            pagination={false}
          />
          <div className="pagination-container">
            <Pagination
              current={page}
              pageSize={perPage}
              total={total}
              showSizeChanger
              showQuickJumper
              showTotal={(t) => `共 ${t} 条`}
              pageSizeOptions={['10', '20', '50', '100']}
              onChange={(p, ps) => { setPage(p); setPerPage(ps || 20); fetchLogs(p, ps || 20) }}
            />
          </div>
        </Card>
      </div>

      {/* 日志统计 */}
      {showStats && (
        <Card
          className="stats-card"
          hoverable
          title={
            <div className="card-header">
              <span className="card-header-title">
                <BarChartOutlined /> 日志统计信息
              </span>
              <Select
                value={statsDays}
                onChange={(val) => { setStatsDays(val); fetchLogStats(val) }}
                style={{ width: 180 }}
              >
                <Select.Option value={7}>最近7天</Select.Option>
                <Select.Option value={30}>最近30天</Select.Option>
                <Select.Option value={90}>最近90天</Select.Option>
              </Select>
            </div>
          }
        >
          <Spin spinning={statsLoading}>
            <Row gutter={20}>
              <Col span={12}>
                <div className="stats-chart">
                  <h3>操作类型分布</h3>
                  <div id="action-type-chart" style={{ height: 300 }} />
                </div>
              </Col>
              <Col span={12}>
                <div className="stats-chart">
                  <h3>资源类型分布</h3>
                  <div id="resource-type-chart" style={{ height: 300 }} />
                </div>
              </Col>
            </Row>
            <Row gutter={20}>
              <Col span={12}>
                <div className="stats-chart">
                  <h3>用户操作排行</h3>
                  <div id="user-chart" style={{ height: 300 }} />
                </div>
              </Col>
              <Col span={12}>
                <div className="stats-chart">
                  <h3>日期趋势</h3>
                  <div id="date-chart" style={{ height: 300 }} />
                </div>
              </Col>
            </Row>
          </Spin>
        </Card>
      )}

      {/* 日志详情对话框 */}
      <Modal
        title="日志详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width="50%"
        maskClosable={false}
        footer={
          <Space>
            {isSuperAdmin && currentLog && (
              <Button danger loading={deleteLogLoading} onClick={deleteCurrentLog}>删除日志</Button>
            )}
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
          </Space>
        }
      >
        {currentLog && (
          <div className="log-detail">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="用户名">{currentLog.username}</Descriptions.Item>
              <Descriptions.Item label="用户ID">{currentLog.user_id}</Descriptions.Item>
              <Descriptions.Item label="操作类型">
                <Tag color={getActionTypeTagColor(currentLog.action_type)}>
                  {getActionTypeLabel(currentLog.action_type)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="资源类型">
                <Tag>{getResourceTypeLabel(currentLog.resource_type)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="资源ID">{currentLog.resource_id || '无'}</Descriptions.Item>
              <Descriptions.Item label="IP地址">{currentLog.ip_address || '未知'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={currentLog.status === 'success' ? 'green' : 'red'}>
                  {currentLog.status === 'success' ? '成功' : '失败'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="操作时间">{formatDateTime(currentLog.created_at)}</Descriptions.Item>
            </Descriptions>

            {currentLog.details && (
              <div className="details-section">
                <h3>详细信息</h3>
                <pre className="details-json">{formatDetails(currentLog.details)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
})

LogManager.displayName = 'LogManager'

export default LogManager
