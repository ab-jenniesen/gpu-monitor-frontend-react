import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Input, Button, Tag, message } from 'antd'
import {
  CloseOutlined,
  MessageOutlined
} from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import './DanmakuChat.css'

interface DanmakuChatProps {
  disabled?: boolean
}

interface DanmakuMessage {
  id: string
  username: string
  content: string
  color: string
  track: number
  position: number
  duration: number
  type?: string
}

const COLOR_OPTIONS = [
  '#ffffff', '#ff6b6b', '#4ecdc4', '#45b7d1',
  '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff',
  '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84'
]

const TRACK_COUNT = 15
const SCROLL_SPEED = 100 // 像素/秒

function getRandomColor(): string {
  return COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)]
}

function getCurrentUsername(): string {
  return localStorage.getItem('username') || '游客'
}

export default function DanmakuChat({ disabled = false }: DanmakuChatProps) {
  const location = useLocation()

  const [isConnected, setIsConnected] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [messageInput, setMessageInput] = useState('')
  const [selectedColor, setSelectedColor] = useState(getRandomColor)
  const [onlineCount, setOnlineCount] = useState(0)
  const [displayMessages, setDisplayMessages] = useState<DanmakuMessage[]>([])

  const danmakuContainerRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const tracksRef = useRef<boolean[]>(Array(TRACK_COUNT).fill(false))
  const nextTrackRef = useRef(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isInitializingRef = useRef(false)
  const isUnmountingRef = useRef(false)
  const isVisibleRef = useRef(true)

  // 保持 isVisible 的 ref 同步（给闭包使用）
  useEffect(() => {
    isVisibleRef.current = isVisible
  }, [isVisible])

  // ==================== 心跳 ====================

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const startHeartbeat = useCallback(() => {
    stopHeartbeat()
    heartbeatRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('heartbeat', { timestamp: Date.now() })
      }
    }, 20000)
  }, [stopHeartbeat])

  // ==================== 弹幕轨道 ====================

  const findAvailableTrack = useCallback((): number => {
    for (let i = 0; i < tracksRef.current.length; i++) {
      if (!tracksRef.current[i]) return i
    }
    const track = nextTrackRef.current
    nextTrackRef.current = (nextTrackRef.current + 1) % TRACK_COUNT
    return track
  }, [])

  // ==================== 弹幕显示 ====================

  const showDanmaku = useCallback((msg: any) => {
    if (!isVisibleRef.current) return

    const trackIndex = findAvailableTrack()
    tracksRef.current[trackIndex] = true

    const containerWidth = danmakuContainerRef.current?.clientWidth || window.innerWidth
    const messageWidth = (msg.content.length + msg.username.length + 2) * 20
    const startX = containerWidth
    const endX = -messageWidth
    const totalDistance = startX - endX
    const duration = totalDistance / SCROLL_SPEED

    const danmakuMsg: DanmakuMessage = {
      ...msg,
      id: msg.id || `msg_${Date.now()}_${Math.random()}`,
      track: trackIndex,
      position: startX,
      duration
    }

    setDisplayMessages(prev => [...prev, danmakuMsg])

    // 开始动画（延迟触发 CSS transition）
    setTimeout(() => {
      setDisplayMessages(prev =>
        prev.map(m => m.id === danmakuMsg.id ? { ...m, position: endX } : m)
      )
    }, 100)

    // 动画结束后清理
    setTimeout(() => {
      tracksRef.current[trackIndex] = false
      setDisplayMessages(prev => prev.filter(m => m.id !== danmakuMsg.id))
    }, duration * 1000 + 500)
  }, [findAvailableTrack])

  // ==================== WebSocket ====================

  const disconnect = useCallback(() => {
    if (!socketRef.current) return
    stopHeartbeat()
    try {
      if (socketRef.current.connected) {
        socketRef.current.disconnect()
      }
    } catch (error) {
      // ignore
    } finally {
      socketRef.current = null
      setIsConnected(false)
      isInitializingRef.current = false
    }
  }, [stopHeartbeat])

  const initSocket = useCallback(() => {
    if (socketRef.current || isInitializingRef.current || isUnmountingRef.current) return

    isInitializingRef.current = true

    try {
      const newSocket = io('/danmaku-chat', {
        path: '/socket.io',
        transports: ['websocket', 'polling']
      })

      socketRef.current = newSocket

      newSocket.on('connect', () => {
        setIsConnected(true)
        isInitializingRef.current = false
        newSocket.emit('join_chat', { username: getCurrentUsername() })
        startHeartbeat()
      })

      newSocket.on('disconnect', () => {
        setIsConnected(false)
        isInitializingRef.current = false
        stopHeartbeat()
      })

      newSocket.on('welcome', (data: any) => {
        setOnlineCount(data.online_count)
      })

      newSocket.on('user_joined', (data: any) => {
        setOnlineCount(data.online_count)
      })

      newSocket.on('user_left', (data: any) => {
        setOnlineCount(data.online_count)
      })

      newSocket.on('online_count_update', (data: any) => {
        setOnlineCount(data.online_count)
      })

      newSocket.on('new_message', (msg: any) => {
        showDanmaku(msg)
      })

      newSocket.on('error', (data: any) => {
        message.error(data.message)
      })
    } catch (error) {
      console.error('创建WebSocket连接失败:', error)
      isInitializingRef.current = false
    }
  }, [startHeartbeat, stopHeartbeat, showDanmaku])

  // ==================== 路由判断 ====================

  const shouldActivateChat = useCallback(() => {
    if (disabled) return false
    return location.pathname === '/servers' || location.pathname.startsWith('/servers/')
  }, [disabled, location.pathname])

  // ==================== 事件处理 ====================

  const sendMessage = useCallback(() => {
    if (!socketRef.current?.connected || !messageInput.trim()) return
    socketRef.current.emit('send_message', {
      message: messageInput.trim(),
      color: selectedColor
    })
    setMessageInput('')
  }, [messageInput, selectedColor])

  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => {
      const next = !prev
      if (!next) {
        setDisplayMessages([])
      }
      return next
    })
  }, [])

  const closeChat = useCallback(() => {
    setShowControls(false)
    // 不断开 WebSocket，保持弹幕接收
  }, [])

  // ==================== 副作用 ====================

  // 路由变化处理连接
  useEffect(() => {
    if (shouldActivateChat()) {
      if (!socketRef.current && !isInitializingRef.current) {
        initSocket()
      }
    } else {
      disconnect()
      setShowControls(false)
    }
  }, [location.pathname, disabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // 页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopHeartbeat()
      } else {
        if (socketRef.current?.connected) {
          startHeartbeat()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [startHeartbeat, stopHeartbeat])

  // 组件卸载
  useEffect(() => {
    isUnmountingRef.current = false
    return () => {
      isUnmountingRef.current = true
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== 如果 disabled，不渲染 ====================

  if (disabled) return null

  // ==================== 渲染 ====================

  return (
    <div className="danmaku-chat">
      {/* 弹幕显示区域 */}
      <div
        ref={danmakuContainerRef}
        className={`danmaku-container ${isVisible ? 'show' : ''}`}
      >
        {displayMessages.map(msg => (
          <div
            key={msg.id}
            className="danmaku-message"
            style={{
              top: `${msg.track * 50}px`,
              color: msg.color,
              transform: `translateX(${msg.position}px)`,
              transition: `transform ${msg.duration}s linear`
            }}
          >
            <strong>{msg.username}:</strong> {msg.content}
          </div>
        ))}
      </div>

      {/* 聊天控制面板 */}
      {showControls && (
        <div className="chat-controls">
          <div className="chat-panel">
            <div className="chat-header">
              <h4>弹幕聊天</h4>
              <div className="online-count">
                <span>👥 {onlineCount} 人在线</span>
              </div>
              <Button
                type="link"
                icon={<CloseOutlined />}
                onClick={closeChat}
              />
            </div>

            <div className="message-input-area">
              <div className="input-row">
                <Input
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="输入弹幕内容..."
                  maxLength={100}
                  onPressEnter={sendMessage}
                  disabled={!isConnected}
                />
                <Button
                  type="primary"
                  onClick={sendMessage}
                  disabled={!isConnected || !messageInput.trim()}
                >
                  发送
                </Button>
              </div>

              <div className="color-row">
                <span>颜色:</span>
                <div className="color-picker">
                  {COLOR_OPTIONS.map(color => (
                    <div
                      key={color}
                      className={`color-option ${selectedColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="connection-status">
              <Tag color={isConnected ? 'success' : 'error'}>
                {isConnected ? '已连接' : '连接中...'}
              </Tag>
            </div>
          </div>
        </div>
      )}

      {/* 弹幕控制按钮组 */}
      {!showControls && (
        <div className="danmaku-controls">
          <Button
            className="danmaku-main-btn"
            type="primary"
            icon={<MessageOutlined />}
            onClick={() => setShowControls(true)}
          >
            弹幕聊天
          </Button>

          <Button
            className="danmaku-visibility-btn"
            shape="circle"
            onClick={toggleVisibility}
            title={isVisible ? '隐藏弹幕' : '显示弹幕'}
            type={isVisible ? 'default' : 'primary'}
          >
            <span className="visibility-icon">{isVisible ? '⏸' : '▶'}</span>
          </Button>
        </div>
      )}
    </div>
  )
}
