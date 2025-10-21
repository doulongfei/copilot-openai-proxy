# 🤖 Copilot OpenAI Proxy

将 GitHub Copilot 转换为标准 OpenAI API 的代理服务器。

## ✨ 特性

- 🔄 **OpenAI API 兼容** - 完全兼容 OpenAI Chat Completions API
- 🔐 **安全授权** - 使用 GitHub OAuth Device Flow 进行授权
- 🎨 **友好的 Web UI** - 可视化的授权流程和状态管理
- 💾 **本地存储** - Token 安全存储在本地文件
- 🔁 **自动刷新** - Token 自动刷新，无需重新授权
- 🚀 **即开即用** - 简单配置，快速启动

## 📋 前置要求

- Node.js 18+ 
- GitHub 账户（需要有 Copilot 订阅）
- npm 或 yarn

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 3. 完成授权

1. 在浏览器中打开 `http://localhost:3000`
2. 点击"开始授权"按钮
3. 复制验证码并在 GitHub 授权页面输入
4. 授权完成后即可使用

## 📖 使用方法

### OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy-key"  # 可以是任意值
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### cURL

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Node.js / JavaScript

```javascript
const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  })
})

const data = await response.json()
console.log(data.choices[0].message.content)
```

## 🎯 API 端点

### Chat Completions

```
POST /v1/chat/completions
```

兼容 OpenAI Chat Completions API，支持以下参数：

- `model` - 模型名称（gpt-4o, gpt-4, claude-3.5-sonnet 等）
- `messages` - 消息数组
- `temperature` - 温度参数 (0-2)
- `max_tokens` - 最大 token 数
- `stream` - 是否启用流式响应
- 其他 OpenAI API 标准参数

### 支持的模型

- `gpt-4o` - GPT-4 Omni
- `gpt-4o-mini` - GPT-4 Omni Mini
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo
- `o1-preview` - O1 Preview
- `o1-mini` - O1 Mini
- `claude-3.5-sonnet` - Claude 3.5 Sonnet

### 列出模型

```
GET /v1/models
```

## 🔧 配置

### 修改端口

创建 `.env` 文件：

```env
PORT=8080
```

或在启动时指定：

```bash
PORT=8080 npm run dev
```

## 📂 项目结构

```
copilot-openai-proxy/
├── src/
│   ├── index.ts          # 服务器入口
│   ├── copilot.ts        # Copilot 认证服务
│   ├── storage.ts        # 文件存储
│   └── types.ts          # 类型定义
├── views/
│   ├── index.ejs         # 首页
│   ├── auth.ejs          # 授权页面
│   └── success.ejs       # 成功页面
├── data/
│   └── auth.json         # Token 存储（自动生成）
└── package.json
```

## 🔒 安全性

- Token 存储在本地 `data/auth.json` 文件中
- 不会上传到任何服务器
- 建议仅在本地环境使用
- 不要将 `data/` 目录提交到 Git

## 🛠️ 开发

### 构建项目

```bash
npm run build
```

### 生产模式运行

```bash
npm start
```

## 📝 许可证

MIT

## ⚠️ 免责声明

本项目仅供学习和个人使用。使用本项目时，请确保遵守 GitHub Copilot 的服务条款。

## 🙏 鸣谢

- [GitHub Copilot](https://github.com/features/copilot)
- [OpenAI API](https://openai.com/api/)
- [Express.js](https://expressjs.com/)

## 📮 问题反馈

如有问题或建议，请提交 Issue。
