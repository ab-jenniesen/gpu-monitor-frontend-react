import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import LoginView from '../views/LoginView/LoginView'
import AdminView from '../views/AdminView/AdminView'
import UserView from '../views/UserView/UserView'
import ServersOverview from '../views/ServersOverview/ServersOverview'
import FirstPasswordChangeView from '../views/FirstPasswordChangeView/FirstPasswordChangeView'
import MainLayout from '../layouts/MainLayout/MainLayout'
import { lazy } from 'react'
import { PublicRoute, RequireAuth, PasswordChangeGuard, RequireAdmin } from './guards'

// 懒加载组件
const ServerDetailView = lazy(() => import('../views/ServerDetailView/ServerDetailView'))
const ServerResourcesView = lazy(() => import('../views/ServerResourcesView/ServerResourcesView'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginView />
      </PublicRoute>
    )
  },
  {
    path: '/first-password-change',
    element: (
      <RequireAuth requiresPasswordChange>
        <FirstPasswordChangeView />
      </RequireAuth>
    )
  },
  {
    // 使用布局组件的嵌套路由
    path: '/',
    element: (
      <RequireAuth>
        <PasswordChangeGuard>
          <MainLayout />
        </PasswordChangeGuard>
      </RequireAuth>
    ),
    children: [
      {
        path: 'admin',
        element: (
          <RequireAdmin>
            <AdminView />
          </RequireAdmin>
        )
      },
      {
        path: 'user',
        element: <UserView />
      },
      {
        path: 'servers',
        element: <ServersOverview />
      },
      {
        path: 'server/:id',
        element: <ServerDetailView />
      },
      {
        path: 'server/:id/resources',
        element: <ServerResourcesView />
      }
    ]
  }
])

export default router
