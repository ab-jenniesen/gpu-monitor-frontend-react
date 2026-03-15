import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation, Outlet, NavLink } from 'react-router-dom'
import { message, Avatar, Badge, Button, Modal, Form, Input, Tooltip } from 'antd'
import {
  HomeFilled,
  DesktopOutlined,
  SettingOutlined,
  UserOutlined,
  DownOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuOutlined,
  BellFilled
} from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { logout, setAvatarUrl, selectCurrentUser } from '../../store/authSlice'
import type { AppDispatch } from '../../store'
import axios from '../../utils/axios'
import { resolveAvatarUrl } from '../../utils/avatar'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import MandatoryAnnouncementDialog from '../../components/MandatoryAnnouncementDialog/MandatoryAnnouncementDialog'
import AnnouncementCenter from '../../components/AnnouncementCenter/AnnouncementCenter'
import './MainLayout.css'

interface SiteSettings {
  name: string
  logo: string
  subtitle: string
}

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch<AppDispatch>()
  const user = useSelector(selectCurrentUser)

  // ==================== 用户信息 ====================

  const username = user?.username || localStorage.getItem('username') || ''
  const userRole = user?.role || localStorage.getItem('userRole') || ''
  const rawAvatarUrl = (() => {
    const direct = user?.avatar_url
    if (typeof direct === 'string') return direct
    return localStorage.getItem('avatarUrl') || ''
  })()
  const navAvatarUrl = resolveAvatarUrl(rawAvatarUrl, username || 'user', 80)
  const avatarInitial = (username ? username.charAt(0) : '用').toUpperCase()

  // ==================== 站点设置 ====================

  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    name: 'GPU共享服务平台',
    logo: 'https://lank.myzr.org:88/i/2024/05/29/66571d8de15ea.png',
    subtitle: '高效、安全的资源管理平台'
  })

  const fetchSiteSettings = useCallback(async () => {
    try {
      const response = await axios.get('/api/settings/site')
      setSiteSettings({
        name: response.data.site_name,
        logo: response.data.site_logo,
        subtitle: response.data.site_subtitle
      })
    } catch (error) {
      console.error('获取站点设置失败:', error)
    }
  }, [])

  // ==================== 待审批申请 ====================

  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const pendingCount = useMemo(
    () => pendingRequests.filter((req) => req.status === 'pending').length,
    [pendingRequests]
  )

  const fetchPendingRequests = useCallback(async () => {
    if (userRole !== 'admin') return
    try {
      const response = await axios.get('/api/container-requests')
      setPendingRequests(response.data.requests || [])
    } catch (error) {
      console.error('获取待审批申请失败:', error)
      setPendingRequests([])
    }
  }, [userRole])

  // ==================== 公告系统 ====================

  const {
    sortedAnnouncements,
    mandatoryAnnouncement,
    hasNewMandatory,
    hasNewGeneral,
    totalUnreadCount,
    markGeneralAsRead,
    markOneAsRead,
    markOneAsUnread,
    acknowledgeMandatory,
    fetchAnnouncements
  } = useAnnouncements({ pollInterval: 30000 })

  const [showMandatoryDialog, setShowMandatoryDialog] = useState(false)
  const [showAnnouncementCenter, setShowAnnouncementCenter] = useState(false)
  const [announcementCenterTab, setAnnouncementCenterTab] = useState('mandatory')
  const [dismissedMandatorySignature, setDismissedMandatorySignature] = useState('')

  const mandatorySignature = useMemo(() => {
    if (!mandatoryAnnouncement) return ''
    return `${mandatoryAnnouncement.id}-${mandatoryAnnouncement.updated_at}`
  }, [mandatoryAnnouncement])

  // 当 mandatorySignature 变化时重置 dismissed 状态
  useEffect(() => {
    if (mandatorySignature && dismissedMandatorySignature && dismissedMandatorySignature !== mandatorySignature) {
      setDismissedMandatorySignature('')
    }
    if (!mandatorySignature) {
      setDismissedMandatorySignature('')
    }
  }, [mandatorySignature]) // eslint-disable-line react-hooks/exhaustive-deps

  // 自动弹出强制公告
  useEffect(() => {
    if (!mandatoryAnnouncement || !hasNewMandatory) return
    if (dismissedMandatorySignature === mandatorySignature) return
    setShowMandatoryDialog(true)
  }, [mandatoryAnnouncement, hasNewMandatory, dismissedMandatorySignature, mandatorySignature])

  const notificationCount = useMemo(() => {
    const count = totalUnreadCount || 0
    return count > 99 ? 99 : count
  }, [totalUnreadCount])

  const openAnnouncementCenter = async () => {
    await fetchAnnouncements()
    if (hasNewMandatory) {
      setAnnouncementCenterTab('mandatory')
    } else if (hasNewGeneral) {
      setAnnouncementCenterTab('timeline')
    } else {
      setAnnouncementCenterTab('mandatory')
    }
    setShowAnnouncementCenter(true)
  }

  const handleMandatoryClose = () => {
    setDismissedMandatorySignature(mandatorySignature)
  }

  const handleMandatoryDismiss = () => {
    if (mandatoryAnnouncement) {
      acknowledgeMandatory(mandatoryAnnouncement)
    }
    setDismissedMandatorySignature(mandatorySignature)
  }

  const handleMandatoryDialogClose = async () => {
    setShowMandatoryDialog(false)
    await fetchAnnouncements()
  }

  const handleGeneralViewed = () => {
    markGeneralAsRead()
  }

  const handleMarkReadOne = (item: any) => {
    try { markOneAsRead(item) } catch { /* no-op */ }
  }

  const handleMarkUnreadOne = (item: any) => {
    try { markOneAsUnread(item) } catch { /* no-op */ }
  }

  const handleAnnouncementCenterClose = async () => {
    setShowAnnouncementCenter(false)
    await fetchAnnouncements()
  }

  // ==================== 移动端菜单 ====================

  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const toggleMobileMenu = () => setShowMobileMenu((v) => !v)
  const closeMobileMenu = () => setShowMobileMenu(false)

  // ==================== 用户下拉菜单 ====================

  const [showUserMenu, setShowUserMenu] = useState(false)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  const toggleUserMenu = () => setShowUserMenu((v) => !v)
  const closeUserMenu = () => setShowUserMenu(false)

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showUserMenu &&
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        closeUserMenu()
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showUserMenu])

  // ==================== 修改密码 ====================

  const [changePasswordVisible, setChangePasswordVisible] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordForm] = Form.useForm()

  const openChangePasswordDialog = () => {
    passwordForm.resetFields()
    setChangePasswordVisible(true)
    closeUserMenu()
  }

  const submitChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields()
      setPasswordLoading(true)
      await axios.post('/api/auth/change-password', {
        old_password: values.oldPassword,
        new_password: values.newPassword
      })
      message.success('密码修改成功')
      setChangePasswordVisible(false)
    } catch (error: any) {
      if (error?.response) {
        message.error(error.response?.data?.msg || '密码修改失败，请稍后再试')
      }
      // 表单验证失败不处理
    } finally {
      setPasswordLoading(false)
    }
  }

  // ==================== 设置头像 ====================

  const [avatarDialogVisible, setAvatarDialogVisible] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarUrl, setAvatarUrlState] = useState('')

  const previewAvatarUrl = resolveAvatarUrl(avatarUrl, username || 'user', 120)

  const openAvatarDialog = () => {
    setAvatarUrlState(rawAvatarUrl)
    setAvatarDialogVisible(true)
    closeUserMenu()
  }

  const resetAvatarUrlInput = () => {
    setAvatarUrlState('')
  }

  const submitAvatarUrl = async () => {
    if (avatarLoading) return
    const trimmed = avatarUrl ? avatarUrl.trim() : ''
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      message.error('头像地址需以 http:// 或 https:// 开头')
      return
    }
    if (trimmed.length > 2048) {
      message.error('头像地址长度不能超过 2048 字符')
      return
    }

    setAvatarLoading(true)
    try {
      const response = await axios.put('/api/users/avatar', { avatar_url: trimmed })
      dispatch(setAvatarUrl(response.data?.avatar_url || ''))
      message.success('头像已更新')
      setAvatarDialogVisible(false)
    } catch (error: any) {
      message.error(error.response?.data?.msg || '头像更新失败，请稍后重试')
    } finally {
      setAvatarLoading(false)
    }
  }

  // ==================== 退出登录 ====================

  const handleLogout = () => {
    dispatch(logout())
    closeUserMenu()
    navigate('/login')
  }

  // ==================== 生命周期 ====================

  useEffect(() => {
    fetchSiteSettings()
    fetchPendingRequests()

    const timer = setInterval(() => {
      fetchPendingRequests()
    }, 30000)

    const handleVisibilityChange = () => {
      if (!document.hidden) fetchAnnouncements()
    }
    const handleFocus = () => fetchAnnouncements()
    const handleRefreshPending = () => fetchPendingRequests()

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('refreshPendingCount', handleRefreshPending)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('refreshPendingCount', handleRefreshPending)
    }
  }, [fetchSiteSettings, fetchPendingRequests, fetchAnnouncements])

  // userRole 变化时刷新待审批
  useEffect(() => {
    if (userRole === 'admin') {
      fetchPendingRequests()
    } else {
      setPendingRequests([])
    }
  }, [userRole, fetchPendingRequests])

  // ==================== 辅助：判断当前路由是否激活 ====================

  const isActive = (path: string) => location.pathname === path

  // ==================== 渲染 ====================

  return (
    <div className="main-layout">
      <div className="layout-container">
        {/* ==================== Header ==================== */}
        <header className="layout-header">
          <div className="header-content">
            {/* 左侧 Logo */}
            <div className="header-left">
              <img src={siteSettings.logo} className="header-logo" alt="Logo" />
              <h1 className="header-title">{siteSettings.name}</h1>
            </div>

            {/* 移动端菜单按钮 */}
            <div className="mobile-menu-btn" onClick={toggleMobileMenu}>
              <MenuOutlined />
            </div>

            {/* 桌面端导航菜单 */}
            <nav className="nav-menu desktop-nav">
              <NavLink
                to="/user"
                className={`nav-item ${isActive('/user') ? 'active' : ''}`}
              >
                <HomeFilled />
                <span>首页</span>
              </NavLink>

              <NavLink
                to="/servers"
                className={`nav-item ${isActive('/servers') ? 'active' : ''}`}
              >
                <DesktopOutlined />
                <span>服务器概览</span>
              </NavLink>

              {userRole === 'admin' && (
                <NavLink
                  to="/admin"
                  className={`nav-item ${isActive('/admin') ? 'active' : ''}`}
                >
                  <SettingOutlined />
                  <span>管理面板</span>
                  {pendingCount > 0 && (
                    <Badge count={pendingCount} className="admin-pending-badge" />
                  )}
                </NavLink>
              )}
            </nav>

            {/* 右侧操作区 */}
            <div className="header-actions">
              {/* 公告入口 */}
              <div className="announcement-entry">
                <Badge
                  count={notificationCount}
                  overflowCount={99}
                >
                  <Button
                    className={`announcement-button ${notificationCount > 0 ? 'announcement-button--alert' : ''}`}
                    shape="circle"
                    icon={<BellFilled />}
                    onClick={openAnnouncementCenter}
                    aria-label="查看公告"
                  />
                </Badge>
              </div>

              {/* 用户信息下拉 */}
              <div className="user-info">
                <div className="custom-user-dropdown" ref={userDropdownRef}>
                  <div className="user-dropdown-trigger" onClick={toggleUserMenu}>
                    <Avatar
                      size={36}
                      className="user-avatar"
                      src={navAvatarUrl || undefined}
                    >
                      {avatarInitial}
                    </Avatar>
                    <span className="username-text">{username || '用户'}</span>
                    <DownOutlined
                      className={`dropdown-arrow ${showUserMenu ? 'dropdown-arrow-open' : ''}`}
                    />
                  </div>

                  {/* 下拉菜单 */}
                  {showUserMenu && (
                    <div className="custom-dropdown-content" onClick={(e) => e.stopPropagation()}>
                      <div className="dropdown-menu-items">
                        <div className="dropdown-menu-item" onClick={openAvatarDialog}>
                          <div className="menu-item-icon">
                            <UserOutlined />
                          </div>
                          <div className="menu-item-content">
                            <span className="menu-item-title">设置头像</span>
                            <span className="menu-item-desc">支持输入网络头像链接</span>
                          </div>
                        </div>

                        <div className="dropdown-menu-item" onClick={openChangePasswordDialog}>
                          <div className="menu-item-icon">
                            <KeyOutlined />
                          </div>
                          <div className="menu-item-content">
                            <span className="menu-item-title">修改密码</span>
                            <span className="menu-item-desc">更改您的登录密码</span>
                          </div>
                        </div>

                        <div className="dropdown-menu-item logout-item" onClick={handleLogout}>
                          <div className="menu-item-icon">
                            <LogoutOutlined />
                          </div>
                          <div className="menu-item-content">
                            <span className="menu-item-title">退出登录</span>
                            <span className="menu-item-desc">安全退出当前账户</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 移动端下拉菜单 */}
          <div className={`mobile-nav ${showMobileMenu ? 'mobile-nav-open' : ''}`}>
            <NavLink
              to="/user"
              className={`mobile-nav-item ${isActive('/user') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              <HomeFilled />
              <span>首页</span>
            </NavLink>

            <NavLink
              to="/servers"
              className={`mobile-nav-item ${isActive('/servers') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              <DesktopOutlined />
              <span>服务器概览</span>
            </NavLink>

            {userRole === 'admin' && (
              <NavLink
                to="/admin"
                className={`mobile-nav-item ${isActive('/admin') ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <SettingOutlined />
                <span>管理面板</span>
                {pendingCount > 0 && (
                  <Badge count={pendingCount} className="mobile-admin-badge" />
                )}
              </NavLink>
            )}
          </div>
        </header>

        {/* ==================== Main Content ==================== */}
        <main className="layout-main">
          <Outlet />
        </main>
      </div>

      {/* ==================== 修改密码对话框 ==================== */}
      <Modal
        open={changePasswordVisible}
        title="修改密码"
        width={400}
        centered
        destroyOnHidden
        onCancel={() => setChangePasswordVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setChangePasswordVisible(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={passwordLoading}
            onClick={submitChangePassword}
          >
            确认
          </Button>
        ]}
      >
        <Form form={passwordForm} layout="horizontal" labelCol={{ span: 6 }}>
          <Form.Item
            label="当前密码"
            name="oldPassword"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve()
                  if (value.length < 6) return Promise.reject('密码长度至少为6位')
                  if (!/[a-zA-Z]/.test(value)) return Promise.reject('密码必须包含字母')
                  if (!/\d/.test(value)) return Promise.reject('密码必须包含数字')
                  return Promise.resolve()
                }
              }
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject('两次输入的密码不一致')
                }
              })
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== 设置头像对话框 ==================== */}
      <Modal
        open={avatarDialogVisible}
        title="设置头像"
        width={420}
        centered
        destroyOnHidden
        onCancel={() => setAvatarDialogVisible(false)}
        footer={[
          <Button
            key="cancel"
            onClick={() => setAvatarDialogVisible(false)}
            disabled={avatarLoading}
          >
            取消
          </Button>,
          <Button
            key="reset"
            onClick={resetAvatarUrlInput}
            disabled={avatarLoading || !avatarUrl}
          >
            恢复默认
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={submitAvatarUrl}
            loading={avatarLoading}
          >
            保存
          </Button>
        ]}
      >
        <div className="avatar-dialog-body">
          <div className="avatar-preview">
            <Avatar size={80} className="user-avatar" src={previewAvatarUrl || undefined}>
              {avatarInitial}
            </Avatar>
            <div className="avatar-preview-text">
              <p>支持填写公网图片地址；留空将使用系统默认头像。</p>
              <p className="hint">建议使用以 http(s):// 开头的链接。</p>
            </div>
          </div>
          <Input
            value={avatarUrl}
            onChange={(e) => setAvatarUrlState(e.target.value)}
            placeholder="输入头像图片 URL，可留空恢复默认"
            allowClear
          />
        </div>
      </Modal>

      {/* ==================== 公告组件 ==================== */}
      <MandatoryAnnouncementDialog
        open={showMandatoryDialog}
        announcement={mandatoryAnnouncement}
        onClose={handleMandatoryClose}
        onDismiss={handleMandatoryDismiss}
        onOpenChange={handleMandatoryDialogClose}
      />

      <AnnouncementCenter
        open={showAnnouncementCenter}
        activeTab={announcementCenterTab}
        onActiveTabChange={setAnnouncementCenterTab}
        mandatoryAnnouncement={mandatoryAnnouncement}
        announcements={sortedAnnouncements}
        hasNewMandatory={hasNewMandatory}
        hasNewGeneral={hasNewGeneral}
        onViewGeneral={handleGeneralViewed}
        onMarkReadOne={handleMarkReadOne}
        onMarkUnreadOne={handleMarkUnreadOne}
        onOpenChange={handleAnnouncementCenterClose}
      />
    </div>
  )
}
