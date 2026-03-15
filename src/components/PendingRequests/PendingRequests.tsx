import { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  Card, Table, Tag, Button, Modal, Form, Input, InputNumber, Select,
  Alert, Descriptions, Divider, Space, message
} from 'antd'
import {
  ClockCircleOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons'
import axios from '../../utils/axios'
import { checkContainerNameConflicts } from '../../utils/usernameConfict'
import './PendingRequests.css'

interface PendingRequestsProps {
  onRequestProcessed?: () => void
}

export interface PendingRequestsRef {
  fetchRequests: () => Promise<void>
}

const PendingRequests = forwardRef<PendingRequestsRef, PendingRequestsProps>(
  ({ onRequestProcessed }, ref) => {
    const [loading, setLoading] = useState(false)
    const [requests, setRequests] = useState<any[]>([])
    const [allUsers, setAllUsers] = useState<any[]>([])

    // 服务器资源数据
    const [storagePaths, setStoragePaths] = useState<any[]>([])
    const [dockerImages, setDockerImages] = useState<any[]>([])
    const [portRanges, setPortRanges] = useState<any[]>([])
    const [serverResources, setServerResources] = useState<any>({})

    // 对话框
    const [approveDialogOpen, setApproveDialogOpen] = useState(false)
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
    const [currentRequest, setCurrentRequest] = useState<any>(null)

    // 操作状态
    const [submitting, setSubmitting] = useState(false)
    const [rejecting, setRejecting] = useState(false)

    // 端口映射
    const [portMappings, setPortMappings] = useState<{ host_port: number | null; container_port: number | null }[]>([])
    const [portRangeMappings, setPortRangeMappings] = useState<{ start_port: number | null; end_port: number | null }[]>([])

    // 表单
    const [containerForm] = Form.useForm()
    const [rejectForm] = Form.useForm()

    // 监听端口范围选择
    const selectedPortRangeId = Form.useWatch('port_range_id', containerForm)
    const selectedPortRange = useMemo(
      () => portRanges.find((r) => r.id === selectedPortRangeId),
      [portRanges, selectedPortRangeId]
    )

    // ==================== 数据获取 ====================

    const fetchRequests = useCallback(async () => {
      setLoading(true)
      try {
        const response = await axios.get('/api/container-requests')
        setRequests(
          (response.data.requests || []).filter((r: any) => r.status === 'pending')
        )
      } catch (error) {
        console.error('获取申请列表失败:', error)
        message.error('获取申请列表失败')
      } finally {
        setLoading(false)
      }
    }, [])

    const fetchUsers = useCallback(async () => {
      try {
        const response = await axios.get('/api/users')
        setAllUsers(response.data.users || [])
      } catch (error) {
        console.error('获取用户列表失败:', error)
      }
    }, [])

    useEffect(() => {
      fetchRequests()
      fetchUsers()
    }, [fetchRequests, fetchUsers])

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      fetchRequests
    }))

    // ==================== 服务器资源加载 ====================

    const loadServerData = useCallback(async (serverId: number) => {
      try {
        const [resourcesResp, storageResp, imagesResp, portResp] = await Promise.all([
          axios.get(`/api/servers/${serverId}/resources`),
          axios.get(`/api/servers/${serverId}/storage_paths`),
          axios.get(`/api/servers/${serverId}/docker_images`),
          axios.get(`/api/servers/${serverId}/port_ranges`)
        ])

        setServerResources(resourcesResp.data || {})
        setStoragePaths(storageResp.data.storage_paths || [])
        setDockerImages(imagesResp.data.docker_images || [])

        const ranges = portResp.data.port_ranges || []
        setPortRanges(ranges)

        return ranges
      } catch (error) {
        console.error('获取服务器相关数据失败:', error)
        message.error('获取服务器相关数据失败')
        return []
      }
    }, [])

    // ==================== 密码生成 ====================

    const generatePassword = useCallback(() => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let password = ''
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return password
    }, [])

    // ==================== 打开批准对话框 ====================

    const openApprovalForm = useCallback(async (request: any) => {
      setCurrentRequest(request)

      const ranges = await loadServerData(request.server_id)

      const initialMappings = request.port_mappings || []
      const initialRangeMappings = request.port_range_mappings || []
      setPortMappings(initialMappings)
      setPortRangeMappings(initialRangeMappings)

      containerForm.setFieldsValue({
        user_id: request.user_id,
        container_name: request.username.toUpperCase(),
        server_id: request.server_id,
        storage_path_id: request.storage_path_id,
        shared_storage_path_id: request.shared_storage_path_id,
        image_id: request.image_id,
        port_range_id: ranges.length > 0 ? (request.port_range_id || ranges[0].id) : undefined,
        port: request.port || (ranges.length > 0 ? ranges[0].start_port : 2222),
        cpu_cores: request.cpu_cores,
        memory_mb: request.memory_mb,
        gpu_indices: request.gpu_indices || 'all',
        root_password: generatePassword()
      })

      setApproveDialogOpen(true)
    }, [containerForm, loadServerData, generatePassword])

    // ==================== 提交容器创建 ====================

    const submitContainerForm = useCallback(async () => {
      try {
        const values = await containerForm.validateFields()

        setSubmitting(true)

        const payload = {
          ...values,
          port_mappings: portMappings.filter((m) => m.host_port && m.container_port),
          port_range_mappings: portRangeMappings.filter((m) => m.start_port && m.end_port)
        }

        await axios.post('/api/containers', payload)
        message.success('容器创建申请已批准并创建成功')

        // 更新申请状态
        await axios.put(`/api/container-requests/${currentRequest.id}/approve`, {
          storage_path_id: values.storage_path_id,
          port: values.port,
          image_id: values.image_id,
          container_name: values.container_name,
          port_mappings: payload.port_mappings,
          port_range_mappings: payload.port_range_mappings,
          admin_comment: '申请已批准并创建容器'
        })

        setApproveDialogOpen(false)
        await fetchRequests()
        onRequestProcessed?.()
      } catch (error: any) {
        if (error.response) {
          message.error(error.response?.data?.msg || '创建容器失败')
        }
      } finally {
        setSubmitting(false)
      }
    }, [containerForm, portMappings, portRangeMappings, currentRequest, fetchRequests, onRequestProcessed])

    // ==================== 拒绝申请 ====================

    const openRejectDialog = useCallback((request: any) => {
      setCurrentRequest(request)
      rejectForm.resetFields()
      setRejectDialogOpen(true)
    }, [rejectForm])

    const confirmReject = useCallback(async () => {
      try {
        const values = await rejectForm.validateFields()
        setRejecting(true)

        await axios.put(`/api/container-requests/${currentRequest.id}/reject`, values)
        message.success('申请已拒绝')

        setRejectDialogOpen(false)
        await fetchRequests()
        onRequestProcessed?.()
      } catch (error: any) {
        if (error.response) {
          message.error(error.response?.data?.msg || '拒绝申请失败')
        }
      } finally {
        setRejecting(false)
      }
    }, [rejectForm, currentRequest, fetchRequests, onRequestProcessed])

    // ==================== 端口范围变化 ====================

    const handlePortRangeChange = useCallback((portRangeId: number) => {
      const range = portRanges.find((r) => r.id === portRangeId)
      if (range) {
        containerForm.setFieldValue('port', range.start_port)
      }
    }, [portRanges, containerForm])

    // ==================== 端口映射管理 ====================

    const addPortMapping = useCallback(() => {
      setPortMappings((prev) => [...prev, { host_port: null, container_port: null }])
    }, [])

    const removePortMapping = useCallback((index: number) => {
      setPortMappings((prev) => prev.filter((_, i) => i !== index))
    }, [])

    const updatePortMapping = useCallback((index: number, field: string, value: number | null) => {
      setPortMappings((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
      )
    }, [])

    const addPortRangeMapping = useCallback(() => {
      setPortRangeMappings((prev) => [...prev, { start_port: null, end_port: null }])
    }, [])

    const removePortRangeMapping = useCallback((index: number) => {
      setPortRangeMappings((prev) => prev.filter((_, i) => i !== index))
    }, [])

    const updatePortRangeMapping = useCallback((index: number, field: string, value: number | null) => {
      setPortRangeMappings((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
      )
    }, [])

    // ==================== 工具函数 ====================

    const formatDate = (dateStr: string) => {
      if (!dateStr) return ''
      return new Date(dateStr).toLocaleString('zh-CN')
    }

    const getStatusText = (status: string) => {
      const map: Record<string, string> = {
        pending: '待审批',
        approved: '已批准',
        rejected: '已拒绝'
      }
      return map[status] || status
    }

    // ==================== 表格列 ====================

    const columns = [
      { title: '申请ID', dataIndex: 'id', width: 80 },
      { title: '申请用户', dataIndex: 'username', width: 100 },
      { title: '服务器', dataIndex: 'server_name', width: 120 },
      {
        title: '资源配置',
        width: 120,
        render: (_: any, record: any) => (
          <div className="resource-config">
            <div>CPU: {record.cpu_cores} 核</div>
            <div>内存: {Math.round(record.memory_mb / 1024)} GB</div>
          </div>
        )
      },
      {
        title: '申请理由',
        dataIndex: 'request_reason',
        width: 150,
        ellipsis: true
      },
      {
        title: '申请时间',
        width: 160,
        render: (_: any, record: any) => formatDate(record.created_at)
      },
      {
        title: '状态',
        width: 80,
        render: (_: any, record: any) => (
          <Tag color="orange">{getStatusText(record.status)}</Tag>
        )
      },
      {
        title: '操作',
        width: 180,
        fixed: 'right' as const,
        render: (_: any, record: any) => (
          <Space size="small">
            <Button
              type="primary"
              size="small"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => openApprovalForm(record)}
            >
              批准创建
            </Button>
            <Button
              danger
              size="small"
              onClick={() => openRejectDialog(record)}
            >
              拒绝
            </Button>
          </Space>
        )
      }
    ]

    // ==================== 容器名称验证规则 ====================

    const containerNameRules = useMemo(() => {
      const currentUsername = currentRequest?.username || ''
      return [
        { required: true, message: '请输入容器名称' },
        {
          validator: (_: any, value: string) => {
            const error = checkContainerNameConflicts(value, currentUsername, allUsers)
            if (error) return Promise.reject(new Error([...error].join('\n')))
            return Promise.resolve()
          },
          validateTrigger: 'onBlur'
        }
      ]
    }, [currentRequest, allUsers])

    // ==================== 渲染 ====================

    return (
      <div className="pending-requests">
        <Card
          className="request-card"
          title={
            <span className="card-title">
              <ClockCircleOutlined /> 待审批申请
            </span>
          }
          extra={
            <Button
              type="primary"
              size="small"
              icon={<ReloadOutlined />}
              onClick={fetchRequests}
              loading={loading}
            >
              刷新
            </Button>
          }
          hoverable
        >
          <Table
            loading={loading}
            dataSource={requests}
            columns={columns}
            rowKey="id"
            bordered
            size="small"
            scroll={{ x: 1000 }}
            pagination={false}
            locale={{ emptyText: '暂无待审批申请' }}
          />
        </Card>

        {/* ========== 批准对话框 ========== */}
        <Modal
          title="批准容器申请 - 创建容器"
          open={approveDialogOpen}
          onCancel={() => setApproveDialogOpen(false)}
          onOk={submitContainerForm}
          confirmLoading={submitting}
          okText="批准并创建容器"
          cancelText="取消"
          width="50%"
          maskClosable={false}
          destroyOnClose
        >
          <Form
            form={containerForm}
            layout="horizontal"
            labelCol={{ span: 6 }}
            wrapperCol={{ span: 18 }}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
              message={
                <span>
                  正在为用户 <strong>{currentRequest?.username}</strong> 在服务器{' '}
                  <strong>{currentRequest?.server_name}</strong> 上创建容器
                </span>
              }
            />

            <Form.Item label="申请用户">
              <Input value={currentRequest?.username} disabled />
            </Form.Item>

            <Form.Item label="目标服务器">
              <Input value={currentRequest?.server_name} disabled />
            </Form.Item>

            <Form.Item label="申请理由">
              <Input.TextArea value={currentRequest?.request_reason} rows={2} disabled />
            </Form.Item>

            <Form.Item
              name="container_name"
              label="容器名称"
              rules={containerNameRules}
              validateTrigger="onBlur"
            >
              <Input placeholder="容器名称" />
            </Form.Item>

            <Form.Item
              name="storage_path_id"
              label="选择存储路径"
              rules={[{ required: true, message: '请选择存储路径' }]}
            >
              <Select placeholder="请选择存储路径">
                {storagePaths.map((path) => (
                  <Select.Option key={path.id} value={path.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{path.path}</span>
                      <Space size="small">
                        {path.is_system && <Tag color="orange">系统</Tag>}
                        {path.is_shared && <Tag color="green">共享</Tag>}
                        {path.description && (
                          <span style={{ color: '#8492a6', fontSize: 13 }}>{path.description}</span>
                        )}
                      </Space>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="shared_storage_path_id" label="选择共享路径">
              <Select placeholder="请选择共享路径" allowClear>
                {storagePaths.map((path) => (
                  <Select.Option key={path.id} value={path.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{path.path}</span>
                      <Space size="small">
                        {path.is_system && <Tag color="orange">系统</Tag>}
                        {path.is_shared && <Tag color="green">共享</Tag>}
                        {path.description && (
                          <span style={{ color: '#8492a6', fontSize: 13 }}>{path.description}</span>
                        )}
                      </Space>
                    </div>
                  </Select.Option>
                ))}
              </Select>
              <div className="form-tip">共享路径将被挂载到容器的/root/share目录</div>
            </Form.Item>

            <Form.Item
              name="image_id"
              label="选择Docker镜像"
              rules={[{ required: true, message: '请选择Docker镜像' }]}
            >
              <Select placeholder="请选择Docker镜像">
                {dockerImages.map((image) => (
                  <Select.Option key={image.id} value={image.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="image-name">
                        <span className="repository">{image.repository || '无仓库名'}</span>
                        {image.tag && <Tag>{image.tag}</Tag>}
                      </div>
                      {image.description && (
                        <div className="image-description">{image.description}</div>
                      )}
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="port_range_id"
              label="选择端口范围"
              rules={[{ required: true, message: '请选择端口范围' }]}
            >
              <Select placeholder="请选择端口范围" onChange={handlePortRangeChange}>
                {portRanges.map((range) => (
                  <Select.Option
                    key={range.id}
                    value={range.id}
                    disabled={range.start_port >= range.end_port}
                  >
                    {range.start_port}-{range.end_port} ({range.description || '无描述'})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="port"
              label="SSH端口"
              rules={[
                { required: true, message: '请输入SSH端口' },
                { type: 'number', min: 1, max: 65535, message: '端口号无效' }
              ]}
            >
              <InputNumber
                min={selectedPortRange?.start_port || 1000}
                max={selectedPortRange?.end_port || 65535}
                disabled={!selectedPortRangeId}
                style={{ width: '100%' }}
              />
              <div className="form-tip">SSH端口必须在选定的端口范围内，用于远程连接容器</div>
            </Form.Item>

            <Form.Item
              name="cpu_cores"
              label="CPU核心数"
              rules={[
                { required: true, message: '请设置CPU核心数' },
                { type: 'number', min: 1, message: 'CPU核心数至少为1' }
              ]}
            >
              <InputNumber
                min={1}
                max={serverResources?.cpu_cores || 1}
                style={{ width: '100%' }}
              />
              <div className="form-tip">
                申请的CPU核心数: {currentRequest?.cpu_cores} (服务器总CPU: {serverResources?.cpu_cores || '未知'})
              </div>
            </Form.Item>

            <Form.Item
              name="memory_mb"
              label="内存大小(MB)"
              rules={[
                { required: true, message: '请设置内存大小' },
                { type: 'number', min: 512, message: '内存大小至少512MB' }
              ]}
            >
              <InputNumber
                min={512}
                max={serverResources?.total_memory_mb || 1024}
                step={512}
                style={{ width: '100%' }}
              />
              <div className="form-tip">
                申请的内存大小: {currentRequest ? Math.round(currentRequest.memory_mb / 1024) : 0}GB ({currentRequest?.memory_mb}MB)
              </div>
            </Form.Item>

            <Form.Item name="gpu_indices" label="GPU设备">
              <Select
                placeholder="请选择GPU设备"
                disabled={serverResources?.gpu_count === 0}
              >
                <Select.Option value="all">全部GPU</Select.Option>
                {(serverResources?.gpu_devices || []).map((gpu: any, index: number) => (
                  <Select.Option key={index} value={String(gpu.index)}>
                    GPU {gpu.index}: {gpu.name}
                  </Select.Option>
                ))}
                {serverResources?.gpu_devices?.length >= 2 && (
                  <Select.Option value="0,1">GPU 0,1 (前两个GPU)</Select.Option>
                )}
              </Select>
              <div className="form-tip">服务器GPU数量: {serverResources?.gpu_count || '0'}</div>
            </Form.Item>

            {/* 额外端口映射 */}
            <Form.Item label="额外端口映射">
              <div className="port-mappings-container">
                {portMappings.map((mapping, index) => (
                  <div key={index} className="port-mapping-item">
                    <InputNumber
                      value={mapping.host_port}
                      min={selectedPortRange?.start_port || 1000}
                      max={selectedPortRange?.end_port || 65535}
                      disabled={!selectedPortRangeId}
                      placeholder="主机端口"
                      style={{ width: '45%' }}
                      onChange={(val) => updatePortMapping(index, 'host_port', val)}
                    />
                    <span className="port-mapping-arrow">→</span>
                    <InputNumber
                      value={mapping.container_port}
                      min={1}
                      max={65535}
                      placeholder="容器端口"
                      style={{ width: '45%' }}
                      onChange={(val) => updatePortMapping(index, 'container_port', val)}
                    />
                    <Button
                      danger
                      shape="circle"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removePortMapping(index)}
                      style={{ marginLeft: 10 }}
                    />
                  </div>
                ))}
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={addPortMapping}
                  disabled={!selectedPortRangeId}
                  style={{ marginTop: 10 }}
                >
                  添加端口映射
                </Button>
              </div>
              <div className="form-tip">额外端口映射用于将主机端口映射到容器内部端口，例如Web服务、数据库等</div>
            </Form.Item>

            {/* 额外端口段映射 */}
            <Form.Item label="额外端口段映射">
              <div className="port-mappings-container">
                {portRangeMappings.map((mapping, index) => (
                  <div key={index} className="port-mapping-item">
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <InputNumber
                        value={mapping.start_port}
                        min={selectedPortRange?.start_port || 1000}
                        max={mapping.end_port || selectedPortRange?.end_port || 65535}
                        disabled={!selectedPortRangeId}
                        placeholder="起始端口"
                        style={{ width: '100%' }}
                        onChange={(val) => updatePortRangeMapping(index, 'start_port', val)}
                      />
                      <span className="port-mapping-dash">-</span>
                      <InputNumber
                        value={mapping.end_port}
                        min={mapping.start_port || selectedPortRange?.start_port || 1000}
                        max={selectedPortRange?.end_port || 65535}
                        disabled={!selectedPortRangeId}
                        placeholder="结束端口"
                        style={{ width: '100%' }}
                        onChange={(val) => updatePortRangeMapping(index, 'end_port', val)}
                      />
                    </div>
                    <Button
                      danger
                      shape="circle"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removePortRangeMapping(index)}
                      style={{ marginLeft: 10 }}
                    />
                  </div>
                ))}
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={addPortRangeMapping}
                  disabled={!selectedPortRangeId}
                  style={{ marginTop: 10 }}
                >
                  添加端口段映射
                </Button>
              </div>
              <div className="form-tip">端口段映射用于批量映射连续的端口范围，适用于需要多个连续端口的应用</div>
            </Form.Item>

            <Form.Item
              name="root_password"
              label="容器密码"
              rules={[
                { required: true, message: '请设置容器密码' },
                { min: 6, message: '密码长度至少6个字符' }
              ]}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="root_password" noStyle>
                  <Input.Password placeholder="容器root用户密码" style={{ flex: 1 }} />
                </Form.Item>
                <Button
                  type="primary"
                  onClick={() => {
                    const pwd = generatePassword()
                    containerForm.setFieldValue('root_password', pwd)
                    message.success('已生成随机密码')
                  }}
                >
                  生成随机密码
                </Button>
              </Space.Compact>
              <div className="form-tip">容器root用户的密码，用于SSH登录</div>
            </Form.Item>

            {/* 隐藏字段 */}
            <Form.Item name="user_id" hidden><Input /></Form.Item>
            <Form.Item name="server_id" hidden><Input /></Form.Item>
          </Form>
        </Modal>

        {/* ========== 拒绝对话框 ========== */}
        <Modal
          title="拒绝容器申请"
          open={rejectDialogOpen}
          onCancel={() => setRejectDialogOpen(false)}
          onOk={confirmReject}
          confirmLoading={rejecting}
          okText="确认拒绝"
          okType="danger"
          cancelText="取消"
          width={500}
          maskClosable={false}
          destroyOnClose
        >
          {currentRequest && (
            <>
              <Descriptions title="申请信息" column={2} bordered size="small">
                <Descriptions.Item label="申请用户">{currentRequest.username}</Descriptions.Item>
                <Descriptions.Item label="目标服务器">{currentRequest.server_name}</Descriptions.Item>
                <Descriptions.Item label="CPU核心">{currentRequest.cpu_cores} 核</Descriptions.Item>
                <Descriptions.Item label="内存大小">{Math.round(currentRequest.memory_mb / 1024)} GB</Descriptions.Item>
                <Descriptions.Item label="申请理由" span={2}>{currentRequest.request_reason}</Descriptions.Item>
              </Descriptions>

              <Divider />

              <Form form={rejectForm} layout="vertical">
                <Form.Item
                  name="admin_comment"
                  label="拒绝理由"
                  rules={[
                    { required: true, message: '请填写拒绝理由' },
                    { min: 5, message: '拒绝理由至少5个字符' }
                  ]}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="请说明拒绝的理由"
                    showCount
                    maxLength={500}
                  />
                </Form.Item>
              </Form>
            </>
          )}
        </Modal>
      </div>
    )
  }
)

PendingRequests.displayName = 'PendingRequests'

export default PendingRequests
