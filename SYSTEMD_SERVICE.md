# 🔧 systemd 服务配置指南

## 📋 概述

本项目支持作为用户级 systemd 服务运行，实现开机自动启动和后台运行。

## ✅ 已完成的配置

服务已成功安装并配置为：
- ✅ **开机自启** - 系统启动时自动运行
- ✅ **后台运行** - 作为系统服务在后台持续运行
- ✅ **自动重启** - 服务异常退出时自动重启（延迟10秒）
- ✅ **日志记录** - 通过 systemd journal 记录日志
- ✅ **用户级服务** - 仅在当前用户登录时运行

## 🚀 快速开始

### 安装服务

```bash
./install-service.sh
```

### 卸载服务

```bash
./uninstall-service.sh
```

## 📖 常用命令

### 查看服务状态

```bash
systemctl --user status copilot-openai-proxy
```

### 启动服务

```bash
systemctl --user start copilot-openai-proxy
```

### 停止服务

```bash
systemctl --user stop copilot-openai-proxy
```

### 重启服务

```bash
systemctl --user restart copilot-openai-proxy
```

### 查看实时日志

```bash
journalctl --user -u copilot-openai-proxy -f
```

### 查看最近日志

```bash
journalctl --user -u copilot-openai-proxy -n 50
```

### 启用开机自启

```bash
systemctl --user enable copilot-openai-proxy
```

### 禁用开机自启

```bash
systemctl --user disable copilot-openai-proxy
```

## 📂 服务文件位置

- **服务定义文件**: `~/.config/systemd/user/copilot-openai-proxy.service`
- **项目工作目录**: `/path/to/your/copilot-openai-proxy`
- **可执行文件**: `/path/to/your/copilot-openai-proxy/dist/index.js`

## ⚙️ 服务配置详解

### 服务配置文件内容

```ini
[Unit]
Description=Copilot OpenAI Proxy Server
Documentation=https://github.com/copilot-openai-proxy
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/your/copilot-openai-proxy
ExecStart=/usr/bin/node /path/to/your/copilot-openai-proxy/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=copilot-proxy

# Environment
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=default.target
```

### 配置说明

| 配置项 | 说明 |
|--------|------|
| `Type=simple` | 简单服务类型 |
| `Restart=always` | 总是自动重启 |
| `RestartSec=10` | 重启前等待10秒 |
| `StandardOutput=journal` | 输出到 systemd 日志 |
| `NODE_ENV=production` | 生产环境模式 |
| `PORT=3000` | 监听端口 3000 |

## 🔧 自定义配置

### 修改端口

编辑服务文件：

```bash
nano ~/.config/systemd/user/copilot-openai-proxy.service
```

修改 Environment 部分：

```ini
Environment=PORT=8080
```

然后重新加载并重启：

```bash
systemctl --user daemon-reload
systemctl --user restart copilot-openai-proxy
```

### 添加环境变量

在服务文件的 `[Service]` 部分添加：

```ini
Environment=YOUR_VAR=value
```

## 🐛 故障排查

### 服务无法启动

1. 查看详细状态：
```bash
systemctl --user status copilot-openai-proxy -l
```

2. 查看日志：
```bash
journalctl --user -u copilot-openai-proxy -n 100
```

3. 检查构建是否成功：
```bash
ls -la /path/to/your/copilot-openai-proxy/dist/
```

### 服务启动但无法访问

1. 检查端口是否被占用：
```bash
ss -tlnp | grep 3000
```

2. 检查服务日志：
```bash
journalctl --user -u copilot-openai-proxy -f
```

### 开机不自动启动

1. 确认服务已启用：
```bash
systemctl --user is-enabled copilot-openai-proxy
```

2. 启用用户服务开机自启：
```bash
loginctl enable-linger $USER
```

## 💡 高级功能

### 启用持久化日志

用户级服务的日志默认可能不持久化，要启用：

```bash
# 创建日志目录
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal

# 重启日志服务
sudo systemctl restart systemd-journald
```

### 限制资源使用

编辑服务文件添加资源限制：

```ini
[Service]
MemoryLimit=512M
CPUQuota=50%
```

### 配置服务依赖

如果需要等待其他服务：

```ini
[Unit]
After=network-online.target
Wants=network-online.target
```

## 📊 监控服务

### 实时监控服务状态

```bash
watch -n 2 'systemctl --user status copilot-openai-proxy'
```

### 检查服务运行时间

```bash
systemctl --user show copilot-openai-proxy --property=ActiveEnterTimestamp
```

### 查看服务资源使用

```bash
systemctl --user status copilot-openai-proxy | grep -E "Memory|CPU"
```

## 🔄 更新服务

当代码更新后：

```bash
# 1. 停止服务
systemctl --user stop copilot-openai-proxy

# 2. 拉取最新代码
git pull

# 3. 重新构建
npm run build

# 4. 启动服务
systemctl --user start copilot-openai-proxy
```

或使用一键脚本：

```bash
systemctl --user restart copilot-openai-proxy
```

## 📮 相关链接

- [systemd 官方文档](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [用户级 systemd 服务](https://wiki.archlinux.org/title/Systemd/User)

---

💡 **提示**: 服务配置文件的任何修改都需要运行 `systemctl --user daemon-reload` 才能生效。
