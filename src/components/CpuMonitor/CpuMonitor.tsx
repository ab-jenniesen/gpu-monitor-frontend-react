import { Card, Progress } from 'antd'
import { DashboardOutlined, DesktopOutlined } from '@ant-design/icons'
import './CpuMonitor.css'

interface CpuData {
  info: {
    brand: string
    arch: string
    count: number
    physical_count: number
    freq_current: number
    freq_max: number
  }
  usage: number
  percent: number[]
  load1_percent?: number
  memory: {
    total: number
    used: number
    percent: number
  }
  system: {
    hostname: string
    platform: string
    uptime: string
  }
  disks: Record<string, {
    usage: {
      percent: number
      used: number
      total: number
      unit: string
    }
  }>
}

interface CpuMonitorProps {
  cpuData: CpuData
}

// 根据百分比获取颜色
const getColorForPercentage = (percentage: number): string => {
  if (percentage < 50) return '#67C23A'
  if (percentage < 80) return '#E6A23C'
  return '#F56C6C'
}

export default function CpuMonitor({ cpuData }: CpuMonitorProps) {
  const diskKeys = Object.keys(cpuData.disks || {})
  const hasDisks = diskKeys.length > 0

  return (
    <div className="cpu-monitor">
      <Card
        className="cpu-card"
        hoverable
        title={
          <div className="card-header">
            <h3>CPU监控</h3>
          </div>
        }
      >
        {/* CPU基本信息 */}
        <div className="cpu-info">
          <div className="info-item">
            <span className="info-label">型号:</span>
            <span className="model-name">{cpuData.info.brand || '未知'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">架构:</span>
            <span className="info-value">{cpuData.info.arch || '未知'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">核心数:</span>
            <span className="info-value">
              {cpuData.info.count || 0} 核 (物理{cpuData.info.physical_count || 0}核)
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">当前频率:</span>
            <span className="info-value">
              {cpuData.info.freq_current ? cpuData.info.freq_current.toFixed(2) : 0} MHz
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">最大频率:</span>
            <span className="info-value">{cpuData.info.freq_max || 0} MHz</span>
          </div>
        </div>

        <div className="section-divider" />

        {/* CPU 总体使用率 */}
        <div className="stat-row">
          <div className="stat-label">
            <DashboardOutlined />
            <span>CPU使用率:</span>
          </div>
          <div className="stat-value">
            <Progress
              percent={cpuData.usage}
              strokeColor={getColorForPercentage(cpuData.usage)}
              strokeWidth={15}
              format={(val) => `${(val ?? 0).toFixed(1)}%`}
            />
          </div>
        </div>

        {/* 系统负载 */}
        <div className="stat-row">
          <div className="stat-label">
            <DesktopOutlined />
            <span>系统负载:</span>
          </div>
          <div className="stat-value">
            <Progress
              percent={cpuData.load1_percent || 0}
              strokeColor={getColorForPercentage(cpuData.load1_percent || 0)}
              strokeWidth={15}
              format={(val) => `${(val ?? 0).toFixed(1)}%`}
            />
          </div>
        </div>

        {/* 内存使用率 */}
        <div className="stat-row">
          <div className="stat-label">
            <DesktopOutlined />
            <span>内存使用:</span>
          </div>
          <div className="stat-value">
            <Progress
              percent={cpuData.memory.percent}
              strokeColor={getColorForPercentage(cpuData.memory.percent)}
              strokeWidth={15}
              format={(val) =>
                `${cpuData.memory.used.toFixed(2)} GB / ${cpuData.memory.total.toFixed(2)} GB (${val}%)`
              }
            />
          </div>
        </div>

        {/* CPU核心使用率 */}
        <div className="section-divider" />
        <h4>CPU核心使用率</h4>
        <div className="cpu-cores">
          {cpuData.percent.map((core, index) => (
            <div key={index} className="core-item">
              <div className="core-label">核心 {index}</div>
              <Progress
                percent={core}
                strokeColor={getColorForPercentage(core)}
                strokeWidth={10}
                format={(val) => `${val}%`}
              />
            </div>
          ))}
        </div>

        {/* 系统信息 */}
        <div className="section-divider" />
        <h4>系统信息</h4>
        <div className="system-info">
          <div className="info-item">
            <span className="info-label">主机名:</span>
            <span className="info-value">{cpuData.system.hostname}</span>
          </div>
          <div className="info-item">
            <span className="info-label">系统:</span>
            <span className="info-value">{cpuData.system.platform}</span>
          </div>
          <div className="info-item">
            <span className="info-label">运行时间:</span>
            <span className="info-value">{cpuData.system.uptime}</span>
          </div>
        </div>

        {/* 磁盘信息 */}
        {hasDisks && (
          <>
            <div className="section-divider" />
            <h4>磁盘使用情况</h4>
            <div className="disk-info">
              {diskKeys.map((key) => {
                const disk = cpuData.disks[key]
                return (
                  <div key={key} className="disk-item">
                    <div className="disk-label">{key}</div>
                    <Progress
                      percent={disk.usage.percent}
                      strokeColor={getColorForPercentage(disk.usage.percent)}
                      strokeWidth={10}
                      format={(val) =>
                        `${disk.usage.used} ${disk.usage.unit} / ${disk.usage.total} ${disk.usage.unit} (${val}%)`
                      }
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
