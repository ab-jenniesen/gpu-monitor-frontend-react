import { useState, useEffect, useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'
import {
  Card, Table, Button, Tag, Empty, Skeleton, Modal,
  Form, Input, Switch, Space, message, Typography
} from 'antd'
import {
  SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  FolderOpenOutlined, CopyOutlined, ExclamationCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'
import {
  fetchServerStoragePaths,
  detectServerStoragePaths,
  addServerStoragePath,
  updateServerStoragePath,
  deleteServerStoragePath,
  fetchServerDiskPartitions,
  mountPartition as mountPartitionAction,
  unmountPartition as unmountPartitionAction,
  createPartition as createPartitionAction
} from '../../store/serversSlice'
import type { AppDispatch } from '../../store'
import './StoragePathsManager.css'

const { confirm } = Modal

interface StoragePathsManagerProps {
  serverId: string
  onUpdate?: () => void
}

export default function StoragePathsManager({ serverId, onUpdate }: StoragePathsManagerProps) {
  const dispatch = useDispatch<AppDispatch>()

  // ==================== State ====================

  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [partitionsLoading, setPartitionsLoading] = useState(false)
  const [mountingPartition, setMountingPartition] = useState(false)

  const [storagePaths, setStoragePaths] = useState<any[]>([])
  const [detectedPaths, setDetectedPaths] = useState<any[]>([])
  const [partitions, setPartitions] = useState<any[]>([])
  const [selectedPaths, setSelectedPaths] = useState<any[]>([])

  const [pathDialogVisible, setPathDialogVisible] = useState(false)
  const [detectDialogVisible, setDetectDialogVisible] = useState(false)
  const [partitionsDialogVisible, setPartitionsDialogVisible] = useState(false)
  const [mountDialogVisible, setMountDialogVisible] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [currentPathId, setCurrentPathId] = useState<string | null>(null)
  const [selectedPartition, setSelectedPartition] = useState<any>(null)

  const [mountingPartitions, setMountingPartitions] = useState<Record<string, boolean>>({})
  const [unmountingPartitions, setUnmountingPartitions] = useState<Record<string, boolean>>({})
  const [creatingPartitions, setCreatingPartitions] = useState<Record<string, boolean>>({})

  const [pathForm] = Form.useForm()
  const [mountForm] = Form.useForm()

  // ==================== 获取存储路径 ====================

  const fetchPaths = useCallback(async () => {
    setLoading(true)
    try {
      const result = await dispatch(fetchServerStoragePaths(serverId)).unwrap()
      setStoragePaths(result)
    } catch {
      message.error('获取存储路径失败')
    } finally {
      setLoading(false)
    }
  }, [serverId, dispatch])

  useEffect(() => {
    fetchPaths()
  }, [fetchPaths])

  // ==================== 检测存储路径 ====================

  const detectPaths = async () => {
    setDetecting(true)
    try {
      let result = await dispatch(detectServerStoragePaths(serverId)).unwrap()
      const existingPaths = storagePaths.map((p: any) => p.path)
      result = result.filter((p: any) => !existingPaths.includes(p.path))
      setDetectedPaths(result)
      setDetectDialogVisible(true)
    } catch {
      message.error('检测存储路径失败')
    } finally {
      setDetecting(false)
    }
  }

  // ==================== 添加 / 编辑路径对话框 ====================

  const showAddPathDialog = () => {
    setIsEditing(false)
    setCurrentPathId(null)
    pathForm.resetFields()
    pathForm.setFieldsValue({ path: '', description: '', is_system: false })
    setPathDialogVisible(true)
  }

  const showEditPathDialog = (record: any) => {
    setIsEditing(true)
    setCurrentPathId(record.id)
    pathForm.setFieldsValue({
      path: record.path,
      description: record.description,
      is_system: record.is_system
    })
    setPathDialogVisible(true)
  }

  const submitPathForm = async () => {
    try {
      const values = await pathForm.validateFields()
      setSubmitting(true)

      if (isEditing && currentPathId) {
        await dispatch(updateServerStoragePath({
          serverId,
          pathId: currentPathId,
          pathData: values
        })).unwrap()
        message.success('存储路径更新成功')
      } else {
        await dispatch(addServerStoragePath({
          serverId,
          pathData: values
        })).unwrap()
        message.success('存储路径添加成功')
      }

      setPathDialogVisible(false)
      await fetchPaths()
      onUpdate?.()
    } catch (error: any) {
      if (error?.errorFields) return // 表单验证失败
      message.error(isEditing ? '更新存储路径失败' : '添加存储路径失败')
    } finally {
      setSubmitting(false)
    }
  }

  // ==================== 删除路径 ====================

  const confirmDeletePath = (record: any) => {
    confirm({
      title: '删除确认',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除存储路径 "${record.path}" 吗？`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      async onOk() {
        try {
          await dispatch(deleteServerStoragePath({
            serverId,
            pathId: record.id
          })).unwrap()
          message.success('存储路径删除成功')
          await fetchPaths()
          onUpdate?.()
        } catch {
          message.error('删除存储路径失败')
        }
      }
    })
  }

  // ==================== 添加选中路径（检测对话框） ====================

  const addSelectedPaths = async () => {
    if (selectedPaths.length === 0) return
    setSubmitting(true)
    try {
      for (const path of selectedPaths) {
        await dispatch(addServerStoragePath({
          serverId,
          pathData: {
            path: path.path,
            description: path.description,
            is_system: path.is_system
          }
        })).unwrap()
      }
      message.success(`成功添加 ${selectedPaths.length} 个存储路径`)
      setDetectDialogVisible(false)
      await fetchPaths()
      onUpdate?.()
    } catch {
      message.error('添加存储路径失败')
    } finally {
      setSubmitting(false)
    }
  }

  // ==================== 磁盘分区 ====================

  const openPartitionsDialog = async () => {
    setPartitionsDialogVisible(true)
    setPartitionsLoading(true)
    try {
      const result = await dispatch(fetchServerDiskPartitions(serverId)).unwrap()
      setPartitions(result)
    } catch {
      setPartitionsDialogVisible(false)
      message.error('获取分区信息失败')
    } finally {
      setPartitionsLoading(false)
    }
  }

  const resetPartitions = () => {
    setPartitions([])
    setPartitionsLoading(false)
  }

  // 复制 UUID
  const copyUUID = async (uuid: string) => {
    try {
      await navigator.clipboard.writeText(uuid)
      message.success('UUID已复制到剪贴板')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }

  // ==================== 挂载分区 ====================

  const canUnmount = (partition: any) => {
    if (!partition.mountpoint) return false
    if (partition.mountpoint === '[SWAP]' || partition.mountpoint.includes('[SWAP]')) return false

    const systemPaths = ['/', '/boot', '/etc', '/usr', '/var', '/sys', '/proc', '/dev', '/root', '/tmp', '/opt', '/bin', '/sbin', '/lib', '/lib64']
    for (const sp of systemPaths) {
      if (partition.mountpoint === sp || partition.mountpoint.startsWith(sp + '/')) {
        if (partition.mountpoint.startsWith('/home/') && partition.mountpoint.includes('/Workspace/')) {
          return true
        }
        return false
      }
    }
    return true
  }

  const canCreatePartition = (disk: any) => {
    if (!disk.device) return false
    const systemDevices = ['/dev/sda', '/dev/nvme0n1', '/dev/vda', '/dev/xvda']
    return !systemDevices.includes(disk.device)
  }

  const showMountDialog = (partition: any) => {
    setSelectedPartition(partition)

    let defaultName = 'mydrive'
    if (partition.brand && partition.brand !== '未知') {
      defaultName = partition.brand.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()
    } else if (partition.model && partition.model !== '未知') {
      defaultName = partition.model.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()
    } else if (partition.name) {
      defaultName = partition.name.replace(/[^a-zA-Z0-9_-]/g, '')
    }
    if (!defaultName) defaultName = 'mydrive'

    mountForm.setFieldsValue({ basePath: '~/Workspace/disk', diskName: defaultName })
    setMountDialogVisible(true)
  }

  const getFullMountPath = () => {
    const basePath = (mountForm.getFieldValue('basePath') || '~/Workspace/disk').replace(/\/+$/, '')
    const diskName = (mountForm.getFieldValue('diskName') || '目录名称').replace(/^\/+/, '')
    return `${basePath}/${diskName}`
  }

  const handleMountPartition = async () => {
    try {
      await mountForm.validateFields()
      setMountingPartition(true)
      setMountingPartitions(prev => ({ ...prev, [selectedPartition.uuid]: true }))

      const basePath = mountForm.getFieldValue('basePath').replace(/\/+$/, '')
      const diskName = mountForm.getFieldValue('diskName').replace(/^\/+/, '')
      const mountPoint = `${basePath}/${diskName}`

      await dispatch(mountPartitionAction({
        serverId,
        mountData: {
          uuid: selectedPartition.uuid,
          device: selectedPartition.device,
          fstype: selectedPartition.fstype,
          mountPoint
        }
      })).unwrap()

      message.success('分区挂载成功')
      setMountDialogVisible(false)
      await openPartitionsDialog()
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error?.response?.data?.msg || error || '挂载失败')
    } finally {
      setMountingPartition(false)
      if (selectedPartition?.uuid) {
        setMountingPartitions(prev => {
          const next = { ...prev }
          delete next[selectedPartition.uuid]
          return next
        })
      }
    }
  }

  // ==================== 卸载分区 ====================

  const confirmUnmount = (partition: any) => {
    confirm({
      title: '卸载确认',
      icon: <ExclamationCircleOutlined />,
      okText: '确定卸载',
      cancelText: '取消',
      okType: 'danger',
      content: (
        <div>
          <p>设备: {partition.device}</p>
          <p>挂载点: {partition.mountpoint}</p>
          <p style={{ color: '#e6a23c', marginTop: 10 }}>
            ⚠️ 卸载后该分区将无法访问，直到重新挂载
          </p>
        </div>
      ),
      async onOk() {
        setUnmountingPartitions(prev => ({ ...prev, [partition.uuid]: true }))
        try {
          await dispatch(unmountPartitionAction({
            serverId,
            unmountData: {
              uuid: partition.uuid,
              mountPoint: partition.mountpoint
            }
          })).unwrap()
          message.success('分区卸载成功')
          await openPartitionsDialog()
        } catch (error: any) {
          message.error(error?.response?.data?.msg || error || '卸载失败')
        } finally {
          setUnmountingPartitions(prev => {
            const next = { ...prev }
            delete next[partition.uuid]
            return next
          })
        }
      }
    })
  }

  // ==================== 创建分区 ====================

  const confirmCreatePartition = (disk: any) => {
    confirm({
      title: '创建分区确认',
      icon: <ExclamationCircleOutlined />,
      okText: '确定创建',
      cancelText: '取消',
      okType: 'danger',
      content: (
        <div>
          <p>设备: {disk.device}</p>
          <p>容量: {disk.size}</p>
          <p>品牌: {disk.brand || disk.model || disk.vendor || '未知'}</p>
          <p style={{ color: '#e6a23c', marginTop: 10 }}>
            ⚠️ 此操作将清除磁盘上的所有数据，并创建新的GPT分区表
          </p>
          <p style={{ color: '#f56c6c', marginTop: 5 }}>
            🔥 操作不可逆，请确保已备份重要数据
          </p>
        </div>
      ),
      async onOk() {
        setCreatingPartitions(prev => ({ ...prev, [disk.device]: true }))
        try {
          const result = await dispatch(createPartitionAction({
            serverId,
            partitionData: { device: disk.device }
          })).unwrap()
          message.success(`分区创建成功！新分区UUID: ${result.uuid}`)
          await openPartitionsDialog()
        } catch (error: any) {
          message.error(error?.response?.data?.msg || error || '创建分区失败')
        } finally {
          setCreatingPartitions(prev => {
            const next = { ...prev }
            delete next[disk.device]
            return next
          })
        }
      }
    })
  }

  // ==================== 表格列定义 ====================

  const pathColumns = [
    { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '类型', key: 'type', width: 200,
      render: (_: any, record: any) => (
        <Tag color={record.is_system ? 'warning' : 'success'}>
          {record.is_system ? '系统路径' : '自定义路径'}
        </Tag>
      )
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="primary" size="small" shape="circle"
            icon={<EditOutlined />} onClick={() => showEditPathDialog(record)} />
          <Button danger size="small" shape="circle"
            icon={<DeleteOutlined />} onClick={() => confirmDeletePath(record)} />
        </Space>
      )
    }
  ]

  const detectedColumns = [
    { title: '路径', dataIndex: 'path', key: 'path' },
    { title: '设备', dataIndex: 'device', key: 'device' },
    { title: '大小', dataIndex: 'size', key: 'size', width: 80 },
    { title: '使用率', dataIndex: 'use_percent', key: 'use_percent', width: 80 },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="primary" size="small" shape="circle"
            icon={<EditOutlined />} onClick={() => showEditPathDialog(record)} />
          <Button danger size="small" shape="circle"
            icon={<DeleteOutlined />} onClick={() => confirmDeletePath(record)} />
        </Space>
      )
    }
  ]

  const partitionColumns = [
    { title: '设备', dataIndex: 'device', key: 'device', ellipsis: true },
    {
      title: '类型', key: 'type', width: 60,
      render: (_: any, r: any) => <Tag>{r.type}</Tag>
    },
    {
      title: '品牌', key: 'brand',
      render: (_: any, r: any) => r.brand || r.model || r.vendor || '未知'
    },
    { title: '容量', dataIndex: 'size', key: 'size', width: 65 },
    {
      title: '文件系统', key: 'fstype', width: 70,
      render: (_: any, r: any) => r.fstype || '未知'
    },
    {
      title: '挂载点', key: 'mountpoint',
      render: (_: any, r: any) =>
        r.mountpoint
          ? <span>{r.mountpoint}</span>
          : <span className="unmounted-text">未挂载</span>
    },
    {
      title: 'UUID', key: 'uuid',
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {r.uuid
            ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.uuid}</span>
            : <span className="unmounted-text">无UUID</span>
          }
          {r.uuid && (
            <Button type="primary" size="small" shape="circle"
              icon={<CopyOutlined />} onClick={() => copyUUID(r.uuid)} title="复制UUID" />
          )}
        </div>
      )
    },
    {
      title: '序列号', key: 'serial',
      render: (_: any, r: any) => r.serial || '未知'
    },
    {
      title: '状态', key: 'status', width: 120,
      render: (_: any, r: any) => (
        <Tag color={r.mounted ? 'success' : 'warning'}>
          {r.mounted ? '已挂载' : '未挂载'}
        </Tag>
      )
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, r: any) => {
        // 未分区的磁盘
        if (r.type === 'disk' && !r.fstype && canCreatePartition(r)) {
          return (
            <Button type="primary" size="small"
              loading={creatingPartitions[r.device]}
              onClick={() => confirmCreatePartition(r)}>
              创建分区
            </Button>
          )
        }
        // 未挂载分区
        if (!r.mounted && r.uuid && r.fstype && r.fstype !== '未知') {
          return (
            <Button type="primary" size="small" style={{ background: '#52c41a', borderColor: '#52c41a' }}
              loading={mountingPartitions[r.uuid]}
              onClick={() => showMountDialog(r)}>
              自动挂载
            </Button>
          )
        }
        // 已挂载可卸载
        if (r.mounted && r.uuid && canUnmount(r)) {
          return (
            <Button size="small" style={{ color: '#e6a23c', borderColor: '#e6a23c' }}
              loading={unmountingPartitions[r.uuid]}
              onClick={() => confirmUnmount(r)}>
              卸载
            </Button>
          )
        }
        // 已挂载系统分区
        if (r.mounted) {
          return <span className="mounted-text">已挂载</span>
        }
        return <span className="cannot-mount-text">无法挂载</span>
      }
    }
  ]

  // ==================== 渲染 ====================

  const renderContent = () => {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 3 }} />
    }
    if (storagePaths.length === 0) {
      return (
        <Empty description="暂无存储路径">
          <Button type="primary" onClick={detectPaths}>检测存储路径</Button>
        </Empty>
      )
    }
    return (
      <Table
        columns={pathColumns}
        dataSource={storagePaths}
        rowKey="id"
        bordered
        pagination={false}
      />
    )
  }

  return (
    <div className="storage-paths-manager">
      <Card
        title={
          <div>
            <h3 style={{ margin: 0 }}>存储路径管理</h3>
            <span className="subtitle">管理服务器的存储路径，用于Docker容器挂载</span>
          </div>
        }
        extra={
          <Space>
            <Button icon={<FolderOpenOutlined />} onClick={openPartitionsDialog}
              loading={partitionsLoading} size="small">
              查看磁盘分区
            </Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={detectPaths}
              loading={detecting} size="small">
              检测存储路径
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={showAddPathDialog}
              size="small" style={{ background: '#52c41a', borderColor: '#52c41a' }}>
              添加路径
            </Button>
          </Space>
        }
      >
        {renderContent()}
      </Card>

      {/* ==================== 添加/编辑路径对话框 ==================== */}
      <Modal
        open={pathDialogVisible}
        title={isEditing ? '编辑存储路径' : '添加存储路径'}
        width={500}
        onCancel={() => setPathDialogVisible(false)}
        onOk={submitPathForm}
        confirmLoading={submitting}
        okText={isEditing ? '更新' : '添加'}
        cancelText="取消"
      >
        <Form form={pathForm} labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="路径" name="path"
            rules={[
              { required: true, message: '请输入存储路径' },
              { min: 1, message: '路径不能为空' }
            ]}>
            <Input placeholder="请输入存储路径，例如: /data" />
          </Form.Item>
          <Form.Item label="描述" name="description"
            rules={[{ max: 100, message: '描述不能超过100个字符' }]}>
            <Input placeholder="请输入路径描述" />
          </Form.Item>
          <Form.Item label="系统路径" name="is_system" valuePropName="checked">
            <div>
              <Switch checked={pathForm.getFieldValue('is_system')}
                onChange={(checked) => pathForm.setFieldValue('is_system', checked)} />
              <div className="form-tip">系统路径通常由系统自动检测，不能被删除</div>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== 检测路径选择对话框 ==================== */}
      <Modal
        open={detectDialogVisible}
        title="检测到的存储路径"
        width={700}
        onCancel={() => setDetectDialogVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setDetectDialogVisible(false)}>取消</Button>,
          <Button key="add" type="primary" onClick={addSelectedPaths}
            loading={submitting} disabled={selectedPaths.length === 0}>
            添加选中路径
          </Button>
        ]}
      >
        {detecting ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : detectedPaths.length === 0 ? (
          <Empty description="未检测到存储路径" />
        ) : (
          <>
            <p>选择要添加的存储路径：</p>
            <Table
              columns={detectedColumns}
              dataSource={detectedPaths}
              rowKey="path"
              bordered
              pagination={false}
              rowSelection={{
                type: 'checkbox',
                onChange: (_: any, selectedRows: any[]) => setSelectedPaths(selectedRows)
              }}
            />
          </>
        )}
      </Modal>

      {/* ==================== 磁盘分区对话框 ==================== */}
      <Modal
        open={partitionsDialogVisible}
        title="磁盘分区信息"
        width="75%"
        onCancel={() => setPartitionsDialogVisible(false)}
        afterClose={resetPartitions}
        footer={[
          <Button key="close" onClick={() => setPartitionsDialogVisible(false)}>关闭</Button>
        ]}
      >
        {partitionsLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : partitions.length === 0 ? (
          <Empty description="未获取到分区信息" />
        ) : (
          <Table
            columns={partitionColumns}
            dataSource={partitions}
            rowKey="device"
            bordered
            size="small"
            pagination={false}
            scroll={{ x: 1200 }}
          />
        )}
      </Modal>

      {/* ==================== 自动挂载对话框 ==================== */}
      <Modal
        open={mountDialogVisible}
        title="自动挂载分区"
        width={500}
        onCancel={() => setMountDialogVisible(false)}
        onOk={handleMountPartition}
        confirmLoading={mountingPartition}
        okText="确认挂载"
        cancelText="取消"
      >
        {selectedPartition && (
          <>
            <div className="mount-info">
              <h4>分区信息</h4>
              <p><strong>设备:</strong> {selectedPartition.device}</p>
              <p><strong>文件系统:</strong> {selectedPartition.fstype}</p>
              <p><strong>容量:</strong> {selectedPartition.size}</p>
              <p><strong>UUID:</strong> <code>{selectedPartition.uuid}</code></p>
            </div>

            <Form form={mountForm} labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
              <Form.Item label="基础路径" name="basePath"
                rules={[
                  { required: true, message: '请输入基础路径' },
                  {
                    pattern: /^(\/[a-zA-Z0-9_\-/]*|~\/[a-zA-Z0-9_\-/]*)$/,
                    message: '请输入有效的路径格式，如 /mnt 或 ~/Workspace/disk'
                  }
                ]}>
                <Input placeholder="例如: ~/Workspace/disk 或 /mnt" allowClear />
              </Form.Item>
              <Form.Item
                label="目录名称"
                name="diskName"
                rules={[
                  { required: true, message: '请输入目录名称' },
                  { pattern: /^[a-zA-Z0-9_-]+$/, message: '目录名称只能包含字母、数字、下划线和横线' },
                  { min: 1, max: 50, message: '目录名称长度在1-50个字符之间' }
                ]}
              >
                <Input placeholder="请输入磁盘目录名称，例如: mydrive" allowClear />
              </Form.Item>

              {/* 路径预览 — 使用 Form.Item noStyle + dependencies 实现实时更新 */}
              <Form.Item noStyle dependencies={['basePath', 'diskName']}>
                {() => (
                  <div className="form-tip" style={{ marginBottom: 16, marginLeft: '25%' }}>
                    完整路径: {getFullMountPath()}
                  </div>
                )}
              </Form.Item>
            </Form>

            <div className="warning-text">
              <WarningOutlined />
              <span>此操作将修改 /etc/fstab 文件，实现开机自动挂载</span>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
