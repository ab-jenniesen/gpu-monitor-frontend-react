import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Card, Button, Table, Tag, Skeleton, Empty, Modal,
  Form, Input, Progress, message
} from 'antd'
import {
  SearchOutlined, PlusOutlined, SyncOutlined, DeleteOutlined
} from '@ant-design/icons'
import { useDispatch } from 'react-redux'
import {
  fetchServerDockerImages,
  detectServerDockerImages,
  addServerDockerImage,
  deleteServerDockerImage,
  pullDockerImage,
  getDockerTaskStatus
} from '../../store/serversSlice'
import type { AppDispatch } from '../../store'
import type { ColumnsType } from 'antd/es/table'
import './DockerImagesManager.css'

interface DockerImagesManagerProps {
  serverId: string
  onUpdate?: () => void
}

interface DockerImage {
  id: string
  image_id: string
  repository: string
  tag: string
  description: string
  size: number
  created: number
}

interface DetectedImage {
  id: string
  repository: string
  tag: string
  size: number
  created: number
}

interface TaskState {
  type: 'pull' | 'delete' | ''
  imageId: string
  progress: number
  status: 'running' | 'success' | 'error' | ''
  logs: string[]
  taskId: string
}

// ==================== 工具函数 ====================

const formatSize = (sizeInBytes: number) => {
  if (!sizeInBytes || sizeInBytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(sizeInBytes) / Math.log(1024))
  return `${(sizeInBytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

const formatDate = (timestamp: number) => {
  if (!timestamp) return '未知'
  return new Date(timestamp * 1000).toLocaleString()
}

// ==================== 组件 ====================

export default function DockerImagesManager({ serverId, onUpdate }: DockerImagesManagerProps) {
  const dispatch = useDispatch<AppDispatch>()

  // 列表状态
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([])

  // 检测镜像
  const [detecting, setDetecting] = useState(false)
  const [detectDialogVisible, setDetectDialogVisible] = useState(false)
  const [detectedImages, setDetectedImages] = useState<DetectedImage[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [selectedImages, setSelectedImages] = useState<DetectedImage[]>([])
  const [submitting, setSubmitting] = useState(false)

  // 拉取新镜像
  const [addImageDialogVisible, setAddImageDialogVisible] = useState(false)
  const [pullLoading, setPullLoading] = useState(false)
  const [addForm] = Form.useForm()

  // 任务进度
  const [taskProgressVisible, setTaskProgressVisible] = useState(false)
  const [currentTask, setCurrentTask] = useState<TaskState>({
    type: '', imageId: '', progress: 0, status: '', logs: [], taskId: ''
  })
  const logsRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ==================== 获取镜像列表 ====================

  const refreshDockerImages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await dispatch(fetchServerDockerImages(serverId)).unwrap()
      setDockerImages(result)
    } catch (err: any) {
      console.error('获取Docker镜像列表失败:', err)
      setError('获取Docker镜像列表失败，请检查服务器连接')
    } finally {
      setLoading(false)
    }
  }, [serverId, dispatch])

  useEffect(() => {
    refreshDockerImages()
  }, [refreshDockerImages])

  // 日志自动滚动到底部
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [currentTask.logs])

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current)
    }
  }, [])

  // ==================== 检测镜像 ====================

  const detectDockerImages = async () => {
    setDetecting(true)
    try {
      const result = await dispatch(detectServerDockerImages(serverId)).unwrap()

      // 过滤已存在的镜像
      const existingIds = dockerImages.map((img) => img.image_id)
      const filtered = result.filter((img: DetectedImage) => !existingIds.includes(img.id))

      if (filtered.length === 0) {
        message.info('未检测到新的Docker镜像')
      } else {
        setDetectedImages(filtered)
        setSelectedRowKeys([])
        setSelectedImages([])
        setDetectDialogVisible(true)
      }
    } catch (err: any) {
      console.error('检测Docker镜像失败:', err)
      message.error('检测Docker镜像失败，请检查服务器连接')
    } finally {
      setDetecting(false)
    }
  }

  // 添加选中的镜像
  const addSelectedImages = async () => {
    if (selectedImages.length === 0) return
    setSubmitting(true)
    try {
      for (const image of selectedImages) {
        await dispatch(addServerDockerImage({
          serverId,
          imageData: {
            image_id: image.id,
            repository: image.repository,
            tag: image.tag,
            size: image.size,
            created: image.created,
            description: `${image.repository}:${image.tag}`
          }
        })).unwrap()
      }
      message.success(`成功添加 ${selectedImages.length} 个Docker镜像`)
      setDetectDialogVisible(false)
      await refreshDockerImages()
      onUpdate?.()
    } catch {
      message.error('添加Docker镜像失败')
    } finally {
      setSubmitting(false)
    }
  }

  // ==================== 拉取镜像 ====================

  const showAddImageDialog = () => {
    addForm.resetFields()
    setAddImageDialogVisible(true)
  }

  const pullNewImage = async () => {
    try {
      const values = await addForm.validateFields()
      setPullLoading(true)

      const response = await dispatch(pullDockerImage({
        serverId,
        imageData: { image: values.imageUrl }
      })).unwrap()

      if (response.success) {
        setAddImageDialogVisible(false)
        startTaskTracking('pull', values.imageUrl, response.task_id)
      } else {
        message.error(response.message || '启动拉取任务失败')
      }
    } catch (err: any) {
      if (err.response) {
        message.error('拉取镜像失败，请检查服务器连接')
      }
    } finally {
      setPullLoading(false)
    }
  }

  // 更新已有镜像
  const pullImage = async (image: DockerImage) => {
    if (!image.repository) {
      message.warning('无法拉取没有仓库名称的镜像')
      return
    }

    const imageUrl = image.tag ? `${image.repository}:${image.tag}` : image.repository

    try {
      const response = await dispatch(pullDockerImage({
        serverId,
        imageData: { image: imageUrl }
      })).unwrap()

      if (response.success) {
        startTaskTracking('pull', imageUrl, response.task_id)
      } else {
        message.error(response.message || '启动拉取任务失败')
      }
    } catch {
      message.error('拉取镜像失败，请检查服务器连接')
    }
  }

  // ==================== 删除镜像 ====================

  const confirmDeleteImage = (image: DockerImage) => {
    const imageName = image.repository
      ? `${image.repository}${image.tag ? `:${image.tag}` : ''}`
      : image.image_id.substring(0, 12)

    Modal.confirm({
      title: '删除确认',
      content: `确定要删除镜像 ${imageName} 吗？`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      async onOk() {
        try {
          const response = await dispatch(deleteServerDockerImage({
            serverId,
            imageId: image.id
          })).unwrap()

          if (response.success) {
            startTaskTracking('delete', image.id, response.task_id)
          } else {
            message.error(response.message || '删除镜像失败')
          }
        } catch {
          message.error('删除镜像失败，请检查服务器连接')
        }
      }
    })
  }

  // ==================== 任务跟踪 ====================

  const startTaskTracking = (type: 'pull' | 'delete', imageId: string, taskId: string) => {
    setCurrentTask({
      type, imageId, progress: 0, status: 'running', logs: [], taskId
    })
    setTaskProgressVisible(true)
    pollTaskStatus(taskId)
  }

  const pollTaskStatus = async (taskId: string) => {
    try {
      const response = await dispatch(getDockerTaskStatus({ serverId, taskId })).unwrap()

      if (response.success) {
        setCurrentTask((prev) => {
          const newStatus = response.task.status || 'running'
          const newTask = {
            ...prev,
            progress: response.task.progress || 0,
            logs: response.task.logs || [],
            status: newStatus
          }

          if (newStatus === 'running') {
            pollingRef.current = setTimeout(() => pollTaskStatus(taskId), 1000)
          } else if (newStatus === 'success') {
            message.success(`${prev.type === 'pull' ? '拉取' : '删除'}镜像成功`)
          } else if (newStatus === 'error') {
            message.error(`${prev.type === 'pull' ? '拉取' : '删除'}镜像失败`)
          }

          return newTask
        })
      } else {
        pollingRef.current = setTimeout(() => pollTaskStatus(taskId), 2000)
      }
    } catch {
      pollingRef.current = setTimeout(() => pollTaskStatus(taskId), 3000)
    }
  }

  const refreshAfterTask = () => {
    if (pollingRef.current) clearTimeout(pollingRef.current)
    setTaskProgressVisible(false)
    refreshDockerImages()
  }

  // ==================== 表格列配置 ====================

  const imageColumns: ColumnsType<DockerImage> = [
    {
      title: '镜像',
      key: 'image',
      width: 250,
      render: (_, record) => (
        <div>
          <div className="image-name">
            <span className="repository">{record.repository || '无仓库名'}</span>
            {record.tag && <Tag>{record.tag}</Tag>}
          </div>
          <div className="image-id">
            ID: {record.image_id ? record.image_id.substring(0, 12) : '未知'}
          </div>
        </div>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200
    },
    {
      title: '大小',
      key: 'size',
      width: 120,
      render: (_, record) => formatSize(record.size)
    },
    {
      title: '创建时间',
      key: 'created',
      width: 180,
      render: (_, record) => formatDate(record.created)
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <div className="action-buttons">
          <Button
            type="primary"
            shape="circle"
            size="small"
            icon={<SyncOutlined />}
            title="更新镜像"
            onClick={() => pullImage(record)}
          />
          <Button
            danger
            shape="circle"
            size="small"
            icon={<DeleteOutlined />}
            title="删除镜像"
            onClick={() => confirmDeleteImage(record)}
          />
        </div>
      )
    }
  ]

  const detectedColumns: ColumnsType<DetectedImage> = [
    {
      title: '镜像',
      key: 'image',
      width: 250,
      render: (_, record) => (
        <div>
          <div className="image-name">
            <span className="repository">{record.repository || '无仓库名'}</span>
            {record.tag && <Tag>{record.tag}</Tag>}
          </div>
          <div className="image-id">
            ID: {record.id ? record.id.substring(0, 12) : '未知'}
          </div>
        </div>
      )
    },
    {
      title: '大小',
      key: 'size',
      width: 120,
      render: (_, record) => formatSize(record.size)
    },
    {
      title: '创建时间',
      key: 'created',
      width: 180,
      render: (_, record) => formatDate(record.created)
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

    if (error) {
      return (
        <div className="error-container">
          <Empty description={error}>
            <Button type="primary" onClick={refreshDockerImages}>重试</Button>
          </Empty>
        </div>
      )
    }

    if (dockerImages.length === 0) {
      return (
        <div className="empty-container">
          <Empty description="暂无Docker镜像">
            <Button type="primary" onClick={detectDockerImages}>检测Docker镜像</Button>
          </Empty>
        </div>
      )
    }

    return (
      <div className="images-list">
        <Table
          columns={imageColumns}
          dataSource={dockerImages}
          rowKey="id"
          bordered
          pagination={false}
        />
      </div>
    )
  }

  // ==================== 渲染 ====================

  return (
    <div className="docker-images-manager">
      <Card
        hoverable
        title={
          <div className="card-header-content">
            <div>
              <h3>Docker镜像管理</h3>
              <span className="subtitle">管理服务器上的Docker镜像，用于容器创建</span>
            </div>
          </div>
        }
        extra={
          <div className="header-actions">
            <Button
              type="primary"
              size="small"
              icon={<SearchOutlined />}
              onClick={detectDockerImages}
              loading={detecting}
            >
              检测Docker镜像
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={showAddImageDialog}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              拉取新镜像
            </Button>
          </div>
        }
      >
        {renderContent()}
      </Card>

      {/* ==================== 拉取新镜像对话框 ==================== */}
      <Modal
        open={addImageDialogVisible}
        title="拉取新Docker镜像"
        width={500}
        onCancel={() => setAddImageDialogVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setAddImageDialogVisible(false)}>
            取消
          </Button>,
          <Button key="pull" type="primary" loading={pullLoading} onClick={pullNewImage}>
            拉取
          </Button>
        ]}
      >
        <Form form={addForm} layout="horizontal" labelCol={{ span: 6 }}>
          <Form.Item
            label="镜像地址"
            name="imageUrl"
            rules={[
              { required: true, message: '请输入镜像地址' },
              {
                pattern: /^[a-z0-9]+([-._/][a-z0-9]+)*(:[\w][\w.-]{0,127})?$/,
                message: '镜像地址格式不正确'
              }
            ]}
          >
            <Input placeholder="例如: nginx:latest 或 ubuntu:20.04" />
          </Form.Item>
          <div className="form-tip">输入镜像名称和标签，格式为 name:tag</div>
        </Form>
      </Modal>

      {/* ==================== 检测到的镜像选择对话框 ==================== */}
      <Modal
        open={detectDialogVisible}
        title="检测到的Docker镜像"
        width={800}
        onCancel={() => setDetectDialogVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setDetectDialogVisible(false)}>
            取消
          </Button>,
          <Button
            key="add"
            type="primary"
            loading={submitting}
            disabled={selectedImages.length === 0}
            onClick={addSelectedImages}
          >
            添加选中镜像
          </Button>
        ]}
      >
        {detecting ? (
          <div className="loading-container">
            <Skeleton active paragraph={{ rows: 5 }} />
          </div>
        ) : detectedImages.length === 0 ? (
          <div className="empty-container">
            <Empty description="未检测到Docker镜像" />
          </div>
        ) : (
          <>
            <p>选择要添加的Docker镜像：</p>
            <Table
              columns={detectedColumns}
              dataSource={detectedImages}
              rowKey="id"
              bordered
              pagination={false}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys, rows) => {
                  setSelectedRowKeys(keys)
                  setSelectedImages(rows)
                }
              }}
            />
          </>
        )}
      </Modal>

      {/* ==================== 任务进度对话框 ==================== */}
      <Modal
        open={taskProgressVisible}
        title={`${currentTask.type === 'pull' ? '拉取' : '删除'}镜像进度`}
        width={600}
        maskClosable={false}
        keyboard={currentTask.status !== 'running'}
        closable={currentTask.status !== 'running'}
        onCancel={refreshAfterTask}
        footer={[
          <Button
            key="close"
            onClick={refreshAfterTask}
            disabled={currentTask.status === 'running'}
          >
            {currentTask.status === 'running' ? '任务进行中...' : '关闭'}
          </Button>
        ]}
      >
        <div className="task-progress">
          <Progress
            percent={currentTask.progress}
            status={
              currentTask.status === 'success'
                ? 'success'
                : currentTask.status === 'error'
                  ? 'exception'
                  : 'active'
            }
          />

          <div className="task-logs" ref={logsRef}>
            {currentTask.logs.map((log, index) => (
              <div key={index} className="log-line">{log}</div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
