import { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Modal, Tabs, Table, Empty, Avatar, Button, Spin, message } from 'antd'
import {
  CloseOutlined, ReloadOutlined, SettingOutlined, ClockCircleOutlined,
  FieldTimeOutlined, PlayCircleOutlined, DollarOutlined
} from '@ant-design/icons'
import axios from '../../utils/axios'
import { resolveAvatarUrl } from '../../utils/avatar'
import './UserProcessReports.css'

interface UserProcessReportsProps {
  visible: boolean
  onClose: () => void
  username: string
  avatarUrl?: string
}

const UserProcessReports = forwardRef<any, UserProcessReportsProps>(
  ({ visible, onClose, username, avatarUrl = '' }, ref) => {
    const [loading, setLoading] = useState(false)
    const [processReports, setProcessReports] = useState<any>(null)
    const [activeTab, setActiveTab] = useState('daily')

    const currentReport = useMemo(() => {
      if (!processReports) return null
      return processReports[activeTab] || null
    }, [processReports, activeTab])

    const resolvedAvatarUrl = useMemo(
      () => resolveAvatarUrl(avatarUrl, username, 80),
      [avatarUrl, username]
    )

    const avatarInitial = useMemo(
      () => (username ? username.charAt(0) : '用').toUpperCase(),
      [username]
    )

    // ==================== 数据获取 ====================

    const fetchProcessReports = useCallback(async () => {
      if (!username) return
      setLoading(true)
      try {
        const response = await axios.get(`/api/admin/user/${username}/process_reports`)
        setProcessReports(response.data)
      } catch (error) {
        console.error('获取用户任务报表失败:', error)
        message.error('获取用户任务报表失败')
        setProcessReports(null)
      } finally {
        setLoading(false)
      }
    }, [username])

    // 监听 visible 和 username 变化
    useEffect(() => {
      if (visible && username) {
        fetchProcessReports()
      }
    }, [visible, username, fetchProcessReports])

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      fetchProcessReports
    }))

    // ==================== 格式化函数 ====================

    const formatGb = (value: any, fractionDigits = 1) => {
      const num = Number(value)
      if (!Number.isFinite(num) || num < 0) return `${(0).toFixed(fractionDigits)} GB`
      return `${num.toFixed(fractionDigits)} GB`
    }

    const formatMemoryMb = (value: any) => {
      const num = Number(value)
      if (!Number.isFinite(num) || num <= 0) return '0 MB'
      if (num >= 1024) return `${(num / 1024).toFixed(2)} GB`
      return `${num.toFixed(2)} MB`
    }

    const formatDateTime = (value: any) => {
      if (!value) return '未知'
      try {
        return new Date(value).toLocaleString('zh-CN')
      } catch {
        return value
      }
    }

    // ==================== 表格列 ====================

    const columns = [
      {
        title: '程序', dataIndex: 'command', width: 200, ellipsis: true
      },
      {
        title: '容器', dataIndex: 'container_name', width: 150, ellipsis: true
      },
      {
        title: '服务器', dataIndex: 'server_name', width: 120, ellipsis: true
      },
      {
        title: '运行时长', width: 120,
        render: (_: any, record: any) => record.max_running_human
      },
      {
        title: '显存峰值', width: 120,
        render: (_: any, record: any) => formatMemoryMb(record.max_gpu_memory_mb)
      },
      {
        title: '最后活跃', dataIndex: 'last_seen', width: 160,
        render: (val: any) => formatDateTime(val)
      }
    ]

    // ==================== 渲染 ====================

    return (
      <Modal
        open={visible}
        onCancel={onClose}
        footer={null}
        width="80%"
        className="reports-dialog"
        destroyOnClose
        centered
        closable={false}
        title={
          <div className="dialog-header">
            <div className="header-left">
              <Avatar size={48} className="user-avatar" src={resolvedAvatarUrl}>
                {avatarInitial}
              </Avatar>
              <div className="header-text">
                <h3>{username}</h3>
                <p>任务运行报表分析</p>
              </div>
            </div>
            <div className="header-right">
              <div className="header-controls">
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  shape="circle"
                  loading={loading}
                  onClick={fetchProcessReports}
                />
              </div>
              <Button
                icon={<CloseOutlined />}
                size="small"
                shape="circle"
                type="text"
                onClick={onClose}
              />
            </div>
          </div>
        }
      >
        <Spin spinning={loading}>
          <div className="reports-content">
            {!loading && processReports ? (
              <>
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  className="reports-tabs"
                  items={[
                    { key: 'daily', label: '日报' },
                    { key: 'weekly', label: '周报' },
                    { key: 'monthly', label: '月报' },
                    { key: 'all', label: '累计' }
                  ]}
                />

                {currentReport ? (
                  <div className="report-content">
                    {/* 摘要卡片 */}
                    <div className="report-summary">
                      <div className="summary-cards">
                        <div className="summary-card">
                          <div className="card-icon process-icon">
                            <SettingOutlined />
                          </div>
                          <div className="card-content">
                            <div className="card-value">{currentReport.process_count || 0}</div>
                            <div className="card-label">任务数量</div>
                          </div>
                        </div>

                        <div className="summary-card">
                          <div className="card-icon time-icon">
                            <ClockCircleOutlined />
                          </div>
                          <div className="card-content">
                            <div className="card-value">{currentReport.total_runtime_human || '0秒'}</div>
                            <div className="card-label">运行时长总计</div>
                          </div>
                        </div>

                        <div className="summary-card">
                          <div className="card-icon avg-icon">
                            <FieldTimeOutlined />
                          </div>
                          <div className="card-content">
                            <div className="card-value">{currentReport.average_runtime_human || '0秒'}</div>
                            <div className="card-label">平均运行时长</div>
                          </div>
                        </div>

                        <div className="summary-card">
                          <div className="card-icon memory-icon">
                            <PlayCircleOutlined />
                          </div>
                          <div className="card-content">
                            <div className="card-value">{formatGb(currentReport.total_gpu_memory_gb, 2)}</div>
                            <div className="card-label">显存总量</div>
                          </div>
                        </div>

                        <div className="summary-card">
                          <div className="card-icon avg-memory-icon">
                            <DollarOutlined />
                          </div>
                          <div className="card-content">
                            <div className="card-value">{currentReport.average_gpu_memory_human || '0 MB'}</div>
                            <div className="card-label">平均显存峰值</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 详细任务列表 */}
                    {currentReport.processes?.length ? (
                      <div className="report-table">
                        <h4>详细任务列表</h4>
                        <Table
                          dataSource={currentReport.processes}
                          columns={columns}
                          rowKey={(record) =>
                            `${record.server_id}-${record.container_name}-${record.pid}-${record.process_instance}`
                          }
                          scroll={{ x: 900 }}
                          pagination={false}
                          bordered
                          size="middle"
                        />
                      </div>
                    ) : (
                      <div className="report-empty">
                        <Empty description="暂无任务数据" imageStyle={{ height: 80 }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="report-empty">
                    <Empty description="暂无报表数据" imageStyle={{ height: 80 }} />
                  </div>
                )}
              </>
            ) : !loading ? (
              <div className="report-empty">
                <Empty description="获取报表数据失败" imageStyle={{ height: 80 }} />
              </div>
            ) : null}
          </div>
        </Spin>
      </Modal>
    )
  }
)

UserProcessReports.displayName = 'UserProcessReports'

export default UserProcessReports
