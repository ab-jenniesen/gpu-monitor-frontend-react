import { type ReactNode } from 'react'
import SiteLogo from '../SiteLogo/SiteLogo'
import './PageHeader.css'

interface PageHeaderProps {
  title: string
  actions?: ReactNode
}

export default function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="page-header-container">
      <div className="page-header-content">
        <div className="site-info">
          <div className="logo-container">
            <SiteLogo />
          </div>
          <div className="page-title-container">
            <h2 className="current-page-title">{title}</h2>
          </div>
        </div>
        {actions && (
          <div className="actions-container">{actions}</div>
        )}
      </div>
    </div>
  )
}

