import { NextRequest, NextResponse } from "next/server";
import { getFastApiUrl } from "@/lib/config";
import { getWorkersInfo } from "@/lib/phalaApi";

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
    "http://127.0.0.1:18000,http://127.0.0.1:18001,http://8.147.106.136:8000";

// 计算fallback worker的评分（使用相同的评分函数）
function calculateFallbackScore(latencyMs: number, online: boolean, registered: boolean): number {
    return scoreWorker(latencyMs || 100, 0, online, registered);
}

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
        score: calculateFallbackScore(25, true, true),
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
        score: calculateFallbackScore(34, true, true),
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
        score: calculateFallbackScore(100, false, true), // 离线worker分数较低
    },
    {
        pubkey:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        endpoint: "http://8.147.106.136:8000",
        online: true,
        latencyMs: 30,
        version: "v0.5.4",
        registered: true,
        state: "Ready",
        gatekeeper: false,
        inCluster: true,
        lastUpdated: Date.now() - 5_000,
        score: calculateFallbackScore(30, true, true),
    },
];

async function fetchExternalInsights(): Promise<WorkerResponse | null> {
    // 禁用外部API，直接使用本地配置的worker
    console.info("[scheduling/workers] 外部API已禁用，使用本地配置的worker");
    return null;

    // 以下代码已禁用
    /*
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
    */
}

function parseWorkerEndpoints() {
    return DEFAULT_WORKER_ENDPOINTS.split(",")
        .map((endpoint) => endpoint.trim())
        .filter(Boolean);
}

function normalizeEndpoint(endpoint: string) {
    return endpoint.replace(/\/$/, "");
}

function scoreWorker(latency: number, blocknum = 0, online = true, registered = true) {
    // 延迟评分：延迟越低分数越高，200ms延迟为0分，0ms延迟为100分
    const latencyScore = Math.max(0, Math.min(100, 100 - latency / 2));

    // 在线状态评分：在线且已注册的worker获得基础分数
    let statusScore = 0;
    if (online && registered) {
        statusScore = 100; // 在线且已注册
    } else if (online) {
        statusScore = 50; // 在线但未注册
    } else {
        statusScore = 0; // 离线
    }

    // 综合评分：70%延迟权重 + 30%状态权重
    // 这样延迟是主要因素，但状态也很重要
    const finalScore = 0.7 * latencyScore + 0.3 * statusScore;
    return Number(finalScore.toFixed(1));
}

