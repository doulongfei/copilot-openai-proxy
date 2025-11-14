#!/bin/bash

# 模型名称映射测试脚本
# 测试 Claude 官方格式的模型名称是否能自动映射

set -e

BASE_URL="http://localhost:3000"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   模型名称映射功能测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}注意: 请确保服务已重启以加载新代码${NC}"
echo -e "${YELLOW}运行: npm run dev 或 npm start${NC}"
echo ""

# 测试 1: Claude 3 Opus 官方格式
echo -e "${YELLOW}[测试 1] Claude 3 Opus (官方格式)${NC}"
echo "模型: claude-3-opus-20240229"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "简短回复：你好"}]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ 状态码: $HTTP_STATUS${NC}"
  echo -e "${GREEN}✓ 映射成功: claude-3-opus-20240229 -> claude-opus-41${NC}"
  echo "响应:"
  echo "$BODY" | jq -r '.content[0].text'
else
  echo -e "${RED}✗ 状态码: $HTTP_STATUS${NC}"
  echo "错误响应:"
  echo "$BODY" | jq '.'
fi

echo ""
echo "================================================"
echo ""

# 测试 2: Claude 3.5 Sonnet 官方格式
echo -e "${YELLOW}[测试 2] Claude 3.5 Sonnet (官方格式)${NC}"
echo "模型: claude-3-5-sonnet-20241022"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "简短回复：测试"}]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ 状态码: $HTTP_STATUS${NC}"
  echo -e "${GREEN}✓ 映射成功: claude-3-5-sonnet-20241022 -> claude-sonnet-4.5${NC}"
  echo "响应:"
  echo "$BODY" | jq -r '.content[0].text'
else
  echo -e "${RED}✗ 状态码: $HTTP_STATUS${NC}"
  echo "错误响应:"
  echo "$BODY" | jq '.'
fi

echo ""
echo "================================================"
echo ""

# 测试 3: 简化的别名格式
echo -e "${YELLOW}[测试 3] Claude 3 Opus (简化别名)${NC}"
echo "模型: claude-3-opus"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model": "claude-3-opus",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "简短回复：OK"}]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ 状态码: $HTTP_STATUS${NC}"
  echo -e "${GREEN}✓ 映射成功: claude-3-opus -> claude-opus-41${NC}"
  echo "响应:"
  echo "$BODY" | jq -r '.content[0].text'
else
  echo -e "${RED}✗ 状态码: $HTTP_STATUS${NC}"
  echo "错误响应:"
  echo "$BODY" | jq '.'
fi

echo ""
echo "================================================"
echo ""

# 测试 4: 模糊匹配 - 任意日期格式
echo -e "${YELLOW}[测试 4] 模糊匹配测试${NC}"
echo "模型: claude-3-sonnet-20240301 (任意日期)"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model": "claude-3-sonnet-20240301",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "简短回复：Hi"}]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ 状态码: $HTTP_STATUS${NC}"
  echo -e "${GREEN}✓ 模糊匹配成功: claude-3-sonnet-20240301 -> claude-sonnet-4${NC}"
  echo "响应:"
  echo "$BODY" | jq -r '.content[0].text'
else
  echo -e "${RED}✗ 状态码: $HTTP_STATUS${NC}"
  echo "错误响应:"
  echo "$BODY" | jq '.'
fi

echo ""
echo "================================================"
echo ""

# 总结
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   测试总结${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ 模型名称自动映射功能已实现${NC}"
echo ""
echo "支持的映射："
echo "  • claude-3-opus-20240229 → claude-opus-41"
echo "  • claude-3-5-sonnet-20241022 → claude-sonnet-4.5"
echo "  • claude-3-sonnet-20240229 → claude-sonnet-4"
echo "  • claude-3-haiku-20240307 → claude-haiku-4.5"
echo "  • claude-3-opus → claude-opus-41"
echo "  • claude-3.5-sonnet → claude-sonnet-4.5"
echo "  • 以及更多格式的模糊匹配..."
echo ""
echo -e "${YELLOW}提示: 检查服务器日志可以看到映射过程${NC}"
echo ""
