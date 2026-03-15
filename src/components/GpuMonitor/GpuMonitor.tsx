import { Card, Tag, Progress, Table } from 'antd'
import {
  DashboardOutlined,
  DesktopOutlined,
  AlertOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import './GpuMonitor.css'

interface GpuProcess {
  pid: number
  username: string
  running_time: string
  gpu_memory?: number | string
  memory_usage?: number | string
  command: string
}

interface GpuInfo {
  name: string
  device_id: string
  utilization: number
  memory_used: number
  memory_total: number
  temperature: number
  processes?: GpuProcess[]
}

interface GpuMonitorProps {
  gpuData: GpuInfo[]
}

// ==================== 辅助函数 ====================

const formatMemory = (memoryValue: number | string | null | undefined): string => {
  if (memoryValue === undefined || memoryValue === null) {
    return '0 MB'
  }

  let numValue: number

  if (typeof memoryValue === 'string') {
    const match = memoryValue.match(/(\d+(\.\d+)?)\s*(MiB|MB|GB|KB)?/i)
    if (match) {
      numValue = parseFloat(match[1])
      if (match[3]) {
        return `${numValue.toFixed(1)} ${match[3].replace('MiB', 'MB')}`
      }
    } else {
      numValue = parseFloat(memoryValue) || 0
    }
  }

  numValue = Number(memoryValue)

  if (numValue >= 1024) {
    return `${(numValue / 1024).toFixed(1)} GB`
  }
  return `${numValue.toFixed(1)} MB`
}

const getColorForPercentage = (percentage: number): string => {
  if (percentage < 50) return '#67C23A'
  if (percentage < 80) return '#E6A23C'
  return '#F56C6C'
}

const getTemperatureColor = (temperature: number): string => {
  if (temperature < 60) return '#67C23A'
  if (temperature < 80) return '#E6A23C'
  return '#F56C6C'
}

// ==================== 进程表格列定义 ====================

const processColumns: ColumnsType<GpuProcess> = [
  {
    title: 'PID',
    dataIndex: 'pid',
    key: 'pid',
    width: 90
  },
  {
    title: '用户',
    dataIndex: 'username',
    key: 'username',
    width: 80
  },
  {
    title: '运行时间',
    dataIndex: 'running_time',
    key: 'running_time',
    width: 100
  },
  {
    title: '显存使用',
    key: 'memory',
    width: 120,
    render: (_, record) => formatMemory(record.gpu_memory || record.memory_usage)
  },
  {
    title: '命令',
    dataIndex: 'command',
    key: 'command',
    ellipsis: true // 对应 show-overflow-tooltip
  }
]

// ==================== 组件 ====================

export default function GpuMonitor({ gpuData = [] }: GpuMonitorProps) {
  return (
    <div className="gpu-monitor">
      {gpuData.map((gpu, index) => {
        const memoryPercent = Math.round(
          (gpu.memory_used / gpu.memory_total) * 100
        )
        const temperaturePercent = Math.min(
          100,
          Math.round((gpu.temperature / 100) * 100)
        )

        return (
          <Card
            key={index}
            className="gpu-card"
            hoverable
            title={
              <div className="card-header">
                <h3>
                  <span className="model-name">{gpu.name}</span>
                </h3>
                <Tag color="success">{gpu.device_id}</Tag>
              </div>
            }
          >
            {/* GPU 使用率 */}
            <div className="stat-row">
              <div className="stat-label">
                <DashboardOutlined />
                <span>GPU使用率:</span>
              </div>
              <div className="stat-value">
                <Progress
                  percent={gpu.utilization}
                  strokeColor={getColorForPercentage(gpu.utilization)}
                  strokeWidth={15}
                  format={(percent) => `${percent}%`}
                />
              </div>
            </div>

            {/* 显存使用 */}
            <div className="stat-row">
              <div className="stat-label">
                <DesktopOutlined />
                <span>显存使用:</span>
              </div>
              <div className="stat-value">
                <Progress
                  percent={memoryPercent}
                  strokeColor={getColorForPercentage(memoryPercent)}
                  strokeWidth={15}
                  format={(percent) =>
                    `${formatMemory(gpu.memory_used)} / ${formatMemory(gpu.memory_total)} (${percent}%)`
                  }
                />
              </div>
            </div>

            {/* 温度 */}
            <div className="stat-row">
              <div className="stat-label">
                <AlertOutlined />
                <span>温度:</span>
              </div>
              <div className="stat-value">
                <Progress
                  percent={temperaturePercent}
                  strokeColor={getTemperatureColor(gpu.temperature)}
                  strokeWidth={15}
                  format={() => `${gpu.temperature}°C`}
                />
              </div>
            </div>

            {/* 进程信息 */}
            {gpu.processes && gpu.processes.length > 0 && (
              <div className="processes-section">
                <div className="section-divider" />
                <h4>运行进程</h4>
                <Table
                  columns={processColumns}
                  dataSource={gpu.processes}
                  rowKey="pid"
                  size="small"
                  pagination={false}
                  // stripe 效果通过 CSS 实现
                  rowClassName={(_, index) =>
                    index % 2 === 0 ? 'table-row-even' : 'table-row-odd'
                  }
                />
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
