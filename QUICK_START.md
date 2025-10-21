# 🚀 快速启动指南

## 第一步：启动服务

在项目目录下运行：

```bash
npm run dev
```

你会看到类似的输出：

```
🚀 Copilot OpenAI Proxy Server is running!
📍 URL: http://localhost:3000

📖 Quick Start:
   1. Open http://localhost:3000 in your browser
   2. Complete GitHub authorization
   3. Use the OpenAI API endpoint: http://localhost:3000/v1/chat/completions
```

## 第二步：在浏览器中完成授权

1. 打开浏览器访问 `http://localhost:3000`
2. 点击"开始授权"按钮
3. 你会看到一个验证码（例如：`ABCD-1234`）
4. 点击"打开 GitHub 授权页面"按钮
5. 在 GitHub 页面输入验证码
6. 确认授权
7. 等待自动跳转到成功页面

## 第三步：测试 API

### 方法 1：使用 Web UI 测试

在成功页面或首页，点击"测试 API"按钮。

### 方法 2：使用 cURL

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

### 方法 3：使用 Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy"  # 可以是任意值
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

## 常见问题

### Q: 如何停止服务？

在运行 `npm run dev` 的终端按 `Ctrl+C`。

### Q: 如何更改端口？

设置环境变量：

```bash
PORT=8080 npm run dev
```

### Q: Token 存储在哪里？

Token 存储在 `data/auth.json` 文件中。

### Q: 如何重新授权？

1. 访问首页 `http://localhost:3000`
2. 点击"退出登录"按钮
3. 重新点击"开始授权"

### Q: 支持哪些模型？

- `gpt-4o` - GPT-4 Omni（推荐）
- `gpt-4o-mini` - GPT-4 Omni Mini
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo
- `o1-preview` - O1 Preview
- `o1-mini` - O1 Mini
- `claude-3.5-sonnet` - Claude 3.5 Sonnet

### Q: 如何在其他应用中使用？

任何支持自定义 OpenAI API 端点的应用都可以使用：

1. 设置 API Base URL: `http://localhost:3000/v1`
2. API Key: 任意值（例如 `dummy`）

例如在 ChatGPT Next Web 等应用中：
- API 地址：`http://localhost:3000`
- API Key：随意填写

## 生产环境部署

### 构建

```bash
npm run build
```

### 运行

```bash
npm start
```

### 使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start npm --name copilot-proxy -- start

# 查看日志
pm2 logs copilot-proxy

# 停止
pm2 stop copilot-proxy
```

## 更多帮助

- 查看完整文档：[README.md](README.md)
- 遇到问题？提交 Issue
- 访问 Web UI：http://localhost:3000

---

🎉 祝使用愉快！
