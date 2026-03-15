import { Navigate } from 'react-router-dom'

/**
 * 获取认证信息
 */
function getAuthInfo() {
  return {
    token: localStorage.getItem('token'),
    userRole: localStorage.getItem('userRole'),
    requiresPasswordChange:
      localStorage.getItem('requiresPasswordChange') === 'true'
  }
}

/**
 * 公开路由守卫（登录页）
 * - 已登录 + 需要改密码 → 跳转密码修改页
 * - 已登录 + 不需要改密码 → 跳转用户页
 * - 未登录 → 正常显示
 */
export function PublicRoute({ children } : { children: React.ReactNode }) {
  const { token, requiresPasswordChange } = getAuthInfo()

  if (token) {
    if (requiresPasswordChange) {
      return <Navigate to="/first-password-change" replace />
    }
    return <Navigate to="/user" replace />
  }

  return children
}

/**
 * 认证守卫
 * - 未登录 → 跳转登录页
 * - requiresPasswordChange 模式：不需要改密码时 → 跳转用户页
 */
export function RequireAuth({ children, requiresPasswordChange: needsPwdChange }: { children: React.ReactNode, requiresPasswordChange?: boolean }) {
  const { token, requiresPasswordChange } = getAuthInfo()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  // 密码修改页的特殊逻辑：如果不需要改密码，跳走
  if (needsPwdChange && !requiresPasswordChange) {
    return <Navigate to="/user" replace />
  }

  return children
}

/**
 * 密码修改拦截守卫
 * - 需要修改密码但不在密码修改页 → 强制跳转
 */
export function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { requiresPasswordChange } = getAuthInfo()

  if (requiresPasswordChange) {
    return <Navigate to="/first-password-change" replace />
  }

  return children
}

/**
 * 管理员权限守卫
 * - 非管理员 → 跳转用户页
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { userRole } = getAuthInfo()

  if (userRole !== 'admin') {
    return <Navigate to="/user" replace />
  }

  return children
}
