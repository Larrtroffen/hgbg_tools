/**
 * 现代化存储抽象层 - 完全异步化设计
 * 支持本地存储和 RESTful API 存储，便于后续扩展
 * 多端同步：防抖保存、重试退避、可见性拉取、可选版本冲突检测（参考 Remote Save 思路）
 */

import type { Ref } from 'vue'
import { customRef, ref, watch } from 'vue'

/** 带版本的读取结果，用于多端冲突检测 */
export interface StorageGetResult {
  value: string | null
  version?: number
}

/**
 * 存储引擎接口 - 完全异步化
 */
export interface StorageEngine {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  remove: (key: string) => Promise<void>
  has: (key: string) => Promise<boolean>
  clear: () => Promise<void>
  keys: () => Promise<string[]>
}

/** 支持版本化读写的扩展接口（可选） */
export interface VersionedStorageEngine extends StorageEngine {
  getWithVersion?: (key: string) => Promise<StorageGetResult>
  setWithVersion?: (key: string, value: string, ifMatch?: number) => Promise<{ version: number } | void>
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: Parameters<T>) => {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, ms)
  }) as T
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number, baseMs?: number, shouldRetry?: (e: unknown) => boolean } = {},
): Promise<T> {
  const { maxAttempts = 4, baseMs = 600, shouldRetry = () => true } = options
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    }
    catch (e) {
      lastError = e
      if (!shouldRetry(e) || attempt >= maxAttempts - 1)
        throw lastError
      const delay = baseMs * 2 ** attempt
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastError
}

/**
 * 本地存储引擎 - 使用 localStorage
 */
export class LocalStorageEngine implements StorageEngine {
  async get(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key)
    }
    catch (error) {
      console.error(`[Storage] Failed to get item:`, key, error)
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value)
    }
    catch (error) {
      console.error(`[Storage] Failed to set item:`, key, error)
      throw error
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key)
    }
    catch (error) {
      console.error(`[Storage] Failed to remove item:`, key, error)
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return localStorage.getItem(key) !== null
    }
    catch {
      return false
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear()
    }
    catch (error) {
      console.error(`[Storage] Failed to clear storage:`, error)
    }
  }

  async keys(): Promise<string[]> {
    try {
      return Object.keys(localStorage)
    }
    catch {
      return []
    }
  }
}

const REMOTE_RETRY_BASE_MS = 500

/**
 * RESTful API 存储引擎 - 用于远程存储
 * 支持重试退避、可选版本化读写与冲突检测
 */
export class RestfulStorageEngine implements StorageEngine {
  constructor(
    private baseURL: string,
    private getAuthToken?: () => string | null,
  ) {}

