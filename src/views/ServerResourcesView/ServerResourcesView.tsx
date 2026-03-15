import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Tabs, Button, Skeleton, Result, message } from 'antd'
import { WarningFilled, ArrowLeftOutlined } from '@ant-design/icons'
import { fetchServerDetails } from '../../store/serversSlice'
import type { AppDispatch } from '../../store'
import StoragePathsManager from '../../components/StoragePathsManager/StoragePathsManager'
import PortRangesManager from '../../components/PortRangesManager/PortRangesManager'
import DockerImagesManager from '../../components/DockerImagesManager/DockerImagesManager'
import './ServerResourcesView.css'

export default function ServerResourcesView() {
  const { id: serverId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const [searchParams, setSearchParams] = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverName, setServerName] = useState('')

  // 从 URL query 读取当前 tab，默认 storage
  const activeTab = searchParams.get('tab') || 'storage'

  // 获取服务器数据
  const fetchServerData = useCallback(async () => {
    if (!serverId) return
    setLoading(true)
    setError(null)

    try {
      const result = await dispatch(fetchServerDetails(serverId)).unwrap()
      if (result) {
        setServerName(result.name)
      } else {
        setError('服务器不存在')
      }
    } catch (err: any) {
      console.error('获取服务器数据失败:', err)
      setError('获取服务器数据失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [serverId, dispatch])

  useEffect(() => {
    fetchServerData()
  }, [fetchServerData])

  // 标签页切换 → 同步 URL query
  const handleTabChange = (tab: string) => {
    setSearchParams({ tab }, { replace: true })
  }

  // 返回服务器管理
  const goBack = () => {
    navigate('/admin?tab=servers')
  }

  // ==================== Tab 配置 ====================

  const tabItems = [
    {
      key: 'storage',
      label: '存储路径管理',
      children: <StoragePathsManager serverId={serverId!} onUpdate={fetchServerData} />
    },
    {
      key: 'ports',
      label: '端口范围管理',
      children: <PortRangesManager serverId={serverId!} onUpdate={fetchServerData} />
    },
    {
      key: 'docker',
      label: 'Docker镜像管理',
      children: <DockerImagesManager serverId={serverId!} onUpdate={fetchServerData} />
    }
  ]

  // ==================== 渲染 ====================

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      )
    }

    if (error) {
      return (
        <div className="error-container">
          <Result
            icon={<WarningFilled style={{ color: '#909399', fontSize: 60 }} />}
            title={error}
            extra={
              <Button type="primary" onClick={fetchServerData}>
                重试
              </Button>
            }
          />
        </div>
      )
    }

    return (
      <div className="resources-content">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          className="custom-tabs"
          items={tabItems}
        />
      </div>
    )
  }

  return (
    <div className="server-resources-view">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="header-text">
          <h1 className="header-title">服务器资源管理</h1>
          <p className="header-subtitle">
            当前服务器：{serverName || '加载中...'}
          </p>
        </div>
        <div className="header-actions">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
            loading={loading}
          >
            返回服务器管理
          </Button>
        </div>
      </div>

      {renderContent()}
    </div>
  )
}
