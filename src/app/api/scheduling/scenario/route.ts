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
        description: "不同权重流量同时调度，观察资源是否按比例分配。",
        flows: [
            { id: "weight-low", flow: "weight_low", weight: 1, cost: 40, requests: 10 },
            { id: "weight-mid", flow: "weight_mid", weight: 2, cost: 40, requests: 10 },
            { id: "weight-high", flow: "weight_high", weight: 4, cost: 40, requests: 10 },
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

    await Promise.all(
        config.flows.map(async (spec) => {
            const promises = Array.from({ length: spec.requests }).map(() =>
                requestSfqFlow(spec.flow, spec.weight, spec.cost).catch(() => null)
            );
            await Promise.all(promises);
        })
    );

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

        flowStats[spec.id] = {
            flowKey: key,
            weight: spec.weight,
            accepted: Math.max(0, acceptedDelta),
            rejected: Math.max(0, rejectedDelta),
            total: Math.max(0, totalDelta),
            backlog: afterFlow?.backlog ?? 0,
            vClock: afterFlow?.vClock ?? 0,
        };
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
    if (!manager.status().running) {
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

