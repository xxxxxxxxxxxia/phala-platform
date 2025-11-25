#!/bin/bash

# SFQ服务器管理脚本
# 用法: ./sfq-server.sh [start|stop|status|restart]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_PATH="${PROJECT_DIR}/bin/sfq-test"
PORT="${SFQ_PORT:-8066}"
HOST="${SFQ_HOST:-127.0.0.1}"
LOG_FILE="${SFQ_LOG_FILE:-/tmp/sfq-test.log}"

# 检查二进制文件是否存在
if [ ! -f "$BIN_PATH" ]; then
    echo "❌ 错误: SFQ二进制文件不存在: $BIN_PATH"
    echo "请确保 sfq-test 二进制文件在 $BIN_PATH"
    exit 1
fi

# 检查二进制文件是否可执行
if [ ! -x "$BIN_PATH" ]; then
    echo "⚠️  警告: 二进制文件不可执行，尝试添加执行权限..."
    chmod +x "$BIN_PATH"
fi

# 获取占用端口的进程PID
get_pid() {
    # 尝试使用lsof
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti :${PORT} 2>/dev/null || echo ""
    # 如果lsof不可用，尝试使用netstat
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tuln 2>/dev/null | grep ":${PORT}" | awk '{print $NF}' | cut -d'/' -f1 | head -1 || echo ""
    else
        echo ""
    fi
}

# 检查SFQ服务器是否运行
is_running() {
    local pid=$(get_pid)
    if [ -n "$pid" ]; then
        # 检查进程是否真的是SFQ服务器
        if curl -s "http://${HOST}:${PORT}/test/dump" >/dev/null 2>&1; then
            echo "$pid"
            return 0
        fi
    fi
    return 1
}

# 启动服务器
start_server() {
    echo "🚀 启动SFQ服务器..."
    
    # 检查是否已经在运行
    local pid=$(is_running)
    if [ -n "$pid" ]; then
        echo "✅ SFQ服务器已在运行 (PID: $pid)"
        return 0
    fi
    
    # 检查端口是否被其他进程占用
    local port_pid=$(get_pid)
    if [ -n "$port_pid" ]; then
        echo "❌ 错误: 端口 ${PORT} 已被其他进程占用 (PID: $port_pid)"
        echo "请先停止占用端口的进程，或使用其他端口"
        exit 1
    fi
    
    # 启动服务器
    echo "📝 日志文件: $LOG_FILE"
    echo "🌐 监听地址: ${HOST}:${PORT}"
    echo "📦 二进制文件: $BIN_PATH"
    
    cd "$PROJECT_DIR"
    ROCKET_ADDRESS="${HOST}" ROCKET_PORT="${PORT}" \
        nohup "$BIN_PATH" --backlog 15 --depth 3 > "$LOG_FILE" 2>&1 &
    
    local new_pid=$!
    echo "⏳ 等待服务器启动..."
    sleep 2
    
    # 检查是否启动成功
    local check_pid=$(is_running)
    if [ -n "$check_pid" ]; then
        echo "✅ SFQ服务器启动成功 (PID: $check_pid)"
        echo "📋 查看日志: tail -f $LOG_FILE"
        return 0
    else
        echo "❌ SFQ服务器启动失败"
        echo "📋 查看日志: cat $LOG_FILE"
        exit 1
    fi
}

# 停止服务器
stop_server() {
    echo "🛑 停止SFQ服务器..."
    
    local pid=$(is_running)
    if [ -z "$pid" ]; then
        echo "ℹ️  SFQ服务器未运行"
        return 0
    fi
    
    echo "📌 找到SFQ服务器进程 (PID: $pid)"
    
    # 发送SIGTERM信号
    echo "📤 发送停止信号..."
    kill -TERM "$pid" 2>/dev/null
    
    # 等待进程退出
    local count=0
    while [ $count -lt 10 ]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "✅ SFQ服务器已停止"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    
    # 如果还在运行，发送SIGKILL
    if kill -0 "$pid" 2>/dev/null; then
        echo "⚠️  进程未响应SIGTERM，发送SIGKILL..."
        kill -KILL "$pid" 2>/dev/null
        sleep 1
        
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "✅ SFQ服务器已强制停止"
            return 0
        else
            echo "❌ 无法停止SFQ服务器 (PID: $pid)"
            exit 1
        fi
    fi
}

# 查看状态
show_status() {
    echo "📊 SFQ服务器状态:"
    echo ""
    
    local pid=$(is_running)
    if [ -n "$pid" ]; then
        echo "✅ 运行中 (PID: $pid)"
        echo "🌐 地址: http://${HOST}:${PORT}"
        echo ""
        echo "📋 服务器信息:"
        curl -s "http://${HOST}:${PORT}/test/dump" | head -10
    else
        echo "❌ 未运行"
        local port_pid=$(get_pid)
        if [ -n "$port_pid" ]; then
            echo "⚠️  端口 ${PORT} 被其他进程占用 (PID: $port_pid)"
        fi
    fi
}

# 重启服务器
restart_server() {
    echo "🔄 重启SFQ服务器..."
    stop_server
    sleep 1
    start_server
}

# 主函数
main() {
    case "${1:-status}" in
        start)
            start_server
            ;;
        stop)
            stop_server
            ;;
        status)
            show_status
            ;;
        restart)
            restart_server
            ;;
        *)
            echo "用法: $0 [start|stop|status|restart]"
            echo ""
            echo "命令:"
            echo "  start   - 启动SFQ服务器"
            echo "  stop    - 停止SFQ服务器"
            echo "  status  - 查看服务器状态"
            echo "  restart - 重启服务器"
            echo ""
            echo "环境变量:"
            echo "  SFQ_PORT      - 服务器端口 (默认: 8066)"
            echo "  SFQ_HOST      - 服务器地址 (默认: 127.0.0.1)"
            echo "  SFQ_LOG_FILE  - 日志文件路径 (默认: /tmp/sfq-test.log)"
            exit 1
            ;;
    esac
}

main "$@"


