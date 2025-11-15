import { NextRequest, NextResponse } from "next/server";
import { getFastApiUrl } from "@/lib/config";

type WorkerInsight = {
    pubkey: string;
    endpoint?: string;
    online: boolean;
    latencyMs?: number;
    version?: string;
    registered: boolean;
    state: string;
    gatekeeper: boolean;
    inCluster: boolean;
    lastUpdated: number;
    score: number;
    isRecommended?: boolean;
};

type WorkerResponse = {
    clusterId: string;
    fetchedAt: number;
    recommended: WorkerInsight | null;
    workers: WorkerInsight[];
};

const FALLBACK_WORKERS: WorkerInsight[] = [
    {
        pubkey:
            "0x8f97320a9b2d9653c750fa73f98c743b9b24b6d6062ef0f844194c016638ea25",
        endpoint: "https://devnet-worker-1.phala",
        online: true,
        latencyMs: 124,
        version: "v0.5.4",
        registered: true,
        state: "Ready",
        gatekeeper: false,
        inCluster: true,
        lastUpdated: Date.now() - 4_000,
        score: 91.4,
        isRecommended: true,
    },
    {
        pubkey:
            "0x2a530d927b4e38e5a40855ae1320bd23a0d01cdc14e4ad405431c2892f5a8cb3",
        endpoint: "https://devnet-worker-2.phala",
        online: true,
        latencyMs: 162,
        version: "v0.5.4",
        registered: true,
        state: "Ready",
        gatekeeper: false,
        inCluster: true,
        lastUpdated: Date.now() - 6_500,
        score: 87.2,
    },
    {
        pubkey:
            "0x4d2316b8d62841cea4ef4a656925fc0d74340c6dfc2676a5d5807e9a82f1da55",
        endpoint: undefined,
        online: false,
        latencyMs: undefined,
        version: "v0.5.1",
        registered: true,
        state: "CoolingDown",
        gatekeeper: true,
        inCluster: false,
        lastUpdated: Date.now() - 28_000,
        score: 65.1,
    },
];

async function fetchExternalInsights(): Promise<WorkerResponse | null> {
    const upstream =
        process.env.SCHEDULING_WORKERS_ENDPOINT ||
        `${getFastApiUrl()}/api/scheduling/workers`;

    try {
        const response = await fetch(upstream, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`upstream responded ${response.status}`);
        }
        const data = await response.json();
        if (data?.success && data.data) {
            return data.data as WorkerResponse;
        }
        if (data?.workers) {
            return data as WorkerResponse;
        }
        return null;
    } catch (error) {
        console.warn("[scheduling/workers] upstream unavailable:", (error as Error).message);
        return null;
    }
}

function buildFallback(): WorkerResponse {
    return {
        clusterId: process.env.SCHEDULING_CLUSTER_ID ?? "dev-cluster",
        fetchedAt: Date.now(),
        recommended:
            FALLBACK_WORKERS.find((w) => w.isRecommended) ?? FALLBACK_WORKERS[0] ?? null,
        workers: FALLBACK_WORKERS,
    };
}

export async function GET(_request: NextRequest) {
    const external = await fetchExternalInsights();
    const payload = external ?? buildFallback();

    return NextResponse.json({
        success: true,
        data: payload,
    });
}

