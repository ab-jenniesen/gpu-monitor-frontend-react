import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Modal, Tag, Button, notification } from 'antd'
import Terminal from '../Terminal/Terminal'
import './TerminalDialog.css'

// ==================== 类型定义 ====================

interface TerminalDialogProps {
  open: boolean
  onClose: () => void
  serverId: number | string
  serverName?: string
  serverAddress?: string
  serverUser?: string
  containerId?: number | string | null
  targetHost?: string
  targetPort?: number | string
  loginUsername?: string
  authToken: string
}

// ==================== 组件 ====================

export default function TerminalDialog({
  open,
  onClose,
  serverId,
  serverName = '未知服务器',
  serverAddress = '',
  serverUser = 'root',
  containerId = null,
  targetHost = '',
  targetPort = '',
  loginUsername = '',
  authToken
}: TerminalDialogProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // ---------- 派生数据 ----------
  const displayName = useMemo(() => serverName || '未知服务器', [serverName])

  const displayUser = useMemo(
    () => loginUsername || serverUser || 'root',
    [loginUsername, serverUser]
  )

  const displayAddress = useMemo(() => {
    const host = targetHost || ''
    const port = targetPort || ''
    if (host && port) return `${host}:${port}`
    if (host) return host
    return serverAddress || ''
  }, [targetHost, targetPort, serverAddress])

  // ---------- 工具方法 ----------
  const dispatchResizeEvent = useCallback(() => {
    window.dispatchEvent(new CustomEvent('terminal-container-resize'))
  }, [])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev)
    setTimeout(() => dispatchResizeEvent(), 50)
  }, [dispatchResizeEvent])

  const handleClose = useCallback(() => {
    onClose()
    setIsFullscreen(false)
    setTimeout(() => dispatchResizeEvent(), 50)
  }, [onClose, dispatchResizeEvent])

  const handleError = useCallback((msg: string) => {
    notification.error({
      message: '终端错误',
      description: msg,
      duration: 5
    })
  }, [])

  const handleMinimize = useCallback(() => {
    // TODO: 实现最小化功能
  }, [])

  // ---------- 窗口 resize ----------
  useEffect(() => {
    const handleResize = () => {
      dispatchResizeEvent()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [dispatchResizeEvent])

  // ---------- ResizeObserver ----------
  useEffect(() => {
    if (!open) return

    const timer = setTimeout(() => {
      const dialogEl = document.querySelector('.terminal-dialog .ant-modal')
      if (dialogEl && window.ResizeObserver) {
        const observer = new ResizeObserver(() => {
          dispatchResizeEvent()
        })
        observer.observe(dialogEl)
        resizeObserverRef.current = observer
      }
      dispatchResizeEvent()
    }, 100)

    return () => {
      clearTimeout(timer)
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
    }
  }, [open, dispatchResizeEvent])

  // 打开/全屏切换后触发 resize
  useEffect(() => {
    if (open) {
      setTimeout(() => dispatchResizeEvent(), 100)
    }
  }, [open, isFullscreen, dispatchResizeEvent])

  // ---------- Modal 样式计算 ----------
  const modalStyle = useMemo(() => {
    if (isFullscreen) {
      return { top: 0, padding: 0 }
    }
    return { top: window.innerHeight > 900 ? '15vh' : '10vh' }
  }, [isFullscreen])

  const modalWidth = isFullscreen ? '100vw' : '80%'

  // ==================== 渲染 ====================

  return (
    <Modal
      open={open}
      title={null}
      width={modalWidth}
      closable={false}
      maskClosable={false}
      footer={null}
      destroyOnClose
      className={`terminal-dialog ${isFullscreen ? 'terminal-dialog--fullscreen' : ''}`}
      style={modalStyle}
      styles={{
        body: { padding: 0 }
      }}
    >
      <div ref={modalRef}>
        {/* 自定义标题栏 */}
        <div className="custom-header">
          <h4 className="terminal-title">
            <span className="header-icon">🖥</span>
            远程登录: {displayName}
          </h4>
          <div className="window-controls">
            <Button
              shape="circle"
              size="small"
              className="minimize-btn"
              onClick={handleMinimize}
            >
              <span className="window-btn-icon">─</span>
            </Button>
            <Button
              shape="circle"
              size="small"
              className="fullscreen-btn"
              onClick={toggleFullscreen}
            >
              <span className="window-btn-icon">□</span>
            </Button>
            <Button
              shape="circle"
              size="small"
              className="close-btn"
              onClick={handleClose}
            >
              <span className="window-btn-icon">×</span>
            </Button>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="terminal-toolbar">
          <div className="terminal-info">
            <Tag color="success">{displayName}</Tag>
            {displayAddress && <Tag color="default">{displayAddress}</Tag>}
            <Tag color="warning">{displayUser}</Tag>
          </div>
        </div>

        {/* 终端 */}
        <div className="terminal-wrapper">
          {open && (
            <Terminal
              serverId={serverId}
              containerId={containerId}
              authToken={authToken}
              targetHost={targetHost}
              targetPort={targetPort}
              loginUsername={displayUser}
              onClose={handleClose}
              onError={handleError}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
