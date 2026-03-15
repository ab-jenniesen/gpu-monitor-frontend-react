import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  Tabs, Table, Tag, Button, Card, Form, Input, InputNumber, Select, Switch,
  Radio, Space, Modal, Badge, Dropdown, Alert, Steps, Divider, Pagination, message
} from 'antd'
import {
  UserOutlined, LockOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  SearchOutlined, ReloadOutlined, EyeOutlined, EyeInvisibleOutlined,
  KeyOutlined, DownloadOutlined, LinkOutlined, SettingOutlined,
  ArrowLeftOutlined, DesktopOutlined, FileTextOutlined, LineChartOutlined,
  SyncOutlined, DownOutlined, ClockCircleOutlined, InfoCircleOutlined,
  ApiOutlined, PoweroffOutlined, AppstoreOutlined, UnorderedListOutlined
} from '@ant-design/icons'
import { selectCurrentUser, selectIsAuthenticated } from '../../store/authSlice'
import { fetchServers, fetchRoutes } from '../../store/serversSlice'
import { fetchUsers } from '../../store/usersSlice'
import type { AppDispatch } from '../../store'
import axios from '../../utils/axios'
import { useAdminTabs } from '../../hooks/useAdminTabs'
import { useUserManagement, groupName, getGroupTagColor, groupDisplay } from '../../hooks/useUserManagement'
import { useServerManagement, getStatusType, getStatusText, formatRouteLabel, formatLastOnline } from '../../hooks/useServerManagement'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

import ServerDetail from '../../components/ServerDetail/ServerDetail'
import AnnouncementManager from '../../components/AnnouncementManager/AnnouncementManager'
import SystemSettings from '../../components/SystemSettings/SystemSettings'
import TerminalDialog from '../../components/TerminalDialog/TerminalDialog'
import ContainerManager from '../../components/ContainerManager/ContainerManager'
import LogManager from '../../components/LogManager/LogManager'
import PendingRequests from '../../components/PendingRequests/PendingRequests'
import UserTrendsChart from '../../components/UserTrendsChart/UserTrendsChart'
import UserProcessReports from '../../components/UserProcessReports/UserProcessReports'
import RoutesManager from '../../components/RoutesManager/RoutesManager'
import ConfigureServerDialog from '../../components/ConfigureServerDialog/ConfigureServerDialog'
import './AdminView.css'

const { TabPane } = Tabs

