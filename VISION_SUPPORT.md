# 🖼️ 图片支持功能说明

## 概述

从本版本开始，Copilot OpenAI Proxy 支持多模态输入，可以处理包含图片的请求。

## 功能特性

### ✨ 主要功能

1. **多模态消息支持** - 支持在同一消息中混合文本和图片
2. **智能模型检测** - 自动检测模型是否支持视觉功能
3. **多种图片格式** - 支持 URL 和 Base64 两种图片输入方式
4. **模型缓存机制** - 缓存模型列表 1 小时，减少 API 调用
5. **完善的错误处理** - 对不支持视觉的模型使用图片会返回友好的错误信息

### 📋 支持的图片格式

1. **图片 URL** - 支持 HTTP/HTTPS 图片链接
2. **Data URL** - 支持 base64 编码的图片（`data:image/png;base64,...`）

### 🎯 支持视觉的模型

根据 Copilot API 实际返回的数据，以下模型通常支持视觉功能：

- `gpt-4o` / `gpt-4o-2024-*`
- `gpt-4o-mini`
- `o1` / `o1-mini`
- `claude-3.5-sonnet` / `claude-3-*`

**注意**: 实际支持的模型列表会根据 Copilot API 的更新而变化。可以通过 `/v1/models/vision` 端点获取最新的支持列表。

## 使用示例

### Python 示例

```python
from openai import OpenAI
import base64

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy-key"
)

# 方式 1: 使用图片 URL
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "这张图片里有什么？"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://example.com/image.jpg",
                        "detail": "auto"  # 可选: auto, low, high
                    }
                }
            ]
        }
    ]
)

# 方式 2: 使用 Base64 编码
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

base64_image = encode_image("path/to/image.jpg")

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "分析这张图片"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}"
                    }
                }
            ]
        }
    ]
)

print(response.choices[0].message.content)
```

### JavaScript / Node.js 示例

```javascript
import fs from 'fs';

const imageUrl = "https://example.com/image.jpg";

const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: '描述这张图片' },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);

// 使用 Base64
const imageBuffer = fs.readFileSync('path/to/image.jpg');
const base64Image = imageBuffer.toString('base64');

const response2 = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: '这是什么？' },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      }
    ]
  })
});
```

## API 端点

### 获取支持视觉的模型列表

```bash
GET /v1/models/vision
Authorization: Bearer YOUR_API_KEY
```

响应示例：

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1234567890,
      "owned_by": "github",
      "capabilities": {
        "vision": true
      }
    }
  ]
}
```

### 聊天接口（支持图片）

```bash
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "model": "gpt-4o",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "这张图片里有什么？"},
      {
        "type": "image_url",
        "image_url": {
          "url": "https://example.com/image.jpg"
        }
      }
    ]
  }]
}
```

## 技术实现

### 架构设计

1. **类型系统** (`src/types.ts`)
   - 定义了 `MessageContent` 联合类型，支持 `string` 和 `Array<TextPart | ImageUrlPart>`
   - 添加了 `ModelCapabilities` 接口来描述模型能力

2. **视觉检测** (`src/copilot.ts`)
   - `isVisionModel()` - 检测模型是否支持视觉（优先使用 API 数据）
   - `isVisionModelFallback()` - 基于模型名称的后备检测
   - `getVisionModels()` - 获取所有支持视觉的模型
   - 模型数据缓存 1 小时，减少 API 调用

3. **请求处理** (`src/index.ts`)
   - 验证消息内容格式
   - 检查模型是否支持视觉
   - 为视觉请求添加 `copilot-vision-request: true` 头部
   - 友好的错误提示

### 数据流

```
客户端请求
    ↓
验证模型是否支持视觉
    ↓
验证消息内容格式
    ↓
添加视觉请求头部（如果需要）
    ↓
转发到 Copilot API
    ↓
返回响应
```

## 错误处理

### 常见错误

1. **模型不支持视觉**
   ```json
   {
     "error": {
       "message": "Model gpt-3.5-turbo does not support vision/multimodal content",
       "type": "invalid_request_error",
       "code": "model_not_support_vision"
     }
   }
   ```

2. **无效的图片格式**
   ```json
   {
     "error": {
       "message": "Invalid image_url format: url is required",
       "type": "invalid_request_error",
       "code": "invalid_image_url"
     }
   }
   ```

## 测试

运行图片功能测试：

```bash
chmod +x test-vision.sh
./test-vision.sh YOUR_API_KEY
```

测试覆盖：
- ✅ 获取支持视觉的模型列表
- ✅ 纯文本消息（兼容性测试）
- ✅ 图片 URL 输入
- ✅ Base64 图片输入
- ✅ 非视觉模型使用图片（错误处理）
- ✅ 无效图片格式（错误处理）

## 注意事项

1. **图片大小限制**
   - 请求体限制为 50MB
   - 建议单张图片不超过 20MB
   - 过大的图片可能导致请求超时

2. **Base64 编码**
   - Base64 会增加约 33% 的数据大小
   - 建议优先使用图片 URL

3. **模型支持**
   - 不是所有模型都支持视觉
   - 使用前建议先查询 `/v1/models/vision` 端点

4. **性能考虑**
   - 图片处理会增加响应时间
   - 多张图片会显著增加处理时间

## 更新日志

### v1.1.0 (2025-01-22)

**新增功能**:
- ✨ 添加多模态消息支持（文本 + 图片）
- ✨ 智能视觉模型检测（基于 API 数据）
- ✨ 模型列表缓存机制
- ✨ `/v1/models/vision` 调试端点
- ✨ 完整的测试套件

**改进**:
- 🔧 更新类型定义支持多模态内容
- 🔧 改进错误处理和提示
- 📝 更新文档和使用示例

## 参考资料

- [OpenAI Vision Guide](https://platform.openai.com/docs/guides/vision)
- [GitHub Copilot API](https://docs.github.com/en/copilot)
- [Cherry Studio 实现参考](https://github.com/kangfenmao/cherry-studio)
