#!/bin/bash

# 性能监控脚本
echo "📊 Next.js开发服务器性能监控"
echo "================================"

# 检查Next.js进程
echo "🔍 检查Next.js进程状态..."
ps aux | grep -E "(next|node)" | grep -v grep | head -5

echo ""
echo "💾 内存使用情况:"
free -h

echo ""
echo "🔥 CPU使用率 (前5个进程):"
top -bn1 | head -15

echo ""
echo "🌐 网络连接状态:"
netstat -tlnp | grep :3000

echo ""
echo "📁 磁盘使用情况:"
df -h /home/user1/Desktop/tmp/phala-blockchain/my-phala-platform

echo ""
echo "⚡ 系统负载:"
uptime

echo ""
echo "📈 实时监控 (按Ctrl+C退出):"
echo "监控Next.js进程资源使用情况..."

# 实时监控Next.js进程
while true; do
    echo "时间: $(date '+%H:%M:%S')"
    ps aux | grep "next-server" | grep -v grep | awk '{print "CPU: " $3 "%, 内存: " $4 "%, 进程ID: " $2}'
    sleep 2
done
