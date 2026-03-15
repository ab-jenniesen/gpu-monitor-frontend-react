import { useEffect, useRef } from 'react'

export function useAutoRefresh(
  callback: () => Promise<void>,
  interval: number,
  enabled: boolean = true
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(async () => {
      try {
        await callback()
      } catch (error) {
        console.error('自动刷新失败:', error)
      }
    }, interval)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [callback, interval, enabled])
}