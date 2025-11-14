# 🔧 Claude API 故障排除指南

## 问题诊断

如果您在使用 Claude API 格式时遇到 **"400 Bad Request"** 错误，请按照以下步骤排查。

---

## 🔍 常见错误原因

### 1. **缺少必需参数 `max_tokens`**

❌ **错误示例**：
```json
{
  "model": "gpt-4o",
  "messages": [{"role": "user", "content": "你好"}]
  // 缺少 max_tokens
}
```

✅ **正确示例**：
```json
{
  "model": "gpt-4o",
  "max_tokens": 1024,  // ← 必需参数
  "messages": [{"role": "user", "content": "你好"}]
}
```

**Claude API 要求 `max_tokens` 为必需参数**，而 OpenAI API 中是可选的。

---

### 2. **使用了不支持的模型名称** ⚠️ 最常见错误

**错误日志示例**：
```
[Claude API] Copilot API error: 400 - {
  "error": {
    "message": "The requested model is not supported.",
    "code": "model_not_supported",
    "param": "model",
    "type": "invalid_request_error"
  }
}
```

❌ **Claude 官方 API 的模型名称（不支持）**：
```python
# 这些是 Claude 官方 API 的模型名称，本代理不支持
model = "claude-3-opus-20240229"
model = "claude-3-5-sonnet-20241022"
model = "claude-3-sonnet-20240229"
model = "claude-3-haiku-20240307"
model = "claude-3-5-haiku-20241022"
model = "claude-sonnet-4-20250514"  # 日期格式
```

✅ **Copilot 支持的模型名称（正确）**：
```python
# GPT 系列
model = "gpt-4o"            # GPT-4 Omni (支持视觉) ⭐ 推荐
model = "gpt-4"             # GPT-4
model = "gpt-4o-mini"       # GPT-4 Omni Mini (支持视觉)
model = "gpt-5"             # GPT-5
model = "gpt-4.1"           # GPT-4.1

# Claude 系列 (注意：使用 Copilot 的命名格式)
model = "claude-sonnet-4.5" # Claude Sonnet 4.5 ⭐ 推荐
model = "claude-sonnet-4"   # Claude Sonnet 4
model = "claude-opus-41"    # Claude Opus 4.1
model = "claude-haiku-4.5"  # Claude Haiku 4.5

# Gemini 系列
model = "gemini-2.5-pro"    # Gemini 2.5 Pro
```

**重要提示**：
- ❌ 不要使用带日期的模型名称（如 `claude-3-opus-20240229`）
- ✅ 使用简化的版本号格式（如 `claude-sonnet-4.5`）
- ✅ 可以通过 `GET /v1/models` 查看所有支持的模型

---

### 3. **消息格式错误**

❌ **错误的消息格式**：
```json
{
  "messages": [
    {"role": "system", "content": "你是助手"}  // ← 不支持 system 角色
  ]
}
```

✅ **正确使用系统提示词**：
```json
{
  "system": "你是助手",  // ← 使用 system 参数
  "messages": [
    {"role": "user", "content": "你好"}
  ]
}
```

---

### 4. **认证问题**

如果远程访问但未配置 `ACCESS_TOKEN`：

```bash
# 设置访问令牌
export ACCESS_TOKEN="your-secret-token"
npm start
```

然后使用该令牌：
```python
client = Anthropic(
    api_key="your-secret-token",  # 使用真实的 token
    base_url="http://your-server:3000"
)
```

---

## 🧪 测试步骤

### 步骤 1: 确认服务正在运行

```bash
curl http://localhost:3000/health
```

**预期响应**：
```json
{"status":"ok","timestamp":1699999999999}
```

---

### 步骤 2: 测试最简单的请求

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 100,
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

**预期响应**：
```json
{
  "id": "msg_xxx",
  "type": "message",
  "role": "assistant",
  "content": [
    {"type": "text", "text": "你好！有什么我可以帮助你的吗？"}
  ],
  "model": "gpt-4o",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 8,
    "output_tokens": 15
  }
}
```

---

### 步骤 3: 运行完整测试套件

```bash
./test-claude.sh
```

这会运行 7 项测试，帮助识别具体问题。

---

## 🐛 特定场景的错误

### 场景 1: 在 Claude Code 中使用

如果您在 VS Code 的 Claude Code 扩展中配置了本代理，可能遇到的问题：

**问题**: Claude Code 可能发送特定的请求头或参数

**解决方案**:
1. 检查 Claude Code 的配置，确保：
   - `base_url` 设置为 `http://localhost:3000`
   - API key 可以是任意值（本地访问）

2. 查看服务器日志：
```bash
npm run dev
# 然后在另一个终端查看输出
```

