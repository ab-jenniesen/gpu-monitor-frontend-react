import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

interface BackButtonProps {
  text?: string
  to?: string
  onClick?: () => void
  loading?: boolean
}

export default function BackButton({
  text = '返回',
  to = '',
  onClick,
  loading = false
}: BackButtonProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (to) {
      navigate(to)
    }
  }

  return (
    <Button
      type="primary"
      icon={<ArrowLeftOutlined />}
      loading={loading}
      onClick={handleClick}
      className="back-button"
    >
      <span>{text}</span>
    </Button>
  )
}
