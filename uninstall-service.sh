#!/bin/bash

echo "🗑️  卸载 Copilot OpenAI Proxy systemd 服务"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 停止服务
echo "⏹️  停止服务"
systemctl --user stop copilot-openai-proxy.service

# 禁用服务
echo "❌ 禁用开机自启"
systemctl --user disable copilot-openai-proxy.service

# 删除服务文件
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SYSTEMD_USER_DIR/copilot-openai-proxy.service"

if [ -f "$SERVICE_FILE" ]; then
    echo "🗑️  删除服务文件"
    rm "$SERVICE_FILE"
fi

# 重新加载 systemd
echo "🔄 重新加载 systemd 用户配置"
systemctl --user daemon-reload

echo ""
echo -e "${GREEN}✅ 卸载完成！${NC}"
echo ""
echo "💡 提示："
echo "  - 服务已停止并移除"
echo "  - 项目文件未删除，仍可手动运行: npm run dev"
echo "  - 如需重新安装: ./install-service.sh"
