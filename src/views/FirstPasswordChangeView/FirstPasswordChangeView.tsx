import { useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { LockOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { logout } from '../../store/authSlice'
import type { AppDispatch } from '../../store'
import axios from '../../utils/axios'
import { useEarthBackground } from '../../hooks/useEarthBackground'
import { useSiteSettings } from '../../hooks/useSiteSettings'
import '../LoginView/LoginView.css'
import './FirstPasswordChangeView.css'

export default function FirstPasswordChangeView() {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const canvasRef = useEarthBackground()
  const siteSettings = useSiteSettings()

  // ==================== 密码验证规则 ====================

  const passwordRules = [
    { required: true, message: '请输入新密码' },
    { min: 6, message: '密码长度至少为6位' },
    {
      validator: (_: any, value: string) => {
        if (value && !/[a-zA-Z]/.test(value)) {
          return Promise.reject(new Error('密码必须包含至少一个字母'))
        }
        if (value && !/\d/.test(value)) {
          return Promise.reject(new Error('密码必须包含至少一个数字'))
        }
        return Promise.resolve()
      }
    }
  ]

  const confirmPasswordRules = [
    { required: true, message: '请再次输入密码进行确认' },
    ({ getFieldValue }: any) => ({
      validator(_: any, value: string) {
        if (!value || getFieldValue('newPassword') === value) {
          return Promise.resolve()
        }
        return Promise.reject(new Error('两次输入的密码不一致，请重新输入'))
      }
    })
  ]

  // ==================== 提交处理 ====================

  const handlePasswordChange = async () => {
    try {
      await form.validateFields()
      setLoading(true)

      const response = await axios.post('/api/auth/first-time-password-change', {
        new_password: form.getFieldValue('newPassword')
      })

      if (response.status === 200) {
        message.success('密码修改成功，请重新登录')

        localStorage.removeItem('requiresPasswordChange')
        localStorage.removeItem('isFirstLogin')
        dispatch(logout())

        navigate('/login')
      } else {
        message.error(response.data.msg || '密码修改失败')
      }
    } catch (error: any) {
      // 区分表单验证失败和请求失败
      if (error.response) {
        message.error(error.response?.data?.msg || '密码修改失败')
      }
    } finally {
      setLoading(false)
    }
  }

  // ==================== 渲染 ====================

  return (
    <div className="login-container">
      <canvas ref={canvasRef} id="earth-background" />

      <div className="login-card">
        {/* 头部 */}
        <div className="login-header">
          <div className="logo-container">
            <img src={siteSettings.logo} className="logo" alt="Logo" />
          </div>
          <h1 className="title">首次登录修改密码</h1>
          <div className="subtitle">{siteSettings.name}</div>
        </div>

        {/* 表单 */}
        <Form
          form={form}
          layout="vertical"
          className="login-form"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handlePasswordChange()
          }}
        >
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={passwordRules}
            validateTrigger="onBlur"
          >
            <Input.Password
              prefix={<LockOutlined className="input-icon" />}
              placeholder="请输入新密码（至少6位，需包含字母和数字）"
              className="custom-input"
            />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={confirmPasswordRules}
            validateTrigger="onBlur"
          >
            <Input.Password
              prefix={<LockOutlined className="input-icon" />}
              placeholder="请再次输入新密码"
              className="custom-input"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              loading={loading}
              onClick={handlePasswordChange}
              className="login-button"
              block
            >
              <span>确认修改</span>
              <RightOutlined className="button-icon" />
            </Button>
          </Form.Item>
        </Form>

        {/* 底部 */}
        <div className="login-footer">
          <p className="login-tip">
            <span className="text-warning">首次登录</span>
            需要修改密码以确保账户安全。新密码要求：
            <span className="text-highlight">至少6位字符</span>
            ，必须同时包含
            <span className="text-highlight">字母和数字</span>
            ，支持特殊符号。请确认两次密码输入一致，修改完成后将自动跳转登录页面。
          </p>
          <p className="copyright">&copy; 2025 MYZR</p>
        </div>
      </div>
    </div>
  )
}
