import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import './App.css'

export default function App() {
  return (
    // Suspense 处理 lazy 懒加载组件的加载状态
    <Suspense fallback={<div>Loading...</div>}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