async function fetchWorkerInfo(endpoint: string): Promise<WorkerInsight | null> {
    const url = normalizeEndpoint(endpoint);
    try {
        console.log(`[scheduling/workers] 正在检查worker: ${url}`);
        const started = Date.now();
        const infoUrl = `${url}/info`;
        console.log(`[scheduling/workers] 请求URL: ${infoUrl}`);
        const response = await fetch(infoUrl, {
            cache: "no-store",
            signal: AbortSignal.timeout(5_000), // 优化：从10秒减少到5秒，快速失败
        });
        const latencyMs = Date.now() - started;
        if (!response.ok) {
            throw new Error(`worker ${url} responded ${response.status}`);
        }
        const data = await response.json();
        console.log(`[scheduling/workers] ${url} 响应数据:`, {
            public_key: data.public_key?.substring(0, 16) + '...',
            initialized: data.initialized,
            registered: data.registered,
            version: data.version || data.git_revision,
            score: data.score,
            rating: data.rating,
        });
        const pubkey = data.public_key ?? url;
        // 处理gatekeeper字段，可能是对象或布尔值
        const isGatekeeper = data.gatekeeper
            ? (typeof data.gatekeeper === 'object' ? (data.gatekeeper.role !== undefined && data.gatekeeper.role !== 0) : Boolean(data.gatekeeper))
            : false;
        const isOnline = Boolean(data.initialized);
        const isRegistered = Boolean(data.registered);

        // 优先使用worker返回的评分，如果score为0则默认显示90分
        let workerScore: number;
        if (typeof data.score === 'number') {
            if (data.score > 0) {
                // worker返回了有效的评分（大于0）
                workerScore = data.score;
                console.log(`[scheduling/workers] ${url} 使用worker返回的评分: ${workerScore}`);
            } else {
                // score为0，使用默认90分
                workerScore = 90;
                console.log(`[scheduling/workers] ${url} worker返回的score=0，使用默认评分: ${workerScore}`);
            }
        } else if (typeof data.rating === 'number' && data.rating > 0) {
            // 使用rating字段（如果score不存在但rating有效）
            workerScore = data.rating;
            console.log(`[scheduling/workers] ${url} 使用worker返回的rating: ${workerScore}`);
        } else {
            // 如果score和rating都不存在，使用默认90分
            workerScore = 90;
            console.log(`[scheduling/workers] ${url} worker未返回评分字段，使用默认评分: ${workerScore}`);
        }

        const result = {
            pubkey,
            endpoint: url,
            online: isOnline,
            latencyMs,
            version: data.git_revision ?? data.version ?? "unknown",
            registered: isRegistered,
            state: data.state ?? (data.initialized ? "Ready" : "Unknown"),
            gatekeeper: isGatekeeper,
            inCluster: Boolean(data.registered),
            lastUpdated: Date.now(),
            score: workerScore,
        };
        console.log(`[scheduling/workers] ${url} 成功获取信息，最终score: ${result.score}`);
        return result;
    } catch (error) {
        console.error(
            `[scheduling/workers] 检查worker失败 ${url}:`,
            error instanceof Error ? error.message : String(error)
        );
        return null;
    }
}

// 检查worker响应状态（使用监控页面的方式，写死两个URL）
async function fetchWorkerResponses(): Promise<Map<string, { url: string; data: any }>> {
    const workerResponses = new Map<string, { url: string; data: any }>();
    const workerUrls = [
        'http://8.147.107.221:18000',
        'http://8.147.106.136:8000'
    ];

    console.log('[scheduling/workers] 开始检查已知worker地址的响应状态...');

    // 优化：使用Promise.allSettled，即使某些worker慢也不会阻塞整个请求
    const results = await Promise.allSettled(workerUrls.map(async (url) => {
        try {
            // 直接调用worker的info接口获取信息
            const started = Date.now();
            const infoUrl = `${url}/info`;
            const response = await fetch(infoUrl, {
                cache: "no-store",
                signal: AbortSignal.timeout(5000), // 5秒超时，快速失败
            });
            const latencyMs = Date.now() - started;

            if (response.ok) {
                const data = await response.json();
                if (data.public_key) {
                    console.log(`[scheduling/workers] ${url} 的public_key: ${data.public_key}`);
                    return {
                        url: url,
                        data: {
                            ...data,
                            latencyMs, // 添加延迟信息
                        },
                        publicKey: data.public_key.toLowerCase()
                    };
                }
            }
            return null;
        } catch (error) {
            console.error(`[scheduling/workers] 检查${url}失败:`, error);
            return null;
        }
    }));

    // 处理结果，只添加成功的worker
    results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
            workerResponses.set(result.value.publicKey, {
                url: result.value.url,
                data: result.value.data
            });
        }
    });

    console.log(`[scheduling/workers] 找到 ${workerResponses.size} 个有响应的worker`);
    return workerResponses;
}

