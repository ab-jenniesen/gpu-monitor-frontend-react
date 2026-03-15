/**
 * 用户名冲突检测工具
 * 用于检测容器名称是否与现有用户名产生模糊匹配冲突
 */

/**
 * 检查容器名称是否与其他用户名产生冲突
 * @param {string} containerName - 容器名称
 * @param {string} currentUsername - 当前用户名（自己的用户名允许匹配）
 * @param {Array} allUsers - 所有用户列表
 * @returns {Array} 冲突信息数组，如果无冲突则返回空数组
 */
export function checkContainerNameConflicts(containerName: string, currentUsername: string, allUsers: any[]) {
  if (!containerName || !allUsers) {
    return []
  }

  const containerNameLower = containerName.toLowerCase().trim()
  const currentUsernameLower = currentUsername ? currentUsername.toLowerCase().trim() : ''
  const conflicts = []

  for (const user of allUsers) {
    const usernameLower = user.username.toLowerCase().trim()

    // 跳过当前用户（自己的用户名允许匹配）
    if (usernameLower === currentUsernameLower) {
      continue
    }

    // 检查双向包含关系，但排除完全相同的情况
    if (containerNameLower !== usernameLower) {
      if (containerNameLower.includes(usernameLower)) {
        conflicts.push(`容器名称 '${containerName}' 包含其他用户名 '${user.username}'`)
      } else if (usernameLower.includes(containerNameLower)) {
        conflicts.push(`容器名称 '${containerName}' 被其他用户名 '${user.username}' 包含`)
      }
    }
  }

  return conflicts
}

/**
 * 创建 Ant Design Form 验证规则
 * @param {string} currentUsername
 * @param {Array} allUsers
 * @returns {Array} Ant Design rules 数组
 */
export function createContainerNameRules(currentUsername: string, allUsers: string[]) {
  return [
    { required: true, message: '请输入容器名称' },
    { min: 2, max: 50, message: '容器名称长度在 2 到 50 个字符' },
    {
      // Ant Design 的自定义 validator 返回 Promise
      validator: (_: any, value: string) => {
        if (!value || !allUsers?.length || !currentUsername) {
          return Promise.resolve()
        }

        if (value.toLowerCase() === currentUsername.toLowerCase()) {
          return Promise.resolve()
        }

        const conflicts = checkContainerNameConflicts(value, currentUsername, allUsers)
        if (conflicts.length > 0) {
          return Promise.reject(new Error(`名称冲突：${conflicts[0]}`))
        }

        return Promise.resolve()
      },
      validateTrigger: 'onBlur' // 对应 Vue 的 trigger: ['blur']
    }
  ]
}