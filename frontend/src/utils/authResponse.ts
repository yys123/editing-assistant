export async function parseAuthResponse(response: Response, fallbackMessage: string) {
  const text = await response.text()
  let data: any = null

  if (text.trim()) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('后端服务返回了非预期响应，请刷新后重试')
    }
  }

  if (!response.ok) {
    throw new Error(data?.detail || '后端服务未返回有效响应，请确认服务已启动')
  }

  if (!data) {
    throw new Error(fallbackMessage)
  }

  return data
}