async function fetchLocalInsights(): Promise<WorkerResponse | null> {
    try {
        // 1. 获取所有链上worker（使用监控页面的方式）
        console.info("[scheduling/workers] 开始获取链上worker...");
        const chainWorkers = await getWorkersInfo();
        console.info(`[scheduling/workers] 从链上获取到 ${chainWorkers.length} 个worker`);

        // 2. 检查worker响应状态（写死两个URL）
        const workerResponses = await fetchWorkerResponses();

        // 3. 合并数据：链上worker + 响应信息 + 延迟和评分
        const workers: WorkerInsight[] = [];

        for (const chainWorker of chainWorkers) {
            const publicKeyHex = chainWorker.publicKey.replace('0x', '').toLowerCase();
            const responseInfo = workerResponses.get(publicKeyHex);

            // 只处理有响应的worker
            if (!responseInfo) {
                continue;
            }

            const responseData = responseInfo.data;
            const isOnline = Boolean(responseData.initialized);
            const isRegistered = Boolean(responseData.registered);
            const latencyMs = responseData.latencyMs || 0;

            // 处理gatekeeper字段
            const isGatekeeper = responseData.gatekeeper
                ? (typeof responseData.gatekeeper === 'object'
                    ? (responseData.gatekeeper.role !== undefined && responseData.gatekeeper.role !== 0)
                    : Boolean(responseData.gatekeeper))
                : false;

            // 优先使用worker返回的评分，如果score为0则使用评分函数计算
            let workerScore: number;
            if (typeof responseData.score === 'number' && responseData.score > 0) {
                workerScore = responseData.score;
            } else if (typeof responseData.rating === 'number' && responseData.rating > 0) {
                workerScore = responseData.rating;
            } else {
                // 使用评分函数计算
                workerScore = scoreWorker(latencyMs, responseData.blocknum || 0, isOnline, isRegistered);
            }

            // 构建WorkerInsight
            const workerInsight: WorkerInsight = {
                pubkey: chainWorker.publicKey, // 使用链上的publicKey
                endpoint: responseInfo.url,
                online: isOnline,
                latencyMs: latencyMs,
                version: responseData.git_revision ?? responseData.version ?? chainWorker.version ?? "unknown",
                registered: isRegistered,
                state: responseData.state ?? chainWorker.state ?? (isOnline ? "Ready" : "Unknown"),
                gatekeeper: isGatekeeper,
                inCluster: isRegistered,
                lastUpdated: Date.now(),
                score: workerScore,
            };

            workers.push(workerInsight);
        }

        console.info(`[scheduling/workers] 成功获取 ${workers.length} 个有响应的worker信息`);

        if (!workers.length) {
            console.warn("[scheduling/workers] 没有成功获取任何worker信息");
            return null;
        }

        // 选择推荐worker（分数最高的）
        const recommended =
            workers.reduce<WorkerInsight | null>((best, worker) => {
                if (!best || worker.score > best.score) {
                    return worker;
                }
                return best;
            }, null) ?? workers[0];

        if (recommended) {
            recommended.isRecommended = true;
        }

        return {
            clusterId: process.env.SCHEDULING_CLUSTER_ID ?? "local-cluster",
            fetchedAt: Date.now(),
            recommended,
            workers,
        };
    } catch (error) {
        console.error("[scheduling/workers] 获取worker信息失败:", error);
        // 如果获取链上worker失败，回退到原来的方式
        const endpoints = parseWorkerEndpoints();
        if (!endpoints.length) {
            console.warn("[scheduling/workers] 没有配置worker端点");
            return null;
        }
        console.info("[scheduling/workers] 回退到检查本地worker端点:", endpoints);
        const workerResults = await Promise.all(
            endpoints.map(async (endpoint) => {
                try {
                    return await fetchWorkerInfo(endpoint);
                } catch (error) {
                    console.error(`[scheduling/workers] 获取worker信息失败 ${endpoint}:`, error);
                    return null;
                }
            })
        );

        const workers = workerResults.filter(Boolean) as WorkerInsight[];
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

        if (recommended) {
            recommended.isRecommended = true;
        }

        return {
            clusterId: process.env.SCHEDULING_CLUSTER_ID ?? "local-cluster",
            fetchedAt: Date.now(),
            recommended,
            workers,
        };
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
    // 直接查询本地指定的worker，不依赖外部API
    const local = await fetchLocalInsights();
    const payload = local ?? buildFallback();

    console.log(`[scheduling/workers] 返回 ${payload.workers.length} 个worker:`,
        payload.workers.map(w => w.endpoint).join(', '));

    return NextResponse.json({
        success: true,
        data: payload,
    });
}

