# 更新日志

## [1.1.0] - 2025-10-21

### ✨ 新增功能

- **动态模型列表**: `/v1/models` 端点现在从 GitHub Copilot API 动态获取真实的可用模型列表
  - 不再使用硬编码的模型列表
  - 自动获取账户可用的所有模型
  - 实时反映 Copilot 的模型更新

### 🔧 技术改进

- 在 `CopilotService` 类中新增 `getModels()` 方法
- 改进 `/v1/models` 端点的错误处理
- 添加更友好的错误响应格式

### 📖 使用方式

```bash
# 获取可用模型列表
curl http://localhost:3000/v1/models
```

响应示例：
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1677610602,
      "owned_by": "github-copilot"
    },
    // ... 更多模型
  ]
}
```

## [1.0.0] - 2025-10-21

### 🎉 首次发布

- 完整的 GitHub Copilot OAuth 授权流程
- OpenAI 兼容的 Chat Completions API
- 友好的 Web UI 界面
- 本地 Token 存储和自动刷新
- 支持流式响应
- 完整的文档和示例代码
