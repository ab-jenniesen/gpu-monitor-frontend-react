import { useState, useEffect, useMemo, useCallback } from 'react'
import { Modal, Select, Button, Avatar, Empty, Spin, Row, Col } from 'antd'
import { ReloadOutlined, CloseOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import axios from '../../utils/axios'
import { resolveAvatarUrl } from '../../utils/avatar'
import './UserTrendsChart.css'

interface UserTrendsChartProps {
  visible: boolean
  onClose: () => void
  username: string
  avatarUrl?: string
}

interface TrendsData {
  cpu_series: any[]
  gpu_series: any[]
  memory_series: any[]
}

const HOUR_OPTIONS = [
  { label: '近1小时', value: 1 },
  { label: '近6小时', value: 6 },
  { label: '近24小时', value: 24 },
  { label: '近3天', value: 72 },
  { label: '近7天', value: 168 },
  { label: '近15天', value: 360 },
  { label: '近30天', value: 720 },
  { label: '近60天', value: 1440 },
]

export default function UserTrendsChart({ visible, onClose, username, avatarUrl }: UserTrendsChartProps) {
  const [loading, setLoading] = useState(false)
  const [selectedHours, setSelectedHours] = useState(24)
  const [trendsData, setTrendsData] = useState<TrendsData>({
    cpu_series: [],
    gpu_series: [],
    memory_series: []
  })

  const resolvedAvatarUrl = useMemo(
    () => resolveAvatarUrl(avatarUrl || '', username, 80),
    [avatarUrl, username]
  )
  const avatarInitial = useMemo(
    () => (username ? username.charAt(0) : '用').toUpperCase(),
    [username]
  )

  // ==================== 获取趋势数据 ====================

  const fetchTrendsData = useCallback(async (hours?: number) => {
    if (!username) return
    setLoading(true)
    try {
      const response = await axios.get('/api/admin/user-trends', {
        params: { username, hours: hours ?? selectedHours }
      })
      setTrendsData({
        cpu_series: response.data.cpu_series || [],
        gpu_series: response.data.gpu_series || [],
        memory_series: response.data.memory_series || []
      })
    } catch (error) {
      console.error('获取用户趋势数据失败:', error)
      setTrendsData({ cpu_series: [], gpu_series: [], memory_series: [] })
    } finally {
      setLoading(false)
    }
  }, [username, selectedHours])

  useEffect(() => {
    if (visible && username) {
      fetchTrendsData()
    }
  }, [visible, username])

  const handleHoursChange = (value: number) => {
    setSelectedHours(value)
    fetchTrendsData(value)
  }

  // ==================== 通用图表时间轴格式化 ====================

  const getTimeFormatter = useCallback((value: number) => {
    const date = new Date(value)
    if (selectedHours <= 24) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }, [selectedHours])

  const getTooltipTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  }

  // ==================== 通用图表基础配置 ====================

  const baseChartOption = useCallback((
    seriesName: string,
    seriesData: any[],
    yAxisName: string,
    unit: string,
    lineColor: string,
    areaColorStart: string,
    areaColorEnd: string
  ) => ({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const timeStr = getTooltipTime(params[0].value[0])
        return `${timeStr}<br/>${username}<br/>${params[0].seriesName}: ${params[0].value[1]}${unit}`
      }
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        fontSize: 12,
        color: '#666',
        formatter: getTimeFormatter,
        interval: 0,
        rotate: 45
      },
      splitLine: {
        show: true,
        lineStyle: { color: '#f0f0f0', type: 'dashed' }
      }
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
      data: seriesData,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: lineColor, width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: areaColorStart },
            { offset: 1, color: areaColorEnd }
          ]
        }
      }
    }],
    grid: { left: '11%', right: '10%', top: '15%', bottom: '25%' }
  }), [username, getTimeFormatter])

  // ==================== 三个图表配置 ====================

  const cpuChartOption = useMemo(() => baseChartOption(
    'CPU使用率', trendsData.cpu_series, 'CPU使用率(%)', '%',
    '#667eea', 'rgba(102, 126, 234, 0.3)', 'rgba(102, 126, 234, 0.05)'
  ), [trendsData.cpu_series, baseChartOption])

  const gpuChartOption = useMemo(() => baseChartOption(
    'GPU使用率', trendsData.gpu_series, 'GPU使用率(%)', '%',
    '#f5576c', 'rgba(245, 87, 108, 0.3)', 'rgba(245, 87, 108, 0.05)'
  ), [trendsData.gpu_series, baseChartOption])

  const memoryChartOption = useMemo(() => baseChartOption(
    '显存使用', trendsData.memory_series, '显存使用量(GB)', 'GB',
    '#00f2fe', 'rgba(0, 242, 254, 0.3)', 'rgba(0, 242, 254, 0.05)'
  ), [trendsData.memory_series, baseChartOption])

  const hasData = trendsData.cpu_series.length > 0

  // ==================== 渲染 ====================

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      width="80%"
      footer={null}
      closable={false}
      destroyOnClose
      centered
      className="trends-dialog"
    >
      {/* 自定义头部 */}
      <div className="dialog-header">
        <div className="header-left">
          <Avatar size={48} src={resolvedAvatarUrl} className="user-avatar">
            {avatarInitial}
          </Avatar>
          <div className="header-text">
            <h3>{username}</h3>
            <p>资源使用趋势分析</p>
          </div>
        </div>
        <div className="header-right">
          <div className="header-controls">
            <Select
              value={selectedHours}
              onChange={handleHoursChange}
              size="small"
              style={{ width: 120 }}
              options={HOUR_OPTIONS}
              popupClassName="trends-select-dropdown"
            />
            <Button
              size="small"
              shape="circle"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => fetchTrendsData()}
              className="header-btn"
            />
          </div>
          <Button
            size="small"
            shape="circle"
            icon={<CloseOutlined />}
            onClick={onClose}
            className="header-close-btn"
            type="text"
          />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="trends-content">
        <Spin spinning={loading}>
          {!loading && hasData ? (
            <div className="charts-content">
              <Row gutter={24}>
                {/* CPU */}
                <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                  <div className="chart-card cpu-card">
                    <div className="chart-header">
                      <div className="chart-icon cpu-icon">
                        <span role="img">🖥</span>
                      </div>
                      <div className="chart-title">
                        <h4>CPU占用率</h4>
                        <p>处理器使用趋势</p>
                      </div>
                    </div>
                    <div className="chart-body">
                      <ReactECharts option={cpuChartOption} className="chart-container" />
                    </div>
                  </div>
                </Col>

                {/* GPU */}
                <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                  <div className="chart-card gpu-card">
                    <div className="chart-header">
                      <div className="chart-icon gpu-icon">
                        <span role="img">🎮</span>
                      </div>
                      <div className="chart-title">
                        <h4>GPU占用率</h4>
                        <p>图形处理器使用趋势</p>
                      </div>
                    </div>
                    <div className="chart-body">
                      <ReactECharts option={gpuChartOption} className="chart-container" />
                    </div>
                  </div>
                </Col>

                {/* 显存 */}
                <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                  <div className="chart-card memory-card">
                    <div className="chart-header">
                      <div className="chart-icon memory-icon">
                        <span role="img">💾</span>
                      </div>
                      <div className="chart-title">
                        <h4>显存使用</h4>
                        <p>显存占用趋势</p>
                      </div>
                    </div>
                    <div className="chart-body">
                      <ReactECharts option={memoryChartOption} className="chart-container" />
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          ) : !loading ? (
            <div className="empty-data">
              <Empty description="暂无趋势数据" />
            </div>
          ) : null}
        </Spin>
      </div>
    </Modal>
  )
}
