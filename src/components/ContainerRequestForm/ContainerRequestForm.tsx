import { useState, useEffect, useCallback } from 'react'
import { Modal, Form, Select, InputNumber, Input, Button, message } from 'antd'
import axios from '../../utils/axios'
import './ContainerRequestForm.css'

interface ContainerRequestFormProps {
  visible: boolean
  onClose: () => void
  servers: any[]
  selectedServerId?: string | number | null
  onSubmitted?: () => void
}

export default function ContainerRequestForm({
  visible,
  onClose,
  servers,
  selectedServerId = null,
  onSubmitted
}: ContainerRequestFormProps) {
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)
  const [serverResources, setServerResources] = useState({
    server_id: 0,
    server_name: '',
    max_cpu_cores: 0,
    max_memory_mb: 0,
    available: false
  })

  const maxCpuCores = serverResources.available ? serverResources.max_cpu_cores : 0
  const maxMemoryMb = serverResources.available ? serverResources.max_memory_mb : 0

  // ==================== API ====================

  const fetchServerResources = useCallback(async (serverId: string | number) => {
    try {
      const response = await axios.get(`/api/servers/${serverId}/resources`)
      setServerResources(response.data)
    } catch (error) {
      console.error('获取服务器资源信息失败:', error)
      message.error('获取服务器资源信息失败')
      setServerResources(prev => ({ ...prev, available: false }))
    }
  }, [])

  // ==================== 事件处理 ====================

  const onServerChange = useCallback(async (serverId: string) => {
    if (serverId) {
      await fetchServerResources(serverId)
      form.setFieldsValue({ cpu_cores: 6, memory_mb: 16384 })
    } else {
      setServerResources(prev => ({ ...prev, available: false }))
    }
  }, [fetchServerResources, form])

  const resetForm = useCallback(() => {
    form.resetFields()
    form.setFieldsValue({
      server_id: undefined,
      cpu_cores: 6,
      memory_mb: 16384,
      request_reason: ''
    })
    setServerResources(prev => ({ ...prev, available: false }))
  }, [form])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitLoading(true)

      await axios.post('/api/container-requests', values)

      resetForm()
      onClose()
      onSubmitted?.()
    } catch (error: any) {
      // 区分表单验证错误和 API 错误
      if (error.response) {
        console.error('提交申请失败:', error)
        message.error(error.response?.data?.msg || '提交申请失败')
      }
      // 表单验证失败不处理
    } finally {
      setSubmitLoading(false)
    }
  }

  // ==================== 副作用 ====================

  // 对话框打开时重置表单 + 预设服务器
  useEffect(() => {
    if (visible) {
      resetForm()
      if (selectedServerId) {
        // 延迟设置，确保表单已重置
        setTimeout(() => {
          form.setFieldsValue({ server_id: selectedServerId })
          fetchServerResources(selectedServerId)
        }, 0)
      }
    }
  }, [visible, selectedServerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== 渲染 ====================

  return (
    <Modal
      title="申请容器资源"
      open={visible}
      onCancel={handleClose}
      width={600}
      mask = {{closable: false}}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitLoading}
          onClick={handleSubmit}
        >
          提交申请
        </Button>
      ]}
    >
      <Form
        form={form}
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        initialValues={{
          cpu_cores: 6,
          memory_mb: 16384,
          request_reason: ''
        }}
      >
        {/* 服务器选择 */}
        <Form.Item
          label="服务器"
          name="server_id"
          rules={[{ required: true, message: '请选择服务器' }]}
        >
          <Select
            placeholder="请选择服务器"
            onChange={onServerChange}
            options={servers.map((s: any) => ({
              label: s.name,
              value: s.id
            }))}
          />
        </Form.Item>

        {/* 服务器资源信息 */}
        {serverResources.available && (
          <Form.Item label="服务器资源">
            <div className="resource-info">
              <div className="resource-item">
                <span className="resource-label">CPU:</span>
                <span className="resource-value">{serverResources.max_cpu_cores} 核心</span>
              </div>
              <div className="resource-item">
                <span className="resource-label">内存:</span>
                <span className="resource-value">{Math.round(serverResources.max_memory_mb / 1024)} GB</span>
              </div>
            </div>
          </Form.Item>
        )}

        {/* CPU 核心数 */}
        <Form.Item
          label="CPU核心数"
          name="cpu_cores"
          rules={[
            { required: true, message: '请输入CPU核心数' },
            {
              validator: (_, value) => {
                if (!value || value <= 0) {
                  return Promise.reject('CPU核心数必须大于0')
                }
                if (maxCpuCores > 0 && value > maxCpuCores) {
                  return Promise.reject(`CPU核心数不能超过${maxCpuCores}`)
                }
                return Promise.resolve()
              }
            }
          ]}
        >
          <InputNumber
            min={1}
            max={Math.max(1, maxCpuCores || 9999)}
            placeholder="请输入CPU核心数"
            style={{ width: '100%' }}
          />
        </Form.Item>
        {maxCpuCores > 0 && (
          <div className="form-tip" style={{ marginTop: -16, marginBottom: 16, paddingLeft: '25%' }}>
            最大可申请: {maxCpuCores} 核心
          </div>
        )}

        {/* 内存大小 */}
        <Form.Item
          label="内存大小"
          name="memory_mb"
          rules={[
            { required: true, message: '请输入内存大小' },
            {
              validator: (_, value) => {
                if (!value || value <= 0) {
                  return Promise.reject('内存大小必须大于0')
                }
                if (maxMemoryMb > 0 && value > maxMemoryMb) {
                  return Promise.reject(`内存大小不能超过${Math.round(maxMemoryMb / 1024)}GB`)
                }
                return Promise.resolve()
              }
            }
          ]}
        >
          <InputNumber
            min={1}
            max={Math.max(1, maxMemoryMb || 999999)}
            step={1024}
            placeholder="请输入内存大小(MB)"
            style={{ width: '100%' }}
          />
        </Form.Item>
        {maxMemoryMb > 0 && (
          <div className="form-tip" style={{ marginTop: -16, marginBottom: 16, paddingLeft: '25%' }}>
            最大可申请: {Math.round(maxMemoryMb / 1024)} GB ({maxMemoryMb} MB)
          </div>
        )}

        {/* 申请理由 */}
        <Form.Item
          label="申请理由"
          name="request_reason"
          rules={[
            { required: true, message: '请填写申请理由' },
            { min: 10, message: '申请理由至少10个字符' }
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder="请简要说明申请容器资源的用途和理由"
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
