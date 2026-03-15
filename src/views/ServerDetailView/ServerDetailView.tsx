import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ServerDetail from '../../components/ServerDetail/ServerDetail'
import BackButton from '../../components/BackButton/BackButton'
import PageHeader from '../../components/PageHeader/PageHeader'
import './ServerDetailView.css'

export default function ServerDetailView() {
  const { id: serverId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const goBack = () => {
    setLoading(true)
    navigate('/servers')
  }

  return (
    <div className="server-detail-view">
      <PageHeader
        title="服务器详情"
        actions={
          <BackButton text="返回列表" onClick={goBack} loading={loading} />
        }
      />
      <ServerDetail serverId={serverId!} />
    </div>
  )
}
