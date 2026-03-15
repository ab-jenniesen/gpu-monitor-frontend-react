import { useMemo } from 'react'
import { Modal, Button } from 'antd'
import { BellFilled, FileTextOutlined } from '@ant-design/icons'
import MarkdownIt from 'markdown-it'
import './MandatoryAnnouncementDialog.css'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
})

interface Announcement {
  id: string | number
  title: string
  content: string
  updated_at: string
}

interface MandatoryAnnouncementDialogProps {
  open: boolean
  announcement: Announcement | null
  onClose: () => void
  onDismiss: () => void
  onOpenChange: (open: boolean) => void
}

export default function MandatoryAnnouncementDialog({
  open,
  announcement,
  onClose,
  onDismiss,
  onOpenChange
}: MandatoryAnnouncementDialogProps) {

  const renderedContent = useMemo(() => {
    if (!announcement?.content) return ''
    return md.render(announcement.content)
  }, [announcement?.content])

  const formattedTime = useMemo(() => {
    if (!announcement?.updated_at) return ''
    return new Date(announcement.updated_at).toLocaleString('zh-CN')
  }, [announcement?.updated_at])

  const handleClose = () => {
    onOpenChange(false)
    onClose()
  }

  const handleDismiss = () => {
    if (!announcement) return
    onOpenChange(false)
    onDismiss()
  }

  return (
    <Modal
      className="mandatory-announcement-dialog"
      open={open}
      closable={false}
      mask={{closable: false}}
      keyboard={false}
      width={960}
      centered
      destroyOnHidden
      title={
        <div className="dialog-header">
          <div className="dialog-title">
            <div className="title-icon">
              <BellFilled />
            </div>
            <div className="title-meta">
              <span className="title-label">重点公告</span>
              <h2>{announcement?.title || '最新重点公告'}</h2>
            </div>
          </div>
          {announcement && <span className="dialog-time">{formattedTime}</span>}
        </div>
      }
      footer={
        <div className="dialog-footer-buttons">
          <Button onClick={handleClose}>稍后再看</Button>
          <Button type="primary" onClick={handleDismiss} disabled={!announcement}>
            不再提示
          </Button>
        </div>
      }
    >
      {announcement ? (
        <div className="dialog-content">
          <div className="content-scroll">
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          </div>
        </div>
      ) : (
        <div className="empty-placeholder">
          <FileTextOutlined />
          <p>暂无需要集中查看的公告</p>
        </div>
      )}
    </Modal>
  )
}
