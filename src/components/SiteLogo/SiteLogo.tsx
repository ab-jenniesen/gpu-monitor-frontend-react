import { useNavigate } from 'react-router-dom'
import { DesktopOutlined } from '@ant-design/icons'
import './SiteLogo.css'

export default function SiteLogo() {
  const navigate = useNavigate()

  const goHome = () => {
    const userRole = localStorage.getItem('userRole')
    navigate(userRole === 'admin' ? '/admin' : '/user')
  }

  return (
    <div className="site-logo" onClick={goHome}>
      <div className="logo-icon">
        <DesktopOutlined className="gpu-icon" />
      </div>
      <h1 className="site-name">GPU共享监控平台</h1>
    </div>
  )
}
