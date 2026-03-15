import { useState, useEffect, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import {
  Card, Table, Button, Skeleton, Empty, Modal,
  Form, InputNumber, Input, message, Space, Tooltip
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined
} from '@ant-design/icons'
import {
  fetchServerPortRanges,
  addServerPortRange,
  updateServerPortRange,
  deleteServerPortRange
} from '../../store/serversSlice'
import type { AppDispatch } from '../../store'
import type { ColumnsType } from 'antd/es/table'
import './PortRangesManager.css'

interface PortRange {
  id: string
  start_port: number
  end_port: number
  description: string
}

interface PortRangesManagerProps {
  serverId: string
  onUpdate?: () => void
}

export default function PortRangesManager({ serverId, onUpdate }: PortRangesManagerProps) {
  const dispatch = useDispatch<AppDispatch>()
  const [form] = Form.useForm()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [portRanges, setPortRanges] = useState<PortRange[]>([])
  const [dialogVisible, setDialogVisible] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentRangeId, setCurrentRangeId] = useState<string | null>(null)

  // ==================== 获取端口范围列表 ====================

  const fetchPortRangesData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await dispatch(fetchServerPortRanges(serverId)).unwrap()
      setPortRanges(result)
    } catch {
      message.error('获取端口范围失败')
    } finally {
      setLoading(false)
    }
  }, [serverId, dispatch])

  useEffect(() => {
    fetchPortRangesData()
  }, [fetchPortRangesData])

  // ==================== 对话框操作 ====================

  const showAddDialog = () => {
    setIsEditing(false)
    setCurrentRangeId(null)
    form.setFieldsValue({
      start_port: 5000,
      end_port: 6000,
      description: ''
    })
    setDialogVisible(true)
  }

  const showEditDialog = (range: PortRange) => {
    setIsEditing(true)
    setCurrentRangeId(range.id)
    form.setFieldsValue({
      start_port: range.start_port,
      end_port: range.end_port,
      description: range.description
    })
    setDialogVisible(true)
  }

  // ==================== 提交表单 ====================

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (values.start_port > values.end_port) {
        message.error('起始端口不能大于结束端口')
        return
      }

      setSubmitting(true)

      if (isEditing && currentRangeId) {
        await dispatch(updateServerPortRange({
          serverId,
          rangeId: currentRangeId,
          rangeData: values
        })).unwrap()
        message.success('端口范围更新成功')
      } else {
        await dispatch(addServerPortRange({
          serverId,
          rangeData: values
        })).unwrap()
        message.success('端口范围添加成功')
      }

      setDialogVisible(false)
      await fetchPortRangesData()
      onUpdate?.()
    } catch (error: any) {
      if (error.response || error.message) {
        message.error(isEditing ? '更新端口范围失败' : '添加端口范围失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ==================== 删除 ====================

  const confirmDelete = (range: PortRange) => {
    Modal.confirm({
      title: '删除确认',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除端口范围 "${range.start_port} - ${range.end_port}" 吗？`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      async onOk() {
        try {
          await dispatch(deleteServerPortRange({
            serverId,
            rangeId: range.id
          })).unwrap()
          message.success('端口范围删除成功')
          await fetchPortRangesData()
          onUpdate?.()
        } catch {
          message.error('删除端口范围失败')
        }
      }
    })
  }

  // ==================== 表格列定义 ====================

  const columns: ColumnsType<PortRange> = [
    {
      title: '端口范围',
      key: 'range',
      minWidth: 150,
      render: (_, record) => `${record.start_port} - ${record.end_port}`
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      minWidth: 200
    },
    {
      title: '端口数量',
      key: 'count',
      width: 100,
      render: (_, record) => record.end_port - record.start_port + 1
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="primary"
              shape="circle"
              size="small"
              icon={<EditOutlined />}
              onClick={() => showEditDialog(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              danger
              shape="circle"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => confirmDelete(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  // ==================== 渲染内容区 ====================

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      )
    }

    if (portRanges.length === 0) {
      return (
        <div className="empty-container">
          <Empty description="暂无端口范围">
            <Button type="primary" onClick={fetchPortRangesData}>
              刷新
            </Button>
          </Empty>
        </div>
      )
    }

    return (
      <div className="ranges-list">
        <Table
          columns={columns}
          dataSource={portRanges}
          rowKey="id"
          bordered
          pagination={false}
        />
      </div>
    )
  }

  // ==================== 渲染 ====================

  return (
    <div className="port-ranges-manager">
      <Card
        hoverable
        title={
          <div className="card-header">
            <div>
              <h3>端口范围管理</h3>
              <span className="subtitle">管理服务器的端口范围，用于Docker容器端口映射</span>
            </div>
            <div className="header-actions">
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={showAddDialog}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                添加端口范围
              </Button>
            </div>
          </div>
        }
      >
        {renderContent()}
      </Card>

      {/* 添加/编辑对话框 */}
      <Modal
        title={isEditing ? '编辑端口范围' : '添加端口范围'}
        open={dialogVisible}
        onCancel={() => setDialogVisible(false)}
        width={500}
        footer={
          <div className="dialog-footer">
            <Button onClick={() => setDialogVisible(false)}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {isEditing ? '更新' : '添加'}
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 16 }}
          initialValues={{
            start_port: 5000,
            end_port: 6000,
            description: ''
          }}
        >
          <Form.Item
            label="起始端口"
            name="start_port"
            rules={[
              { required: true, message: '请输入起始端口' },
              { type: 'number', min: 1, max: 65535, message: '端口范围必须在1-65535之间' }
            ]}
          >
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="结束端口"
            name="end_port"
            rules={[
              { required: true, message: '请输入结束端口' },
              { type: 'number', min: 1, max: 65535, message: '端口范围必须在1-65535之间' }
            ]}
          >
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[
              { max: 100, message: '描述不能超过100个字符' }
            ]}
          >
            <Input placeholder="请输入端口范围描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
