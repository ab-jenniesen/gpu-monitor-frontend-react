import { useState, useMemo, useCallback, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { message, Modal } from 'antd'
import { selectUsers, selectUsersLoading, fetchUsers, addUser, updateUser, deleteUser, addUsers } from '../store/usersSlice'
import axios from '../utils/axios'
import type { AppDispatch } from '../store'

// 分组显示名
export const groupName = (code: string) => {
  switch (code) {
    case 'undergrad': return '本科生'
    case 'master': return '硕士生'
    case 'phd': return '博士生'
    case 'teacher': return '教师'
    case 'unassigned': return '未分组'
    default: return code || '未分组'
  }
}

export const getGroupTagColor = (code: string) => {
  switch (code) {
    case 'undergrad': return 'green'
    case 'master': return 'blue'
    case 'phd': return 'orange'
    case 'teacher': return 'red'
    default: return 'default'
  }
}

export const groupDisplay = (code: string, year: number | null) => {
  if ((code === 'undergrad' || code === 'master') && year) {
    const yy = Number(year) % 100
    return `${String(yy).padStart(2, '0')}级${groupName(code)}`
  }
  return groupName(code)
}

interface UserFilter {
  keyword: string
  role: string
  groupSelector: string
  activationStatus: string
}

interface UserPagination {
  page: number
  pageSize: number
}

export function useUserManagement(currentUser: any, username: string) {
  const dispatch = useDispatch<AppDispatch>()
  const users = useSelector(selectUsers)
  const loading = useSelector(selectUsersLoading)

  // 筛选
  const [filter, setFilter] = useState<UserFilter>({
    keyword: '',
    role: '',
    groupSelector: '',
    activationStatus: ''
  })
  const [pagination, setPagination] = useState<UserPagination>({ page: 1, pageSize: 20 })

  // 选中的用户
  const [selectedUserKeys, setSelectedUserKeys] = useState<React.Key[]>([])

  // 对话框状态
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)

  // 趋势/报表
  const [trendsVisible, setTrendsVisible] = useState(false)
  const [reportsVisible, setReportsVisible] = useState(false)
  const [selectedUsername, setSelectedUsername] = useState('')
  const [selectedUserAvatar, setSelectedUserAvatar] = useState('')

  // 过滤后的用户列表
  const filteredUsers = useMemo(() => {
    const kw = (filter.keyword || '').trim().toLowerCase()
    const role = (filter.role || '').trim()
    const sel = (filter.groupSelector || '').trim()
    const activation = (filter.activationStatus || '').trim()

    return (users || []).filter((u: any) => {
      const matchKw = kw
        ? ((u.username || '').toLowerCase().includes(kw) || (u.display_label || '').toLowerCase().includes(kw))
        : true
      const matchRole = role ? u.role === role : true

      let matchGroup = true
      if (sel) {
        if (['unassigned', 'phd', 'teacher'].includes(sel)) {
          matchGroup = u.group === sel
        } else if (sel === 'undergrad:*') {
          matchGroup = u.group === 'undergrad'
        } else if (sel === 'master:*') {
          matchGroup = u.group === 'master'
        } else if (sel.startsWith('undergrad:')) {
          const y = Number(sel.split(':')[1])
          matchGroup = u.group === 'undergrad' && u.entry_year === y
        } else if (sel.startsWith('master:')) {
          const y = Number(sel.split(':')[1])
          matchGroup = u.group === 'master' && u.entry_year === y
        }
      }

      let matchActivation = true
      if (activation === 'activated') matchActivation = u.is_activated === true
      else if (activation === 'not_activated') matchActivation = u.is_activated === false

      return matchKw && matchRole && matchGroup && matchActivation
    })
  }, [users, filter])

  // 分页后的用户列表
  const pagedUsers = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize
    return filteredUsers.slice(start, start + pagination.pageSize)
  }, [filteredUsers, pagination])

  // 分组筛选选项
  const groupFilterOptions = useMemo(() => {
    const opts = [
      { value: '', label: '全部' },
      { value: 'unassigned', label: '未分组' },
      { value: 'undergrad:*', label: '本科生（全部）' },
      { value: 'master:*', label: '硕士生（全部）' },
      { value: 'phd', label: '博士生' },
      { value: 'teacher', label: '教师' }
    ]
    const yearsUndergrad = new Set<number>()
    const yearsMaster = new Set<number>()
    for (const u of users || []) {
      if ((u.group === 'undergrad' || u.group === 'master') && u.entry_year) {
        const y = Number(u.entry_year)
        if (Number.isInteger(y)) {
          if (u.group === 'undergrad') yearsUndergrad.add(y)
          if (u.group === 'master') yearsMaster.add(y)
        }
      }
    }
    Array.from(yearsUndergrad).sort((a, b) => b - a).forEach(y => {
      opts.push({ value: `undergrad:${y}`, label: groupDisplay('undergrad', y) })
    })
    Array.from(yearsMaster).sort((a, b) => b - a).forEach(y => {
      opts.push({ value: `master:${y}`, label: groupDisplay('master', y) })
    })
    return opts
  }, [users])

  // 行是否可选
  const isRowSelectable = useCallback((record: any) => {
    if (record.username === 'admin') return false
    if (record.id === currentUser?.id) return false
    if (record.role === 'admin' && username !== 'admin') return false
    return true
  }, [currentUser, username])

  // 有效选中用户
  const validSelectedUsers = useMemo(() => {
    return (users || []).filter((u: any) => selectedUserKeys.includes(u.id) && isRowSelectable(u))
  }, [users, selectedUserKeys, isRowSelectable])

  // 操作方法
  const handleFilter = useCallback(() => {
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [])

  const resetFilter = useCallback(() => {
    setFilter({ keyword: '', role: '', groupSelector: '', activationStatus: '' })
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [])

  const findUserAvatar = useCallback((name: string) => {
    const target = (users || []).find((u: any) => u.username === name)
    return target?.avatar_url || ''
  }, [users])

  const showTrends = useCallback((uname: string) => {
    setSelectedUsername(uname)
    setSelectedUserAvatar(findUserAvatar(uname))
    setTrendsVisible(true)
  }, [findUserAvatar])

  const showReports = useCallback((uname: string) => {
    setSelectedUsername(uname)
    setSelectedUserAvatar(findUserAvatar(uname))
    setReportsVisible(true)
  }, [findUserAvatar])

  // 打开编辑
  const openEdit = useCallback((user: any) => {
    setEditingUserId(user.id)
    setEditDialogOpen(true)
  }, [])

  // 提交添加用户
  const submitAdd = useCallback(async (values: any) => {
    setSubmitting(true)
    try {
      const result = await dispatch(addUser({
        username: values.username,
        password: values.password,
        role: values.role,
        group: values.group,
        entry_year: ['undergrad', 'master'].includes(values.group) ? values.entry_year : null
      })).unwrap()
      message.success('用户添加成功')
      setAddDialogOpen(false)
      return true
    } catch (error: any) {
      message.error(error || '添加用户失败')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [dispatch])

  // 提交编辑
  const submitEdit = useCallback(async (values: any) => {
    if (!editingUserId) return false
    setSubmitting(true)
    const updateData: any = {
      username: values.username,
      role: values.role,
      group: values.group,
      entry_year: ['undergrad', 'master'].includes(values.group) ? values.entry_year : null
    }
    if (values.password?.trim()) {
      updateData.password = values.password.trim()
    }
    try {
      await dispatch(updateUser({ userId: String(editingUserId), userData: updateData })).unwrap()
      message.success('用户信息更新成功')
      setEditDialogOpen(false)
      return true
    } catch (error: any) {
      message.error(error || '更新用户失败')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [dispatch, editingUserId])

  // 提交批量添加
  const submitBatch = useCallback(async (values: any) => {
    setSubmitting(true)
    const usernames = values.usernames.trim().split('\n').filter(Boolean)
    const usersData = usernames.map((uname: string) => ({
      username: uname.trim(),
      password: values.password,
      role: values.role,
      group: values.group,
      entry_year: ['undergrad', 'master'].includes(values.group) ? values.entry_year : null
    }))
    try {
      await dispatch(addUsers(usersData)).unwrap()
      message.success('批量添加用户成功')
      setBatchDialogOpen(false)
      return true
    } catch (error: any) {
      message.error(error || '批量添加用户失败')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [dispatch])

  // 删除用户
  const confirmDelete = useCallback(async (user: any) => {
    if (user.id === currentUser?.id) {
      message.error('不能删除自己的账户')
      return
    }
    try {
      const resp = await axios.get('/api/containers')
      const containers = (resp.data?.containers || []).filter(
        (c: any) => c.user_id === user.id && c.status !== 'deleted'
      )
      if (containers.length > 0) {
        const detail = containers.map((c: any) => ` - ${c.container_name} @ ${c.server_name}`).join('\n')
        Modal.warning({
          title: '存在容器资源，无法删除',
          content: `用户 ${user.username} 仍拥有以下容器：\n${detail}\n\n请先在容器管理中删除或转移以上容器，再删除该用户。`,
        })
        return
      }
    } catch {
      message.error('获取容器列表失败，无法执行删除前检查')
      return
    }

    Modal.confirm({
      title: '警告',
      content: `确定要删除用户 "${user.username}" 吗？此操作不可恢复！`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteUser(String(user.id))).unwrap()
          message.success('用户删除成功')
        } catch (error: any) {
          message.error(error || '删除用户失败')
        }
      }
    })
  }, [dispatch, currentUser])

  // 批量删除
  const confirmBatchDelete = useCallback(async () => {
    const list = validSelectedUsers
    if (!list.length) {
      message.warning('请选择可删除的用户')
      return
    }
    try {
      const resp = await axios.get('/api/containers')
      const allContainers = resp.data?.containers || []
      const withContainers = list
        .map((u: any) => ({
          user: u,
          containers: allContainers.filter((c: any) => c.user_id === u.id && c.status !== 'deleted')
        }))
        .filter((x: any) => x.containers.length > 0)

      if (withContainers.length > 0) {
        const detail = withContainers
          .map((x: any) => `用户 ${x.user.username} 拥有容器:\n` + x.containers.map((c: any) => ` - ${c.container_name} @ ${c.server_name}`).join('\n'))
          .join('\n\n')
        Modal.warning({
          title: '存在容器资源，无法删除',
          content: `${detail}\n\n请先在容器管理中删除或转移以上容器，再执行批量删除用户。`,
        })
        return
      }
    } catch {
      message.error('获取容器列表失败，无法执行批量删除前检查')
      return
    }

    const names = list.map((u: any) => u.username).join(', ')
    Modal.confirm({
      title: '批量删除确认',
      content: `确定要批量删除以下用户吗？\n${names}`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          for (const u of list) {
            await dispatch(deleteUser(String(u.id))).unwrap()
          }
          message.success(`已删除 ${list.length} 个用户`)
          setSelectedUserKeys([])
          await dispatch(fetchUsers())
        } catch {
          message.error('批量删除过程中出现错误')
        }
      }
    })
  }, [dispatch, validSelectedUsers])

  return {
    users, loading, filter, setFilter, pagination, setPagination,
    filteredUsers, pagedUsers, groupFilterOptions,
    selectedUserKeys, setSelectedUserKeys, validSelectedUsers,
    isRowSelectable,
    addDialogOpen, setAddDialogOpen,
    editDialogOpen, setEditDialogOpen, editingUserId, openEdit,
    batchDialogOpen, setBatchDialogOpen,
    submitting,
    submitAdd, submitEdit, submitBatch,
    confirmDelete, confirmBatchDelete,
    handleFilter, resetFilter,
    trendsVisible, setTrendsVisible,
    reportsVisible, setReportsVisible,
    selectedUsername, selectedUserAvatar,
    showTrends, showReports
  }
}
