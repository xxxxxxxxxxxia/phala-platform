import { NextRequest, NextResponse } from "next/server";

type AddQueryResult = {
    a: number;
    b: number;
    sum: number;
    workerEndpoint?: string | null;
    executedAt: number;
};

function toNumber(value: string | null, fallback = 0) {
    if (value === null) return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const a = toNumber(params.get("a"));
    const b = toNumber(params.get("b"));
    const workerEndpoint = params.get("workerEndpoint");

    const result: AddQueryResult = {
        a,
        b,
        sum: a + b,
        workerEndpoint,
        executedAt: Date.now(),
    };

    return NextResponse.json({
        success: true,
        data: result,
        message: "phat_hello_add 模拟执行完成",
    });
}

