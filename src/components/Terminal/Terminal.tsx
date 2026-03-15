import { useState, useEffect, useRef, useCallback } from 'react'
import { Select, Button } from 'antd'
import { ControlOutlined } from '@ant-design/icons'
import { Terminal as XTerminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { io, Socket } from 'socket.io-client'
import 'xterm/css/xterm.css'
import './Terminal.css'

// ==================== 常量 ====================

const FONT_SIZES = [12, 14, 16, 18, 20]
const FONT_FAMILIES = ['Monaco', 'Consolas', 'Menlo', 'Courier New', 'monospace']
const MAX_RECONNECT_ATTEMPTS = 3

const TERMINAL_THEME = {
  background: '#1a1b26',
  foreground: '#c0caf5',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: '#3d59a1',
  black: '#414868',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#c0caf5',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5'
}

const ARROW_KEY_MAP: Record<string, string> = {
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D'
}

const DESKTOP_COMMAND_SECTIONS = [
  {
    title: '基础操作',
    commands: ['ls -la', 'll', 'pwd', 'clear', 'cd ..', 'cd ~']
  },
  {
    title: '文件操作',
    commands: ['mkdir ', 'touch ', 'cp ', 'mv ', 'rm ', 'chmod ']
  },
  {
    title: '系统信息',
    commands: ['ps aux', 'top', 'htop', 'df -h', 'free -h', 'uptime']
  },
  {
    title: '网络工具',
    commands: ['ping ', 'wget ', 'curl ', 'netstat -tulpn', 'ss -tulpn', 'ifconfig']
  },
  {
    title: '开发工具',
    commands: ['git status', 'git log --oneline', 'docker ps', 'docker images', 'npm -v', 'python3 --version']
  },
  {
    title: 'GPU监控',
    commands: ['nvidia-smi', 'nvitop', 'gpustat', 'watch -n 1 nvidia-smi']
  }
]

const MOBILE_QUICK_COMMANDS = ['ls -la', 'pwd', 'clear', 'cd ..', 'cd ~', 'nvidia-smi']

// ==================== 类型 ====================

interface TerminalProps {
  serverId: number | string
  containerId?: number | string | null
  authToken: string
  targetHost?: string
  targetPort?: number | string
  loginUsername?: string
  onClose?: () => void
  onError?: (message: string) => void
}

// ==================== 移动端检测 ====================

function detectMobile(): boolean {
  const userAgent = navigator.userAgent || (navigator as any).vendor || (window as any).opera
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isSmallScreen = window.innerWidth <= 768
  return isMobileDevice || (isTouchDevice && isSmallScreen)
}

// ==================== 组件 ====================

export default function Terminal({
  serverId,
  containerId = null,
  authToken,
  targetHost = '',
  targetPort = '',
  loginUsername = '',
  onClose,
  onError
}: TerminalProps) {
  // ---------- 状态 ----------
  const [fontSize, setFontSize] = useState(16)
  const [fontFamily, setFontFamily] = useState('Monaco')
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileToolbar, setShowMobileToolbar] = useState(false)
  const [showDesktopToolbar, setShowDesktopToolbar] = useState(false)

  // ---------- Refs ----------
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const isConnectedRef = useRef(false)
  const isAuthenticatedRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)

  // fontSize / fontFamily 同步到 ref（供回调使用）
  const fontSizeRef = useRef(fontSize)
  fontSizeRef.current = fontSize
  const fontFamilyRef = useRef(fontFamily)
  fontFamilyRef.current = fontFamily

  // ---------- 工具方法 ----------

  const emitInput = useCallback((data: string) => {
    if (isConnectedRef.current && socketRef.current?.connected) {
      socketRef.current.emit('input', data)
    }
  }, [])

  const fitTerminal = useCallback(() => {
    if (!fitAddonRef.current) return
    try {
      fitAddonRef.current.fit()
      if (isConnectedRef.current && socketRef.current?.connected && terminalRef.current) {
        const { cols, rows } = terminalRef.current
        socketRef.current.emit('resize', { cols, rows })
      }
    } catch { /* ignore */ }
  }, [])

  const calculateTerminalHeight = useCallback(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.style.height = '100%'
    }
  }, [])

  const handleResize = useCallback(() => {
    calculateTerminalHeight()
    setTimeout(() => fitTerminal(), 50)
  }, [calculateTerminalHeight, fitTerminal])

  // ---------- 终端设置 ----------

  const applyTerminalSettings = useCallback((newFontSize?: number, newFontFamily?: string) => {
    const term = terminalRef.current
    if (!term) return

    term.options.fontSize = newFontSize ?? fontSizeRef.current
    term.options.fontFamily = newFontFamily ?? fontFamilyRef.current

    setTimeout(() => fitTerminal(), 100)
  }, [fitTerminal])

  const handleFontSizeChange = useCallback((value: number) => {
    setFontSize(value)
    applyTerminalSettings(value, undefined)
  }, [applyTerminalSettings])

  const handleFontFamilyChange = useCallback((value: string) => {
    setFontFamily(value)
    applyTerminalSettings(undefined, value)
  }, [applyTerminalSettings])

  const increaseFontSize = useCallback(() => {
    if (fontSizeRef.current < 24) {
      const newSize = fontSizeRef.current + 2
      setFontSize(newSize)
      applyTerminalSettings(newSize, undefined)
    }
  }, [applyTerminalSettings])

  const decreaseFontSize = useCallback(() => {
    if (fontSizeRef.current > 10) {
      const newSize = fontSizeRef.current - 2
      setFontSize(newSize)
      applyTerminalSettings(newSize, undefined)
    }
  }, [applyTerminalSettings])

  // ---------- 工具栏切换 ----------

  const toggleToolbar = useCallback((mobile: boolean) => {
    if (mobile) {
      setShowMobileToolbar(prev => !prev)
    } else {
      setShowDesktopToolbar(prev => !prev)
    }
    setTimeout(() => {
      calculateTerminalHeight()
      fitTerminal()
    }, 100)
  }, [calculateTerminalHeight, fitTerminal])

  // ---------- 快捷键发送 ----------

  const sendArrowKey = useCallback((direction: string) => {
    const key = ARROW_KEY_MAP[direction]
    if (key) emitInput(key)
  }, [emitInput])

  const sendEscape = useCallback(() => emitInput('\x1b'), [emitInput])
  const sendCtrlC = useCallback(() => emitInput('\x03'), [emitInput])
  const sendTab = useCallback(() => emitInput('\t'), [emitInput])
  const sendEnter = useCallback(() => emitInput('\r'), [emitInput])

  const sendCommand = useCallback((command: string) => {
    emitInput(command + '\r')
  }, [emitInput])

  // ---------- 初始化 + 清理 ----------

  useEffect(() => {
    setIsMobile(detectMobile())

    if (!terminalContainerRef.current) return

    // 创建终端
    const term = new XTerminal({
      cursorBlink: true,
      fontSize: fontSizeRef.current,
      fontFamily: fontFamilyRef.current,
      theme: TERMINAL_THEME,
      allowTransparency: true,
      scrollback: 1500,
      cols: 100,
      rows: 30,
      smoothScrollDuration: 300
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalContainerRef.current)
    fitAddon.fit()

    terminalRef.current = term
    fitAddonRef.current = fitAddon

    // 创建 Socket.IO 连接
    const socket = io('/ssh-terminal', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      timeout: 30000,
      withCredentials: true
    })

    socketRef.current = socket

    // ===== Socket 事件 =====

    socket.on('connect', () => {
      reconnectAttemptsRef.current = 0

      // 发送认证
      const payload: any = {
        token: authToken,
        server_id: serverId
      }
      if (containerId) payload.container_id = containerId
      if (targetHost) payload.target_host = targetHost
      if (targetPort) payload.target_port = targetPort
      if (loginUsername) payload.login_username = loginUsername

      socket.emit('authenticate', payload)
    })

    socket.on('connect_error', (error) => {
      console.error('WebSocket连接错误:', error)
      reconnectAttemptsRef.current++
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        onError?.('无法连接到终端服务器')
      }
    })

    socket.on('disconnect', () => {
      isConnectedRef.current = false
      isAuthenticatedRef.current = false
    })

    socket.on('authenticated', () => {
      isAuthenticatedRef.current = true
    })

    socket.on('connecting', () => { /* noop */ })

    socket.on('terminal_ready', () => { /* noop */ })

    socket.on('connected', () => {
      isConnectedRef.current = true

      // 用户输入 → 服务器
      term.onData((input) => {
        if (isConnectedRef.current && socket.connected) {
          socket.emit('input', input)
        }
      })

      // 调整终端大小
      setTimeout(() => {
        if (terminalContainerRef.current) {
          terminalContainerRef.current.style.height = '100%'
        }
        try {
          fitAddon.fit()
          if (socket.connected) {
            socket.emit('resize', { cols: term.cols, rows: term.rows })
          }
        } catch { /* ignore */ }
      }, 200)
    })

    socket.on('output', (data: any) => {
      if (data?.data) {
        term.write(data.data)
      }
    })

    socket.on('disconnected', () => {
      isConnectedRef.current = false
    })

    socket.on('error', (data: any) => {
      console.error('终端错误:', data)
      term.writeln(`\r\n❌ 错误: ${data.message}`)
      onError?.(data.message)
    })

    // ===== 事件监听 =====

    const onResize = () => {
      setIsMobile(detectMobile())
      if (terminalContainerRef.current) {
        terminalContainerRef.current.style.height = '100%'
      }
      try {
        fitAddon.fit()
        if (isConnectedRef.current && socket.connected) {
          socket.emit('resize', { cols: term.cols, rows: term.rows })
        }
      } catch { /* ignore */ }
    }

    const onTerminalContainerResize = () => onResize()

    window.addEventListener('resize', onResize)
    window.addEventListener('terminal-container-resize', onTerminalContainerResize)

    // 初始化后延迟 fit
    const initTimer = setTimeout(() => {
      if (terminalContainerRef.current) {
        terminalContainerRef.current.style.height = '100%'
      }
      try { fitAddon.fit() } catch { /* ignore */ }
    }, 300)

    // ===== 清理 =====
    return () => {
      clearTimeout(initTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('terminal-container-resize', onTerminalContainerResize)

      // 断开 socket
      if (socket.connected) {
        socket.disconnect()
      }
      socketRef.current = null

      // 释放 fitAddon
      try {
        const disposables = (fitAddon as any)._disposables
        if (disposables && Array.isArray(disposables) && disposables.length > 0) {
          fitAddon.dispose()
        }
      } catch { /* ignore */ }
      fitAddonRef.current = null

      // 释放终端
      try {
        if ((term as any)._core && (term as any)._initialized) {
          term.dispose()
        }
      } catch { /* ignore */ }
      terminalRef.current = null

      isConnectedRef.current = false
      isAuthenticatedRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== 渲染 ====================

  return (
    <div className="terminal-wrapper">
      {/* 顶部工具栏 */}
      <div className="terminal-toolbar">
        <div className="terminal-settings">
          <Select
            value={fontSize}
            onChange={handleFontSizeChange}
            size="small"
            style={{ width: 120 }}
            options={FONT_SIZES.map(s => ({ label: `${s}px`, value: s }))}
          />
          <Select
            value={fontFamily}
            onChange={handleFontFamilyChange}
            size="small"
            style={{ width: 140 }}
            options={FONT_FAMILIES.map(f => ({ label: f, value: f }))}
          />
        </div>
        <div className="font-size-controls">
          <Button size="small" onClick={decreaseFontSize} disabled={fontSize <= 10}>A-</Button>
          <Button size="small" onClick={increaseFontSize} disabled={fontSize >= 24}>A+</Button>
          {isMobile ? (
            <Button
              size="small"
              onClick={() => toggleToolbar(true)}
              type={showMobileToolbar ? 'primary' : 'default'}
              icon={<ControlOutlined />}
            />
          ) : (
            <Button
              size="small"
              onClick={() => toggleToolbar(false)}
              type={showDesktopToolbar ? 'primary' : 'default'}
              icon={<ControlOutlined />}
            >
              命令
            </Button>
          )}
        </div>
      </div>

      {/* 移动端快捷键工具栏 */}
      {isMobile && showMobileToolbar && (
        <div className="mobile-toolbar-compact">
          <div className="toolbar-row">
            <div className="direction-compact">
              <Button onClick={() => sendArrowKey('up')} className="compact-btn direction-btn">↑</Button>
              <div className="direction-lr">
                <Button onClick={() => sendArrowKey('left')} className="compact-btn direction-btn">←</Button>
                <Button onClick={() => sendArrowKey('right')} className="compact-btn direction-btn">→</Button>
              </div>
              <Button onClick={() => sendArrowKey('down')} className="compact-btn direction-btn">↓</Button>
            </div>
            <div className="control-compact">
              <Button onClick={sendEscape} className="compact-btn escape-btn">ESC</Button>
              <Button onClick={sendCtrlC} className="compact-btn ctrl-btn">Ctrl+C</Button>
              <Button onClick={sendTab} className="compact-btn">Tab</Button>
              <Button onClick={sendEnter} className="compact-btn">Enter</Button>
            </div>
          </div>
          <div className="toolbar-row">
            <div className="commands-compact">
              {MOBILE_QUICK_COMMANDS.map(cmd => (
                <Button
                  key={cmd}
                  onClick={() => sendCommand(cmd)}
                  className="compact-btn cmd-btn"
                >
                  {cmd}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 桌面端命令工具栏 */}
      {!isMobile && showDesktopToolbar && (
        <div className="desktop-toolbar">
          <div className="command-sections">
            {DESKTOP_COMMAND_SECTIONS.map(section => (
              <div key={section.title} className="command-section">
                <span className="section-title">{section.title}</span>
                <div className="command-buttons">
                  {section.commands.map(cmd => (
                    <Button
                      key={cmd}
                      size="small"
                      onClick={() => sendCommand(cmd)}
                      className="cmd-btn"
                    >
                      {cmd.trim() || cmd}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 终端容器 */}
      <div ref={terminalContainerRef} className="terminal-container" />
    </div>
  )
}
