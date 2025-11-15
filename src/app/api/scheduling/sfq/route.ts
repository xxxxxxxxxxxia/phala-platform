import { NextRequest, NextResponse } from "next/server";
import { getSfqManager } from "@/lib/sfq";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const action = request.nextUrl.searchParams.get("action");
    const manager = getSfqManager();

    try {
        switch (action) {
            case "start": {
                const result = await manager.start();
                return NextResponse.json({
                    success: true,
                    message: "SFQ 服务器启动成功",
                    data: result,
                });
            }
            case "stop": {
                const stopped = await manager.stop();
                return NextResponse.json({
                    success: true,
                    message: stopped.stopped ? "SFQ 服务器已停止" : "SFQ 服务器未在运行",
                    data: stopped,
                });
            }
            case "status":
            default: {
                return NextResponse.json({
                    success: true,
                    data: manager.status(),
                });
            }
        }
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || "SFQ 操作失败",
            },
            { status: 500 }
        );
    }
}

