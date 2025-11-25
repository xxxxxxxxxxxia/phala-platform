import { NextRequest, NextResponse } from "next/server";
import {
    getSfqManager,
    getSfqDumpData,
    getSfqBaseUrl,
} from "@/lib/sfq";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const action = request.nextUrl.searchParams.get("action");
    console.log(`[SFQ Flip API] 收到请求: action=${action}`);

    if (action !== "sfq-status") {
        return NextResponse.json(
            { success: false, error: "Unsupported action" },
            { status: 400 }
        );
    }

    const manager = getSfqManager();
    const status = await manager.status();
    console.log(`[SFQ Flip API] 管理器状态:`, status);

    try {
        if (!status.running) {
            console.log(`[SFQ Flip API] 服务器未运行，返回未运行状态`);
            throw new Error("SFQ 服务器未运行");
        }
        console.log(`[SFQ Flip API] 服务器运行中，获取dump数据...`);
        const dump = await getSfqDumpData();
        console.log(`[SFQ Flip API] ✅ 返回运行中状态`);
        return NextResponse.json({
            success: true,
            available: true,
            status: "SFQ 服务器运行中",
            data: dump,
            meta: {
                ...status,
                baseUrl: getSfqBaseUrl(),
            },
        });
    } catch (error: any) {
        console.error(`[SFQ Flip API] ❌ 操作失败:`, error);
        console.error(`[SFQ Flip API] 错误类型:`, error?.constructor?.name);
        console.error(`[SFQ Flip API] 错误消息:`, error?.message);
        console.error(`[SFQ Flip API] 错误堆栈:`, error?.stack);

        // 确保错误信息被记录到标准输出（Docker日志）
        process.stdout.write(`[SFQ Flip API ERROR] ${error?.message || "unknown error"}\n`);
        if (error?.stack) {
            process.stdout.write(`[SFQ Flip API STACK] ${error.stack}\n`);
        }

        const running = status.running && !/未运行/.test(error?.message || "");
        console.log(`[SFQ Flip API] 错误处理: running=${running}, error=${error?.message}`);
        const payload = {
            success: false,
            available: false,
            status: running ? "无法获取 SFQ 运行数据" : "SFQ 服务器未运行",
            error: error?.message || "unknown error",
            meta: running
                ? status
                : {
                    running: false,
                    pid: null,
                    startedAt: null,
                    baseUrl: status.baseUrl || getSfqBaseUrl(),
                },
        };

        console.log(`[SFQ Flip API] 返回状态: available=${payload.available}, status=${payload.status}`);
        return NextResponse.json(payload, { status: running ? 500 : 200 });
    }
}

