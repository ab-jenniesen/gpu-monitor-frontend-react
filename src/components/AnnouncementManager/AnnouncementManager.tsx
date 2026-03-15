import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Table, Tag, Button, Form, Input, Switch, Radio, Modal, Space, message } from 'antd'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from '../../utils/axios'
import MarkdownIt from 'markdown-it'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import './AnnouncementManager.css'

const md = new MarkdownIt({ html: true, linkify: true, typographer: true })

const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    ['blockquote', 'code-block'],
    [{ header: 1 }, { header: 2 }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ script: 'sub' }, { script: 'super' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ size: ['small', false, 'large', 'huge'] }],
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ color: [] }, { background: [] }],
    ['link', 'image'],
    ['clean']
  ]
}

interface Announcement {
  id?: number
  title: string
  content: string
  is_active: boolean
  is_mandatory: boolean
  updated_at?: string
}

export interface AnnouncementManagerRef {
  openAddAnnouncementDialog: () => void
}

const AnnouncementManager = forwardRef<AnnouncementManagerRef>((_, ref) => {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 编辑状态
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [form] = Form.useForm()

  // ==================== 数据获取 ====================

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/announcements', {
        params: { active_only: false }
      })
      setAnnouncements(response.data)
    } catch (error) {
      console.error('获取公告列表失败:', error)
      message.error('获取公告列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  // ==================== 暴露方法给父组件 ====================

  useImperativeHandle(ref, () => ({
    openAddAnnouncementDialog: () => {
      const newAnnouncement: Announcement = {
        title: '',
        content: '',
        is_active: true,
        is_mandatory: false
      }
      setCurrentAnnouncement(newAnnouncement)
      setIsNew(true)
      setEditorMode('edit')
      form.setFieldsValue(newAnnouncement)
    }
  }))

  // ==================== 编辑操作 ====================

  const editAnnouncement = useCallback((announcement: any) => {
    const data = { is_mandatory: false, ...announcement }
    setCurrentAnnouncement(data)
    setIsNew(false)
    setEditorMode('edit')
    form.setFieldsValue(data)
  }, [form])

  const backToList = useCallback(() => {
    setCurrentAnnouncement(null)
    form.resetFields()
  }, [form])

  // ==================== 保存 ====================

  const saveAnnouncement = useCallback(async () => {
    try {
      await form.validateFields()
    } catch {
      return
    }

    if (!currentAnnouncement) return
    setSaving(true)

    try {
      if (isNew) {
        await axios.post('/api/announcements', currentAnnouncement)
        message.success('公告添加成功')
      } else {
        await axios.put(`/api/announcements/${currentAnnouncement.id}`, currentAnnouncement)
        message.success('公告更新成功')
      }
      await fetchAnnouncements()
      backToList()
    } catch (error: any) {
      console.error('保存公告失败:', error)
      message.error('保存公告失败: ' + (error.response?.data?.msg || error.message))
    } finally {
      setSaving(false)
    }
  }, [currentAnnouncement, isNew, form, fetchAnnouncements, backToList])

  // ==================== 删除 ====================

  const confirmDelete = useCallback((announcement: any) => {
    setDeleteTarget(announcement)
    setDeleteDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await axios.delete(`/api/announcements/${deleteTarget.id}`)
      message.success('公告删除成功')
      setDeleteDialogOpen(false)
      await fetchAnnouncements()
    } catch (error: any) {
      console.error('删除公告失败:', error)
      message.error('删除公告失败: ' + (error.response?.data?.msg || error.message))
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, fetchAnnouncements])

  // ==================== 更新当前公告字段 ====================

  const updateField = useCallback((field: keyof Announcement, value: any) => {
    setCurrentAnnouncement(prev => prev ? { ...prev, [field]: value } : null)
  }, [])

  // ==================== 表格列 ====================

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '标题', dataIndex: 'title', width: 150 },
    {
      title: '内容', dataIndex: 'content', width: 250,
      render: (content: string) => (
        <div
          className="content-preview"
          dangerouslySetInnerHTML={{ __html: md.render(content || '') }}
        />
      )
    },
    {
      title: '状态', dataIndex: 'is_active', width: 80,
      render: (val: boolean) => (
        <Tag color={val ? 'green' : 'default'}>{val ? '已发布' : '草稿'}</Tag>
      )
    },
    {
      title: '重点', dataIndex: 'is_mandatory', width: 80,
      render: (val: boolean) => val ? <Tag color="red">必读</Tag> : <span>普通</span>
    },
    { title: '更新时间', dataIndex: 'updated_at', width: 160 },
    {
      title: '操作', width: 180, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" type="primary" icon={<EditOutlined />}
            onClick={() => editAnnouncement(record)}>
            编辑
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />}
            onClick={() => confirmDelete(record)}>
            删除
          </Button>
        </Space>
      )
    }
  ]

  // ==================== 渲染 ====================

  // 公告列表视图
  if (!currentAnnouncement) {
    return (
      <div className="announcement-manager">
        <Table
          loading={loading}
          dataSource={announcements}
          columns={columns}
          rowKey="id"
          bordered
          scroll={{ x: 900 }}
          pagination={false}
        />

        {/* 删除确认 */}
        <Modal
          title="确认删除"
          open={deleteDialogOpen}
          onCancel={() => setDeleteDialogOpen(false)}
          footer={
            <Space>
              <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
              <Button danger loading={deleting} onClick={handleDelete}>确定</Button>
            </Space>
          }
        >
          <span>确定要删除这条公告吗？此操作不可恢复。</span>
        </Modal>
      </div>
    )
  }

  // 编辑视图
  return (
    <div className="announcement-manager">
      <div className="announcement-edit">
        <Form
          form={form}
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 20 }}
          className="announcement-form"
          initialValues={currentAnnouncement}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[
              { required: true, message: '请输入公告标题' },
              { min: 2, max: 50, message: '标题长度应在2到50个字符之间' }
            ]}
          >
            <Input
              placeholder="请输入公告标题"
              value={currentAnnouncement.title}
              onChange={(e) => {
                updateField('title', e.target.value)
                form.setFieldValue('title', e.target.value)
              }}
            />
          </Form.Item>

          <Form.Item
            label="内容"
            name="content"
            rules={[{ required: true, message: '请输入公告内容' }]}
          >
            <div className="editor-container">
              <div className="editor-tabs">
                <Radio.Group
                  value={editorMode}
                  onChange={(e) => setEditorMode(e.target.value)}
                  size="small"
                  optionType="button"
                >
                  <Radio.Button value="edit">编辑</Radio.Button>
                  <Radio.Button value="preview">预览</Radio.Button>
                </Radio.Group>
              </div>

              {editorMode === 'edit' ? (
                <div className="editor-wrapper">
                  <ReactQuill
                    theme="snow"
                    value={currentAnnouncement.content}
                    onChange={(val) => {
                      updateField('content', val)
                      form.setFieldValue('content', val)
                    }}
                    modules={quillModules}
                    style={{ minHeight: 250 }}
                  />
                  <div className="markdown-tips">
                    <p>
                      支持 Markdown 语法，可以使用 <code>**粗体**</code>,{' '}
                      <code>*斜体*</code>, <code>[链接](URL)</code> 等格式
                    </p>
                  </div>
                </div>
              ) : (
                <div className="preview-wrapper">
                  <div
                    className="markdown-preview"
                    dangerouslySetInnerHTML={{
                      __html: md.render(currentAnnouncement.content || '')
                    }}
                  />
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item label="状态">
            <Switch
              checked={currentAnnouncement.is_active}
              onChange={(val) => updateField('is_active', val)}
              checkedChildren="已发布"
              unCheckedChildren="草稿"
            />
          </Form.Item>

          <Form.Item label="重点公告">
            <Switch
              checked={currentAnnouncement.is_mandatory}
              onChange={(val) => updateField('is_mandatory', val)}
              checkedChildren="必读"
              unCheckedChildren="普通"
            />
          </Form.Item>

          <Form.Item wrapperCol={{ offset: 4 }}>
            <Space>
              <Button type="primary" loading={saving} onClick={saveAnnouncement}>
                保存
              </Button>
              <Button onClick={backToList}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
})

AnnouncementManager.displayName = 'AnnouncementManager'
export default AnnouncementManager
