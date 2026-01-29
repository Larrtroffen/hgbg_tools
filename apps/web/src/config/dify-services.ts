/**
 * Dify 工作流服务配置
 * 用于 AI 选项卡中调用 Dify 工作流（如论文简析/文章编译）
 */
export interface DifyServiceOption {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  /** 工作流输入中文件变量的名称，如 paper */
  fileInputKey?: string
  /** 工作流输出变量名，如 oneOutput */
  outputKey?: string
  /** 新建内容时的默认标题 */
  defaultTitle?: string
}

const DEFAULT_ARTICLE_SERVICE: DifyServiceOption = {
  id: `article-compile`,
  name: `文章编译`,
  baseUrl: `https://api.dify.ai/v1`,
  apiKey: ``,
  fileInputKey: `paper`,
  outputKey: `oneOutput`,
  defaultTitle: `论文简析`,
}

/** 可扩展的 Dify 服务列表（可持久化后支持用户自定义添加） */
export const defaultDifyServices: DifyServiceOption[] = [
  DEFAULT_ARTICLE_SERVICE,
]

export const DEFAULT_DIFY_SERVICE_ID = DEFAULT_ARTICLE_SERVICE.id
