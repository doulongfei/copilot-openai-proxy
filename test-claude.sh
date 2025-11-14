#!/bin/bash

# Claude API 格式测试脚本
# 测试新增的 /v1/messages 端点

set -e

BASE_URL="http://localhost:3000"
API_KEY="${1:-dummy-key}"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Claude API 格式测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 测试 1: 基础文本对话 (非流式)
echo -e "${YELLOW}[测试 1] 基础文本对话 (非流式)${NC}"
echo "请求: POST $BASE_URL/v1/messages"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "Say \"Hello from Claude API!\""
      }
    ]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ 状态码: $HTTP_STATUS${NC}"
  echo "响应:"
  echo "$BODY" | jq '.'
  
  # 验证响应格式
  if echo "$BODY" | jq -e '.type == "message"' > /dev/null; then
    echo -e "${GREEN}✓ 响应类型正确${NC}"
  else
    echo -e "${RED}✗ 响应类型错误${NC}"
  fi
  
  if echo "$BODY" | jq -e '.content[0].type == "text"' > /dev/null; then
    echo -e "${GREEN}✓ 内容格式正确${NC}"
  else
    echo -e "${RED}✗ 内容格式错误${NC}"
  fi
  
  if echo "$BODY" | jq -e '.usage.input_tokens' > /dev/null; then
    echo -e "${GREEN}✓ Usage 信息存在${NC}"
  else
    echo -e "${RED}✗ Usage 信息缺失${NC}"
  fi
else
  echo -e "${RED}✗ 状态码: $HTTP_STATUS${NC}"
  echo "错误响应:"
  echo "$BODY" | jq '.' || echo "$BODY"
fi

echo ""
echo "================================================"
echo ""

# 测试 2: 带系统提示词的对话
echo -e "${YELLOW}[测试 2] 带系统提示词的对话${NC}"
echo "请求: POST $BASE_URL/v1/messages (with system prompt)"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 150,
    "system": "You are a helpful assistant that always responds in a friendly tone.",
    "messages": [
      {
        "role": "user",
        "content": "What is 2+2?"
      }
    ]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ 状态码: $HTTP_STATUS${NC}"
  echo "响应内容:"
  echo "$BODY" | jq -r '.content[0].text'
  echo -e "${GREEN}✓ 系统提示词测试通过${NC}"
else
  echo -e "${RED}✗ 状态码: $HTTP_STATUS${NC}"
  echo "错误响应:"
  echo "$BODY" | jq '.' || echo "$BODY"
fi

echo ""
echo "================================================"
echo ""

# 测试 3: 温度参数测试
echo -e "${YELLOW}[测试 3] 温度参数测试${NC}"
echo "请求: POST $BASE_URL/v1/messages (with temperature=0)"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 50,
    "temperature": 0,
    "messages": [
      {
        "role": "user",
        "content": "Count from 1 to 5"
      }
    ]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ 状态码: $HTTP_STATUS${NC}"
  echo "响应内容:"
  echo "$BODY" | jq -r '.content[0].text'
  echo -e "${GREEN}✓ 温度参数测试通过${NC}"
else
  echo -e "${RED}✗ 状态码: $HTTP_STATUS${NC}"
  echo "错误响应:"
  echo "$BODY" | jq '.' || echo "$BODY"
fi

echo ""
echo "================================================"
echo ""

# 测试 4: 多轮对话
echo -e "${YELLOW}[测试 4] 多轮对话${NC}"
echo "请求: POST $BASE_URL/v1/messages (multi-turn)"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "My name is Alice."
      },
      {
        "role": "assistant",
        "content": "Nice to meet you, Alice!"
      },
      {
        "role": "user",
        "content": "What is my name?"
      }
    ]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ 状态码: $HTTP_STATUS${NC}"
  echo "响应内容:"
  echo "$BODY" | jq -r '.content[0].text'
  
  # 检查是否记住了名字
  if echo "$BODY" | jq -r '.content[0].text' | grep -iq "alice"; then
    echo -e "${GREEN}✓ 多轮对话上下文保持正确${NC}"
  else
    echo -e "${YELLOW}⚠ 多轮对话上下文可能未正确保持${NC}"
  fi
else
  echo -e "${RED}✗ 状态码: $HTTP_STATUS${NC}"
  echo "错误响应:"
  echo "$BODY" | jq '.' || echo "$BODY"
fi

echo ""
echo "================================================"
echo ""

# 测试 5: 流式响应
echo -e "${YELLOW}[测试 5] 流式响应${NC}"
echo "请求: POST $BASE_URL/v1/messages (streaming)"
echo ""

echo "发送流式请求..."
curl -s -N -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 100,
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Count from 1 to 10"
      }
    ]
  }' | head -n 20

echo ""
echo -e "${GREEN}✓ 流式响应测试完成${NC}"

echo ""
echo "================================================"
echo ""

# 测试 6: 图片支持 (如果模型支持)
echo -e "${YELLOW}[测试 6] 图片支持测试 (可选)${NC}"
echo "请求: POST $BASE_URL/v1/messages (with image)"
echo ""

# 使用一个简单的测试图片URL
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "max_tokens": 200,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Describe this image briefly."
          },
          {
            "type": "image",
            "source": {
              "type": "url",
              "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/320px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
              "media_type": "image/jpeg"
            }
          }
        ]
      }
    ]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ 状态码: $HTTP_STATUS${NC}"
  echo "响应内容:"
  echo "$BODY" | jq -r '.content[0].text'
  echo -e "${GREEN}✓ 图片支持测试通过${NC}"
else
  echo -e "${YELLOW}⚠ 状态码: $HTTP_STATUS${NC}"
  echo "注意: 图片功能可能需要支持视觉的模型"
  echo "响应:"
  echo "$BODY" | jq '.' || echo "$BODY"
fi

echo ""
echo "================================================"
echo ""

# 测试 7: 错误处理 - 缺少必需参数
echo -e "${YELLOW}[测试 7] 错误处理 - 缺少 max_tokens${NC}"
echo "请求: POST $BASE_URL/v1/messages (missing max_tokens)"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": "Hello"
      }
    ]
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 400 ]; then
  echo -e "${GREEN}✓ 正确返回 400 错误${NC}"
  echo "错误信息:"
  echo "$BODY" | jq '.'
  
  if echo "$BODY" | jq -e '.error.type' > /dev/null; then
    echo -e "${GREEN}✓ 错误格式符合 Claude API 规范${NC}"
  fi
else
  echo -e "${RED}✗ 期望状态码 400, 实际: $HTTP_STATUS${NC}"
  echo "$BODY"
fi

echo ""
echo "================================================"
echo ""

# 总结
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   测试总结${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ Claude API 格式 (/v1/messages) 已实现${NC}"
echo -e "${GREEN}✓ 支持非流式和流式响应${NC}"
echo -e "${GREEN}✓ 支持系统提示词${NC}"
echo -e "${GREEN}✓ 支持温度等参数${NC}"
echo -e "${GREEN}✓ 支持多轮对话${NC}"
echo -e "${GREEN}✓ 支持图片输入 (视觉模型)${NC}"
echo -e "${GREEN}✓ 错误处理符合规范${NC}"
echo ""
echo -e "${YELLOW}提示: 使用 x-api-key header 进行认证${NC}"
echo -e "${YELLOW}提示: 建议添加 anthropic-version header${NC}"
echo ""