---

### 场景 2: Copilot Token 过期

**错误信息**: "Unauthorized. Please authorize first."

**解决方案**:
1. 在浏览器打开 `http://localhost:3000`
2. 点击"开始授权"
3. 完成 GitHub 授权流程

**验证授权状态**:
```bash
curl http://localhost:3000/api/status
```

---

### 场景 3: 使用工具调用（Tools）

**问题**: 当前实现不支持工具调用

如果您的代码包含 `tools` 参数：
```python
# ❌ 不支持
message = client.messages.create(
    model="gpt-4o",
    max_tokens=1024,
    tools=[...],  # ← 会被忽略或导致错误
    messages=[...]
)
```

**解决方案**: 移除 `tools` 和 `tool_choice` 参数

---

## 📋 完整的请求示例

### Python (Anthropic SDK)

```python
from anthropic import Anthropic

client = Anthropic(
    api_key="dummy-key",
    base_url="http://localhost:3000"
)

try:
    message = client.messages.create(
        model="gpt-4o",           # 必需
        max_tokens=1024,          # 必需
        temperature=0.7,          # 可选
        system="你是一个有帮助的助手",  # 可选
        messages=[
            {"role": "user", "content": "你好"}
        ]
    )
    print(message.content[0].text)
    
except Exception as e:
    print(f"错误: {e}")
    # 查看详细错误信息
    import traceback
    traceback.print_exc()
```

### cURL

```bash
curl -v -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: dummy-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 1024,
    "system": "你是一个有帮助的助手",
    "messages": [
      {
        "role": "user",
        "content": "你好"
      }
    ]
  }'
```

使用 `-v` 参数可以看到完整的请求和响应头。

---

## 🔍 调试技巧

### 1. 启用详细日志

修改 `src/index.ts` 中的日志级别（已经有详细日志）：
```typescript
console.log('[Claude API] Received request to /v1/messages')
console.log(`[Claude API] Request validated - Model: ${claudeRequest.model}`)
```

### 2. 检查请求体

在发送请求前，先打印请求体：
```python
import json

request_body = {
    "model": "gpt-4o",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好"}]
}

print("发送的请求:")
print(json.dumps(request_body, indent=2, ensure_ascii=False))

# 然后发送请求
message = client.messages.create(**request_body)
```

### 3. 使用 jq 格式化响应

```bash
curl ... | jq '.'
```

### 4. 检查服务器日志

```bash
# 启动服务时查看日志
npm run dev

# 在另一个终端发送请求
curl ...

# 观察第一个终端的输出
```

---

## ✅ 验证清单

在报告问题前，请检查：

- [ ] 服务器正在运行 (`npm run dev`)
- [ ] GitHub Copilot 已授权（访问 http://localhost:3000 检查状态）
- [ ] 请求包含 `max_tokens` 参数
- [ ] 使用了正确的模型名称（不是 Claude 官方格式）
- [ ] 消息格式正确（只有 user/assistant 角色）
- [ ] 如果使用系统提示词，使用 `system` 参数而不是消息角色
- [ ] 请求头包含 `Content-Type: application/json`
- [ ] 本地访问使用任意 `x-api-key`，远程访问使用正确的 token

---

## 📞 获取帮助

如果问题仍未解决：

1. **查看服务器日志** - 最重要的调试信息
2. **运行测试脚本** - `./test-claude.sh` 查看哪个测试失败
3. **对比工作示例** - 参考 `CLAUDE_API.md` 中的示例
4. **检查兼容性** - 查看 `CLAUDE_COMPATIBILITY.md` 确认功能支持

---

## 🎯 常见成功案例

### ✅ 基础对话 - 工作正常

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{"model":"gpt-4o","max_tokens":100,"messages":[{"role":"user","content":"你好"}]}'
```

### ✅ 带系统提示词 - 工作正常

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model":"gpt-4o",
    "max_tokens":100,
    "system":"你是一个友好的助手",
    "messages":[{"role":"user","content":"介绍一下你自己"}]
  }'
```

### ✅ 图片识别 - 工作正常

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model":"gpt-4o",
    "max_tokens":200,
    "messages":[{
      "role":"user",
      "content":[
        {"type":"text","text":"描述这张图片"},
        {"type":"image","source":{"type":"url","url":"https://example.com/image.jpg","media_type":"image/jpeg"}}
      ]
    }]
  }'
```

---

## 🔗 相关文档

- [CLAUDE_API.md](CLAUDE_API.md) - 使用指南
- [CLAUDE_COMPATIBILITY.md](CLAUDE_COMPATIBILITY.md) - 兼容性详情
- [README.md](README.md) - 项目总览
