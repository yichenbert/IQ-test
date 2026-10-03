import type { LLMConfig } from '../types'

/**
 * 遮罩脱敏 API 密钥，防止他人偷窥或录屏泄露
 */
export function maskApiKey(key: string): string {
  if (!key) return ''
  const trimmed = key.trim()
  if (trimmed.length <= 8) {
    return '••••••••'
  }
  const prefix = trimmed.slice(0, 4)
  const suffix = trimmed.slice(-4)
  return `${prefix}••••••••${suffix}`
}

/**
 * 安全导出配置（将敏感信息进行 Base64 混淆或口令加扰，便于在 GitHub Pages 挂载站与本地之间无缝同步）
 */
export function exportConfigToken(config: LLMConfig, passCode?: string): string {
  const payload = {
    apiKey: config.apiKey || '',
    baseURL: config.baseURL || 'https://api.openai.com/v1',
    model: config.model || 'gpt-4o',
    temperature: config.temperature ?? 0.1,
    exportedAt: Date.now(),
    passCode: passCode || '',
  }
  const jsonStr = JSON.stringify(payload)
  
  // 简易可逆加扰（基于口令与位异或）
  const salt = passCode || 'IQ_SHIELD_SECURE_2024'
  let obfuscated = ''
  for (let i = 0; i < jsonStr.length; i++) {
    const charCode = jsonStr.charCodeAt(i) ^ salt.charCodeAt(i % salt.length)
    obfuscated += String.fromCharCode(charCode)
  }
  
  try {
    return btoa(encodeURIComponent(obfuscated))
  } catch {
    return btoa(unescape(encodeURIComponent(jsonStr)))
  }
}

/**
 * 导入并解密配置
 */
export function importConfigToken(token: string, passCode?: string): LLMConfig | null {
  try {
    const raw = decodeURIComponent(atob(token.trim()))
    const salt = passCode || 'IQ_SHIELD_SECURE_2024'
    let deobfuscated = ''
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i) ^ salt.charCodeAt(i % salt.length)
      deobfuscated += String.fromCharCode(charCode)
    }

    let parsed: any = null
    try {
      parsed = JSON.parse(deobfuscated)
    } catch {
      // Fallback direct JSON
      parsed = JSON.parse(decodeURIComponent(escape(atob(token.trim()))))
    }

    if (parsed && typeof parsed.baseURL === 'string') {
      return {
        apiKey: parsed.apiKey || '',
        baseURL: parsed.baseURL || 'https://api.openai.com/v1',
        model: parsed.model || 'gpt-4o',
        temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0.1,
        isKeyProtected: Boolean(parsed.passCode || parsed.isKeyProtected),
        accessPasscode: parsed.passCode || '',
      }
    }
  } catch (e) {
    console.warn('Failed to parse config token', e)
  }
  return null
}
