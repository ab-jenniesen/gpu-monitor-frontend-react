import { useState, useEffect } from 'react'
import axios from '../utils/axios'

export interface SiteSettings {
  name: string
  logo: string
  subtitle: string
  loginTipMd: string
}

const defaultSettings: SiteSettings = {
  name: 'GPU共享服务平台',
  logo: 'https://lank.myzr.org:88/i/2024/05/29/66571d8de15ea.png',
  subtitle: '高效、安全的资源管理平台',
  loginTipMd: ''
}

export function useSiteSettings() {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSettings)

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await axios.get('/api/settings/site')
        setSiteSettings({
          name: response.data.site_name,
          logo: response.data.site_logo,
          subtitle: response.data.site_subtitle,
          loginTipMd: response.data.login_tip_md || ''
        })
      } catch (error) {
        console.error('获取站点设置失败:', error)
      }
    }
    fetch()
  }, [])

  return siteSettings
}