export default function AdminView() {
  const dispatch = useDispatch<AppDispatch>()
  const currentUser = useSelector(selectCurrentUser)
  const username = localStorage.getItem('username') || ''
  const authToken = localStorage.getItem('token') || ''

  const isSuperAdmin = useMemo(
    () => username === 'admin' && localStorage.getItem('userRole') === 'admin',
    [username]
  )

  // 站点设置
  const [siteSettings, setSiteSettings] = useState({
    name: '', logo: '', subtitle: '', serverUrl: ''
  })

  useEffect(() => {
    const fetchSite = async () => {
      try {
        const resp = await axios.get('/api/settings/site')
        setSiteSettings({
          name: resp.data.site_name,
          logo: resp.data.site_logo,
          subtitle: resp.data.site_subtitle,
          serverUrl: resp.data.server_url || window.location.origin
        })
      } catch (e) {
        console.error('获取站点设置失败:', e)
      }
    }
    fetchSite()
  }, [])

  // 待审批
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const pendingCount = useMemo(
    () => pendingRequests.filter((r) => r.status === 'pending').length,
    [pendingRequests]
  )

  const fetchPending = useCallback(async () => {
    try {
      const resp = await axios.get('/api/container-requests')
      setPendingRequests(resp.data.requests || [])
    } catch {
      setPendingRequests([])
    }
  }, [])

  const handleRequestProcessed = useCallback(() => {
    fetchPending()
    window.dispatchEvent(new CustomEvent('refreshPendingCount'))
  }, [fetchPending])

  // Tab 管理
  const { activeTab, changeTab } = useAdminTabs()

  // 用户管理
  const userMgmt = useUserManagement(currentUser, username)

  // 服务器管理
  const serverMgmt = useServerManagement(siteSettings)

  // 子组件 ref
  const announcementRef = useRef<any>(null)
  const containerRef = useRef<any>(null)
  const logRef = useRef<any>(null)
  const pendingRef = useRef<any>(null)

  // 密码修改
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordForm] = Form.useForm()

  // 日志清理
  const [cleanupLoading, setCleanupLoading] = useState(false)

  // 自动刷新
  useAutoRefresh(
    useCallback(async () => {
      await dispatch(fetchServers())
    }, [dispatch]),
    30000,
    !serverMgmt.terminalDialogOpen
  )

  useAutoRefresh(fetchPending, 30000, true)

  // 初始化
  useEffect(() => {
    const init = async () => {
      try {
        await dispatch(fetchUsers())
        await Promise.all([dispatch(fetchServers()), dispatch(fetchRoutes())])
        await fetchPending()
      } catch (e) {
        console.error('AdminView 初始化失败:', e)
        message.error('管理面板初始化失败，请刷新页面重试')
      }
    }
    init()
  }, [dispatch, fetchPending])

  // ==================== 用户表格列 ====================

  const userColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', width: 120 },
    {
      title: '分组', dataIndex: 'group', width: 120,
      render: (_: any, record: any) => (
        <Tag color={getGroupTagColor(record.group)}>
          {record.display_label || groupName(record.group)}
        </Tag>
      )
    },
    {
      title: '角色', dataIndex: 'role', width: 100,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'green'}>
          {role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      )
    },
    {
      title: '激活状态', dataIndex: 'is_activated', width: 100,
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'orange'}>{val ? '已激活' : '未激活'}</Tag>
      )
    },
    { title: '创建时间', dataIndex: 'created_at', width: 160 },
    {
      title: '操作', width: 320, fixed: 'right' as const,
      render: (_: any, record: any) => {
        const disabled = record.id === currentUser?.id || record.username === 'admin' || (record.role === 'admin' && username !== 'admin')
        return (
          <Space size="small" wrap>
            <Button size="small" type="primary" disabled={disabled} onClick={() => userMgmt.openEdit(record)}>
              <EditOutlined /> 编辑
            </Button>
            <Button size="small" onClick={() => userMgmt.showTrends(record.username)}>
              <LineChartOutlined /> 趋势
            </Button>
            <Button size="small" type="primary" onClick={() => userMgmt.showReports(record.username)}>
              <FileTextOutlined /> 报表
            </Button>
            <Button size="small" danger disabled={disabled} onClick={() => userMgmt.confirmDelete(record)}>
              <DeleteOutlined /> 删除
            </Button>
          </Space>
        )
      }
    }
  ]

  // ==================== 服务器表格列 ====================

  const serverColumns = [
    { title: 'ID', dataIndex: 'id', width: 50 },
    {
      title: '显示顺序', dataIndex: 'display_order', width: 100,
      render: (_: any, record: any) => (
        <InputNumber
          size="small" min={1} max={999} value={record.display_order}
          onChange={(val) => val !== null && serverMgmt.updateServerOrder(record.id, val)}
          onClick={(e: any) => e.stopPropagation()}
          style={{ width: 70 }}
        />
      )
    },
    {
      title: '显示/隐藏', width: 90,
      render: (_: any, record: any) => (
        <Switch
          checked={record.is_visible}
          onChange={(val) => serverMgmt.updateServerVisibility(record.id, val)}
          onClick={(_, e) => e?.stopPropagation()}
        />
      )
    },
    { title: '名称', dataIndex: 'name', width: 100 },
    { title: 'IP地址', dataIndex: 'ip_address', width: 130 },
    { title: 'SSH', dataIndex: 'port', width: 70 },
    {
      title: '上报', width: 80,
      render: (_: any, record: any) => record.collection_interval
        ? <Tag color="green">{record.collection_interval} 秒</Tag>
        : <span>默认</span>
    },
    {
      title: '路由', width: 140,
      render: (_: any, record: any) => record.route
        ? <Tag>{formatRouteLabel(record.route)}</Tag>
        : <span>未配置</span>
    },
    {
      title: '状态', width: 80,
      render: (_: any, record: any) => (
        <Tag color={getStatusType(record.status)}>{getStatusText(record.status)}</Tag>
      )
    },
    { title: 'GPU', dataIndex: 'gpu_count', width: 60 },
    {
      title: '最后在线', width: 160,
      render: (_: any, record: any) => formatLastOnline(record.last_online)
    },
    {
      title: '操作', width: 320, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small" wrap>
          <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); serverMgmt.setSelectedServer(record) }}>
            <EyeOutlined /> 详情
          </Button>
          <Button size="small" style={{ color: 'green', borderColor: 'green' }} onClick={(e) => { e.stopPropagation(); serverMgmt.showServerToken(record.id) }}>
            <KeyOutlined /> Token
          </Button>
          <Button size="small" type="primary"
            disabled={record.status === 'offline' || !!serverMgmt.installingAgents[record.id]}
            loading={!!serverMgmt.installingAgents[record.id]}
            onClick={(e) => { e.stopPropagation(); serverMgmt.installAgent(record) }}>
            <DownloadOutlined /> 安装代理
          </Button>
          <Button size="small" onClick={(e) => { e.stopPropagation(); serverMgmt.openEdit(record) }}>
            <EditOutlined /> 编辑
          </Button>
          <Button size="small" onClick={(e) => { e.stopPropagation(); serverMgmt.testConnection(record.id) }}>
            <LinkOutlined /> 测试
          </Button>
          <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); serverMgmt.openTerminal(record) }}>
            <DesktopOutlined /> 远程登录
          </Button>
          <Button size="small" style={{ color: 'green', borderColor: 'green' }} onClick={(e) => { e.stopPropagation(); serverMgmt.goToResources(record.id) }}>
            <SettingOutlined /> 资源管理
          </Button>
          <Button size="small" onClick={(e) => { e.stopPropagation(); serverMgmt.restartAgent(record.id) }}
            disabled={record.status === 'offline'}>
            <SyncOutlined /> 重启代理
          </Button>
          <Button size="small" danger onClick={(e) => { e.stopPropagation(); serverMgmt.restartServer(record.id) }}
            disabled={record.status === 'offline'}>
            <PoweroffOutlined /> 重启服务器
          </Button>
        </Space>
      )
    },
    {
      title: '危险操作', width: 100, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button size="small" danger onClick={(e) => { e.stopPropagation(); serverMgmt.confirmDelete(record) }}>
          <DeleteOutlined /> 删除
        </Button>
      )
    }
  ]

  // ==================== 渲染 ====================

  return (
    <div className="admin-view-wrapper">
      <div className="admin-container">
        <div className="main-content">
          <Tabs activeKey={activeTab} onChange={changeTab} className="admin-tabs">

            {/* ========== 用户管理 ========== */}
            <TabPane tab={<span><UserOutlined /> 用户管理</span>} key="users">
              <div className="tab-header">
                <h2>用户管理</h2>
                <Space className="tab-actions">
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => userMgmt.setAddDialogOpen(true)}>添加用户</Button>
                  <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<FileTextOutlined />}
                    onClick={() => userMgmt.setBatchDialogOpen(true)}>批量添加用户</Button>
                  <Button danger icon={<DeleteOutlined />}
                    disabled={userMgmt.validSelectedUsers.length === 0}
                    onClick={userMgmt.confirmBatchDelete}>
                    批量删除{userMgmt.validSelectedUsers.length > 0 && `（${userMgmt.validSelectedUsers.length}）`}
                  </Button>
                </Space>
              </div>

              {/* 筛选 */}
              <Card className="filter-card" hoverable>
                <Space wrap size="middle">
                  <span>用户名：</span>
                  <Input
                    placeholder="搜索用户名" allowClear style={{ width: 180 }}
                    value={userMgmt.filter.keyword}
                    onChange={(e) => userMgmt.setFilter(prev => ({ ...prev, keyword: e.target.value }))}
                  />
                  <span>角色：</span>
                  <Select value={userMgmt.filter.role} onChange={(val) => userMgmt.setFilter(prev => ({ ...prev, role: val }))}
                    style={{ width: 120 }} allowClear placeholder="全部">
                    <Select.Option value="">全部</Select.Option>
                    <Select.Option value="admin">管理员</Select.Option>
                    <Select.Option value="user">普通用户</Select.Option>
                  </Select>
                  <span>分组：</span>
                  <Select value={userMgmt.filter.groupSelector}
                    onChange={(val) => userMgmt.setFilter(prev => ({ ...prev, groupSelector: val }))}
                    style={{ width: 180 }} allowClear placeholder="全部">
                    {userMgmt.groupFilterOptions.map((opt) => (
                      <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
                    ))}
                  </Select>
                  <span>激活状态：</span>
                  <Select value={userMgmt.filter.activationStatus}
                    onChange={(val) => userMgmt.setFilter(prev => ({ ...prev, activationStatus: val }))}
                    style={{ width: 120 }} allowClear placeholder="全部">
                    <Select.Option value="">全部</Select.Option>
                    <Select.Option value="activated">已激活</Select.Option>
                    <Select.Option value="not_activated">未激活</Select.Option>
                  </Select>
                  <Button type="primary" icon={<SearchOutlined />} onClick={userMgmt.handleFilter}>搜索</Button>
                  <Button icon={<ReloadOutlined />} onClick={userMgmt.resetFilter}>重置</Button>
                </Space>
              </Card>

              {/* 用户表格 */}
              <Card className="table-card" hoverable>
                <Table
                  loading={userMgmt.loading}
                  dataSource={userMgmt.pagedUsers}
                  columns={userColumns}
                  rowKey="id"
                  bordered
                  scroll={{ x: 1000 }}
                  pagination={false}
                  rowSelection={{
                    selectedRowKeys: userMgmt.selectedUserKeys,
                    onChange: userMgmt.setSelectedUserKeys,
                    getCheckboxProps: (record: any) => ({
                      disabled: !userMgmt.isRowSelectable(record)
                    })
                  }}
                />
                <div className="pagination-container">
                  <Pagination
                    current={userMgmt.pagination.page}
                    pageSize={userMgmt.pagination.pageSize}
                    total={userMgmt.filteredUsers.length}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 条`}
                    pageSizeOptions={['10', '20', '50', '100']}
                    onChange={(page, pageSize) => userMgmt.setPagination({ page, pageSize: pageSize || 20 })}
                  />
                </div>
              </Card>
            </TabPane>

            {/* ========== 公告管理 ========== */}
            <TabPane tab={<span><FileTextOutlined /> 公告管理</span>} key="announcements">
              <div className="tab-header">
                <h2>公告管理</h2>
                <Space className="tab-actions">
                  <Button type="primary" icon={<PlusOutlined />}
                    onClick={() => announcementRef.current?.openAddAnnouncementDialog()}>
                    添加公告
                  </Button>
                </Space>
              </div>
              <AnnouncementManager ref={announcementRef} />
            </TabPane>

            {/* ========== 系统设置 ========== */}
            {isSuperAdmin && (
              <TabPane tab={<span><PoweroffOutlined /> 系统设置</span>} key="settings">
                <div className="tab-header">
                  <h2>系统设置</h2>
                </div>
                <SystemSettings />
              </TabPane>
            )}

            {/* ========== 服务器管理 ========== */}
            <TabPane tab={<span><DesktopOutlined /> 服务器管理</span>} key="servers">
              <div className="tab-header">
                <h2>服务器管理</h2>
                <Space className="tab-actions" wrap>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => serverMgmt.setAddDialogOpen(true)}>
                    添加服务器
                  </Button>
                  <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} icon={<SettingOutlined />}
                    onClick={() => serverMgmt.setConfigureDialogOpen(true)}>
                    配置服务器
                  </Button>
                  <Dropdown
                    disabled={serverMgmt.selectedServerKeys.length === 0 || serverMgmt.batchProcessing}
                    menu={{
                      items: [
                        { key: 'batchInstallAgent', label: '批量安装代理', icon: <DownloadOutlined /> },
                        { key: 'batchRestartAgent', label: '批量重启代理', icon: <SyncOutlined /> },
                        { key: 'batchTest', label: '批量测试连接', icon: <LinkOutlined /> },
                      ],
                      onClick: ({ key }) => serverMgmt.handleBatchOperation(key)
                    }}
                  >
                    <Button loading={serverMgmt.batchProcessing} style={{ color: '#faad14', borderColor: '#faad14' }}>
                      {serverMgmt.batchProcessing ? '处理中...' : '批量操作'}
                      {serverMgmt.selectedServerKeys.length > 0 && !serverMgmt.batchProcessing && `（${serverMgmt.selectedServerKeys.length}）`}
                      <DownOutlined />
                    </Button>
                  </Dropdown>
                </Space>
              </div>

              {!serverMgmt.selectedServer ? (
                <Card className="table-card" hoverable>
                  <Table
                    loading={serverMgmt.serversLoading}
                    dataSource={serverMgmt.servers}
                    columns={serverColumns}
                    rowKey="id"
                    bordered
                    scroll={{ x: 1800 }}
                    pagination={false}
                    onRow={(record) => ({
                      onClick: () => serverMgmt.setSelectedServer(record)
                    })}
                    rowSelection={{
                      selectedRowKeys: serverMgmt.selectedServerKeys,
                      onChange: serverMgmt.setSelectedServerKeys
                    }}
                  />
                </Card>
              ) : (
                <div className="server-detail-container">
                  <div className="tab-header">
                    <h2>{serverMgmt.selectedServer.name} 详情</h2>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => serverMgmt.setSelectedServer(null)}>
                      返回服务器列表
                    </Button>
                  </div>
                  <Card hoverable>
                    <ServerDetail serverId={serverMgmt.selectedServer.id} />
                  </Card>
                </div>
              )}
            </TabPane>

            {/* ========== 路由管理 ========== */}
            <TabPane tab={<span><ApiOutlined /> 路由管理</span>} key="routes">
              <div className="tab-header">
                <h2>路由管理</h2>
                <Tag color="blue">维护网段与域名映射，安装代理时自动下发</Tag>
              </div>
              <RoutesManager />
            </TabPane>

            {/* ========== 容器管理 ========== */}
            <TabPane
              tab={
                <span>
                  <AppstoreOutlined /> 容器管理
                  {pendingCount > 0 && <Badge count={pendingCount} size="small" offset={[5, -3]} />}
                </span>
              }
              key="containers"
            >
              <div className="tab-header">
                <h2>容器管理</h2>
                <Space className="tab-actions">
                  <Button type="primary" icon={<PlusOutlined />}
                    onClick={() => containerRef.current?.openCreateContainerDialog()}>
                    创建容器
                  </Button>
                  <Button type="primary" icon={<ReloadOutlined />}
                    loading={false}
                    onClick={() => containerRef.current?.fetchContainers()}>
                    刷新
                  </Button>
                </Space>
              </div>
              <PendingRequests ref={pendingRef} onRequestProcessed={handleRequestProcessed} />
              <ContainerManager ref={containerRef} />
            </TabPane>

            {/* ========== 操作日志 ========== */}
            <TabPane tab={<span><UnorderedListOutlined /> 操作日志</span>} key="logs">
              <div className="tab-header">
                <h2>操作日志</h2>
                <Space className="tab-actions">
                  <Button type="primary" icon={<ReloadOutlined />}
                    onClick={() => logRef.current?.refreshLogs()}>
                    刷新日志
                  </Button>
                  {isSuperAdmin && (
                    <Dropdown
                      menu={{
                        items: [
                          { key: 'all', label: '删除全部' },
                          { key: '30', label: '删除一个月以前' },
                          { key: '7', label: '删除一个星期以前' },
                        ],
                        onClick: ({ key }) => {
                          if (key === 'all') logRef.current?.confirmCleanup('all')
                          else logRef.current?.confirmCleanup('older_than_days', Number(key))
                        }
                      }}
                    >
                      <Button danger loading={cleanupLoading}>
                        <DeleteOutlined /> 清理日志
                      </Button>
                    </Dropdown>
                  )}
                </Space>
              </div>
              <LogManager ref={logRef} isActive={activeTab === 'logs'} />
            </TabPane>
          </Tabs>
        </div>

        {/* ========== 对话框 ========== */}

        {/* 终端 */}
        {serverMgmt.terminalServer && (
          <TerminalDialog
            open={serverMgmt.terminalDialogOpen}
            onClose={() => serverMgmt.setTerminalDialogOpen(false)}
            serverId={serverMgmt.terminalServer.id}
            serverName={serverMgmt.terminalServer.name}
            serverAddress={`${serverMgmt.terminalServer.ip_address}:${serverMgmt.terminalServer.port}`}
            serverUser={serverMgmt.terminalServer.username}
            authToken={authToken}
          />
        )}

        {/* 添加用户 */}
        <UserFormDialog
          title="添加用户"
          open={userMgmt.addDialogOpen}
          onCancel={() => userMgmt.setAddDialogOpen(false)}
          onSubmit={userMgmt.submitAdd}
          loading={userMgmt.submitting}
          isSuperAdmin={isSuperAdmin}
          username={username}
          users={userMgmt.users}
          isEdit={false}
        />

        {/* 编辑用户 */}
        <UserFormDialog
          title="编辑用户"
          open={userMgmt.editDialogOpen}
          onCancel={() => userMgmt.setEditDialogOpen(false)}
          onSubmit={userMgmt.submitEdit}
          loading={userMgmt.submitting}
          isSuperAdmin={isSuperAdmin}
          username={username}
          users={userMgmt.users}
          isEdit={true}
          initialValues={
            userMgmt.editingUserId
              ? (userMgmt.users || []).find((u: any) => u.id === userMgmt.editingUserId)
              : undefined
          }
        />

        {/* 批量添加用户 */}
        <BatchUserFormDialog
          open={userMgmt.batchDialogOpen}
          onCancel={() => userMgmt.setBatchDialogOpen(false)}
          onSubmit={userMgmt.submitBatch}
          loading={userMgmt.submitting}
          isSuperAdmin={isSuperAdmin}
          username={username}
        />

        {/* 添加服务器 */}
        <ServerFormDialog
          title="添加服务器"
          open={serverMgmt.addDialogOpen}
          onCancel={() => serverMgmt.setAddDialogOpen(false)}
          onSubmit={serverMgmt.submitAdd}
          loading={serverMgmt.submitting}
          routes={serverMgmt.routes}
          isEdit={false}
        />

        {/* 编辑服务器 */}
        <ServerFormDialog
          title="编辑服务器"
          open={serverMgmt.editDialogOpen}
          onCancel={() => serverMgmt.setEditDialogOpen(false)}
          onSubmit={serverMgmt.submitEdit}
          loading={serverMgmt.submitting}
          routes={serverMgmt.routes}
          isEdit={true}
          initialValues={
            serverMgmt.editingServerId
              ? (serverMgmt.servers || []).find((s: any) => s.id === serverMgmt.editingServerId)
              : undefined
          }
        />

        {/* Token 对话框 */}
        <TokenDialog
          open={serverMgmt.tokenDialogOpen}
          onClose={() => serverMgmt.setTokenDialogOpen(false)}
          token={serverMgmt.currentServerToken}
          installCommand={serverMgmt.currentServerInstallCommand}
          serverId={serverMgmt.currentServerId}
          showToken={serverMgmt.showToken}
          onToggleShowToken={() => serverMgmt.setShowToken(!serverMgmt.showToken)}
          onCopyToken={serverMgmt.copyToken}
          onCopyCommand={serverMgmt.copyInstallCommand}
          onRegenerate={serverMgmt.confirmRegenerateToken}
          activeInstallTab={serverMgmt.activeInstallTab}
          onInstallTabChange={serverMgmt.setActiveInstallTab}
          siteSettings={siteSettings}
        />

        {/* 用户趋势 */}
        <UserTrendsChart
          visible={userMgmt.trendsVisible}
          onClose={() => userMgmt.setTrendsVisible(false)}
          username={userMgmt.selectedUsername}
          avatarUrl={userMgmt.selectedUserAvatar}
        />

        {/* 用户报表 */}
        <UserProcessReports
          visible={userMgmt.reportsVisible}
          onClose={() => userMgmt.setReportsVisible(false)}
          username={userMgmt.selectedUsername}
          avatarUrl={userMgmt.selectedUserAvatar}
        />

        {/* 配置服务器 */}
        <ConfigureServerDialog
          open={serverMgmt.configureDialogOpen}
          onClose={() => serverMgmt.setConfigureDialogOpen(false)}
        />
      </div>
    </div>
  )
}

// ==================== 子对话框组件 ====================

// 用户表单对话框
function UserFormDialog({ title, open, onCancel, onSubmit, loading, isSuperAdmin, username, users, isEdit, initialValues }: any) {
  const [form] = Form.useForm()
  const groupValue = Form.useWatch('group', form)

  useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue({
        username: initialValues.username,
        password: '',
        role: initialValues.role,
        group: initialValues.group || 'unassigned',
        entry_year: initialValues.entry_year || null
      })
    } else if (open) {
      form.resetFields()
    }
  }, [open, initialValues])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const success = await onSubmit(values)
      if (success) form.resetFields()
    } catch { /* validation failed */ }
  }

  return (
    <Modal title={title} open={open} onCancel={onCancel} onOk={handleOk}
      confirmLoading={loading} destroyOnClose maskClosable={false}>
      <Form form={form} layout="horizontal" labelCol={{ span: 6 }}
        initialValues={{ role: 'user', group: 'unassigned' }}>
        <Form.Item name="username" label="用户名" rules={[
          { required: true, message: '请输入用户名' },
          { min: 2, max: 20, message: '用户名长度应为2-20个字符' },
          ...(!isEdit ? [{
            validator: (_: any, value: string) => {
              if (value && (users || []).some((u: any) => u.username === value)) {
                return Promise.reject('用户名已存在')
              }
              return Promise.resolve()
            }
          }] : [])
        ]}>
          <Input placeholder="请输入用户名" />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={isEdit ? [] : [
          { required: true, message: '请输入密码' },
          {
            validator: (_: any, value: string) => {
              if (!value) return Promise.resolve()
              if (value.length < 6) return Promise.reject('密码长度至少为6位')
              if (!/[a-zA-Z]/.test(value)) return Promise.reject('密码必须包含至少一个字母')
              if (!/\d/.test(value)) return Promise.reject('密码必须包含至少一个数字')
              return Promise.resolve()
            }
          }
        ]}>
          <Input.Password placeholder={isEdit ? '请输入新密码（留空则不修改）' : '请输入密码'} />
        </Form.Item>
        <Form.Item name="role" label="角色" rules={[{ required: true }]}>
          <Select>
            {username === 'admin' && <Select.Option value="admin">管理员</Select.Option>}
            <Select.Option value="user">普通用户</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="group" label="分组" rules={[{ required: true }]}>
          <Select>
            <Select.Option value="unassigned">未分组</Select.Option>
            <Select.Option value="undergrad">本科生</Select.Option>
            <Select.Option value="master">硕士生</Select.Option>
            <Select.Option value="phd">博士生</Select.Option>
            <Select.Option value="teacher">教师</Select.Option>
          </Select>
        </Form.Item>
        {['undergrad', 'master'].includes(groupValue) && (
          <Form.Item name="entry_year" label="年份" rules={[{ required: true, message: '请填写年份' }]}>
            <InputNumber min={2000} max={2100} placeholder="如 2025" style={{ width: '100%' }} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

// 批量添加用户对话框
function BatchUserFormDialog({ open, onCancel, onSubmit, loading, isSuperAdmin, username }: any) {
  const [form] = Form.useForm()
  const groupValue = Form.useWatch('group', form)

  useEffect(() => {
    if (open) form.resetFields()
  }, [open])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const success = await onSubmit(values)
      if (success) form.resetFields()
    } catch { /* */ }
  }

  return (
    <Modal title="批量添加用户" open={open} onCancel={onCancel} onOk={handleOk}
      confirmLoading={loading} width={600} destroyOnClose maskClosable={false}>
      <Form form={form} layout="horizontal" labelCol={{ span: 6 }}
        initialValues={{ role: 'user', group: 'unassigned' }}>
        <Form.Item name="usernames" label="用户名列表" rules={[{ required: true, message: '请输入用户名列表' }]}>
          <Input.TextArea rows={10} placeholder="请输入用户名列表，每行一个用户名" />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[
          { required: true, message: '请输入密码' },
          {
            validator: (_: any, value: string) => {
              if (!value) return Promise.resolve()
              if (value.length < 6) return Promise.reject('密码长度至少为6位')
              if (!/[a-zA-Z]/.test(value)) return Promise.reject('密码必须包含至少一个字母')
              if (!/\d/.test(value)) return Promise.reject('密码必须包含至少一个数字')
              return Promise.resolve()
            }
          }
        ]}>
          <Input.Password placeholder="请输入密码" />
        </Form.Item>
        <Form.Item name="role" label="角色" rules={[{ required: true }]}>
          <Select>
            {username === 'admin' && <Select.Option value="admin">管理员</Select.Option>}
            <Select.Option value="user">普通用户</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="group" label="分组" rules={[{ required: true }]}>
          <Select>
            <Select.Option value="unassigned">未分组</Select.Option>
            <Select.Option value="undergrad">本科生</Select.Option>
            <Select.Option value="master">硕士生</Select.Option>
            <Select.Option value="phd">博士生</Select.Option>
            <Select.Option value="teacher">教师</Select.Option>
          </Select>
        </Form.Item>
        {['undergrad', 'master'].includes(groupValue) && (
          <Form.Item name="entry_year" label="年份" rules={[{ required: true, message: '请填写年份' }]}>
            <InputNumber min={2000} max={2100} placeholder="如 2025" style={{ width: '100%' }} />
            <div className="form-tip">本科生/硕士生必填；教师/博士生无需填写</div>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

// 服务器表单对话框
function ServerFormDialog({ title, open, onCancel, onSubmit, loading, routes, isEdit, initialValues }: any) {
  const [form] = Form.useForm()
  const authType = Form.useWatch('auth_type', form)

  useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue({
        name: initialValues.name,
        ip_address: initialValues.ip_address,
        port: initialValues.port,
        username: initialValues.username,
        auth_type: 'password',
        password: '',
        ssh_key: '',
        display_order: initialValues.display_order || 50,
        is_visible: initialValues.is_visible || false,
        route_id: initialValues.route?.id || null,
        collection_interval: initialValues.collection_interval ?? null
      })
    } else if (open) {
      form.resetFields()
    }
  }, [open, initialValues])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const success = await onSubmit(values)
      if (success) form.resetFields()
    } catch { /* */ }
  }

  return (
    <Modal title={title} open={open} onCancel={onCancel} onOk={handleOk}
      confirmLoading={loading} width={600} destroyOnClose maskClosable={false}>
      <Form form={form} layout="horizontal" labelCol={{ span: 6 }}
        initialValues={{ port: 22, auth_type: 'password', display_order: 50, is_visible: false, collection_interval: 2 }}>
        <Form.Item name="name" label="服务器名称" rules={[{ required: true, message: '请输入服务器名称' }]}>
          <Input placeholder="请输入服务器名称" />
        </Form.Item>
        <Form.Item name="ip_address" label="IP地址" rules={[
          { required: true, message: '请输入IP地址' },
          { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: 'IP地址格式不正确' }
        ]}>
          <Input placeholder="请输入IP地址" />
        </Form.Item>
        <Form.Item name="port" label="SSH端口" rules={[{ required: true }]}>
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input placeholder="请输入SSH用户名" />
        </Form.Item>
        <Form.Item name="auth_type" label="认证方式">
          <Radio.Group>
            <Radio value="password">密码</Radio>
            <Radio value="ssh_key">SSH密钥</Radio>
          </Radio.Group>
        </Form.Item>
        {authType === 'password' && (
          <Form.Item name="password" label="密码"
            rules={!isEdit ? [{ required: true, message: '请输入密码' }] : []}>
            <Input.Password placeholder={isEdit ? '请输入新密码（留空则不修改）' : '请输入SSH密码'} />
          </Form.Item>
        )}
        {authType === 'ssh_key' && (
          <Form.Item name="ssh_key" label="SSH密钥"
            rules={!isEdit ? [{ required: true, message: '请输入SSH密钥' }] : []}>
            <Input.TextArea rows={4} placeholder={isEdit ? '请输入SSH私钥内容（留空则不修改）' : '请输入SSH私钥内容'} />
          </Form.Item>
        )}
        <Form.Item name="display_order" label="显示顺序">
          <InputNumber min={1} max={999} />
          <div className="form-tip">数字越小，在服务器概览中显示越靠前</div>
        </Form.Item>
        <Form.Item name="collection_interval" label="采集间隔">
          <InputNumber min={1} max={3600} style={{ width: '100%' }} />
          <div className="form-tip">单位：秒，留空表示使用代理默认策略。默认值 2 秒。</div>
        </Form.Item>
        <Form.Item name="route_id" label="路由器">
          <Select placeholder="请选择路由器" allowClear showSearch
            filterOption={(input, option) => (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())}>
            {(routes || []).map((r: any) => (
              <Select.Option key={r.id} value={r.id}>{formatRouteLabel(r)}</Select.Option>
            ))}
          </Select>
          <div className="form-tip">可选：指定路由后，安装代理时会自动写入对应的路由域名。</div>
        </Form.Item>
        <Form.Item name="is_visible" label="在概览中显示" valuePropName="checked">
          <Switch />
          <span className="form-tip" style={{ marginLeft: 8 }}>开启后，该服务器将显示在服务器概览页面中</span>
        </Form.Item>
      </Form>
    </Modal>
  )
}

// Token 对话框
function TokenDialog({
  open, onClose, token, installCommand, serverId, showToken, onToggleShowToken,
  onCopyToken, onCopyCommand, onRegenerate, activeInstallTab, onInstallTabChange, siteSettings
}: any) {
  return (
    <Modal title="服务器认证令牌与代理配置" open={open} onCancel={onClose}
      footer={<Button size="large" onClick={onClose}>关闭</Button>}
      width="60%" maskClosable={false}>
      <div className="token-container">
        <Alert message="重要提示" description="此认证令牌用于代理程序注册和数据采集，请妥善保管。泄露后请及时重新生成。"
          type="info" showIcon style={{ marginBottom: 20 }} />

        <h3><KeyOutlined /> 认证令牌</h3>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.Password
            value={token} readOnly size="large"
            visibilityToggle={{ visible: showToken, onVisibleChange: onToggleShowToken }}
          />
          <Space>
            <Button type="primary" size="large" icon={<FileTextOutlined />} onClick={onCopyToken}>复制令牌</Button>
            <Button size="large" icon={<SyncOutlined />} onClick={onRegenerate}
              style={{ color: '#faad14', borderColor: '#faad14' }}>重新生成</Button>
          </Space>
        </Space>

        <Divider />

        <h3><DownloadOutlined /> 代理程序安装</h3>
        <Tabs activeKey={activeInstallTab} onChange={onInstallTabChange}>
          <TabPane tab="一键安装（推荐）" key="auto">
            <Alert message="复制以下命令在目标服务器上执行，将自动安装并配置代理程序" type="info" showIcon style={{ marginBottom: 12 }} />
            {installCommand && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input.TextArea value={installCommand} readOnly rows={3} />
                <Button type="primary" size="large" icon={<FileTextOutlined />} onClick={onCopyCommand}>复制命令</Button>
              </Space>
            )}
            <Divider orientation="horizontal" ><SettingOutlined /> 高级配置参数</Divider>
            <Alert message="安装脚本支持以下可选参数来自定义配置" type="success" showIcon style={{ marginBottom: 12 }} />
            <div className="config-options">
              <h4><ClockCircleOutlined /> 采集间隔配置</h4>
              <p>使用 <code>--collection-interval=N</code> 参数设置数据采集间隔（秒）</p>
              <Tag color="blue">示例：--collection-interval=30</Tag>

              <h4 style={{ marginTop: 16 }}><ApiOutlined /> 路由域名</h4>
              <p>使用 <code>--router-domain=域名</code> 参数指定路由器的公网域名</p>
              <Tag color="blue">示例：--router-domain=router.example.com</Tag>
            </div>
            <Divider orientation="horizontal"><FileTextOutlined /> 配置示例</Divider>
            <pre className="code-example">
{`# 基础安装
curl -sSL ${siteSettings.serverUrl || window.location.origin}/api/agent/install_script | sudo bash -s -- --server-url=${siteSettings.serverUrl || window.location.origin} --auth-token=${token} --server-id=${serverId || '[SERVER_ID]'}

