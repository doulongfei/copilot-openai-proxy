# 🤖 Claude API 格式支持

本项目现已支持 **Claude API 格式**！您可以使用 Claude 的消息 API 格式与 GitHub Copilot 进行交互。

## ✨ 特性

- ✅ **完全兼容** Claude Messages API 格式
- ✅ **系统提示词** 支持（`system` 参数）
- ✅ **流式响应** 支持（`stream: true`）
- ✅ **多模态支持** 图片输入（文本 + 图片）
- ✅ **所有高级特性** 温度、top_p、top_k、stop_sequences 等
- ✅ **标准认证** 使用 `x-api-key` header

## 🚀 快速开始

### Python (Anthropic SDK)

```python
from anthropic import Anthropic

client = Anthropic(
    api_key="dummy-key",  # 本地使用可以是任意值
    base_url="http://localhost:3000"
)

message = client.messages.create(
    model="gpt-4o",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude!"}
    ]
)

print(message.content[0].text)
```

### Python (使用 httpx)

```python
import httpx

response = httpx.post(
    "http://localhost:3000/v1/messages",
    headers={
        "x-api-key": "dummy-key",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    },
    json={
        "model": "gpt-4o",
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": "Hello!"}
        ]
    }
)

data = response.json()
print(data["content"][0]["text"])
```

### cURL

```bash
curl http://localhost:3000/v1/messages \
  -H "x-api-key: dummy-key" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello, world"}
    ]
  }'
```

### Node.js / JavaScript

```javascript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: 'dummy-key',
  baseURL: 'http://localhost:3000'
})

const message = await client.messages.create({
  model: 'gpt-4o',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello, Claude!' }
  ]
})

console.log(message.content[0].text)
```

## 📖 使用示例

### 1. 基础对话

```python
message = client.messages.create(
    model="gpt-4o",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "解释一下什么是机器学习"}
    ]
)

print(message.content[0].text)
```

### 2. 系统提示词

```python
message = client.messages.create(
    model="gpt-4o",
    max_tokens=1024,
    system="你是一位专业的 Python 编程导师，请用简洁易懂的方式回答问题。",
    messages=[
        {"role": "user", "content": "如何在 Python 中读取 CSV 文件？"}
    ]
)

print(message.content[0].text)
```

### 3. 多轮对话

```python
message = client.messages.create(
    model="gpt-4o",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "我叫张三"},
        {"role": "assistant", "content": "你好张三！很高兴认识你。"},
        {"role": "user", "content": "我的名字是什么？"}
    ]
)

print(message.content[0].text)  # 应该会回答"张三"
```

### 4. 流式响应

```python
with client.messages.stream(
    model="gpt-4o",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "写一首关于春天的短诗"}
    ]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

或者使用原始流式 API：

```python
import httpx

with httpx.stream(
    "POST",
    "http://localhost:3000/v1/messages",
    headers={
        "x-api-key": "dummy-key",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    },
    json={
        "model": "gpt-4o",
        "max_tokens": 1024,
        "stream": True,
        "messages": [
            {"role": "user", "content": "数从 1 到 10"}
        ]
    }
) as response:
    for line in response.iter_lines():
        if line.startswith("data: "):
            print(line)
```

### 5. 图片识别（多模态）

```python
import base64

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

base64_image = encode_image("photo.jpg")

message = client.messages.create(
    model="gpt-4o",  # 需要支持视觉的模型
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "这张图片里有什么？请详细描述。"
                },
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": base64_image
                    }
                }
            ]
        }
    ]
)

print(message.content[0].text)
```

或使用 URL：

```python
message = client.messages.create(
    model="gpt-4o",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "描述这张图片"
                },
                {
                    "type": "image",
                    "source": {
                        "type": "url",
                        "url": "https://example.com/image.jpg",
                        "media_type": "image/jpeg"
                    }
                }
            ]
        }
    ]
)

print(message.content[0].text)
```

### 6. 温度和采样参数

```python
message = client.messages.create(
    model="gpt-4o",
    max_tokens=1024,
    temperature=0.7,      # 控制随机性 (0-1)
    top_p=0.9,            # 核采样
    top_k=40,             # Top-K 采样
    messages=[
        {"role": "user", "content": "写一个创意故事"}
    ]
)

print(message.content[0].text)
```

### 7. 停止序列

```python
message = client.messages.create(
    model="gpt-4o",
    max_tokens=1024,
    stop_sequences=["\n\n", "END"],
    messages=[
        {"role": "user", "content": "列举 5 种编程语言"}
    ]
)

