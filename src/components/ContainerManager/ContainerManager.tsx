import { forwardRef, useImperativeHandle, useState, useEffect, useMemo } from 'react'
import {
  Card, Table, Tag, Button, Space, Select, Input, Pagination, Modal,
  Form, InputNumber, Switch, Alert, Dropdown, message
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, DeleteOutlined, EditOutlined,
  PlayCircleOutlined, PauseCircleOutlined, DesktopOutlined, LinkOutlined,
  PlusOutlined, DownOutlined, MinusCircleOutlined
} from '@ant-design/icons'
import {
  useContainerManagement,
  getContainerStatusType, getContainerStatusText,
  formatDate, formatMemory, generatePassword, getSshOptions
} from '../../hooks/useContainerManagement'
import { checkContainerNameConflicts } from '../../utils/usernameConfict'
import TerminalDialog from '../TerminalDialog/TerminalDialog'
import { useSelector } from 'react-redux'
import { selectCurrentUser } from '../../store/authSlice'
import './ContainerManager.css'

const ContainerManager = forwardRef((_props, ref) => {
  const mgmt = useContainerManagement()
  const currentUser = useSelector(selectCurrentUser)
  const authToken = currentUser ? localStorage.getItem('token') || '' : ''

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    openCreateContainerDialog: mgmt.openCreateDialog,
    fetchContainers: mgmt.fetchContainers
  }))

  // 终端显示信息
  const terminalDisplayName = mgmt.terminalContext
    ? [mgmt.terminalContext.containerName, mgmt.terminalContext.serverName].filter(Boolean).join(' @ ') || '容器远程登录'
    : ''
  const terminalDisplayAddress = mgmt.terminalContext
    ? [mgmt.terminalContext.host, mgmt.terminalContext.port].filter(Boolean).join(':')
    : ''

  // ==================== 表格列 ====================

  const columns: any[] = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '容器名称', dataIndex: 'container_name', width: 120 },
    { title: '用户', dataIndex: 'user_username', width: 100 },
    { title: '服务器', dataIndex: 'server_name', width: 120 },
    { title: '镜像', dataIndex: 'image_name', width: 160 },
    { title: 'SSH', dataIndex: 'port', width: 70 },
    { title: 'CPU', dataIndex: 'cpu_cores', width: 60 },
    { title: '内存(MB)', dataIndex: 'memory_mb', width: 90 },
    {
      title: '状态', width: 90,
      render: (_: any, r: any) => (
        <Tag color={getContainerStatusType(r.status)}>{getContainerStatusText(r.status)}</Tag>
      )
    },
    {
      title: '创建时间', width: 160,
      render: (_: any, r: any) => formatDate(r.created_at)
    },
    // 控制权限列（仅管理员）
    ...(mgmt.currentUserRole === 'admin' ? [{
      title: '控制权限', width: 100, align: 'center' as const,
      render: (_: any, r: any) => (
        <Switch
          checked={r.is_control_enabled}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
          loading={mgmt.actionLoading === `control-${r.id}`}
          onChange={(val) => mgmt.toggleControl(r.id, val)}
        />
      )
    }] : []),
    {
      title: '操作', width: 400, fixed: 'right' as const,
      render: (_: any, record: any) => {
        const operable = mgmt.canOperate(record)
        const remoteOptions = getSshOptions(record, false)
        const sshOptions = getSshOptions(record)

        return (
          <Space size="small" wrap>
            {/* 编辑 */}
            <Button size="small" type="primary"
              loading={mgmt.actionLoading === `edit-${record.id}`}
              disabled={!operable && record.status !== 'deleted'}
              onClick={() => mgmt.openEditDialog(record)}>
              <EditOutlined /> 编辑
            </Button>

            {/* 启动/停止 */}
            {record.status !== 'running' ? (
              <Button size="small" style={{ color: '#52c41a', borderColor: '#52c41a' }}
                loading={mgmt.actionLoading === `start-${record.id}`}
                disabled={!operable}
                onClick={() => mgmt.startContainer(record.id)}>
                <PlayCircleOutlined /> 启动
              </Button>
            ) : (
              <Button size="small" style={{ color: '#faad14', borderColor: '#faad14' }}
                loading={mgmt.actionLoading === `stop-${record.id}`}
                disabled={!operable}
                onClick={() => mgmt.stopContainer(record.id)}>
                <PauseCircleOutlined /> 停止
              </Button>
            )}

            {/* 远程登录 */}
            {operable ? (
              remoteOptions.length > 0 ? (
                <Dropdown menu={{
                  items: remoteOptions.map(opt => ({ key: opt.key, label: opt.label })),
                  onClick: ({ key }) => {
                    const opt = remoteOptions.find(o => o.key === key)
                    if (opt) mgmt.openTerminal(record, opt.value)
                  }
                }}>
                  <Button size="small" type="primary">
                    <DesktopOutlined /> 远程登录 <DownOutlined />
                  </Button>
                </Dropdown>
              ) : (
                <Button size="small" type="primary"
                  onClick={() => message.warning('暂时无法获取服务器网络信息，请稍后再试')}>
                  <DesktopOutlined /> 远程登录
                </Button>
              )
            ) : (
              <Button size="small" type="primary" disabled>
                <DesktopOutlined /> 远程登录
              </Button>
            )}

            {/* SSH指令 */}
            {operable ? (
              sshOptions.length > 0 ? (
                <Dropdown menu={{
                  items: sshOptions.map(opt => ({ key: opt.key, label: opt.label })),
                  onClick: ({ key }) => {
                    const opt = sshOptions.find(o => o.key === key)
                    if (opt) mgmt.handleSshCommand(opt, record)
                  }
                }}>
                  <Button size="small" type="primary">
                    <LinkOutlined /> SSH指令 <DownOutlined />
                  </Button>
                </Dropdown>
              ) : (
                <Button size="small" type="primary"
                  onClick={() => message.warning('暂时无法获取服务器网络信息，请稍后再试')}>
                  <LinkOutlined /> SSH指令
                </Button>
              )
            ) : (
              <Button size="small" type="primary" disabled>
                <LinkOutlined /> SSH指令
              </Button>
            )}

            {/* 删除 */}
            <Button size="small" danger
              loading={mgmt.actionLoading === `delete-${record.id}`}
              disabled={!operable}
              onClick={() => mgmt.confirmDelete(record)}>
              <DeleteOutlined /> 删除
            </Button>
          </Space>
        )
      }
    }
  ]

  // ==================== 渲染 ====================

  return (
    <div className="container-manager">
      {/* 筛选 */}
      <Card hoverable style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <span>用户名：</span>
          <Input placeholder="搜索用户名" allowClear style={{ width: 160 }}
            value={mgmt.filter.keyword}
            onChange={e => mgmt.setFilter(prev => ({ ...prev, keyword: e.target.value }))}
          />
          <span>服务器：</span>
          <Select value={mgmt.filter.serverId || undefined} onChange={val => mgmt.setFilter(prev => ({ ...prev, serverId: val || '' }))}
            style={{ width: 160 }} allowClear placeholder="全部服务器">
            {mgmt.servers.map((s: any) => (
              <Select.Option key={s.id} value={String(s.id)}>{s.name}</Select.Option>
            ))}
          </Select>
          <span>状态：</span>
          <Select value={mgmt.filter.status || undefined} onChange={val => mgmt.setFilter(prev => ({ ...prev, status: val || '' }))}
            style={{ width: 120 }} allowClear placeholder="全部状态">
            <Select.Option value="running">运行中</Select.Option>
            <Select.Option value="stopped">已停止</Select.Option>
            <Select.Option value="creating">创建中</Select.Option>
            <Select.Option value="error">错误</Select.Option>
          </Select>
          <span>镜像：</span>
          <Select value={mgmt.filter.imageName || undefined} onChange={val => mgmt.setFilter(prev => ({ ...prev, imageName: val || '' }))}
            style={{ width: 200 }} allowClear showSearch placeholder="全部镜像">
            {mgmt.distinctImages.map(img => (
              <Select.Option key={img} value={img}>{img}</Select.Option>
            ))}
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={mgmt.handleFilter}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={mgmt.resetFilter}>重置</Button>
        </Space>
      </Card>

      {/* 表格 */}
      <Card hoverable>
        <div style={{ marginBottom: 12 }}>
          <Button danger icon={<DeleteOutlined />}
            disabled={mgmt.validSelectedContainers.length === 0}
            onClick={mgmt.confirmBatchDelete}>
            批量删除{mgmt.validSelectedContainers.length > 0 && `（${mgmt.validSelectedContainers.length}）`}
          </Button>
        </div>

        <Table
          loading={mgmt.loading}
          dataSource={mgmt.pagedContainers}
          columns={columns}
          rowKey="id"
          bordered
          scroll={{ x: 1600 }}
          pagination={false}
          rowSelection={{
            selectedRowKeys: mgmt.selectedKeys,
            onChange: mgmt.setSelectedKeys,
            getCheckboxProps: (record: any) => ({ disabled: !mgmt.canOperate(record) })
          }}
        />

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={mgmt.pagination.page}
            pageSize={mgmt.pagination.pageSize}
            total={mgmt.filteredContainers.length}
            showSizeChanger showQuickJumper
            showTotal={total => `共 ${total} 条`}
            pageSizeOptions={['10', '20', '50', '100']}
            onChange={(page, pageSize) => mgmt.setPagination({ page, pageSize: pageSize || 20 })}
          />
        </div>
      </Card>

      {/* 终端 */}
      {mgmt.terminalContext && authToken && (
        <TerminalDialog
          open={mgmt.terminalOpen}
          onClose={() => mgmt.setTerminalOpen(false)}
          serverId={mgmt.terminalContext.serverId}
          containerId={mgmt.terminalContext.containerId}
          serverName={terminalDisplayName}
          serverAddress={terminalDisplayAddress}
          serverUser={mgmt.terminalContext.user || 'root'}
          targetHost={mgmt.terminalContext.host}
          targetPort={mgmt.terminalContext.port}
          loginUsername={mgmt.terminalContext.user || 'root'}
          authToken={authToken}
        />
      )}

      {/* 创建容器对话框 */}
      <CreateContainerDialog
        open={mgmt.createDialogOpen}
        onCancel={() => mgmt.setCreateDialogOpen(false)}
        onSubmit={mgmt.submitCreate}
        loading={mgmt.submitting}
        servers={mgmt.servers}
        users={mgmt.users}
        storagePaths={mgmt.storagePaths}
        dockerImages={mgmt.dockerImages}
        portRanges={mgmt.portRanges}
        serverResources={mgmt.serverResources}
        onServerChange={mgmt.fetchServerData}
      />

      {/* 编辑容器对话框 */}
      <EditContainerDialog
        open={mgmt.editDialogOpen}
        onCancel={() => mgmt.setEditDialogOpen(false)}
        onSubmit={mgmt.submitEdit}
        loading={mgmt.submitting}
        container={mgmt.editingContainer}
        servers={mgmt.servers}
        storagePaths={mgmt.storagePaths}
        dockerImages={mgmt.dockerImages}
        portRanges={mgmt.portRanges}
        serverResources={mgmt.serverResources}
      />
    </div>
  )
})

