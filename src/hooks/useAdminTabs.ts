import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const ADMIN_TAB_STORAGE_KEY = 'gpu-monitor-admin-active-tab'
const VALID_ADMIN_TABS = ['users', 'announcements', 'settings', 'servers', 'routes', 'containers', 'logs']

export function useAdminTabs() {
  const [searchParams, setSearchParams] = useSearchParams()

  const getInitialTab = (): string => {
    const tabParam = searchParams.get('tab')
    if (tabParam && VALID_ADMIN_TABS.includes(tabParam)) return tabParam
    const stored = localStorage.getItem(ADMIN_TAB_STORAGE_KEY)
    if (stored && VALID_ADMIN_TABS.includes(stored)) return stored
    return 'users'
  }

  const [activeTab, setActiveTab] = useState(getInitialTab)

  // 同步 URL 参数
  useEffect(() => {
    const current = searchParams.get('tab')
    if (current !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true })
    }
    localStorage.setItem(ADMIN_TAB_STORAGE_KEY, activeTab)
  }, [activeTab])

  // 监听外部 URL 变化
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && VALID_ADMIN_TABS.includes(tab) && tab !== activeTab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const changeTab = useCallback((tab: string) => {
    if (VALID_ADMIN_TABS.includes(tab)) {
      setActiveTab(tab)
    }
  }, [])

  return { activeTab, changeTab, VALID_ADMIN_TABS }
}