# 自定义采集间隔为30秒
curl -sSL ${siteSettings.serverUrl || window.location.origin}/api/agent/install_script | sudo bash -s -- --server-url=${siteSettings.serverUrl || window.location.origin} --auth-token=${token} --server-id=${serverId || '[SERVER_ID]'} --collection-interval=30`}
            </pre>
          </TabPane>
          <TabPane tab="手动配置" key="manual">
            <Alert message="适用于需要自定义安装路径或特殊配置的场景" type="info" showIcon style={{ marginBottom: 12 }} />
            <Steps direction="vertical" current={3} items={[
              { title: '下载代理程序', description: '从服务器下载GPU监控代理程序' },
              { title: '配置认证信息', description: '创建配置文件并设置认证令牌' },
              { title: '启动代理服务', description: '运行代理程序开始数据采集' },
            ]} />
            <h4>配置文件示例 (config.json)</h4>
            <pre className="code-example">
{JSON.stringify({
  server_url: siteSettings.serverUrl || window.location.origin,
  auth_token: token,
  collection_interval: 60,
  log_level: "INFO",
  collect_gpu: true,
  collect_cpu: true,
  collect_docker: true,
  collect_network: true,
  router_domain: "router.example.com"
}, null, 2)}
            </pre>
          </TabPane>
        </Tabs>
      </div>
    </Modal>
  )
}