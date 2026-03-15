import { Card, Tag, Table, Descriptions, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import './NetworkMonitor.css'

interface NetworkMonitorProps {
  networkData: any
}

export default function NetworkMonitor({ networkData }: NetworkMonitorProps) {

  // ==================== 辅助函数 ====================

  const getNetworkType = () => {
    if (!networkData?.interfaces) return '未知'
    const hasWifi = Object.keys(networkData.interfaces).some(
      (name) =>
        name.toLowerCase().includes('wlan') ||
        name.toLowerCase().includes('wifi')
    )
    return hasWifi ? '无线网络' : '有线网络'
  }

  const getInterfacesData = () => {
    if (!networkData?.interfaces) return []
    return Object.entries(networkData.interfaces)
      .filter(([name, info]: [string, any]) => info.ip && !name.includes('lo'))
      .map(([name, info]: [string, any]) => ({
        key: name,
        name,
        ip: info.ip || 'N/A',
        mac: info.mac || 'N/A',
        netmask: info.netmask || 'N/A'
      }))
  }

  const formatDNS = (dnsServers: string[]) => {
    if (!dnsServers || !Array.isArray(dnsServers) || dnsServers.length === 0) {
      return 'N/A'
    }
    return dnsServers.join(', ')
  }

  const getContainerName = (container: any) => Object.keys(container)[0] || '未知容器'

  const getContainerPorts = (container: any) => {
    const name = Object.keys(container)[0]
    return container[name] || {}
  }

  const getDockerPortData = () => {
    if (!networkData?.['docker-port']?.length) return []
    return networkData['docker-port'].map((container: any, index: number) => {
      const containerName = getContainerName(container)
      const ports = getContainerPorts(container)
      return {
        key: index,
        container: containerName,
        ssh: ports.ssh || '-',
        tcp: ports.tcp || '-',
        udp: ports.udp || '-'
      }
    })
  }

  // ==================== 表格列定义 ====================

  const interfaceColumns: ColumnsType<any> = [
    { title: '接口名称', dataIndex: 'name', key: 'name', width: 120 },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', ellipsis: true },
    { title: 'MAC地址', dataIndex: 'mac', key: 'mac', ellipsis: true },
    { title: '子网掩码', dataIndex: 'netmask', key: 'netmask', ellipsis: true }
  ]

  const dockerPortColumns: ColumnsType<any> = [
    { title: '容器名称', dataIndex: 'container', key: 'container', ellipsis: true },
    {
      title: 'SSH端口',
      dataIndex: 'ssh',
      key: 'ssh',
      width: 120,
      align: 'center',
      render: (val: string) =>
        val !== '-' ? <Tag color="success">{val}</Tag> : <span>-</span>
    },
    { title: 'TCP端口', dataIndex: 'tcp', key: 'tcp', ellipsis: true },
    { title: 'UDP端口', dataIndex: 'udp', key: 'udp', ellipsis: true }
  ]

  // ==================== 渲染 ====================

  const hasData = networkData && Object.keys(networkData).length > 0

  return (
    <div className="network-monitor">
      <Card
        className="network-card"
        hoverable
        title={
          <div className="card-header">
            <h3>网络信息</h3>
            <Tag>{getNetworkType()}</Tag>
          </div>
        }
      >
        {!hasData ? (
          <Empty description="暂无网络数据" />
        ) : (
          <>
            {/* 特殊网络信息 */}
            {(networkData['edu-ip'] || networkData['lan-ip'] || networkData['edu-domain']) && (
              <div className="special-network-info">
                <Descriptions column={3} bordered size="small">
                  {networkData['edu-ip'] && (
                    <Descriptions.Item label="校园网IP">
                      {networkData['edu-ip']}
                    </Descriptions.Item>
                  )}
                  {networkData['lan-ip'] && (
                    <Descriptions.Item label="局域网IP">
                      {networkData['lan-ip']}
                    </Descriptions.Item>
                  )}
                  {networkData['edu-domain'] && (
                    <Descriptions.Item label="校园网域名">
                      {networkData['edu-domain']}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            )}

            {/* 网络接口信息 */}
            {networkData.interfaces && (
              <div className="mt-4">
                <h4>网络接口</h4>
                <Table
                  columns={interfaceColumns}
                  dataSource={getInterfacesData()}
                  size="small"
                  pagination={false}
                  scroll={{ x: 600 }}
                />
              </div>
            )}

            {/* 网络连接信息 */}
            {networkData.connections && (
              <div className="mt-4">
                <h4>网络连接</h4>
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="默认网关">
                    {networkData.default_gateway || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="DNS服务器">
                    {formatDNS(networkData.dns_servers)}
                  </Descriptions.Item>
                  <Descriptions.Item label="主机名">
                    {networkData.hostname || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="外网IP">
                    {networkData.public_ip || 'N/A'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {/* Docker端口映射 */}
            {networkData['docker-port']?.length > 0 && (
              <div className="mt-4">
                <h4>Docker端口映射</h4>
                <Table
                  columns={dockerPortColumns}
                  dataSource={getDockerPortData()}
                  size="small"
                  pagination={false}
                  bordered
                  scroll={{ x: 600 }}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
