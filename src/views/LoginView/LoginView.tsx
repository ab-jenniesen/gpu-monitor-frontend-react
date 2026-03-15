import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { login, selectAuthLoading } from '../../store/authSlice'
import type { AppDispatch } from '../../store'
import MarkdownIt from 'markdown-it'
import { useEarthBackground } from '../../hooks/useEarthBackground'
import { useSiteSettings } from '../../hooks/useSiteSettings'
import './LoginView.css'

const md = new MarkdownIt({ html: true, linkify: true, typographer: true })

export default function LoginView() {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const loading = useSelector(selectAuthLoading)
  const [form] = Form.useForm()
  const canvasRef = useEarthBackground()
  const siteSettings = useSiteSettings()

  const handleLogin = async () => {
    try {
      const values = await form.validateFields()
      const result = await dispatch(login({
        username: values.username,
        password: values.password
      }))
      if (login.fulfilled.match(result)) {
        message.success('登录成功')
        const requiresPasswordChange = localStorage.getItem('requiresPasswordChange') === 'true'
        navigate(requiresPasswordChange ? '/first-password-change' : '/user')
      } else {
        message.error((result.payload as string) || '登录失败')
      }
    } catch { /* 表单验证失败 */ }
  }

  return (
    <div className="login-container">
      <canvas ref={canvasRef} id="earth-background" />
      <div className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <img src={siteSettings.logo} className="logo" alt="Logo" />
          </div>
          <h1 className="title">{siteSettings.name}</h1>
          <div className="subtitle" dangerouslySetInnerHTML={{ __html: siteSettings.subtitle }} />
        </div>

        <Form form={form} layout="vertical" className="login-form"
          onKeyDown={(e) => { if (e.key === 'Enter') handleLogin() }}>
          <Form.Item label="用户名" name="username"
            rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined className="input-icon" />} placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item label="密码" name="password"
            rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined className="input-icon" />} placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" loading={loading} onClick={handleLogin} className="login-button" block>
              <span>登录</span>
              <RightOutlined className="button-icon" />
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          {siteSettings.loginTipMd && (
            <div className="login-tip" dangerouslySetInnerHTML={{ __html: md.render(siteSettings.loginTipMd) }} />
          )}
          <p className="copyright">&copy; 2025 MYZR</p>
        </div>
      </div>
    </div>
  )
}
