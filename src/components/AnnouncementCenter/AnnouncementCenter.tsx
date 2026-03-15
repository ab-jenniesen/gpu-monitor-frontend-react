// components/AnnouncementCenter.tsx
import { useState, useMemo, useCallback } from 'react'
import { Modal, Tabs, Badge, Tag, Button, Timeline } from 'antd'
import { BellFilled, FileTextOutlined } from '@ant-design/icons'
import MarkdownIt from 'markdown-it'
import './AnnouncementCenter.css'

const md = new MarkdownIt({ html: true, linkify: true, breaks: true, typographer: true })

const GENERAL_READ_MAP_KEY = 'announcementReadMap'
const PREVIEW_LIMIT = 120

// ==================== localStorage 读写 ====================

function getReadMap(): Record<string, string> {
  try {
    const stored = localStorage.getItem(GENERAL_READ_MAP_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function setReadMap(map: Record<string, string>) {
  try {
    localStorage.setItem(GENERAL_READ_MAP_KEY, JSON.stringify(map || {}))
  } catch {
    // ignore
  }
}

// ==================== 工具函数 ====================

function renderMarkdown(content: string) {
  return content ? md.render(content) : ''
}

function formatTime(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN')
}

function getPlainText(content: string) {
  if (!content) return ''
  const html = renderMarkdown(content)
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTruncatable(item: any) {
  return getPlainText(item.content).length > PREVIEW_LIMIT
}

function getPreviewText(item: any) {
  const text = getPlainText(item.content)
  return text.length > PREVIEW_LIMIT ? text.slice(0, PREVIEW_LIMIT) + '...' : text
}

// ==================== Props ====================

interface AnnouncementCenterProps {
  open: boolean
  activeTab: string
  onActiveTabChange: (tab: string) => void
  mandatoryAnnouncement: any | null
  announcements: any[]
  hasNewMandatory: boolean
  hasNewGeneral: boolean
  onViewGeneral: () => void
  onMarkReadOne: (item: any) => void
  onMarkUnreadOne: (item: any) => void
  onOpenChange: (open: boolean) => void
}

// ==================== 组件 ====================

export default function AnnouncementCenter({
  open,
  activeTab,
  onActiveTabChange,
  mandatoryAnnouncement,
  announcements,
  hasNewMandatory,
  hasNewGeneral,
  onViewGeneral,
  onMarkReadOne,
  onMarkUnreadOne,
  onOpenChange
}: AnnouncementCenterProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set())
  // 用于强制刷新已读/未读状态
  const [readMapVersion, setReadMapVersion] = useState(0)

  const internalTab = activeTab === 'timeline' ? 'timeline' : 'mandatory'
  const tabTitle = internalTab === 'timeline' ? '公告时间线' : '重点公告'

  // ==================== 展开/收起 ====================

  const isExpanded = useCallback(
    (id: string | number) => expandedIds.has(id),
    [expandedIds]
  )

  const toggleExpand = useCallback((id: string | number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // ==================== 时间线数据 ====================

  const timeline = useMemo(() => {
    const list = Array.isArray(announcements) ? [...announcements] : []
    return list
      .filter((item) => item && item.content)
      .sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at || 0).getTime()
        const timeB = new Date(b.updated_at || b.created_at || 0).getTime()
        return timeB - timeA
      })
  }, [announcements])

  // ==================== 已读/未读判断 ====================

  const isNewAnnouncement = useCallback(
    (item: any) => {
      // 创建响应式依赖
      void readMapVersion

      if (!item) return false

      if (item.is_mandatory) {
        try {
          const mandatoryAck = JSON.parse(
            localStorage.getItem('mandatoryAnnouncementAck') || 'null'
          )
          if (!mandatoryAck) return true
          return mandatoryAck.id !== item.id || mandatoryAck.updatedAt !== item.updated_at
        } catch {
          return true
        }
      }

      const map = getReadMap()
      return map[item.id] !== item.updated_at
    },
    [readMapVersion]
  )

  // ==================== 标记已读/未读 ====================

  const handleMarkRead = useCallback(
    (item: any) => {
      if (!item || item.is_mandatory) return
      const map = getReadMap()
      map[item.id] = item.updated_at
      setReadMap(map)
      setReadMapVersion((v) => v + 1)
      onMarkReadOne(item)
    },
    [onMarkReadOne]
  )

  const handleMarkUnread = useCallback(
    (item: any) => {
      if (!item || item.is_mandatory) return
      const map = getReadMap()
      delete map[item.id]
      setReadMap(map)
      setReadMapVersion((v) => v + 1)
      onMarkUnreadOne(item)
    },
    [onMarkUnreadOne]
  )

  const handleMarkAllRead = useCallback(() => {
    onViewGeneral()
    setTimeout(() => setReadMapVersion((v) => v + 1), 0)
  }, [onViewGeneral])

  // ==================== 渲染：时间线项 ====================

  const renderTimelineItem = (item: any) => {
    const isNew = isNewAnnouncement(item)
    const truncatable = isTruncatable(item)
    const expanded = isExpanded(item.id)

    const readUnreadButton = !item.is_mandatory && (
      isNew ? (
        <Button type="link" className="action-success" onClick={() => handleMarkRead(item)}>
          标记为已读
        </Button>
      ) : (
        <Button type="link" className="action-warning" onClick={() => handleMarkUnread(item)}>
          标记为未读
        </Button>
      )
    )

    return (
      <div className={`timeline-item ${isNew ? 'timeline-item--new' : ''}`}>
        <div className="timeline-header">
          <div className="tag-group">
            {item.is_mandatory && <Tag color="error">必读</Tag>}
          </div>
          <h4>{item.title}</h4>
        </div>

        {truncatable ? (
          <>
            {expanded ? (
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content) }}
              />
            ) : (
              <p className="timeline-preview">{getPreviewText(item)}</p>
            )}
            <div className="timeline-actions">
              <Button type="link" onClick={() => toggleExpand(item.id)}>
                {expanded ? '收起' : '展开'}
              </Button>
              {readUnreadButton}
            </div>
          </>
        ) : (
          <>
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content) }}
            />
            <div className="timeline-actions">
              {readUnreadButton}
            </div>
          </>
        )}
      </div>
    )
  }

  // ==================== 渲染：重点公告 ====================

  const renderMandatoryContent = () => {
    if (!mandatoryAnnouncement) {
      return (
        <div className="empty-state">
          <FileTextOutlined style={{ fontSize: 48 }} />
          <p>暂无重点公告</p>
        </div>
      )
    }

    return (
      <article className={`content-card mandatory-card ${hasNewMandatory ? 'content-card--new' : ''}`}>
        <div className="card-scroll">
          <header className="card-header">
            <h3>{mandatoryAnnouncement.title}</h3>
            <span className="time">{formatTime(mandatoryAnnouncement.updated_at)}</span>
          </header>
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(mandatoryAnnouncement.content) }}
          />
        </div>
      </article>
    )
  }

  // ==================== 渲染：时间线 ====================

  const renderTimelineContent = () => {
    if (!timeline.length) {
      return (
        <div className="empty-state">
          <FileTextOutlined style={{ fontSize: 48 }} />
          <p>暂无公告</p>
        </div>
      )
    }

    return (
      <article className="content-card timeline-card">
        <div className="card-scroll">
          <div className="timeline-toolbar">
            <Button size="small" type="primary" onClick={handleMarkAllRead}>
              全部标记为已读
            </Button>
          </div>

          <Timeline
            className="announcement-timeline"
            items={timeline.map((item) => ({
              key: item.id,
              color: item.is_mandatory ? 'red' : 'blue',
              children: (
                <div>
                  <div className="timeline-timestamp">{formatTime(item.updated_at)}</div>
                  {renderTimelineItem(item)}
                </div>
              )
            }))}
          />
        </div>
      </article>
    )
  }

  // ==================== Tab 配置 ====================

  const tabItems = [
    {
      key: 'mandatory',
      label: (
        <span className="tab-label">
          <Badge dot={hasNewMandatory}>
            <span>重点公告</span>
          </Badge>
        </span>
      )
    },
    {
      key: 'timeline',
      label: (
        <span className="tab-label">
          <Badge dot={hasNewGeneral}>
            <span>公告时间线</span>
          </Badge>
        </span>
      )
    }
  ]

  // ==================== 渲染 ====================

  return (
    <Modal
      className="announcement-center-dialog"
      open={open}
      width={920}
      centered
      destroyOnHidden 
      footer={null}
      onCancel={() => onOpenChange(false)}
      title={
        <div className="dialog-header">
          <div className="dialog-heading">
            <span className="icon-wrapper">
              <BellFilled />
            </span>
            <div className="heading-text">
              <span className="heading-sub">公告中心</span>
              <h2 className="heading-title">{tabTitle}</h2>
            </div>
          </div>
          <Tabs
            activeKey={internalTab}
            onChange={onActiveTabChange}
            className="header-tabs"
            items={tabItems}
          />
        </div>
      }
    >
      <section className="dialog-body">
        {internalTab === 'mandatory' ? renderMandatoryContent() : renderTimelineContent()}
      </section>
    </Modal>
  )
}
