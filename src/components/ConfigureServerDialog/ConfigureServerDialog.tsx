import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Modal, Form, Input, Switch, Card, Tag, Space, Button, Alert, Tooltip, Divider, Row, Col, message
} from 'antd'
import {
  KeyOutlined, SettingOutlined, RocketOutlined, GlobalOutlined,
  ReloadOutlined, CopyOutlined, LinkOutlined, DownloadOutlined,
  ClockCircleOutlined, BellOutlined
} from '@ant-design/icons'
import { generateSetup, reset as resetSetup, selectSetupResult, selectSetupLoading, selectSetupError } from '../../store/serverSetupSlice'
import type { AppDispatch } from '../../store'
import './ConfigureServerDialog.css'

interface Props {
  open: boolean
  onClose: () => void
}

const DEFAULT_SSH_KEY = ''
const DEFAULT_TORCH_URL = 'http://10.160.109.128:5000/share.cgi?ssid=c9066b12c89947a88c0fb639632d5b5e&ep=&path=%2F&filename=torch2.tar&openfolder=normal&fid=torch2.tar'
const DEFAULT_TORCH_SHA = '52af54f32508874de8b1a28373e33aa37ef9e27f71c047c86cf1d155f80d304a'
const DEFAULT_IP_ENDPOINT = 'https://ip.myzr.site/get-ip'
const DEFAULT_ENTRY_NAME = 'ip.dns.com'

const SHORTURL_API = '/api/shorturl/generate'

const baseModules = [
  { label: '系统初始化', color: 'blue', description: '创建 Apps 目录、调整权限，保证后续脚本写入位置一致。' },
  { label: '禁用自动更新', color: 'orange', description: '锁定内核版本，关闭 unattended-upgrades 与自动更新计划任务。' },
  { label: '更换 apt 源', color: 'blue', description: '将 apt 源替换为清华镜像，加速软件包下载。' },
  { label: '基础软件安装', color: 'green', description: '安装 vim、curl、git、net-tools、build-essential 等常用工具。' },
  { label: 'NVIDIA 显卡驱动', color: 'orange', description: '自动检测并安装最新的 NVIDIA 显卡驱动，为 GPU 计算提供基础支持。' },
  { label: 'Docker 与 GPU 支持', color: 'green', description: '自动安装 Docker、配置 GPU runtime（nvidia-container-toolkit）并启用服务。' },
  { label: 'Miniconda 基础环境', color: 'green', description: '下载并安装最新 Miniconda，初始化环境以便后续 Python/GPU 依赖管理。' },
  { label: 'SSH 公钥配置', color: 'blue', description: '将填写的公钥写入 ~/.ssh/authorized_keys，保障远程免密登录。' },
  { label: 'sudo 免密命令', color: 'blue', description: '为常用运维命令生成 sudoers 免密规则。' },
  { label: '系统日志提醒', color: 'green', description: '在脚本结尾输出完成提示及运维注意事项。' }
]

function getDefaultForm() {
  return {
    sshPublicKey: DEFAULT_SSH_KEY,
    installOhMyZsh: true,
    installMiniconda: true,
    installRustdesk: false,
    installWireguard: false,
    loadTorchImage: false,
    wireguardConfig: '',
    updateIpEnabled: true,
    updateIpEntryName: DEFAULT_ENTRY_NAME,
    updateIpIpEndpoint: DEFAULT_IP_ENDPOINT,
    updateIpAuthUser: '',
    updateIpAuthPassword: '',
    updateIpWgInterface: 'wg-dns',
    updateIpCron: '* * * * *',
    updateIpBarkEnabled: false,
    updateIpBarkUrl: '',
    updateIpBarkGroup: '',
    updateIpBarkIcon: '',
    torchImageUrl: DEFAULT_TORCH_URL,
    torchImageSha256: DEFAULT_TORCH_SHA
  }
}

