import { NextRequest, NextResponse } from "next/server";
import {
    getSfqManager,
    getSfqDumpData,
    getSfqBaseUrl,
} from "@/lib/sfq";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const action = request.nextUrl.searchParams.get("action");

    if (action !== "sfq-status") {
        return NextResponse.json(
            { success: false, error: "Unsupported action" },
            { status: 400 }
        );
    }

    const manager = getSfqManager();
    const status = await manager.status();

    try {
        if (!status.running) {
            throw new Error("SFQ 服务器未运行");
        }
        const dump = await getSfqDumpData();
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
        const running = status.running && !/未运行/.test(error?.message || "");
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

        return NextResponse.json(payload, { status: running ? 500 : 200 });
    }
}

