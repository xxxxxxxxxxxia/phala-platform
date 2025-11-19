import { NextRequest, NextResponse } from "next/server";
import {
    getSfqManager,
    getSfqDumpData,
    requestSfqFlow,
    mapFlowsByKey,
    buildFlowKey,
} from "@/lib/sfq";

type ScenarioFlow = {
    id: string;
    flow: string;
    weight: number;
    cost: number;
    requests: number;
};

type ScenarioConfig = {
    id: string;
    name: string;
    description: string;
    flows: ScenarioFlow[];
};

const SCENARIOS: ScenarioConfig[] = [
    {
        id: "fairness",
        name: "公平调度",
        description: "三个等权流量同时进入，预期调度器能够公平处理。",
        flows: [
            { id: "flow-a", flow: "fair_a", weight: 1, cost: 50, requests: 12 },
            { id: "flow-b", flow: "fair_b", weight: 1, cost: 50, requests: 12 },
            { id: "flow-c", flow: "fair_c", weight: 1, cost: 50, requests: 12 },
        ],
    },
    {
        id: "weight-distribution",
        name: "带权重调度",
        description: "三个不同权重流（1:2:3）同时调度，观察资源是否按权重比例分配。高权重流应获得更多资源，表现为更多接受数、更少的积压和更快的处理速度。",
        flows: [
            // 权重1:2:3，总权重=6
            // 重要：所有流发送相同数量的请求，这样可以公平对比权重效果
            // 但高权重流应该处理得更快，从而接受更多请求
            { id: "weight-low", flow: "weight_low", weight: 1, cost: 40, requests: 40 },
            { id: "weight-mid", flow: "weight_mid", weight: 2, cost: 40, requests: 40 },
            { id: "weight-high", flow: "weight_high", weight: 3, cost: 40, requests: 40 },
        ],
    },
    {
        id: "overload-protection",
        name: "过载保护",
        description: "模拟突发流量并考察调度器拒绝策略。",
        flows: [
            { id: "critical", flow: "overload_critical", weight: 4, cost: 80, requests: 8 },
            { id: "noise", flow: "overload_noise", weight: 1, cost: 20, requests: 30 },
        ],
    },
];

async function runScenario(config: ScenarioConfig) {
    const before = await getSfqDumpData();
    const beforeMap = mapFlowsByKey(before.flows);

    const start = Date.now();

    // 对于带权重场景，采用顺序发送（带小延迟）以更清晰地展示权重效果
    // 这样可以避免所有请求同时到达导致队列瞬间被填满
    if (config.id === "weight-distribution") {
        // 交错发送请求，让调度器有时间处理
        const maxRequests = Math.max(...config.flows.map(f => f.requests));
        for (let i = 0; i < maxRequests; i++) {
            const promises = config.flows
                .filter(spec => i < spec.requests)
                .map(spec =>
                    requestSfqFlow(spec.flow, spec.weight, spec.cost)
                        .catch(() => null)
                        .then(() => new Promise(resolve => setTimeout(resolve, 5))) // 5ms延迟
                );
            await Promise.all(promises);
        }
    } else {
        // 其他场景保持并发发送
        await Promise.all(
            config.flows.map(async (spec) => {
                const promises = Array.from({ length: spec.requests }).map(() =>
                    requestSfqFlow(spec.flow, spec.weight, spec.cost).catch(() => null)
                );
                await Promise.all(promises);
            })
        );
    }

    const after = await getSfqDumpData();
    const afterMap = mapFlowsByKey(after.flows);

    const flowStats: Record<
        string,
        {
            flowKey: string;
            weight: number;
            accepted: number;
            rejected: number;
            total: number;
            backlog: number;
            vClock: number;
            vClockDelta?: number;
            expectedAccepted?: number;
            allocationRatio?: number;
            normalizedAccepted?: number;
        }
    > = {};

    for (const spec of config.flows) {
        const key = buildFlowKey(spec.flow, spec.weight);
        const beforeFlow = beforeMap[key];
        const afterFlow = afterMap[key];

        const acceptedDelta =
            (afterFlow?.accepted ?? 0) - (beforeFlow?.accepted ?? 0);
        const rejectedDelta =
            (afterFlow?.rejected ?? 0) - (beforeFlow?.rejected ?? 0);
        const totalDelta =
            (afterFlow?.total ?? 0) - (beforeFlow?.total ?? 0);
        const vClockDelta =
            (afterFlow?.vClock ?? 0) - (beforeFlow?.vClock ?? 0);

        flowStats[spec.id] = {
            flowKey: key,
            weight: spec.weight,
            accepted: Math.max(0, acceptedDelta),
            rejected: Math.max(0, rejectedDelta),
            total: Math.max(0, totalDelta),
            backlog: afterFlow?.backlog ?? 0,
            vClock: afterFlow?.vClock ?? 0,
            vClockDelta: vClockDelta, // 虚拟时钟变化量，反映服务时间
        };
    }

    // 计算权重相关指标（仅对weight-distribution场景）
    if (config.id === "weight-distribution") {
        const totalWeight = config.flows.reduce((sum, f) => sum + f.weight, 0);
        const totalAccepted = Object.values(flowStats).reduce(
            (sum, stat) => sum + stat.accepted,
            0
        );

        for (const spec of config.flows) {
            const stats = flowStats[spec.id];
            if (stats && totalAccepted > 0 && totalWeight > 0) {
                // 期望接受数（按权重比例）
                const expectedAccepted =
                    (spec.weight / totalWeight) * totalAccepted;
                // 实际资源分配比例（实际接受数/期望接受数）
                const allocationRatio =
                    stats.accepted > 0 ? stats.accepted / expectedAccepted : 0;
                // 归一化后的接受数（每权重单位的接受数）
                const normalizedAccepted = stats.accepted / spec.weight;

                // 添加到统计中
                flowStats[spec.id] = {
                    ...stats,
                    expectedAccepted: Math.round(expectedAccepted * 100) / 100,
                    allocationRatio: Math.round(allocationRatio * 1000) / 1000,
                    normalizedAccepted: Math.round(normalizedAccepted * 100) / 100,
                };
            }
        }
    }

    const totals = Object.values(flowStats).reduce(
        (acc, entry) => {
            acc.accepted += entry.accepted;
            acc.rejected += entry.rejected;
            acc.total += entry.total;
            return acc;
        },
        { accepted: 0, rejected: 0, total: 0 }
    );

    return {
        scenarioId: config.id,
        scenarioName: config.name,
        description: config.description,
        duration: Date.now() - start,
        flows: config.flows.map((flow) => ({
            id: flow.id,
            label: flow.flow,
            weight: flow.weight,
            requests: flow.requests,
        })),
        flowStats,
        totalAccepted: totals.accepted,
        totalRejected: totals.rejected,
        totalRequests: totals.total,
        rejectionRate: totals.total
            ? totals.rejected / totals.total
            : 0,
    };
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const manager = getSfqManager();
    const status = await manager.status();
    if (!status.running) {
        return NextResponse.json(
            { success: false, error: "请先启动 SFQ 服务器" },
            { status: 400 }
        );
    }

    const body = await request.json().catch(() => null);
    const scenarioId = body?.scenarioId;

    const config = SCENARIOS.find((item) => item.id === scenarioId);
    if (!config) {
        return NextResponse.json(
            { success: false, error: "未知的调度场景" },
            { status: 400 }
        );
    }

    try {
        const result = await runScenario(config);
        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || "场景运行失败" },
            { status: 500 }
        );
    }
}