  private async request(
    method: string,
    endpoint: string,
    data?: any,
    extraHeaders?: HeadersInit,
  ): Promise<any> {
    const url = `${this.baseURL}${endpoint}`
    const headers: HeadersInit = {
      'Content-Type': `application/json`,
      ...extraHeaders,
    }
    const token = this.getAuthToken?.()
    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`
    }
    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    })
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('NOT_FOUND')
      }
      if (response.status === 409) {
        const err = new Error('CONFLICT') as Error & { version?: number }
        try {
          const body = await response.json()
          err.version = body.version
        }
        catch { /* no body */ }
        throw err
      }
      throw new Error(`Storage API error: ${response.statusText}`)
    }
    const text = await response.text()
    if (!text || !text.trim()) {
      return {}
    }
    const first = text.trimStart()[0]
    if (first !== '{' && first !== '[') {
      throw new Error(`Storage API returned non-JSON: ${text.slice(0, 80)}`)
    }
    try {
      return JSON.parse(text) as any
    }
    catch {
      throw new Error(`Storage API invalid JSON`)
    }
  }

  async get(key: string): Promise<string | null> {
    return retryWithBackoff(async () => {
      try {
        const result = await this.request(`GET`, `/storage/${encodeURIComponent(key)}`)
        return result.value ?? null
      }
      catch (e) {
        if (e instanceof Error && e.message === 'NOT_FOUND') {
          return null
        }
        throw e
      }
    }, { baseMs: REMOTE_RETRY_BASE_MS })
  }

  async getWithVersion(key: string): Promise<StorageGetResult> {
    return retryWithBackoff(async () => {
      try {
        const result = await this.request(`GET`, `/storage/${encodeURIComponent(key)}`)
        return {
          value: result.value ?? null,
          version: result.version,
        }
      }
      catch (e) {
        if (e instanceof Error && e.message === 'NOT_FOUND') {
          return { value: null, version: undefined }
        }
        throw e
      }
    }, { baseMs: REMOTE_RETRY_BASE_MS })
  }

  async set(key: string, value: string): Promise<void> {
    await retryWithBackoff(() =>
      this.request(`POST`, `/storage`, { key, value }), { baseMs: REMOTE_RETRY_BASE_MS })
  }

  async setWithVersion(key: string, value: string, ifMatch?: number): Promise<{ version: number } | void> {
    const body: { key: string, value: string, ifMatch?: number } = { key, value }
    if (ifMatch !== undefined)
      body.ifMatch = ifMatch
    const result = await retryWithBackoff(
      () => this.request(`POST`, `/storage`, body),
      {
        baseMs: REMOTE_RETRY_BASE_MS,
        shouldRetry: e => !(e instanceof Error && e.message === 'CONFLICT'),
      },
    )
    return result?.version != null ? { version: result.version } : undefined
  }

  async remove(key: string): Promise<void> {
    await this.request(`DELETE`, `/storage/${encodeURIComponent(key)}`)
  }

  async has(key: string): Promise<boolean> {
    try {
      await this.request(`HEAD`, `/storage/${encodeURIComponent(key)}`)
      return true
    }
    catch {
      return false
    }
  }

  async clear(): Promise<void> {
    await this.request(`DELETE`, `/storage`)
  }

  async keys(): Promise<string[]> {
    const result = await this.request(`GET`, `/storage/keys`)
    return result.keys ?? []
  }
}

/** 远程引擎下防抖保存的毫秒数，减少多端并发写入与请求风暴 */
const SAVE_DEBOUNCE_MS = 800

/**
 * 统一存储管理器
 * 支持防抖保存、失败重试、可见性拉取（refreshKey）、可选版本冲突处理
 */
class StorageManager {
  private engine: StorageEngine = new LocalStorageEngine()
  /** 用于 visibility 拉取时更新 reactive 的 ref，避免刷新触发误保存；可选版本号用于冲突时拉取最新 */
  private reactiveMeta = new Map<string, {
    ref: Ref<unknown>
    isString: boolean
    setRefreshing: (v: boolean) => void
    getVersion?: () => number
    setVersion?: (v: number) => void
  }>()

  /**
   * 切换存储引擎
   */
  setEngine(engine: StorageEngine): void {
    this.engine = engine
  }

  /**
   * 获取当前引擎
   */
  getEngine(): StorageEngine {
    return this.engine
  }

  /**
   * 获取字符串值
   */
  async get(key: string): Promise<string | null> {
    return this.engine.get(key)
  }

  /**
   * 设置字符串值
   */
  async set(key: string, value: string): Promise<void> {
    return this.engine.set(key, value)
  }

  /**
   * 获取 JSON 值（带默认值重载）
   */
  async getJSON<T>(key: string, defaultValue: T): Promise<T>
  async getJSON<T>(key: string): Promise<T | null>
  async getJSON<T>(key: string, defaultValue?: T): Promise<T | null> {
    const value = await this.engine.get(key)
    if (!value) {
      return (defaultValue ?? null) as T | null
    }

    try {
      return JSON.parse(value) as T
    }
    catch (error) {
      console.error(`[Storage] Failed to parse JSON for key:`, key, error)
      return (defaultValue ?? null) as T | null
    }
  }

  /**
   * 设置 JSON 值
   */
  async setJSON<T>(key: string, value: T): Promise<void> {
    try {
      const jsonString = JSON.stringify(value)
      return this.engine.set(key, jsonString)
    }
    catch (error) {
      console.error(`[Storage] Failed to stringify JSON for key:`, key, error)
      throw error
    }
  }

  /**
   * 删除值
   */
  async remove(key: string): Promise<void> {
    return this.engine.remove(key)
  }

  /**
   * 检查键是否存在
   */
  async has(key: string): Promise<boolean> {
    return this.engine.has(key)
  }

  /**
   * 清空所有存储
   */
  async clear(): Promise<void> {
    return this.engine.clear()
  }

  /**
   * 获取所有键
   */
  async keys(): Promise<string[]> {
    return this.engine.keys()
  }

  /**
   * 从远程拉取指定 key 并更新已注册的 reactive ref（多端/可见性恢复时同步最新）
   */
  async refreshKey(key: string): Promise<void> {
    const meta = this.reactiveMeta.get(key)
    if (!meta)
      return
    meta.setRefreshing(true)
    try {
      const eng = this.engine as VersionedStorageEngine
      const result = eng.getWithVersion
        ? await eng.getWithVersion(key)
        : { value: await this.engine.get(key), version: undefined as number | undefined }
      if (result.value !== null) {
        const parsed = meta.isString
          ? result.value
          : (() => {
              try {
                return JSON.parse(result.value!)
              }
              catch {
                return (meta.ref as Ref<unknown>).value
              }
            })()
        ;(meta.ref as Ref<unknown>).value = parsed
        if (result.version != null && meta.setVersion)
          meta.setVersion(result.version)
      }
    }
    finally {
      meta.setRefreshing(false)
    }
  }

  /**
   * 创建响应式存储引用
   * - 对于 LocalStorageEngine：同步读取初始值，确保首次渲染正确
   * - 对于其他引擎：异步加载，加载完成后更新；保存防抖 + 失败重试，多端更稳
   * - 自动监听变化并保存到存储；远程引擎支持 refreshKey 拉取最新
   */
  reactive<T>(key: string, defaultValue: T): Ref<T> {
    const isStringType = typeof defaultValue === `string`
    let initialValue: T = defaultValue

    // LocalStorageEngine 同步读取初始值
    if (this.engine instanceof LocalStorageEngine) {
      try {
        const stored = localStorage.getItem(key)
        if (stored !== null) {
          initialValue = isStringType ? (stored as T) : this.parseJSON(stored, defaultValue)
        }
      }
      catch (error) {
        console.error(`[Storage] Failed to read initial value:`, key, error)
      }
    }

    const data = ref<T>(initialValue) as Ref<T>

    // 远程引擎：首次拉取完成前禁止保存；刷新时禁止保存，避免覆盖刚拉取的数据；可选版本号用于冲突时拉取最新
    const isLocal = this.engine instanceof LocalStorageEngine
    const versioned = !isLocal && !!(this.engine as VersionedStorageEngine).getWithVersion && !!(this.engine as VersionedStorageEngine).setWithVersion
    let initialLoadDone = isLocal
    let isRefreshing = false
    const setRefreshing = (v: boolean) => { isRefreshing = v }
    let lastVersion = 0
    const getVersion = () => lastVersion
    const setVersion = (v: number) => { lastVersion = v }

    if (!isLocal) {
      this.reactiveMeta.set(key, {
        ref: data as Ref<unknown>,
        isString: isStringType,
        setRefreshing,
        ...(versioned ? { getVersion, setVersion } : {}),
      })
      const eng = this.engine as VersionedStorageEngine
      const loadAsync = versioned && eng.getWithVersion
        ? eng.getWithVersion(key).then((r) => {
            if (r.version != null)
              setVersion(r.version)
            return r.value !== null ? (isStringType ? r.value as T : this.parseJSON(r.value!, defaultValue) as T) : null
          })
        : isStringType
          ? this.get(key).then(value => value !== null ? (value as T) : null)
          : this.getJSON<T>(key, defaultValue)

      loadAsync.then((value) => {
        if (value !== null) {
          data.value = value
        }
        initialLoadDone = true
      })
    }

    const doSave = async (value: T) => {
      const eng = this.engine as VersionedStorageEngine
      const str = isStringType ? (value as string) : JSON.stringify(value)
      try {
        if (versioned && eng.setWithVersion) {
          const result = await eng.setWithVersion(key, str, getVersion())
          if (result?.version != null)
            setVersion(result.version)
        }
        else {
          await this.set(key, str)
        }
      }
      catch (error) {
        if (error instanceof Error && error.message === 'CONFLICT' && versioned && eng.getWithVersion) {
          setRefreshing(true)
          try {
            const r = await eng.getWithVersion(key)
            if (r.value !== null) {
              const parsed = isStringType ? r.value : this.parseJSON(r.value, defaultValue as T)
              data.value = parsed as T
              if (r.version != null)
                setVersion(r.version)
            }
          }
          finally {
            setRefreshing(false)
          }
          return
        }
        console.error(`[Storage] Failed to save reactive data:`, key, error)
      }
    }

    const save = isLocal
      ? (value: T) => { doSave(value) }
      : debounce((value: T) => {
          if (!initialLoadDone || isRefreshing)
            return
          doSave(value)
        }, SAVE_DEBOUNCE_MS)

    // 监听变化并自动保存（远程引擎：防抖 + 刷新期间不写回）
    Promise.resolve().then(() => {
      watch(
        data,
        (newValue) => {
          if (!initialLoadDone)
            return
          save(newValue)
        },
        { deep: true },
      )
    })

    return data
  }

  /**
   * 创建自定义响应式存储引用
   * 支持自定义 getter/setter 转换逻辑
   */
  customReactive<T>(
    key: string,
    defaultValue: T,
    options?: {
      get?: (stored: T | null) => T
      set?: (value: T) => T
    },
  ): Ref<T> {
    let cachedValue: T = defaultValue

    // 异步加载初始值
    this.getJSON<T>(key, defaultValue).then((value) => {
      const stored = value ?? defaultValue
      cachedValue = options?.get ? options.get(stored) : stored
    })

    return customRef<T>((track, trigger) => ({
      get() {
        track()
        return cachedValue
      },
      set: (newValue: T) => {
        const valueToStore = options?.set ? options.set(newValue) : newValue
        cachedValue = valueToStore
        trigger()

        // 异步保存
        this.setJSON(key, valueToStore).catch((error: any) => {
          console.error(`[Storage] Failed to save custom reactive data:`, key, error)
        })
      },
    }))
  }

  /**
   * 解析 JSON 字符串的辅助方法
   */
  private parseJSON<T>(value: string, fallback: T): T {
    try {
      return JSON.parse(value) as T
    }
    catch {
      console.warn(`[Storage] Failed to parse JSON, using fallback`)
      return fallback
    }
  }
}

/**
 * 全局存储实例 - 统一通过 store.xxx 调用
 */
export const store = new StorageManager()
