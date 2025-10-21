#!/bin/bash

echo "🧪 Copilot OpenAI Proxy 测试脚本"
echo "================================"
echo ""

# 检查服务是否运行
echo "📡 检查服务状态..."
response=$(curl -s http://localhost:3000/health 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ 服务正在运行"
    echo "   响应: $response"
    echo ""
    
    # 测试模型列表
    echo "📋 测试模型列表 API..."
    curl -s http://localhost:3000/v1/models | jq '.' 2>/dev/null || curl -s http://localhost:3000/v1/models
    echo ""
    
    # 测试授权状态
    echo "🔐 检查授权状态..."
    curl -s http://localhost:3000/api/status | jq '.' 2>/dev/null || curl -s http://localhost:3000/api/status
    echo ""
    
else
    echo "❌ 服务未运行"
    echo "💡 请先启动服务: npm run dev"
fi

echo ""
echo "================================"
echo "📖 更多信息请访问: http://localhost:3000"
