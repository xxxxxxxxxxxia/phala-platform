import { NextRequest, NextResponse } from "next/server";
import { getSfqManager } from "@/lib/sfq";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const action = request.nextUrl.searchParams.get("action") || "status";
    console.log(`[SFQ API] 收到请求: action=${action}`);
    console.log(`[SFQ API] 请求URL: ${request.url}`);
    console.log(`[SFQ API] 当前工作目录: ${process.cwd()}`);

    const manager = getSfqManager();

    try {
        switch (action) {
            case "start": {
                console.log(`[SFQ API] 执行启动操作...`);
                const result = await manager.start();
                console.log(`[SFQ API] ✅ 启动成功:`, result);
                return NextResponse.json({
                    success: true,
                    message: "SFQ 服务器启动成功",
                    data: result,
                });
            }
            case "stop": {
                console.log(`[SFQ API] 执行停止操作...`);
                const stopped = await manager.stop();
                console.log(`[SFQ API] ✅ 停止完成:`, stopped);

                // 如果停止成功，等待一段时间确保端口释放
                if (stopped.stopped) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    // 再次检查状态，确保真的停止了
                    const finalStatus = await manager.status();
                    console.log(`[SFQ API] 停止后状态检查:`, finalStatus);
                    if (finalStatus.running) {
                        console.warn(`[SFQ API] ⚠️ 停止后服务器仍在运行，尝试强制停止...`);
                        // 如果还在运行，尝试再次停止
                        const retryStopped = await manager.stop();
                        console.log(`[SFQ API] 重试停止结果:`, retryStopped);
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: stopped.stopped ? "SFQ 服务器已停止" : "SFQ 服务器未在运行",
                    data: stopped,
                });
            }
            case "reset": {
                console.log(`[SFQ API] 执行重置操作（停止并清空数据）...`);
                // 先停止服务器
                const stopped = await manager.stop();
                console.log(`[SFQ API] 停止结果:`, stopped);

                // 注意：SFQ服务器本身没有提供重置数据的API
                // 重置数据需要重启服务器，所以这里只返回停止结果
                // 用户需要重新启动服务器来清空数据
                return NextResponse.json({
                    success: true,
                    message: stopped.stopped ? "SFQ 服务器已停止，请重新启动以清空数据" : "SFQ 服务器未在运行",
                    data: { stopped: stopped.stopped, reset: true },
                });
            }
            case "status":
            default: {
                console.log(`[SFQ API] 执行状态检查...`);
                const status = await manager.status();
                console.log(`[SFQ API] ✅ 状态检查完成:`, status);
                return NextResponse.json({
                    success: true,
                    data: status,
                });
            }
        }
    } catch (error: any) {
        console.error(`[SFQ API] ❌ 操作失败:`, error);
        console.error(`[SFQ API] 错误堆栈:`, error?.stack);
        return NextResponse.json(
            {
                success: false,
                error: error?.message || "SFQ 操作失败",
                details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
            },
            { status: 500 }
        );
    }
}

