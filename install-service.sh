#!/bin/bash

echo "🚀 安装 Copilot OpenAI Proxy 用户级 systemd 服务"
echo "================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否已构建
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}⚠️  未找到 dist 目录，正在构建项目...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 构建失败${NC}"
        exit 1
    fi
fi

# 创建用户 systemd 目录
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"

# 复制服务文件
echo "📋 复制服务文件到 $SYSTEMD_USER_DIR"
cp copilot-openai-proxy.service "$SYSTEMD_USER_DIR/"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 复制服务文件失败${NC}"
    exit 1
fi

# 重新加载 systemd
echo "🔄 重新加载 systemd 用户配置"
systemctl --user daemon-reload

# 启用服务（开机自启）
echo "✅ 启用服务（开机自启）"
systemctl --user enable copilot-openai-proxy.service

# 启动服务
echo "▶️  启动服务"
systemctl --user start copilot-openai-proxy.service

# 等待服务启动
sleep 2

# 检查服务状态
echo ""
echo "📊 服务状态："
systemctl --user status copilot-openai-proxy.service --no-pager

echo ""
echo -e "${GREEN}✅ 安装完成！${NC}"
echo ""
echo "📖 常用命令："
echo "  查看状态: systemctl --user status copilot-openai-proxy"
echo "  停止服务: systemctl --user stop copilot-openai-proxy"
echo "  启动服务: systemctl --user start copilot-openai-proxy"
echo "  重启服务: systemctl --user restart copilot-openai-proxy"
echo "  查看日志: journalctl --user -u copilot-openai-proxy -f"
echo "  禁用开机自启: systemctl --user disable copilot-openai-proxy"
echo ""
echo "🌐 访问地址: http://localhost:3000"
