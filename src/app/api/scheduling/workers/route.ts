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

const DEFAULT_WORKER_ENDPOINTS =
    process.env.WORKER_ENDPOINTS ??
    "http://127.0.0.1:18000,http://127.0.0.1:18001";

const FALLBACK_WORKERS: WorkerInsight[] = [
    {
        pubkey:
            "0x8f97320a9b2d9653c750fa73f98c743b9b24b6d6062ef0f844194c016638ea25",
        endpoint: "http://127.0.0.1:18000",
        online: true,
        latencyMs: 25,
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
        endpoint: "http://127.0.0.1:18001",
        online: true,
        latencyMs: 34,
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

function parseWorkerEndpoints() {
    return DEFAULT_WORKER_ENDPOINTS.split(",")
        .map((endpoint) => endpoint.trim())
        .filter(Boolean);
}

function normalizeEndpoint(endpoint: string) {
    return endpoint.replace(/\/$/, "");
}

function scoreWorker(latency: number, blocknum = 0) {
    const latencyScore = Math.max(0, 100 - latency / 2);
    const blockScore = Math.min(100, Math.max(0, Number(blocknum) % 150));
    return Number((0.6 * latencyScore + 0.4 * blockScore).toFixed(1));
}

async function fetchWorkerInfo(endpoint: string): Promise<WorkerInsight | null> {
    const url = normalizeEndpoint(endpoint);
    try {
        const started = Date.now();
        const response = await fetch(`${url}/info`, {
            cache: "no-store",
            signal: AbortSignal.timeout(5_000),
        });
        const latencyMs = Date.now() - started;
        if (!response.ok) {
            throw new Error(`worker ${url} responded ${response.status}`);
        }
        const data = await response.json();
        const pubkey = data.public_key ?? url;
        return {
            pubkey,
            endpoint: url,
            online: Boolean(data.initialized),
            latencyMs,
            version: data.git_revision ?? data.version ?? "unknown",
            registered: Boolean(data.registered),
            state: data.state ?? (data.initialized ? "Ready" : "Unknown"),
            gatekeeper: Boolean(data.gatekeeper),
            inCluster: Boolean(data.registered),
            lastUpdated: Date.now(),
            score: scoreWorker(latencyMs, data.blocknum),
        };
    } catch (error) {
        console.warn(
            `[scheduling/workers] failed to inspect ${url}:`,
            (error as Error).message
        );
        return null;
    }
}

async function fetchLocalInsights(): Promise<WorkerResponse | null> {
    const endpoints = parseWorkerEndpoints();
    if (!endpoints.length) {
        return null;
    }
    console.info("[scheduling/workers] inspecting local workers:", endpoints);
    const workers = (
        await Promise.all(endpoints.map((endpoint) => fetchWorkerInfo(endpoint)))
    ).filter(Boolean) as WorkerInsight[];
    if (!workers.length) {
        return null;
    }

    const recommended =
        workers.reduce<WorkerInsight | null>((best, worker) => {
            if (!best || worker.score > best.score) {
                return worker;
            }
            return best;
        }, null) ?? workers[0];

    return {
        clusterId: process.env.SCHEDULING_CLUSTER_ID ?? "local-cluster",
        fetchedAt: Date.now(),
        recommended,
        workers,
    };
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
    const local = external ? null : await fetchLocalInsights();
    const payload = external ?? local ?? buildFallback();

    return NextResponse.json({
        success: true,
        data: payload,
    });
}