print(message.content[0].text)
print(f"停止原因: {message.stop_reason}")
```

## 🎯 API 端点

### POST /v1/messages

创建一条新消息（对话）。

**Headers:**
```
x-api-key: <your-api-key>              # 必需（本地可用任意值）
anthropic-version: 2023-06-01          # 推荐
content-type: application/json         # 必需
```

**请求体:**
```json
{
  "model": "gpt-4o",                   // 必需: 模型名称
  "max_tokens": 1024,                  // 必需: 最大输出 token 数
  "messages": [                        // 必需: 消息数组
    {
      "role": "user",                  // "user" 或 "assistant"
      "content": "Hello"               // 字符串或内容块数组
    }
  ],
  "system": "You are helpful",         // 可选: 系统提示词
  "temperature": 1.0,                  // 可选: 0-1
  "top_p": 1.0,                        // 可选: 0-1
  "top_k": 0,                          // 可选: >=0
  "stream": false,                     // 可选: 是否流式响应
  "stop_sequences": ["END"],           // 可选: 停止序列
  "metadata": {                        // 可选: 元数据
    "user_id": "user123"
  }
}
```

**响应:**
```json
{
  "id": "msg_123456",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "gpt-4o",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

## 🔧 支持的参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `model` | string | ✅ | 模型名称（如 `gpt-4o`） |
| `max_tokens` | integer | ✅ | 最大输出 token 数（≥1） |
| `messages` | array | ✅ | 对话消息数组 |
| `system` | string/array | ❌ | 系统提示词 |
| `temperature` | number | ❌ | 温度参数（0-1） |
| `top_p` | number | ❌ | 核采样参数（0-1） |
| `top_k` | integer | ❌ | Top-K 采样（≥0） |
| `stream` | boolean | ❌ | 是否启用流式响应 |
| `stop_sequences` | array | ❌ | 停止序列列表 |
| `metadata` | object | ❌ | 请求元数据 |

## 📊 支持的模型

### ⭐ 推荐模型

| 模型 ID | 名称 | 特性 |
|--------|------|------|
| `gpt-4o` | GPT-4 Omni | 🖼️ 支持视觉，高性能 |
| `claude-sonnet-4.5` | Claude Sonnet 4.5 | 🖼️ 支持视觉，Claude 最新 |
| `gpt-5` | GPT-5 | 最新模型 |

### 📋 所有支持的模型

**GPT 系列**：
- `gpt-4o` - GPT-4 Omni 🖼️ (支持视觉)
- `gpt-4o-mini` - GPT-4 Omni Mini 🖼️ (支持视觉)
- `gpt-4` - GPT-4
- `gpt-4.1` - GPT-4.1
- `gpt-5` - GPT-5
- `gpt-5-mini` - GPT-5 mini
- `gpt-3.5-turbo` - GPT-3.5 Turbo

**Claude 系列** (注意：使用 Copilot 的命名格式)：
- `claude-sonnet-4.5` - Claude Sonnet 4.5 🖼️ (支持视觉)
- `claude-sonnet-4` - Claude Sonnet 4 🖼️
- `claude-opus-41` - Claude Opus 4.1 🖼️
- `claude-haiku-4.5` - Claude Haiku 4.5 🖼️

**Gemini 系列**：
- `gemini-2.5-pro` - Gemini 2.5 Pro 🖼️

**其他**：
- `grok-code-fast-1` - Grok Code Fast 1

**注意**: 
- 🖼️ 标记的模型支持图片输入（多模态）
- ❌ **不支持** Claude 官方的模型名称格式（如 `claude-3-opus-20240229`）
- ✅ 使用上述 Copilot 格式的模型名称

### 🔍 查询所有可用模型

```bash
curl http://localhost:3000/v1/models -H "x-api-key: test" | jq '.data[] | {id: .id, name: .name}'
```

## 🔒 认证

### 本地使用

本地访问（localhost）无需认证，可以使用任意值作为 `x-api-key`：

```python
client = Anthropic(
    api_key="dummy-key",  # 任意值即可
    base_url="http://localhost:3000"
)
```

### 远程访问

如需远程访问，设置环境变量 `ACCESS_TOKEN`：

```bash
export ACCESS_TOKEN="your-secret-token"
npm start
```

然后使用该 token：

```python
client = Anthropic(
    api_key="your-secret-token",
    base_url="http://your-server:3000"
)
```

## 🧪 测试

运行 Claude API 测试脚本：

```bash
./test-claude.sh
```

该脚本会测试：
- ✅ 基础文本对话
- ✅ 系统提示词
- ✅ 温度参数
- ✅ 多轮对话
- ✅ 流式响应
- ✅ 图片支持
- ✅ 错误处理

## 📝 响应格式

### 非流式响应

```json
{
  "id": "msg_123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I assist you today?"
    }
  ],
  "model": "gpt-4o",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 15,
    "output_tokens": 25
  }
}
```

### 流式响应

流式响应使用 Server-Sent Events (SSE) 格式：

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_123",...}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}

event: message_stop
data: {"type":"message_stop"}
```

## 🆚 与 OpenAI 格式对比

| 特性 | Claude API | OpenAI API |
|------|-----------|------------|
| 端点 | `/v1/messages` | `/v1/chat/completions` |
| 认证 | `x-api-key` | `Authorization: Bearer` |
| 必需参数 | `max_tokens` 必需 | `max_tokens` 可选 |
| 系统提示词 | `system` 参数 | `messages` 中的 `system` 角色 |
| 响应格式 | `content` 数组 | `choices` 数组 |
| 停止原因 | `stop_reason: "end_turn"` | `finish_reason: "stop"` |

两种格式都支持，可以根据习惯选择使用！

## ⚠️ 注意事项

1. **max_tokens 是必需参数** - 与 Claude API 保持一致，必须指定 `max_tokens`
2. **流式响应格式** - 完全符合 Claude SSE 事件格式
3. **错误格式** - 错误响应遵循 Claude API 的错误格式规范
4. **模型映射** - 使用 GitHub Copilot 的模型名称，而不是 Claude 的模型名称

## 🔗 相关文档

- [README.md](README.md) - 项目总览
- [VISION_SUPPORT.md](VISION_SUPPORT.md) - 视觉/图片功能详解
- [Claude API 官方文档](https://docs.anthropic.com/en/api/messages) - Claude Messages API 参考

## 💡 提示

如果你的应用已经使用了 Claude API，只需修改 `base_url` 即可无缝切换到本代理：

```python
# 原来使用 Claude
client = Anthropic(
    api_key=os.environ["ANTHROPIC_API_KEY"]
)

# 切换到本代理
client = Anthropic(
    api_key="dummy-key",
    base_url="http://localhost:3000"
)
```

就是这么简单！🎉