ContainerManager.displayName = 'ContainerManager'
export default ContainerManager

// ==================== 创建容器对话框 ====================

function CreateContainerDialog({
  open, onCancel, onSubmit, loading,
  servers, users, storagePaths, dockerImages, portRanges, serverResources,
  onServerChange
}: any) {
  const [form] = Form.useForm()
  const serverId = Form.useWatch('server_id', form)
  const portRangeId = Form.useWatch('port_range_id', form)
  const userId = Form.useWatch('user_id', form)

  const selectedRange = useMemo(
    () => portRanges.find((r: any) => r.id === portRangeId),
    [portRanges, portRangeId]
  )

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({ cpu_cores: 1, memory_mb: 1024, root_password: generatePassword(), port_mappings: [], port_range_mappings: [] })
    }
  }, [open])

  // 服务器变化时加载资源
  useEffect(() => {
    if (serverId) {
      onServerChange(serverId)
      form.setFieldsValue({
        storage_path_id: undefined, shared_storage_path_id: undefined,
        image_id: undefined, port_range_id: undefined, port: null, gpu_indices: undefined
      })
    }
  }, [serverId])

  // 用户变化时自动生成容器名
  useEffect(() => {
    if (userId) {
      const user = users.find((u: any) => u.id === userId)
      if (user) form.setFieldsValue({ container_name: user.username.toUpperCase() })
    } else {
      form.setFieldsValue({ container_name: '' })
    }
  }, [userId, users])

  // 端口范围变化时重置端口
  useEffect(() => {
    if (selectedRange && selectedRange.start_port < selectedRange.end_port) {
      form.setFieldsValue({ port: selectedRange.start_port })
    } else {
      form.setFieldsValue({ port: null })
    }
  }, [portRangeId, selectedRange])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      await onSubmit(values)
    } catch { /* validation */ }
  }

  return (
    <Modal title="创建容器" open={open} onCancel={onCancel} onOk={handleOk}
      confirmLoading={loading} width={700} destroyOnClose maskClosable={false}
      okText="创建">
      <Form form={form} layout="horizontal" labelCol={{ span: 6 }}>
        <Form.Item name="user_id" label="选择用户" rules={[{ required: true, message: '请选择用户' }]}>
          <Select placeholder="搜索或选择用户" showSearch allowClear
            filterOption={(input, option) => (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())}>
            {users.map((u: any) => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
          </Select>
        </Form.Item>

        <Form.Item name="container_name" label="容器名称" rules={[
          { required: true, message: '请输入容器名称' },
          {
            validator: (_, value) => {
              if (!value) return Promise.resolve()
              const selectedUser = users.find((u: any) => u.id === form.getFieldValue('user_id'))
              const err = checkContainerNameConflicts(value, selectedUser?.username || '', users)
              return err ? Promise.reject(err) : Promise.resolve()
            }
          }
        ]}>
          <Input placeholder="容器名称" disabled={!userId} />
        </Form.Item>

        <Form.Item name="server_id" label="选择服务器" rules={[{ required: true, message: '请选择服务器' }]}>
          <Select placeholder="请选择服务器">
            {servers.map((s: any) => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
          </Select>
        </Form.Item>

        <Form.Item name="storage_path_id" label="选择存储路径" rules={[{ required: true, message: '请选择存储路径' }]}>
          <Select placeholder="请选择存储路径" disabled={!serverId}>
            {storagePaths.map((p: any) => (
              <Select.Option key={p.id} value={p.id}>
                {p.path}{p.description ? ` (${p.description})` : ''}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="shared_storage_path_id" label="选择共享路径" rules={[{ required: true, message: '请选择共享路径' }]}>
          <Select placeholder="请选择共享路径" disabled={!serverId}>
            {storagePaths.map((p: any) => (
              <Select.Option key={p.id} value={p.id}>
                {p.path}{p.description ? ` (${p.description})` : ''}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="image_id" label="Docker镜像" rules={[{ required: true, message: '请选择Docker镜像' }]}>
          <Select placeholder="请选择Docker镜像" disabled={!serverId}>
            {dockerImages.map((img: any) => (
              <Select.Option key={img.id} value={img.id}>
                {img.repository}:{img.tag}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="port_range_id" label="端口范围" rules={[{ required: true, message: '请选择端口范围' }]}>
          <Select placeholder="请选择端口范围" disabled={!serverId}>
            {portRanges.map((r: any) => (
              <Select.Option key={r.id} value={r.id} disabled={r.start_port >= r.end_port}>
                {r.start_port}-{r.end_port} ({r.description || '无描述'})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="port" label="SSH端口" rules={[{ required: true, message: '请输入SSH端口' }]}>
          <InputNumber
            min={selectedRange?.start_port || 1000}
            max={selectedRange?.end_port || 65535}
            disabled={!portRangeId}
            style={{ width: '100%' }}
          />
        </Form.Item>

        {/* 额外端口映射 */}
        <Form.Item label="额外端口映射">
          <Form.List name="port_mappings">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Space key={key} align="center" style={{ marginBottom: 8 }}>
                    <Form.Item name={[name, 'host_port']} noStyle>
                      <InputNumber placeholder="主机端口" min={selectedRange?.start_port || 1} max={selectedRange?.end_port || 65535}
                        disabled={!portRangeId} style={{ width: 120 }} />
                    </Form.Item>
                    <span>→</span>
                    <Form.Item name={[name, 'container_port']} noStyle>
                      <InputNumber placeholder="容器端口" min={1} max={65535} style={{ width: 120 }} />
                    </Form.Item>
                    <Button danger size="small" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ host_port: selectedRange?.start_port || 1000, container_port: 8080 })}
                  disabled={!portRangeId} icon={<PlusOutlined />} size="small">
                  添加端口映射
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        {/* 额外端口段映射 */}
        <Form.Item label="端口段映射">
          <Form.List name="port_range_mappings">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Space key={key} align="center" style={{ marginBottom: 8 }}>
                    <Form.Item name={[name, 'start_port']} noStyle>
                      <InputNumber placeholder="起始端口" min={selectedRange?.start_port || 1} max={selectedRange?.end_port || 65535}
                        disabled={!portRangeId} style={{ width: 120 }} />
                    </Form.Item>
                    <span>-</span>
                    <Form.Item name={[name, 'end_port']} noStyle>
                      <InputNumber placeholder="结束端口" min={selectedRange?.start_port || 1} max={selectedRange?.end_port || 65535}
                        disabled={!portRangeId} style={{ width: 120 }} />
                    </Form.Item>
                    <Button danger size="small" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({
                  start_port: selectedRange?.start_port || 1000,
                  end_port: Math.min((selectedRange?.start_port || 1000) + 10, selectedRange?.end_port || 65535)
                })} disabled={!portRangeId} icon={<PlusOutlined />} size="small">
                  添加端口段映射
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Form.Item name="cpu_cores" label="CPU核心数" rules={[{ required: true }]}>
          <InputNumber min={1} max={serverResources?.cpu_cores || 1} disabled={!serverId} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="memory_mb" label="内存(MB)" rules={[{ required: true }]}>
          <InputNumber min={512} max={serverResources?.total_memory_mb || 1024} step={512} disabled={!serverId} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="gpu_indices" label="GPU设备" rules={[{ required: true, message: '请选择GPU设备' }]}>
          <Select placeholder="请选择GPU设备" disabled={!serverId || serverResources?.gpu_count === 0}>
            <Select.Option value="all">全部GPU</Select.Option>
            {(serverResources?.gpu_devices || []).map((gpu: any, idx: number) => (
              <Select.Option key={idx} value={String(gpu.index)}>GPU {gpu.index}: {gpu.name}</Select.Option>
            ))}
            {serverResources?.gpu_devices?.length >= 2 && (
              <Select.Option value="0,1">GPU 0,1 (前两个GPU)</Select.Option>
            )}
          </Select>
        </Form.Item>

        <Form.Item name="root_password" label="容器密码" rules={[{ required: true, message: '请输入容器密码' }]}>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="root_password" noStyle>
              <Input.Password placeholder="容器root用户密码" style={{ flex: 1 }} />
            </Form.Item>
            <Button type="primary" onClick={() => form.setFieldsValue({ root_password: generatePassword() })}>
              生成随机密码
            </Button>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ==================== 编辑容器对话框 ====================

function EditContainerDialog({
  open, onCancel, onSubmit, loading,
  container, servers, storagePaths, dockerImages, portRanges, serverResources
}: any) {
  const [form] = Form.useForm()

  const portRangeId = Form.useWatch('port_range_id', form)
  const selectedRange = useMemo(
    () => portRanges.find((r: any) => r.id === portRangeId),
    [portRanges, portRangeId]
  )

  useEffect(() => {
    if (open && container) {
      form.setFieldsValue({
        id: container.id,
        server_id: container.server_id,
        storage_path_id: container.storage_path_id,
        shared_storage_path_id: storagePaths[0]?.id || '',
        image_id: container.image_id,
        cpu_cores: container.cpu_cores,
        memory_mb: container.memory_mb,
        gpu_indices: 'all',
        port_mappings: [],
        port_range_mappings: [],
        container_name: container.container_name,
        user_username: container.user_username,
        port: container.port,
        root_password: container.root_password || '',
        port_range_id: container.port_range_id
      })
    }
  }, [open, container, storagePaths])

  const handleOk = () => {
    Modal.confirm({
      title: '更新确认',
      content: `确定要更新容器 "${container?.container_name}" 的配置吗？此操作不可逆，仅保留data、projects和share目录中的数据，容器将被重新初始化。`,
      okText: '确定', cancelText: '取消', okType: 'danger',
      onOk: async () => {
        try {
          const values = await form.validateFields()
          await onSubmit({ ...values, id: container.id })
        } catch { /* validation */ }
      }
    })
  }

  return (
    <Modal title="编辑容器配置" open={open} onCancel={onCancel} onOk={handleOk}
      confirmLoading={loading} width={700} destroyOnClose maskClosable={false}
      okText="确认更新">
      <Alert type="warning" showIcon style={{ marginBottom: 20 }}
        message={<><b>警告：此操作不可逆！</b>容器将被重新初始化，仅保留 data、projects 和 share 目录中的数据。</>} />

      <Form form={form} layout="horizontal" labelCol={{ span: 6 }}>
        <Form.Item label="用户"><Input value={container?.user_username} disabled /></Form.Item>
        <Form.Item label="容器名称"><Input value={container?.container_name} disabled /></Form.Item>
        <Form.Item label="服务器">
          <Select value={container?.server_id} disabled>
            {servers.map((s: any) => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
          </Select>
        </Form.Item>

        <Form.Item name="storage_path_id" label="存储路径" rules={[{ required: true }]}>
          <Select>
            {storagePaths.map((p: any) => <Select.Option key={p.id} value={p.id}>{p.path} {p.description ? `(${p.description})` : ''}</Select.Option>)}
          </Select>
        </Form.Item>

        <Form.Item name="shared_storage_path_id" label="共享路径" rules={[{ required: true }]}>
          <Select>
            {storagePaths.map((p: any) => <Select.Option key={p.id} value={p.id}>{p.path} {p.description ? `(${p.description})` : ''}</Select.Option>)}
          </Select>
        </Form.Item>

        <Form.Item name="image_id" label="Docker镜像" rules={[{ required: true }]}>
          <Select>
            {dockerImages.map((img: any) => <Select.Option key={img.id} value={img.id}>{img.repository}:{img.tag}</Select.Option>)}
          </Select>
        </Form.Item>

        <Form.Item name="port" label="SSH端口">
          <InputNumber min={selectedRange?.start_port || 1} max={selectedRange?.end_port || 65535}
            disabled={!portRangeId} style={{ width: '100%' }} />
        </Form.Item>

        {/* 端口映射 */}
        <Form.Item label="额外端口映射">
          <Form.List name="port_mappings">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Space key={key} align="center" style={{ marginBottom: 8 }}>
                    <Form.Item name={[name, 'host_port']} noStyle>
                      <InputNumber placeholder="主机端口" style={{ width: 120 }} />
                    </Form.Item>
                    <span>→</span>
                    <Form.Item name={[name, 'container_port']} noStyle>
                      <InputNumber placeholder="容器端口" style={{ width: 120 }} />
                    </Form.Item>
                    <Button danger size="small" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ host_port: selectedRange?.start_port || 1000, container_port: 8080 })}
                  icon={<PlusOutlined />} size="small">添加端口映射</Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        {/* 端口段映射 */}
        <Form.Item label="端口段映射">
          <Form.List name="port_range_mappings">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Space key={key} align="center" style={{ marginBottom: 8 }}>
                    <Form.Item name={[name, 'start_port']} noStyle>
                      <InputNumber placeholder="起始" style={{ width: 120 }} />
                    </Form.Item>
                    <span>-</span>
                    <Form.Item name={[name, 'end_port']} noStyle>
                      <InputNumber placeholder="结束" style={{ width: 120 }} />
                    </Form.Item>
                    <Button danger size="small" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({
                  start_port: selectedRange?.start_port || 1000,
                  end_port: Math.min((selectedRange?.start_port || 1000) + 10, selectedRange?.end_port || 65535)
                })} icon={<PlusOutlined />} size="small">添加端口段映射</Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Form.Item name="cpu_cores" label="CPU核心数" rules={[{ required: true }]}>
          <InputNumber min={1} max={serverResources?.cpu_cores || 1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="memory_mb" label="内存(MB)" rules={[{ required: true }]}>
          <InputNumber min={512} max={serverResources?.total_memory_mb || 1024} step={512} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="gpu_indices" label="GPU设备" rules={[{ required: true }]}>
          <Select disabled={serverResources?.gpu_count === 0}>
            <Select.Option value="all">全部GPU</Select.Option>
            {(serverResources?.gpu_devices || []).map((gpu: any, idx: number) => (
              <Select.Option key={idx} value={String(gpu.index)}>GPU {gpu.index}: {gpu.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="root_password" label="容器密码" rules={[{ required: true }]}>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="root_password" noStyle>
              <Input placeholder="容器root用户密码" style={{ flex: 1 }} />
            </Form.Item>
            <Button type="primary" onClick={() => form.setFieldsValue({ root_password: generatePassword() })}>
              生成随机密码
            </Button>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  )
}
