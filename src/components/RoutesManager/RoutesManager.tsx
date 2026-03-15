import { useEffect, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  Card, Table, Tag, Button, Modal, Form, Input, Switch, Space, Empty, Skeleton, message
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  fetchRoutes, createRoute, updateRoute, deleteRoute,
  selectRoutes, selectRoutesLoading
} from '../../store/serversSlice'
import type { AppDispatch } from '../../store'
import './RoutesManager.css'

const { TextArea } = Input

const formatExternalUrl = (value: string | null) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

export default function RoutesManager() {
  const dispatch = useDispatch<AppDispatch>()
  const routes = useSelector(selectRoutes) || []
  const routesLoading = useSelector(selectRoutesLoading)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [currentRouteId, setCurrentRouteId] = useState<number | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    dispatch(fetchRoutes())
  }, [dispatch])

  // ==================== 表格列 ====================

  const columns = [
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '路由域名', dataIndex: 'domain', width: 200 },
    {
      title: '管理IP', dataIndex: 'router_mgmt_ip', width: 160,
      render: (val: string) => val
        ? <a href={formatExternalUrl(val)} target="_blank" rel="noopener noreferrer">{val}</a>
        : '-'
    },
    {
      title: 'DDNS地址', dataIndex: 'ddns_url', width: 200,
      render: (val: string) => val
        ? <a href={formatExternalUrl(val)} target="_blank" rel="noopener noreferrer">{val}</a>
        : '-'
    },
    {
      title: '网关IP', dataIndex: 'gateway_ip', width: 140,
      render: (val: string) => val || '-'
    },
    {
      title: 'CIDR', dataIndex: 'cidr', width: 140,
      render: (val: string) => val || '-'
    },
    {
      title: '描述', dataIndex: 'description', width: 220,
      render: (val: string) => val || '-'
    },
    {
      title: '状态', width: 120,
      render: (_: any, record: any) => (
        <Tag color={record.is_active ? 'green' : 'default'}>
          {record.is_active ? '启用' : '停用'}
        </Tag>
      )
    },
    {
      title: '操作', width: 150, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button type="primary" size="small" shape="circle" icon={<EditOutlined />}
            onClick={() => showEditDialog(record)} />
          <Button danger size="small" shape="circle" icon={<DeleteOutlined />}
            onClick={() => confirmDelete(record)} />
        </Space>
      )
    }
  ]

  // ==================== 对话框操作 ====================

  const showAddDialog = useCallback(() => {
    form.resetFields()
    setIsEditing(false)
    setCurrentRouteId(null)
    setDialogOpen(true)
  }, [form])

  const showEditDialog = useCallback((route: any) => {
    setIsEditing(true)
    setCurrentRouteId(route.id)
    form.setFieldsValue({
      name: route.name,
      cidr: route.cidr || '',
      domain: route.domain,
      gateway_ip: route.gateway_ip || '',
      description: route.description || '',
      router_mgmt_ip: route.router_mgmt_ip || '',
      ddns_url: route.ddns_url || '',
      is_active: route.is_active
    })
    setDialogOpen(true)
  }, [form])

  const submitRoute = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const payload = {
        name: values.name,
        cidr: values.cidr || '',
        domain: values.domain,
        gateway_ip: values.gateway_ip || '',
        description: values.description || '',
        router_mgmt_ip: values.router_mgmt_ip || '',
        ddns_url: values.ddns_url || '',
        is_active: values.is_active ?? true
      }

      if (isEditing && currentRouteId !== null) {
        await dispatch(updateRoute({ routeId: String(currentRouteId), routeData: payload })).unwrap()
        message.success('路由更新成功')
      } else {
        await dispatch(createRoute(payload)).unwrap()
        message.success('路由创建成功')
      }
      setDialogOpen(false)
    } catch (error: any) {
      if (error?.errorFields) return // 表单验证失败
      message.error(error || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }, [dispatch, form, isEditing, currentRouteId])

  const confirmDelete = useCallback((route: any) => {
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除路由 "${route.name}" 吗？`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteRoute(String(route.id))).unwrap()
          message.success('路由已删除')
        } catch (error: any) {
          message.error(error || '删除失败')
        }
      }
    })
  }, [dispatch])

  // ==================== 渲染 ====================

  const renderContent = () => {
    if (routesLoading) {
      return (
        <div className="loading-container">
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      )
    }

    if (routes.length === 0) {
      return (
        <div className="empty-container">
          <Empty description="暂无路由配置">
            <Button type="primary" onClick={showAddDialog}>新增路由</Button>
          </Empty>
        </div>
      )
    }

    return (
      <Table
        dataSource={routes}
        columns={columns}
        rowKey="id"
        bordered
        scroll={{ x: 1400 }}
        pagination={false}
      />
    )
  }

  return (
    <div className="routes-manager">
      <Card
        hoverable
        title={
          <div className="card-header">
            <div>
              <h3 style={{ margin: 0 }}>路由配置</h3>
              <span className="subtitle">维护路由域名及管理信息，安装代理时自动下发</span>
            </div>
            <div className="header-actions">
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={showAddDialog}>
                新增路由
              </Button>
            </div>
          </div>
        }
      >
        {renderContent()}
      </Card>

      {/* 新增/编辑对话框 */}
      <Modal
        title={isEditing ? '编辑路由' : '新增路由'}
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onOk={submitRoute}
        confirmLoading={submitting}
        okText={isEditing ? '更新' : '创建'}
        cancelText="取消"
        width={520}
        destroyOnClose
        forceRender
      >
        <Form
          form={form}
          layout="horizontal"
          labelCol={{ span: 6 }}
          initialValues={{ is_active: true }}
        >
          <Form.Item name="name" label="名称"
            rules={[{ required: true, message: '请输入路由名称' }]}>
            <Input placeholder="例如：办公室路由" />
          </Form.Item>

          <Form.Item name="cidr" label="CIDR">
            <Input placeholder="例如：192.168.1.0/24" />
          </Form.Item>

          <Form.Item name="domain" label="路由域名"
            rules={[{ required: true, message: '请输入路由域名' }]}>
            <Input placeholder="例如：office.example.com" />
          </Form.Item>

          <Form.Item name="router_mgmt_ip" label="管理IP">
            <Input placeholder="例如：192.168.1.1" />
          </Form.Item>

          <Form.Item name="ddns_url" label="DDNS地址">
            <Input placeholder="例如：https://router.example.com" />
          </Form.Item>

          <Form.Item name="gateway_ip" label="网关IP">
            <Input placeholder="例如：192.168.1.1" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="备注信息" />
          </Form.Item>

          <Form.Item name="is_active" label="启用状态" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
