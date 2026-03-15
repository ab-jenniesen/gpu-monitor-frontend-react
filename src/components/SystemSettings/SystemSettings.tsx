import { useState, useEffect, useMemo, forwardRef } from 'react'
import {
  Card, Form, Input, InputNumber, Button, Switch, Select, Table, Tag,
  Space, Alert, Empty, Skeleton, Checkbox, Modal, Radio, Tabs
} from 'antd'
import {
  InfoCircleOutlined, WarningOutlined, DownloadOutlined, UploadOutlined,
  SettingOutlined, FolderOpenOutlined, ClockCircleOutlined,
  EditOutlined, DeleteOutlined
} from '@ant-design/icons'
import axios from '../../utils/axios'
import { message } from 'antd'
import { useBackupManagement, formatConfigLabel, formatFileSize } from '../../hooks/useBackupManagement'
import MarkdownIt from 'markdown-it'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import './SystemSettings.css'

const md = new MarkdownIt({ html: true, linkify: true, typographer: true })

const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    ['blockquote', 'code-block'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    ['link'],
    ['clean']
  ]
}

const SystemSettings = forwardRef((_props, _ref) => {
  const isSuperAdmin = useMemo(
    () => localStorage.getItem('username') === 'admin' && localStorage.getItem('userRole') === 'admin',
    []
  )

  // ==================== 站点设置 ====================

  const [siteLoading, setSiteLoading] = useState(false)
  const [siteForm, setSiteForm] = useState({
    siteName: 'GPU共享服务平台',
    siteLogo: 'https://lank.myzr.org:88/i/2024/05/29/66571d8de15ea.png',
    siteSubtitle: '高效、安全的资源管理平台',
    serverUrl: window.location.origin,
    loginTipMd: ''
  })
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')

  const fetchSiteSettings = async () => {
    setSiteLoading(true)
    try {
      const resp = await axios.get('/api/settings/site')
      setSiteForm({
        siteName: resp.data.site_name,
        siteLogo: resp.data.site_logo,
        siteSubtitle: resp.data.site_subtitle,
        serverUrl: resp.data.server_url,
        loginTipMd: resp.data.login_tip_md || ''
      })
    } catch (e) {
      message.error('获取站点设置失败')
    } finally {
      setSiteLoading(false)
    }
  }

  const saveSiteSettings = async () => {
    setSiteLoading(true)
    try {
      await axios.post('/api/settings/site', {
        site_name: siteForm.siteName,
        site_logo: siteForm.siteLogo,
        site_subtitle: siteForm.siteSubtitle,
        server_url: siteForm.serverUrl,
        login_tip_md: siteForm.loginTipMd
      })
      message.success('站点设置已保存')
    } catch (e: any) {
      message.error(e.response?.data?.msg || '保存站点设置失败')
    } finally {
      setSiteLoading(false)
    }
  }

  // ==================== 数据保留策略 ====================

  const [retentionLoading, setRetentionLoading] = useState(false)
  const [dataRetentionHours, setDataRetentionHours] = useState(24)

  const fetchSettings = async () => {
    setRetentionLoading(true)
    try {
      const resp = await axios.get('/api/settings/data_retention')
      setDataRetentionHours(resp.data.data_retention_hours)
    } catch (e) {
      message.error('获取设置失败')
    } finally {
      setRetentionLoading(false)
    }
  }

  const saveSettings = async () => {
    setRetentionLoading(true)
    try {
      await axios.post('/api/settings/data_retention', { data_retention_hours: dataRetentionHours })
      message.success('设置已保存')
    } catch (e: any) {
      message.error(e.response?.data?.msg || '保存设置失败')
    } finally {
      setRetentionLoading(false)
    }
  }

  // ==================== 备份管理 ====================

  const backup = useBackupManagement(isSuperAdmin)

  // ==================== 初始化 ====================

  useEffect(() => {
    fetchSettings()
    fetchSiteSettings()
    if (isSuperAdmin) {
      backup.fetchBackupConfigs()
      backup.fetchScheduleSettings().then(() => {
        backup.startScheduleRefreshTimer()
      })
      backup.loadLocalBackups()
    }
    return () => backup.stopScheduleRefreshTimer()
  }, [])

  // ==================== WebDAV 配置表格列 ====================

  const configColumns = [
    { title: '服务器URL', dataIndex: 'webdav_url', ellipsis: true },
    { title: '用户名', dataIndex: 'webdav_username', width: 160 },
    { title: '根目录', dataIndex: 'webdav_root_path', width: 200 },
    {
      title: '默认', width: 80, align: 'center' as const,
      render: (_: any, r: any) => r.is_default ? <Tag color="green">默认</Tag> : null
    },
    {
      title: '操作', width: 220, align: 'center' as const,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" type="primary" onClick={() => backup.openEditConfigDialog(r)}>编辑</Button>
          <Button size="small" style={{ color: '#52c41a', borderColor: '#52c41a' }}
            disabled={r.is_default} loading={backup.setDefaultLoadingId === r.id}
            onClick={() => backup.setDefaultConfig(r)}>设为默认</Button>
          <Button size="small" danger loading={backup.deleteConfigLoadingId === r.id}
            onClick={() => backup.confirmDeleteConfig(r)}>删除</Button>
        </Space>
      )
    }
  ]

  // ==================== 备份文件表格列 ====================

  const backupFileColumns = (type: string) => [
    { title: '文件名', dataIndex: 'name', ellipsis: true },
    { title: '修改时间', dataIndex: 'modified', width: 200 },
    {
      title: '操作', width: 140,
      render: (_: any, r: any) => (
        <Button size="small" type="primary" loading={backup.restoreBackupLoading}
          onClick={() => backup.restoreFromWebDAV(type, r.name)}>恢复</Button>
      )
    }
  ]

  const localBackupColumns = [
    { title: '文件名', dataIndex: 'name', ellipsis: true },
    { title: '修改时间', dataIndex: 'modified', width: 200 },
    {
      title: '大小', width: 140,
      render: (_: any, r: any) => formatFileSize(r.size)
    },
    {
      title: '操作', width: 200,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" type="primary" loading={backup.restoringLocalName === r.name}
            onClick={() => backup.restoreLocalBackup(r)}>恢复</Button>
          <Button size="small" danger loading={backup.deletingLocalName === r.name}
            onClick={() => backup.deleteLocalBackup(r)}>删除</Button>
        </Space>
      )
    }
  ]

  // ==================== 渲染 ====================

  return (
    <div className="system-settings">

      {/* 站点设置 */}
      <Card title="站点设置" hoverable className="settings-card">
        <Form layout="horizontal" labelCol={{ span: 4 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="站点名称">
            <Input value={siteForm.siteName} maxLength={50} showCount
              onChange={e => setSiteForm(p => ({ ...p, siteName: e.target.value }))}
              placeholder="请输入站点名称" />
            <div className="form-item-help">设置站点名称，将显示在页面标题和登录页面</div>
          </Form.Item>

          <Form.Item label="站点Logo">
            <Input value={siteForm.siteLogo}
              onChange={e => setSiteForm(p => ({ ...p, siteLogo: e.target.value }))}
              placeholder="请输入Logo图片URL" />
            <div className="form-item-help">设置站点Logo的URL地址，建议使用正方形图片</div>
          </Form.Item>

          <Form.Item label="站点副标题">
            <Input value={siteForm.siteSubtitle} maxLength={100} showCount
              onChange={e => setSiteForm(p => ({ ...p, siteSubtitle: e.target.value }))}
              placeholder="请输入站点副标题" />
            <div className="form-item-help">设置站点副标题，将显示在登录页面</div>
          </Form.Item>

          <Form.Item label="登录页提示" className="login-tip-item">
            <div className="editor-container">
              <div className="editor-tabs">
                <Radio.Group value={editorMode} onChange={e => setEditorMode(e.target.value)} size="small">
                  <Radio.Button value="edit">编辑</Radio.Button>
                  <Radio.Button value="preview">预览</Radio.Button>
                </Radio.Group>
              </div>
              {editorMode === 'edit' ? (
                <div className="editor-wrapper">
                  <ReactQuill
                    theme="snow"
                    value={siteForm.loginTipMd}
                    onChange={(val) => setSiteForm(p => ({ ...p, loginTipMd: val }))}
                    modules={quillModules}
                    style={{ minHeight: 220 }}
                  />
                  <div className="markdown-tips">
                    <p>支持 Markdown 语法，如 <code>**粗体**</code>、<code>*斜体*</code>、<code>[链接](URL)</code>、<code>`代码`</code> 等。</p>
                  </div>
                </div>
              ) : (
                <div className="preview-wrapper">
                  <div className="markdown-preview"
                    dangerouslySetInnerHTML={{ __html: md.render(siteForm.loginTipMd || '') }} />
                </div>
              )}
            </div>
            <div className="form-item-help">显示在登录页密码框下方（支持 Markdown）。</div>
          </Form.Item>

          <Form.Item label="服务器URL">
            <Input value={siteForm.serverUrl}
              onChange={e => setSiteForm(p => ({ ...p, serverUrl: e.target.value }))}
              placeholder="请输入服务器URL" />
            <div className="form-item-help">设置服务器URL，用于生成代理安装命令。例如：http://your-server-domain.com</div>
          </Form.Item>

          <Form.Item wrapperCol={{ offset: 4 }}>
            <Button type="primary" onClick={saveSiteSettings} loading={siteLoading}>保存站点设置</Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 数据保留策略 */}
      <Card title="数据保留策略" hoverable className="settings-card">
        <Form layout="horizontal" labelCol={{ span: 4 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="数据保留时间">
            <Space>
              <InputNumber value={dataRetentionHours} min={1} max={720}
                onChange={v => setDataRetentionHours(v || 24)} />
              <span>小时</span>
            </Space>
            <div className="form-item-help">
              设置监控数据的保留时间，超过此时间的数据将被自动删除。建议值：24小时（1天）
            </div>
          </Form.Item>
          <Form.Item wrapperCol={{ offset: 4 }}>
            <Button type="primary" onClick={saveSettings} loading={retentionLoading}>保存设置</Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 数据管理 */}
      <Card title="数据管理" hoverable className="settings-card">
        <div className="settings-info">
          <p><InfoCircleOutlined /> 系统会根据上面设置的保留时间，自动清理过期的监控数据，以防止数据库过度增长。</p>
          <p><WarningOutlined /> 数据清理是不可逆的操作，请确保设置了合适的保留时间。</p>
        </div>
      </Card>

      {/* 数据备份与恢复 */}
      {isSuperAdmin && (
        <Card title="数据备份与恢复" hoverable className="settings-card">

          {/* WebDAV 配置 */}
          <div className="settings-form">
            <div className="settings-section-header">
              <h4><SettingOutlined /> WebDAV配置</h4>
              <Space>
                <Button onClick={backup.fetchBackupConfigs} loading={backup.configListLoading}>刷新</Button>
                <Button type="primary" onClick={backup.openCreateConfigDialog}>新增配置</Button>
              </Space>
            </div>

            <Table
              loading={backup.configListLoading}
              dataSource={backup.backupConfigs}
              columns={configColumns}
              rowKey="id"
              size="small"
              bordered
              pagination={false}
              locale={{ emptyText: '暂无配置，请先新增WebDAV配置' }}
            />
          </div>

          {/* 备份操作 */}
          <div className="settings-form" style={{ marginTop: 20 }}>
            <h4><DownloadOutlined /> 备份操作</h4>
            <div className="config-selector">
              <Space wrap>
                <span>选择配置：</span>
                <Select
                  value={backup.selectedConfigId}
                  onChange={backup.setSelectedConfigId}
                  placeholder="请选择WebDAV配置"
                  disabled={!backup.backupConfigs.length}
                  style={{ width: 320 }}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {backup.backupConfigs.map((c: any) => (
                    <Select.Option key={c.id} value={c.id}>{formatConfigLabel(c)}</Select.Option>
                  ))}
                </Select>
                {backup.selectedConfig?.is_default && <Tag color="green">默认配置</Tag>}
                <Button onClick={backup.testSelectedConfigConnection}
                  disabled={!backup.selectedConfigId}
                  loading={backup.testSelectedConfigLoading}>
                  测试选中配置
                </Button>
              </Space>
            </div>
            <div className="backup-actions" style={{ marginTop: 12 }}>
              <Space>
                <Button type="primary" icon={<UploadOutlined />}
                  onClick={backup.backupToWebDAV}
                  loading={backup.backupToWebdavLoading}
                  disabled={!backup.selectedConfigId}>
                  备份到WebDAV
                </Button>
                <Button icon={<DownloadOutlined />}
                  onClick={backup.exportToLocal}
                  loading={backup.exportToLocalLoading}>
                  导出到本地
                </Button>
              </Space>
            </div>
            <div className="backup-info" style={{ marginTop: 15 }}>
              <InfoCircleOutlined /> <span>备份包含所有用户数据、服务器配置和系统设置</span>
            </div>
          </div>

          {/* 定时备份 */}
          <div className="settings-form" style={{ marginTop: 20 }}>
            <h4><ClockCircleOutlined /> 定时备份</h4>
            <div className="schedule-container">
              <Space wrap align="center">
                <Switch
                  checked={backup.scheduleSettings.enabled}
                  checkedChildren="已启用"
                  unCheckedChildren="未启用"
                  onChange={v => backup.setScheduleSettings((p: any) => ({ ...p, enabled: v }))}
                />
                <span>备份间隔：</span>
                <InputNumber value={backup.scheduleSettings.interval_hours} min={0} max={168}
                  disabled={!backup.scheduleSettings.enabled}
                  onChange={v => backup.setScheduleSettings((p: any) => ({ ...p, interval_hours: v || 0 }))} />
                <span>小时</span>
                <InputNumber value={backup.scheduleSettings.interval_minutes} min={0} max={59}
                  disabled={!backup.scheduleSettings.enabled}
                  onChange={v => backup.setScheduleSettings((p: any) => ({ ...p, interval_minutes: v || 0 }))} />
                <span>分钟</span>
                <span>保留份数：</span>
                <InputNumber value={backup.scheduleSettings.retain_count} min={1} max={500}
                  disabled={!backup.scheduleSettings.enabled}
                  onChange={v => backup.setScheduleSettings((p: any) => ({ ...p, retain_count: v || 10 }))} />
                <span>份</span>
                <Button type="primary" onClick={backup.saveScheduleSettings} loading={backup.saveScheduleLoading}>
                  保存设置
                </Button>
                <Button onClick={backup.fetchScheduleSettings} loading={backup.scheduleLoading}>刷新</Button>
              </Space>
            </div>
            <div className="schedule-status" style={{ marginTop: 8 }}>
              {backup.scheduleSettings.enabled ? (
                <>
                  <p>上次执行：{backup.scheduleSettings.last_run || '尚未执行'}</p>
                  <p>下次执行：{backup.scheduleSettings.next_run || '等待计算'}</p>
                </>
              ) : (
                <p>定时备份已关闭。</p>
              )}
            </div>
          </div>

          {/* 恢复操作 */}
          <div className="settings-form" style={{ marginTop: 20 }}>
            <h4><UploadOutlined /> 恢复操作</h4>
            <div className="restore-section">
              <Space>
                <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  icon={<FolderOpenOutlined />}
                  onClick={backup.loadWebDAVBackups}
                  loading={backup.loadWebdavBackupsLoading}
                  disabled={!backup.selectedConfigId}>
                  从WebDAV恢复
                </Button>
                <Button icon={<UploadOutlined />} onClick={backup.triggerLocalRestore}>
                  从本地文件恢复
                </Button>
                <input
                  ref={backup.uploadFileRef}
                  type="file"
                  accept=".gpumon"
                  style={{ display: 'none' }}
                  onChange={backup.handleLocalRestore}
                />
              </Space>
            </div>

            {/* WebDAV 备份文件列表 */}
            {(backup.manualWebdavBackups.length > 0 || backup.scheduledWebdavBackups.length > 0) && (
              <div className="backup-list" style={{ marginTop: 16 }}>
                <h5>
                  可用备份文件
                  {backup.selectedConfig && (
                    <span>（当前配置：{formatConfigLabel(backup.selectedConfig)}）</span>
                  )}
                </h5>

                {backup.manualWebdavBackups.length > 0 && (
                  <div className="backup-category">
                    <h6>📁 手动备份</h6>
                    <Table dataSource={backup.manualWebdavBackups} columns={backupFileColumns('manual')}
                      rowKey="name" size="small" pagination={false} style={{ marginBottom: 15 }} />
                  </div>
                )}

                {backup.scheduledWebdavBackups.length > 0 && (
                  <div className="backup-category">
                    <h6>📅 定时备份</h6>
                    <Table dataSource={backup.scheduledWebdavBackups} columns={backupFileColumns('scheduled')}
                      rowKey="name" size="small" pagination={false} style={{ marginBottom: 15 }} />
                  </div>
                )}
              </div>
            )}

            <div className="backup-info" style={{ marginTop: 15 }}>
              <WarningOutlined className="warning" />
              <span>恢复备份将覆盖当前所有数据，请谨慎操作！系统会自动备份当前数据。</span>
            </div>
          </div>

          {/* 本地备份列表 */}
          <div className="settings-form" style={{ marginTop: 20 }}>
            <h4><FolderOpenOutlined /> 本地备份文件</h4>
            <div className="local-backup-actions" style={{ marginBottom: 12 }}>
              <Button onClick={backup.loadLocalBackups} loading={backup.loadLocalBackupsLoading}>刷新列表</Button>
            </div>
            {backup.localBackups.length > 0 ? (
              <Table dataSource={backup.localBackups} columns={localBackupColumns}
                rowKey="name" size="small" bordered pagination={false} />
            ) : backup.loadLocalBackupsLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : (
              <Empty description="暂无本地备份" />
            )}
          </div>
        </Card>
      )}

      {/* WebDAV 配置对话框 */}
      <Modal
        title={backup.configDialogMode === 'edit' ? '编辑WebDAV配置' : '新增WebDAV配置'}
        open={backup.configDialogOpen}
        onCancel={() => backup.setConfigDialogOpen(false)}
        footer={
          <Space>
            <Button onClick={() => backup.setConfigDialogOpen(false)}>取消</Button>
            <Button onClick={backup.testConfigConnection} loading={backup.testConfigLoading}>测试连接</Button>
            <Button type="primary" onClick={backup.saveConfig} loading={backup.configFormLoading}>保存</Button>
          </Space>
        }
        width={480}
        destroyOnClose
      >
        <Form layout="horizontal" labelCol={{ span: 6 }}>
          <Form.Item label="服务器URL">
            <Input value={backup.configForm.webdav_url}
              onChange={e => backup.setConfigForm((p: any) => ({ ...p, webdav_url: e.target.value }))}
              placeholder="https://example.com/webdav" />
          </Form.Item>
          <Form.Item label="用户名">
            <Input value={backup.configForm.webdav_username}
              onChange={e => backup.setConfigForm((p: any) => ({ ...p, webdav_username: e.target.value }))}
              placeholder="WebDAV用户名" />
          </Form.Item>
          <Form.Item label="密码">
            <Input.Password value={backup.configForm.webdav_password}
              onChange={e => backup.setConfigForm((p: any) => ({ ...p, webdav_password: e.target.value }))}
              placeholder="WebDAV密码" />
          </Form.Item>
          <Form.Item label="根目录">
            <Input value={backup.configForm.webdav_root_path}
              onChange={e => backup.setConfigForm((p: any) => ({ ...p, webdav_root_path: e.target.value }))}
              placeholder="/gpu-monitor-backups" />
          </Form.Item>
          <Form.Item wrapperCol={{ offset: 6 }}>
            <Checkbox checked={backup.configForm.set_as_default}
              onChange={e => backup.setConfigForm((p: any) => ({ ...p, set_as_default: e.target.checked }))}>
              保存后设为默认配置
            </Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
})

SystemSettings.displayName = 'SystemSettings'

export default SystemSettings
