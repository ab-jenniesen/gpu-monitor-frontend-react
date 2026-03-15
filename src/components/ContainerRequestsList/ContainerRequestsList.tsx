import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Table, Tag, Button, Modal, message, Spin } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import axios from '../../utils/axios'
import './ContainerRequestsList.css'

// ==================== 工具函数 ====================

function getStatusType(status: string): string {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'error'
  }
  return typeMap[status] || 'default'
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝'
  }
  return statusMap[status] || status
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

function canDelete(status: string): boolean {
  return status === 'pending' || status === 'rejected'
}

// ==================== 类型 ====================

interface ContainerRequest {
  id: number
  server_name: string
  cpu_cores: number
  memory_mb: number
  request_reason: string
  status: string
  created_at: string
  updated_at: string
  processed_by_username: string | null
  admin_comment: string | null
  _deleting?: boolean
}

export interface ContainerRequestsListRef {
  fetchRequests: () => Promise<void>
}

// ==================== 组件 ====================

const ContainerRequestsList = forwardRef<ContainerRequestsListRef>((_, ref) => {
  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState<ContainerRequest[]>([])

  // ---------- API ----------

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/container-requests?current_user_only=true')
      const all = response.data.requests || []
      // 过滤掉已批准的申请，只显示待审批和已拒绝的
      setRequests(all.filter((req: ContainerRequest) => req.status !== 'approved'))
    } catch (error) {
      console.error('获取申请记录失败:', error)
      message.error('获取申请记录失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteRequest = useCallback(async (row: ContainerRequest) => {
    Modal.confirm({
      title: '删除确认',
      content: '确认删除此申请记录？',
      okType: 'danger',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        try {
          await axios.delete(`/api/container-requests/${row.id}`)
          message.success('删除成功')
          fetchRequests()
        } catch (error) {
          console.error('删除失败:', error)
          message.error('删除失败')
        }
      }
    })
  }, [fetchRequests])

  const viewContainerInfo = useCallback(() => {
    message.info('请在"我的容器"页面查看已创建的容器')
  }, [])

  // ---------- 暴露方法给父组件（对应 Vue 的 defineExpose） ----------

  useImperativeHandle(ref, () => ({
    fetchRequests
  }), [fetchRequests])

  // ---------- 初始化 ----------

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // ---------- 表格列配置 ----------

  const columns: ColumnsType<ContainerRequest> = [
    {
      title: '服务器',
      dataIndex: 'server_name',
      width: 90
    },
    {
      title: '资源配置',
      width: 80,
      render: (_, row) => (
        <div className="resource-config">
          <div>CPU: {row.cpu_cores} 核</div>
          <div>内存: {Math.round(row.memory_mb / 1024)} GB</div>
        </div>
      )
    },
    {
      title: '申请理由',
      dataIndex: 'request_reason',
      ellipsis: true,
      width: 150
    },
    {
      title: '状态',
      width: 81,
      render: (_, row) => (
        <Tag color={getStatusType(row.status)}>
          {getStatusText(row.status)}
        </Tag>
      )
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      width: 130,
      render: (value) => formatDate(value)
    },
    {
      title: '处理时间',
      dataIndex: 'updated_at',
      width: 130,
      render: (_, row) => (row.status === 'pending' ? '-' : formatDate(row.updated_at))
    },
    {
      title: '处理人',
      width: 70,
      render: (_, row) => row.processed_by_username || '-'
    },
    {
      title: '管理员备注',
      ellipsis: true,
      width: 150,
      render: (_, row) => row.admin_comment || '-'
    },
    {
      title: '操作',
      width: 75,
      fixed: 'right',
      render: (_, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {canDelete(row.status) && (
            <Button
              type="primary"
              danger
              size="small"
              onClick={() => deleteRequest(row)}
            >
              删除
            </Button>
          )}
          {row.status === 'approved' && (
            <Button
              type="primary"
              size="small"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => viewContainerInfo()}
            >
              查看容器
            </Button>
          )}
        </div>
      )
    }
  ]

  // ---------- 渲染 ----------

  return (
    <div className="container-requests-list">
      <Spin spinning={loading}>
        <div className="requests-table-wrapper">
          <Table<ContainerRequest>
            dataSource={requests}
            columns={columns}
            rowKey="id"
            bordered
            pagination={false}
            scroll={{ x: 960 }}
            locale={{ emptyText: '暂无申请记录' }}
          />
        </div>
      </Spin>
    </div>
  )
})

ContainerRequestsList.displayName = 'ContainerRequestsList'

export default ContainerRequestsList