import { Card, Tag, Empty, Progress } from 'antd'
import { ContainerOutlined } from '@ant-design/icons'
import './DockerMonitor.css'

interface ContainerData {
  ID?: string
  Name: string
  Status: string
  CPUPerc: string
  MemPerc: string
  MemUsage: string
  GPUMemPerc: string
  GPUMemUsage: string
  Image: string
  Created: string
  Ports?: string
}

interface DockerMonitorProps {
  dockerData: ContainerData[]
}

// 根据百分比获取颜色
const getColorForPercentage = (percentage: number): string => {
  if (percentage < 50) return '#67C23A'
  if (percentage < 80) return '#E6A23C'
  return '#F56C6C'
}

export default function DockerMonitor({ dockerData = [] }: DockerMonitorProps) {
  return (
    <div className="docker-monitor">
      <Card
        className="docker-card"
        hoverable
        title={
          <div className="card-header">
            <h3>Docker容器</h3>
            <Tag>{dockerData.length}个容器</Tag>
          </div>
        }
      >
        {dockerData.length === 0 ? (
          <div className="empty-container">
            <Empty description="暂无运行中的容器" />
          </div>
        ) : (
          <div className="containers-list">
            {dockerData.map((container, index) => {
              const cpuPerc = parseFloat(container.CPUPerc) || 0
              const memPerc = parseFloat(container.MemPerc) || 0
              const gpuMemPerc = parseFloat(container.GPUMemPerc) || 0
              const hasGpu = container.GPUMemPerc !== 'N/A'

              return (
                <div key={index} className="container-item">
                  {/* 容器头部 */}
                  <div className="container-header">
                    <div className="container-name">
                      <ContainerOutlined />
                      <span>{container.Name}</span>
                    </div>
                    <Tag color={container.Status === 'running' ? 'success' : 'warning'}>
                      {container.Status}
                    </Tag>
                  </div>

                  {/* 使用率进度条 */}
                  <div className="usage-bars">
                    {/* CPU */}
                    <div className="usage-row">
                      <div className="usage-label">CPU:</div>
                      <div className="usage-bar">
                        <Progress
                          percent={cpuPerc}
                          strokeColor={getColorForPercentage(cpuPerc)}
                          strokeWidth={10}
                          format={(val) => `${(val ?? 0).toFixed(1)}%`}
                        />
                      </div>
                    </div>

                    {/* 内存 */}
                    <div className="usage-row">
                      <div className="usage-label">内存:</div>
                      <div className="usage-bar">
                        <Progress
                          percent={memPerc}
                          strokeColor={getColorForPercentage(memPerc)}
                          strokeWidth={10}
                          format={(val) => `${container.MemUsage} (${val}%)`}
                        />
                      </div>
                    </div>

                    {/* GPU 显存 */}
                    {hasGpu && (
                      <div className="usage-row">
                        <div className="usage-label">GPU显存:</div>
                        <div className="usage-bar">
                          <Progress
                            percent={gpuMemPerc}
                            strokeColor={getColorForPercentage(gpuMemPerc)}
                            strokeWidth={10}
                            format={(val) => `${container.GPUMemUsage} (${val}%)`}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 容器详情 */}
                  <div className="container-details">
                    <div className="detail-item">
                      <span className="detail-label">ID:</span>
                      <span className="detail-value">
                        {container.ID ? container.ID.substring(0, 12) : 'N/A'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">镜像:</span>
                      <span className="detail-value">{container.Image}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">创建时间:</span>
                      <span className="detail-value">{container.Created}</span>
                    </div>
                    {container.Ports && (
                      <div className="detail-item">
                        <span className="detail-label">端口:</span>
                        <span className="detail-value">{container.Ports}</span>
                      </div>
                    )}
                  </div>

                  {/* 分割线 */}
                  {index < dockerData.length - 1 && (
                    <div className="section-divider" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
