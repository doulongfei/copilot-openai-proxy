#!/bin/bash

# 测试图片支持的脚本
# 使用方法: ./test-vision.sh YOUR_API_KEY

API_KEY=${1:-""}
BASE_URL="http://localhost:3000"

if [ -z "$API_KEY" ]; then
    echo "❌ 错误: 请提供 API Key"
    echo "使用方法: ./test-vision.sh YOUR_API_KEY"
    exit 1
fi

echo "🧪 测试 Copilot OpenAI Proxy 图片支持"
echo "=================================="
echo ""

# 测试1: 获取支持视觉的模型列表
echo "📋 测试1: 获取支持视觉的模型列表"
echo "GET $BASE_URL/v1/models/vision"
curl -s -X GET "$BASE_URL/v1/models/vision" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo "=================================="
echo ""

# 测试2: 使用纯文本（应该正常工作）
echo "📝 测试2: 纯文本消息（gpt-4o）"
echo "POST $BASE_URL/v1/chat/completions"
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{
      "role": "user",
      "content": "Hello! Say hi in Chinese."
    }],
    "stream": false
  }' | jq '.'
echo ""
echo "=================================="
echo ""

# 测试3: 使用多模态内容（文本 + 图片URL）
echo "🖼️ 测试3: 多模态消息（文本 + 图片URL）"
echo "POST $BASE_URL/v1/chat/completions"
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "这张图片里有什么？请用中文回答。"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
          }
        }
      ]
    }],
    "stream": false
  }' | jq '.'
echo ""
echo "=================================="
echo ""

# 测试4: 使用 base64 图片（小的测试图片）
echo "🎨 测试4: Base64 图片"
echo "POST $BASE_URL/v1/chat/completions"
# 这是一个 1x1 红色像素的 PNG 图片
BASE64_IMAGE="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"gpt-4o\",
    \"messages\": [{
      \"role\": \"user\",
      \"content\": [
        {
          \"type\": \"text\",
          \"text\": \"这是什么颜色的图片？\"
        },
        {
          \"type\": \"image_url\",
          \"image_url\": {
            \"url\": \"data:image/png;base64,$BASE64_IMAGE\"
          }
        }
      ]
    }],
    \"stream\": false
  }" | jq '.'
echo ""
echo "=================================="
echo ""

# 测试5: 非视觉模型使用图片（应该返回错误）
echo "❌ 测试5: 非视觉模型使用图片（预期失败）"
echo "POST $BASE_URL/v1/chat/completions"
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Hello"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "https://example.com/image.jpg"
          }
        }
      ]
    }],
    "stream": false
  }' | jq '.'
echo ""
echo "=================================="
echo ""

# 测试6: 无效的图片格式（应该返回错误）
echo "❌ 测试6: 无效的图片格式（预期失败）"
echo "POST $BASE_URL/v1/chat/completions"
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Hello"
        },
        {
          "type": "image_url",
          "image_url": {}
        }
      ]
    }],
    "stream": false
  }' | jq '.'
echo ""
echo "=================================="
echo ""

echo "✅ 测试完成！"
