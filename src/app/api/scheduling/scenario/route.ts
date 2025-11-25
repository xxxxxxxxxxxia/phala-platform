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
        description: "三个不同权重流（1:2:3）同时发送大量并发请求，观察系统过载时的拒绝策略。高权重流应被拒绝更少，低权重流被拒绝更多，通过拒绝数差异展示权重效果。",
        flows: [
            // 权重1:2:3，总权重=6
            // 使用大量并发请求，让系统过载，触发拒绝机制
            // 通过拒绝数的差异来展示权重效果：权重高的被拒绝少，权重低的被拒绝多
            // 增加请求数量，确保系统过载，触发拒绝机制
            { id: "weight-low", flow: "weight_low", weight: 1, cost: 50, requests: 150 },
            { id: "weight-mid", flow: "weight_mid", weight: 2, cost: 50, requests: 150 },
            { id: "weight-high", flow: "weight_high", weight: 3, cost: 50, requests: 150 },
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

    // 对于带权重场景，使用预热+快速连续发送策略，让系统过载并展示权重差异
    if (config.id === "weight-distribution") {
        // 策略：先预热建立average_cost，然后快速连续发送大量请求让系统过载
        // 权重高的流会被拒绝更少，权重低的流会被拒绝更多
        const totalRequests = config.flows.reduce((sum, f) => sum + f.requests, 0);
        console.log(`[场景] 带权重调度：预热后快速发送 ${totalRequests} 个请求，让系统过载并展示权重差异`);

        // 步骤1: 预热阶段 - 让系统建立average_cost
        console.log(`[场景] 步骤1: 预热阶段（每个流发送10个请求）...`);
        for (let i = 0; i < 10; i++) {
            const warmupPromises = config.flows.map(spec =>
                requestSfqFlow(spec.flow, spec.weight, spec.cost).catch(() => null)
            );
            await Promise.all(warmupPromises);
            // 短暂延迟，让请求有时间处理
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log(`[场景] 预热完成，等待系统建立average_cost...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 步骤2: 快速连续发送大量请求，让系统过载
        console.log(`[场景] 步骤2: 快速连续发送请求让系统过载...`);
        const requestCounters = config.flows.map(() => 0);
        const maxRequests = Math.max(...config.flows.map(f => f.requests));

        // 快速连续发送：每轮每个流都发送一个请求
        for (let round = 0; round < maxRequests; round++) {
            const promises: Promise<any>[] = [];

            for (let i = 0; i < config.flows.length; i++) {
                const spec = config.flows[i];
                if (requestCounters[i] < spec.requests) {
                    requestCounters[i]++;
                    promises.push(
                        requestSfqFlow(spec.flow, spec.weight, spec.cost)
                            .catch(() => null)
                    );
                }
            }

            // 快速发送，不等待完成（让系统过载）
            Promise.all(promises);

            // 每10轮稍微延迟一下，避免请求堆积过多
            if (round % 10 === 0 && round > 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // 等待所有请求发送完成
        console.log(`[场景] 所有请求已发送，等待系统处理...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
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

                // 添加到统计中（只保留期望接受数，移除分配比例和标准化接受数）
                flowStats[spec.id] = {
                    ...stats,
                    expectedAccepted: Math.round(expectedAccepted * 100) / 100,
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

