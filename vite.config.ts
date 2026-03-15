import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['punycode']
  },
  server: {
    allowedHosts: [
      'gpu2.xkl505.top',
      'gpu.xkl505.top',
      'gpushare.xkl505.top',
      // 可以添加其他需要允许的主机
    ],
    host: '0.0.0.0', // 允许所有IP访问
    port: 3002, // 指定端口
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production' ? 'https://gpushare.xkl505.top' : 'https://gpushare.xkl505.top',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.NODE_ENV === 'production' ? 'https://gpushare.xkl505.top' : 'https://gpushare.xkl505.top',
        ws: true,
        changeOrigin: true,
        // 增加这些选项以解决超时问题
        configure: (_proxy, options) => {
          // 连接建立后超时时间
          options.timeout = 30000; // 30秒
        }
      }
    }
  },
  // 确保在生产环境中正确处理API请求
  build: {
    // 生成sourcemap以便于调试
    sourcemap: true
  }
})
