import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import axios from '../utils/axios'

const GENERAL_READ_KEY = 'announcementLastReadAt'
const MANDATORY_ACK_KEY = 'mandatoryAnnouncementAck'
const GENERAL_READ_MAP_KEY = 'announcementReadMap'
const DEFAULT_POLL_INTERVAL = 60000

// ==================== 辅助函数 ====================

const toTimestamp = (value: any): number => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

const readGeneralReadMap = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem(GENERAL_READ_MAP_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeGeneralReadMap = (map: Record<string, string>) => {
  try {
    localStorage.setItem(GENERAL_READ_MAP_KEY, JSON.stringify(map || {}))
  } catch {
    // ignore quota or serialization errors
  }
}

const readGeneralLastRead = (): number => {
  const stored = localStorage.getItem(GENERAL_READ_KEY)
  const parsed = stored ? parseInt(stored, 10) : 0
  return Number.isNaN(parsed) ? 0 : parsed
}

const readMandatoryAck = (): { id: string; updatedAt: string } | null => {
  try {
    const stored = localStorage.getItem(MANDATORY_ACK_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

// ==================== Hook ====================

interface UseAnnouncementsOptions {
  pollInterval?: number
}

export function useAnnouncements({ pollInterval = DEFAULT_POLL_INTERVAL }: UseAnnouncementsOptions = {}) {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)
  const [generalLastRead, setGeneralLastRead] = useState(() => readGeneralLastRead())
  const [mandatoryAck, setMandatoryAck] = useState(() => readMandatoryAck())
  const [generalReadMap, setGeneralReadMap] = useState(() => readGeneralReadMap())

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 用 ref 保存最新的 announcements，避免 fetchAnnouncements 的闭包问题
  const announcementsRef = useRef(announcements)
  announcementsRef.current = announcements

  const generalLastReadRef = useRef(generalLastRead)
  generalLastReadRef.current = generalLastRead

  const generalReadMapRef = useRef(generalReadMap)
  generalReadMapRef.current = generalReadMap

  // ==================== 派生计算（对应 Vue computed） ====================

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      return toTimestamp(b.updated_at) - toTimestamp(a.updated_at)
    })
  }, [announcements])

  const mandatoryAnnouncement = useMemo(() => {
    return announcements
      .filter((item) => item.is_active !== false && item.is_mandatory)
      .sort((a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at))[0] || null
  }, [announcements])

  const generalAnnouncements = useMemo(() => {
    return announcements.filter((item) => !item.is_mandatory)
  }, [announcements])

  const latestGeneralUpdate = useMemo(() => {
    if (!generalAnnouncements.length) return 0
    return generalAnnouncements.reduce((latest, item) => {
      const ts = toTimestamp(item.updated_at)
      return ts > latest ? ts : latest
    }, 0)
  }, [generalAnnouncements])

  const hasNewMandatory = useMemo(() => {
    if (!mandatoryAnnouncement) return false
    if (!mandatoryAck) return true
    return (
      mandatoryAck.id !== mandatoryAnnouncement.id ||
      mandatoryAck.updatedAt !== mandatoryAnnouncement.updated_at
    )
  }, [mandatoryAnnouncement, mandatoryAck])

  const hasNewGeneral = useMemo(() => {
    if (!generalAnnouncements.length) return false
    return generalAnnouncements.some((item) => {
      const sig = generalReadMap?.[item.id]
      return sig !== item.updated_at
    })
  }, [generalAnnouncements, generalReadMap])

  const unreadGeneralCount = useMemo(() => {
    if (!generalAnnouncements.length) return 0
    return generalAnnouncements.reduce((count, item) => {
      const sig = generalReadMap?.[item.id]
      return sig !== item.updated_at ? count + 1 : count
    }, 0)
  }, [generalAnnouncements, generalReadMap])

  const unreadMandatoryCount = hasNewMandatory ? 1 : 0

  const totalUnreadCount = unreadGeneralCount + unreadMandatoryCount

  // ==================== 异步操作 ====================

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get('/api/announcements', {
        params: { active_only: true }
      })
      const list = Array.isArray(response.data) ? response.data : []
      setAnnouncements(list)

      // One-time migration: if map is empty but we have a legacy timestamp,
      // pre-fill read signatures for all general announcements updated at or before that timestamp.
      const currentMap = generalReadMapRef.current || {}
      const lastRead = generalLastReadRef.current
      if (Object.keys(currentMap).length === 0 && lastRead > 0) {
        const next: Record<string, string> = {}
        list
          .filter((it: any) => !it.is_mandatory)
          .forEach((it: any) => {
            if (toTimestamp(it.updated_at) <= lastRead) {
              next[it.id] = it.updated_at
            }
          })
        if (Object.keys(next).length > 0) {
          setGeneralReadMap(next)
          writeGeneralReadMap(next)
        }
      }
    } catch (err) {
      console.error('获取公告失败:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ==================== 轮询控制 ====================

  const startPolling = useCallback(() => {
    if (pollInterval <= 0) return
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
    }
    pollingTimerRef.current = setInterval(fetchAnnouncements, pollInterval)
  }, [pollInterval, fetchAnnouncements])

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
  }, [])

  // ==================== 操作方法 ====================

  const markGeneralAsRead = useCallback(() => {
    const currentGenerals = announcementsRef.current.filter((item) => !item.is_mandatory)
    const next: Record<string, string> = { ...(generalReadMapRef.current || {}) }
    currentGenerals.forEach((item) => {
      next[item.id] = item.updated_at
    })
    setGeneralReadMap(next)
    writeGeneralReadMap(next)

    // Backward compatibility
    const latest = currentGenerals.reduce((max, item) => {
      const ts = toTimestamp(item.updated_at)
      return ts > max ? ts : max
    }, 0) || Date.now()
    setGeneralLastRead(latest)
    localStorage.setItem(GENERAL_READ_KEY, String(latest))
  }, [])

  const markOneAsRead = useCallback((announcement: any) => {
    if (!announcement || announcement.is_mandatory) return
    const next = { ...(generalReadMapRef.current || {}) }
    next[announcement.id] = announcement.updated_at
    setGeneralReadMap(next)
    writeGeneralReadMap(next)
  }, [])

  const markOneAsUnread = useCallback((announcement: any) => {
    if (!announcement || announcement.is_mandatory) return
    const next = { ...(generalReadMapRef.current || {}) }
    delete next[announcement.id]
    setGeneralReadMap(next)
    writeGeneralReadMap(next)
  }, [])

  const acknowledgeMandatory = useCallback((announcement: any) => {
    if (!announcement) return
    const payload = {
      id: announcement.id,
      updatedAt: announcement.updated_at
    }
    setMandatoryAck(payload)
    localStorage.setItem(MANDATORY_ACK_KEY, JSON.stringify(payload))
  }, [])

  const clearMandatoryAcknowledgement = useCallback(() => {
    setMandatoryAck(null)
    localStorage.removeItem(MANDATORY_ACK_KEY)
  }, [])

  // ==================== 生命周期（对应 onMounted / onUnmounted） ====================

  useEffect(() => {
    fetchAnnouncements()
    startPolling()

    return () => {
      stopPolling()
    }
  }, [fetchAnnouncements, startPolling, stopPolling])

  // ==================== 返回 ====================

  return {
    announcements,
    sortedAnnouncements,
    mandatoryAnnouncement,
    generalAnnouncements,
    loading,
    error,
    hasNewMandatory,
    hasNewGeneral,
    unreadGeneralCount,
    totalUnreadCount,
    fetchAnnouncements,
    markGeneralAsRead,
    markOneAsRead,
    markOneAsUnread,
    acknowledgeMandatory,
    clearMandatoryAcknowledgement,
    generalLastRead,
    generalReadMap,
    mandatoryAck,
    stopPolling,
    startPolling
  }
}