export default function ConfigureServerDialog({ open, onClose }: Props) {
  const dispatch = useDispatch<AppDispatch>()
  const [form] = Form.useForm()
  const result = useSelector(selectSetupResult)
  const loading = useSelector(selectSetupLoading)
  const errorMessage = useSelector(selectSetupError)

  // 短链接状态
  const [shortUrl, setShortUrl] = useState('')
  const [shortUrlLoading, setShortUrlLoading] = useState(false)
  const [shortUrlError, setShortUrlError] = useState('')

  // 监听表单字段
  const installWireguard = Form.useWatch('installWireguard', form)
  const loadTorchImage = Form.useWatch('loadTorchImage', form)
  const updateIpEnabled = Form.useWatch('updateIpEnabled', form)
  const updateIpBarkEnabled = Form.useWatch('updateIpBarkEnabled', form)

  // 打开时重置
  useEffect(() => {
    if (open) {
      dispatch(resetSetup())
      setShortUrl('')
      setShortUrlError('')
      form.setFieldsValue(getDefaultForm())
    }
  }, [open])

  // ==================== 计算属性 ====================

  const resourceList = useMemo(() => result?.resources || [], [result])

  const enabledModules = useMemo(() => {
    const opts = result?.options || {}
    const mapping = [
      { key: 'install_ohmyzsh', label: 'oh-my-zsh' },
      { key: 'install_miniconda', label: 'Miniconda' },
      { key: 'install_rustdesk', label: 'RustDesk' },
      { key: 'install_wireguard', label: 'WireGuard' },
      { key: 'update_ip_enabled', label: 'Update-IP' },
      { key: 'load_torch_image', label: 'torch2 镜像' }
    ]
    return mapping.filter(item => opts[item.key])
  }, [result])

  const expiresAt = useMemo(() => {
    if (!result?.expires_at) return '未知'
    const date = new Date(result.expires_at)
    return isNaN(date.getTime()) ? result.expires_at : date.toLocaleString()
  }, [result])

  const wgetCommand = useMemo(() => {
    if (!result?.install_command) return ''
    const cmd = result.install_command.trim()
    const patterns = [
      /^curl\s+(-[fsSL]+)\s+([^\s|]+)(\s*\|\s*.+)?$/,
      /^curl\s+((?:-[a-zA-Z]+\s*)*)\s*([^\s|]+)(\s*\|\s*.+)?$/
    ]
    for (const pattern of patterns) {
      const match = cmd.match(pattern)
      if (match) {
        const url = match[2]
        const pipeline = match[3] || ''
        return `wget -qO- ${url}${pipeline}`
      }
    }
    return cmd.replace(/curl\s+-[fsSL]+/g, 'wget -qO-').replace(/curl\s+/g, 'wget -qO- ')
  }, [result])

  const shortCurlCommand = useMemo(() => {
    if (!shortUrl || !result?.install_command) return ''
    return result.install_command.replace(/https?:\/\/[^\s|]+/, shortUrl)
  }, [shortUrl, result])

  const shortWgetCommand = useMemo(() => {
    if (!shortUrl || !wgetCommand) return ''
    return wgetCommand.replace(/https?:\/\/[^\s|]+/, shortUrl)
  }, [shortUrl, wgetCommand])

  // ==================== 操作 ====================

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('复制成功')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }, [])

  const generateShortUrl = useCallback(async () => {
    if (!result?.script_url) {
      message.error('请先生成脚本')
      return
    }
    setShortUrlLoading(true)
    setShortUrlError('')
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('未登录，请重新登录')

      const response = await fetch(SHORTURL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: result.script_url, title: '服务器一键配置脚本' })
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const data = await response.json()
      if (data.code === 'success' && data.data?.shorturl) {
        setShortUrl(data.data.shorturl)
        message.success(data.data.is_existing ? '获取已存在的短链接' : '短链接生成成功')
      } else {
        throw new Error(data.msg || '短链接生成失败')
      }
    } catch (error: any) {
      setShortUrlError(error.message)
      message.error(`短链接生成失败: ${error.message}`)
    } finally {
      setShortUrlLoading(false)
    }
  }, [result])

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields()

      // 自定义验证
      if (!values.sshPublicKey?.trim()) {
        message.error('请填写 SSH 公钥')
        return
      }
      if (values.installWireguard && !values.wireguardConfig?.trim()) {
        message.error('请粘贴完整的 WireGuard 配置')
        return
      }
      if (values.installWireguard && values.updateIpEnabled) {
        if (!values.updateIpEntryName?.trim()) { message.error('请填写 Update-IP 的域名条目'); return }
        if (!values.updateIpIpEndpoint?.trim()) { message.error('请填写 Update-IP 的获取接口'); return }
        if (values.updateIpBarkEnabled && !values.updateIpBarkUrl?.trim()) {
          message.error('启用 Bark 推送时需要提供 Bark URL'); return
        }
      }
      if (values.loadTorchImage && !values.torchImageUrl?.trim()) {
        message.error('请提供 torch2 镜像的下载地址')
        return
      }

      // 构建 payload
      const payload: any = {
        sshPublicKey: values.sshPublicKey.trim(),
        installOhMyZsh: values.installOhMyZsh,
        installMiniconda: values.installMiniconda,
        installRustdesk: values.installRustdesk,
        installWireguard: values.installWireguard,
        loadTorchImage: values.loadTorchImage,
        wireguardConfig: (values.wireguardConfig || '').trim()
      }

      if (values.installWireguard) {
        payload.updateIp = {
          enabled: values.updateIpEnabled,
          entryName: (values.updateIpEntryName || '').trim(),
          ipEndpoint: (values.updateIpIpEndpoint || '').trim(),
          authUser: (values.updateIpAuthUser || '').trim(),
          authPassword: values.updateIpAuthPassword || '',
          wgInterface: (values.updateIpWgInterface || '').trim() || 'wg-dns',
          cron: (values.updateIpCron || '').trim() || '* * * * *',
          barkEnabled: values.updateIpBarkEnabled,
          barkUrl: (values.updateIpBarkUrl || '').trim(),
          barkGroup: (values.updateIpBarkGroup || '').trim() || 'WG服务',
          barkIcon: (values.updateIpBarkIcon || '').trim()
        }
      }

      if (values.loadTorchImage) {
        payload.torchImage = {
          url: values.torchImageUrl.trim(),
          sha256: (values.torchImageSha256 || '').trim()
        }
      }

      await dispatch(generateSetup(payload)).unwrap()
      message.success('脚本生成成功，可复制指令或下载脚本')
    } catch (error: any) {
      if (error?.message) message.error(error.message)
    }
  }, [dispatch, form])

  const handleClosed = useCallback(() => {
    form.resetFields()
    dispatch(resetSetup())
    setShortUrl('')
    setShortUrlError('')
    onClose()
  }, [dispatch, form, onClose])

  // ==================== 渲染 ====================

  return (
    <Modal
      title="🖥️ 生成服务器一键配置脚本"
      open={open}
      onCancel={handleClosed}
      width="65%"
      maskClosable={false}
      className="server-config-dialog"
      destroyOnClose
      footer={
        <div className="dialog-footer">
          <Button size="large" onClick={handleClosed} className="cancel-btn">
            ❌ 取消
          </Button>
          <Button type="primary" size="large" loading={loading} onClick={handleSubmit} className="submit-btn">
            {result ? '🔄 重新生成' : '🚀 生成脚本'}
          </Button>
        </div>
      }
    >
      <div className="configure-dialog">
        <Alert
          type="warning" showIcon closable={false} className="mb-16 warning-alert"
          message="⚠️ 推荐在 Ubuntu 22.04 桌面版环境下使用，其他版本尚未充分验证，请谨慎操作"
        />
        <Alert
          type="info" showIcon className="mb-16 info-alert"
          message="⏰ 脚本有效期 2 小时，失效后可重新生成"
        />

        <Form form={form} layout="horizontal" labelCol={{ span: 6 }} labelAlign="left"
          initialValues={getDefaultForm()} className="config-form">

          {/* ========== 固定步骤 ========== */}
          <Card hoverable className="section-card base-section"
            title={<div className="section-header"><span className="section-icon">⚙️</span><span className="section-title">固定步骤（默认执行）</span></div>}>
            <p className="section-intro">这些步骤为脚本的必备流程，确保系统初始化、Docker 环境和 sudo 免密等能力。</p>
            <Space wrap className="mb-12">
              {baseModules.map((item) => (
                <Tooltip key={item.label} title={item.description}>
                  <Tag color={item.color}>{item.label}</Tag>
                </Tooltip>
              ))}
            </Space>
            <Form.Item name="sshPublicKey" label="服务器 SSH 公钥"
              rules={[{ required: true, message: '请填写 SSH 公钥' }]}>
              <Input.TextArea rows={4} placeholder="粘贴或使用默认 SSH 公钥" />
            </Form.Item>
            <div className="form-tip">脚本会将该公钥写入目标用户的 ~/.ssh/authorized_keys，后续可安全登录。</div>
          </Card>

          {/* ========== 增强组件 ========== */}
          <Card hoverable className="section-card enhance-section"
            title={<div className="section-header"><span className="section-icon">⭐</span><span className="section-title">增强组件（可选）</span></div>}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="installOhMyZsh" label="🛠️ 安装 oh-my-zsh" valuePropName="checked" className="switch-item">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="installRustdesk" label="🖥️ 安装 RustDesk" valuePropName="checked" className="switch-item">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="loadTorchImage" label="🔥 下载 torch2 镜像" valuePropName="checked" className="switch-item">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            {loadTorchImage && (
              <Card size="small" className="sub-card"
                title={<div className="sub-header"><span className="sub-icon">🔥</span><span>torch2 镜像配置</span></div>}>
                <Form.Item name="torchImageUrl" label="下载地址" rules={[{ required: true, message: '请提供下载地址' }]}>
                  <Input placeholder="填写镜像下载链接" />
                </Form.Item>
                <Form.Item name="torchImageSha256" label="SHA256 校验">
                  <Input placeholder="可选，留空则跳过校验" />
                </Form.Item>
              </Card>
            )}
          </Card>

          {/* ========== WireGuard ========== */}
          <Card hoverable className="section-card network-section"
            title={
              <div className="card-header">
                <div className="section-header">
                  <span className="section-icon">🌐</span>
                  <span className="section-title">WireGuard 与 Update-IP</span>
                </div>
                <Form.Item name="installWireguard" valuePropName="checked" noStyle>
                  <Switch />
                </Form.Item>
              </div>
            }>
            <p className="section-intro">开启后可一次性写入 WireGuard 配置并自动部署 Update-IP 脚本。</p>

            {installWireguard && (
              <div className="wireguard-block">
                <Form.Item name="wireguardConfig" label="WireGuard 配置"
                  rules={[{ required: true, message: '请粘贴完整的 WireGuard 配置' }]}>
                  <Input.TextArea rows={12} placeholder="粘贴完整的 WireGuard 配置文本" />
                </Form.Item>

                <Card size="small" className="sub-card"
                  title={
                    <div className="card-header">
                      <div className="sub-header"><span className="sub-icon">🔄</span><span>Update-IP 配置</span></div>
                      <Form.Item name="updateIpEnabled" valuePropName="checked" noStyle>
                        <Switch />
                      </Form.Item>
                    </div>
                  }>
                  {updateIpEnabled && (
                    <div className="update-ip-column">
                      <Form.Item name="updateIpEntryName" label="域名条目" rules={[{ required: true, message: '请填写域名条目' }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="updateIpIpEndpoint" label="获取接口" rules={[{ required: true, message: '请填写获取接口' }]}>
                        <Input.TextArea rows={2} />
                      </Form.Item>
                      <Form.Item name="updateIpAuthUser" label="接口用户名">
                        <Input placeholder="可选" />
                      </Form.Item>
                      <Form.Item name="updateIpAuthPassword" label="接口密码">
                        <Input placeholder="可选" />
                      </Form.Item>
                      <Form.Item name="updateIpWgInterface" label="WireGuard 接口">
                        <Input />
                      </Form.Item>
                      <Form.Item name="updateIpCron" label="执行频率 (cron)">
                        <Input />
                      </Form.Item>

                      <Divider orientation="vertical">Bark 推送</Divider>
                      <Form.Item name="updateIpBarkEnabled" label="启用 Bark 推送" valuePropName="checked">
                        <Switch />
                      </Form.Item>

                      {updateIpBarkEnabled && (
                        <div className="update-ip-column">
                          <Form.Item name="updateIpBarkUrl" label="Bark URL"
                            rules={[{ required: true, message: '请提供 Bark URL' }]}>
                            <Input.TextArea rows={2} />
                          </Form.Item>
                          <Form.Item name="updateIpBarkGroup" label="通知分组">
                            <Input />
                          </Form.Item>
                          <Form.Item name="updateIpBarkIcon" label="通知图标">
                            <Input.TextArea rows={2} placeholder="可选" />
                          </Form.Item>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </Card>
        </Form>

        {/* 错误提示 */}
        {errorMessage && (
          <Alert type="error" closable={false} showIcon message={errorMessage} className="mb-16" />
        )}

        {/* ========== 生成结果 ========== */}
        {result && (
          <Card className="result-card"
            title={
              <div className="card-header">
                <div className="section-header">
                  <span className="section-icon">✅</span>
                  <span className="section-title">生成结果</span>
                </div>
                <Tag color="success">⏱️ 有效期至 {expiresAt}</Tag>
              </div>
            }>

            {/* 短链接命令 */}
            {shortUrl ? (
              <div className="command-section short-command-section">
                <ResultCommand
                  label="🚀 短链接一键指令（curl版本）"
                  value={shortCurlCommand}
                  onCopy={() => copy(shortCurlCommand)}
                  tip="✨ 短链接版本，链接更简洁 (curl -fsSL)"
                  tipClass="success-tip"
                />
                <ResultCommand
                  label="🚀 短链接一键指令（wget版本）"
                  value={shortWgetCommand}
                  onCopy={() => copy(shortWgetCommand)}
                  tip="✨ 短链接版本，链接更简洁 (wget -qO-)"
                  tipClass="success-tip"
                />
                <Divider>
                  <Button type="text" onClick={() => setShortUrl('')} className="show-original-btn">
                    📋 显示原始链接命令
                  </Button>
                </Divider>
              </div>
            ) : (
              <div className="command-section">
                <ResultCommand
                  label="一键指令（curl版本）"
                  value={result.install_command}
                  onCopy={() => copy(result.install_command)}
                  tip="💡 适用于已安装curl的服务器 (curl -fsSL)"
                />
                <ResultCommand
                  label="一键指令（wget版本）"
                  value={wgetCommand}
                  onCopy={() => copy(wgetCommand)}
                  tip="💡 适用于未安装curl但有wget的服务器 (wget -qO-) - 大多数Linux发行版默认包含"
                />
              </div>
            )}

            {/* 固定步骤标签 */}
            <div className="result-block">
              <div className="result-label">固定步骤</div>
              <Space wrap>
                {baseModules.map((item) => (
                  <Tooltip key={item.label} title={item.description}>
                    <Tag color={item.color}>{item.label}</Tag>
                  </Tooltip>
                ))}
              </Space>
            </div>

            {/* 脚本下载 */}
            <div className="result-block">
              <div className="result-label">脚本下载</div>
              <div className="script-url-row">
                <a href={result.script_url} target="_blank" rel="noopener noreferrer" className="script-url-link">
                  {result.script_url}
                </a>
                <div className="url-actions">
                  <Button type="primary" onClick={() => copy(result.script_url)}>复制链接</Button>
                  <Button loading={shortUrlLoading} onClick={generateShortUrl}
                    style={{ color: '#e6a23c', borderColor: '#e6a23c' }}>
                    🔗 {shortUrl ? '重新获取' : '获取短链接'}
                  </Button>
                </div>
              </div>

              {shortUrl && (
                <div className="short-url-display">
                  <div className="result-label short-url-label">短链接</div>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input value={shortUrl} readOnly className="short-url-input" />
                    <Button type="primary" onClick={() => copy(shortUrl)}>复制</Button>
                  </Space.Compact>
                </div>
              )}

              {shortUrlError && (
                <Alert type="error" message={shortUrlError} showIcon closable={false} className="short-url-error" />
              )}
            </div>

            {/* 依赖资源 */}
            {resourceList.length > 0 && (
              <div className="result-block">
                <div className="result-label">依赖资源</div>
                <Space wrap>
                  {resourceList.map((item: any) => (
                    <Tag key={item.name} color="blue">
                      <a href={item.url} target="_blank" rel="noopener noreferrer">{item.name}</a>
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* SSH 公钥 */}
            <div className="result-block">
              <div className="result-label">SSH 公钥</div>
              <Space.Compact style={{ width: '100%' }}>
                <Input.TextArea value={form.getFieldValue('sshPublicKey')} readOnly rows={3} style={{ flex: 1 }} />
                <Button type="primary" onClick={() => copy(form.getFieldValue('sshPublicKey'))}>复制</Button>
              </Space.Compact>
            </div>

            {/* 启用模块 */}
            <div className="result-block">
              <div className="result-label">启用模块</div>
              <Space wrap>
                {enabledModules.map((item) => (
                  <Tag key={item.label} color="green">{item.label}</Tag>
                ))}
              </Space>
            </div>

            {/* Torch 镜像 */}
            {result.torch_image && (
              <div className="result-block">
                <div className="result-label">Torch 镜像</div>
                <div className="torch-info">
                  <div>下载地址：<a href={result.torch_image.url} target="_blank" rel="noopener noreferrer">{result.torch_image.url}</a></div>
                  {result.torch_image.sha256 && <div>SHA256：{result.torch_image.sha256}</div>}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </Modal>
  )
}

// ==================== 子组件：结果命令行 ====================

function ResultCommand({ label, value, onCopy, tip, tipClass }: {
  label: string; value: string; onCopy: () => void; tip: string; tipClass?: string
}) {
  return (
    <div className="result-block">
      <div className="result-label">{label}</div>
      <Space.Compact style={{ width: '100%' }}>
        <Input value={value} readOnly style={{ flex: 1 }} />
        <Button type="primary" onClick={onCopy} className="copy-btn">复制</Button>
      </Space.Compact>
      <div className={`command-tip ${tipClass || ''}`}>{tip}</div>
    </div>
  )
}
