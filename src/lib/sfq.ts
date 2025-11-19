import { spawn, ChildProcessWithoutNullStreams, exec } from "child_process";
import { constants as fsConstants } from "fs";
import { access } from "fs/promises";
import { promisify } from "util";

const execAsync = promisify(exec);

const SFQ_DEFAULT_BIN = "/root/tmp/phala-platform/bin/sfq-test";
const SFQ_DEFAULT_HOST = process.env.SFQ_SERVER_HOST ?? "127.0.0.1";
const SFQ_FALLBACK_PORT = process.env.SFQ_DEFAULT_PORT ?? "8066";

export type SfqFlowInfo = {
    flow: string;
    weight: number;
    vClock: number;
    timeUsed: number;
    avgCost: number;
    backlog: number;
    accepted: number;
    rejected: number;
    total: number;
};

export type SfqDumpData = {
    raw: string;
    virtualTime: number;
    serving: string;
    backlogSize: number;
    flows: SfqFlowInfo[];
};

type StartResult = {
    pid: number;
    startedAt: number;
    baseUrl: string;
};

type StopResult = {
    stopped: boolean;
};

type StatusResult = {
    running: boolean;
    pid: number | null;
    startedAt: number | null;
    baseUrl: string;
};

function resolvePort() {
    return (process.env.SFQ_SERVER_PORT ?? SFQ_FALLBACK_PORT).toString();
}

function getBaseUrl() {
    const explicit = process.env.SFQ_BASE_URL;
    if (explicit) {
        return explicit.replace(/\/$/, "");
    }
    return `http://${SFQ_DEFAULT_HOST}:${resolvePort()}`;
}

function getBinaryPath() {
    return process.env.SFQ_BIN_PATH || SFQ_DEFAULT_BIN;
}

function getSpawnEnv() {
    const port = resolvePort();
    return {
        ...process.env,
        ROCKET_ADDRESS: SFQ_DEFAULT_HOST,
        ROCKET_PORT: port,
    };
}

async function ensureExecutable(path: string) {
    try {
        await access(path, fsConstants.X_OK);
    } catch (error: any) {
        throw new Error(
            `无法执行 SFQ 二进制 (${path})，请确认文件存在并已 chmod +x。系统信息: ${error?.message || "unknown"}`
        );
    }
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkPortAvailable(host: string, port: string): Promise<{ available: boolean; isSfqServer?: boolean }> {
    try {
        const baseUrl = `http://${host}:${port}`;
        // 使用更可靠的方式检查端口，带超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
            const response = await fetch(`${baseUrl}/test/dump`, {
                cache: "no-store",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            // 如果能连接并响应OK，说明端口被SFQ服务器占用
            if (response.ok) {
                // 验证响应内容是否是SFQ dump格式
                const text = await response.text();
                if (text.includes("V time") || text.includes("Flow stats") || text.includes("Serving")) {
                    return { available: false, isSfqServer: true };
                }
                return { available: false, isSfqServer: false };
            }
            return { available: false, isSfqServer: false };
        } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            // 如果是超时或网络错误，但端口可能仍被占用，尝试使用lsof验证
            try {
                const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`);
                if (stdout.trim()) {
                    // 端口被占用，但无法确认是否为SFQ服务器
                    return { available: false, isSfqServer: false };
                }
            } catch {
                // 忽略lsof失败
            }
            // 连接失败且端口未被占用，说明端口可用
            return { available: true };
        }
    } catch (err) {
        // 其他错误，保守地认为端口可用
        return { available: true };
    }
}

async function waitUntilReady(baseUrl: string, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${baseUrl}/test/dump`);
            if (response.ok) {
                return true;
            }
        } catch (err) {
            // ignore
        }
        await sleep(500);
    }
    throw new Error("SFQ 服务启动超时");
}

function parseNumber(input?: string) {
    if (!input) return 0;
    const value = Number(input.trim());
    return Number.isFinite(value) ? value : 0;
}

export function parseSfqDump(text: string): SfqDumpData {
    const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const virtualTime = parseNumber(
        lines
            .find((line) => line.toLowerCase().startsWith("v time"))
            ?.split(":")[1]
    );

    const serving =
        lines
            .find((line) => line.toLowerCase().startsWith("serving"))
            ?.split(":")[1]
            ?.trim() || "--";

    const backlogSize = parseNumber(
        lines
            .find((line) => line.toLowerCase().startsWith("backlog"))
            ?.split(":")[1]
    );

    const headerIndex = lines.findIndex((line) =>
        line.toLowerCase().startsWith("flow stats")
    );

    const flows: SfqFlowInfo[] = [];

    if (headerIndex !== -1) {
        for (let i = headerIndex + 2; i < lines.length; i++) {
            const line = lines[i];
            if (!line || !line.includes(",")) continue;
            const parts = line.split(",").map((item) => item.trim());
            if (parts.length < 9) continue;

            const [
                flowName,
                explicitWeight,
                vClock,
                timeUsed,
                avgCost,
                backlog,
                accepted,
                rejected,
                total,
            ] = parts;

            const flow = flowName;
            const derivedWeight = flow.split("/")[1];
            flows.push({
                flow,
                weight:
                    parseNumber(explicitWeight) || parseNumber(derivedWeight),
                vClock: parseNumber(vClock),
                timeUsed: parseNumber(timeUsed),
                avgCost: parseNumber(avgCost),
                backlog: parseNumber(backlog),
                accepted: parseNumber(accepted),
                rejected: parseNumber(rejected),
                total: parseNumber(total),
            });
        }
    }

    return {
        raw: text,
        virtualTime,
        serving,
        backlogSize,
        flows,
    };
}

async function fetchDump(): Promise<SfqDumpData> {
    const response = await fetch(`${getBaseUrl()}/test/dump`, {
        cache: "no-store",
    });
    if (!response.ok) {
        throw new Error(`获取 SFQ dump 失败: ${response.status}`);
    }
    const text = await response.text();
    return parseSfqDump(text);
}

class SfqProcessManager {
    private child: ChildProcessWithoutNullStreams | null = null;
    private startedAt: number | null = null;

    isRunning() {
        return !!this.child && !this.child.killed;
    }

    async start(): Promise<StartResult> {
        if (this.isRunning() && this.child?.pid) {
            return {
                pid: this.child.pid,
                startedAt: this.startedAt || Date.now(),
                baseUrl: getBaseUrl(),
            };
        }

        // 检查端口是否已被占用
        const port = resolvePort();
        const portCheck = await checkPortAvailable(SFQ_DEFAULT_HOST, port);

        if (!portCheck.available) {
            if (portCheck.isSfqServer) {
                // 端口被SFQ服务器占用（可能是外部启动的）
                // 如果能连接，说明SFQ服务器已经在运行，直接返回成功
                const baseUrl = getBaseUrl();
                try {
                    // 快速检查服务器是否正常响应
                    const response = await fetch(`${baseUrl}/test/dump`, {
                        cache: "no-store",
                        signal: AbortSignal.timeout(2000),
                    });
                    if (response.ok) {
                        // SFQ服务器已经在运行，接受现有服务器
                        console.warn(
                            `[SFQ] 检测到端口 ${port} 上已有SFQ服务器在运行（可能由外部进程启动），将使用该服务器。`
                        );
                        // 尝试获取PID（通过lsof命令，可选）
                        return {
                            pid: 0, // 无法确定PID
                            startedAt: Date.now(), // 使用当前时间作为近似值
                            baseUrl,
                        };
                    }
                } catch (err) {
                    // 连接失败，但之前检测到是SFQ服务器，可能是临时问题
                    throw new Error(
                        `端口 ${port} 被SFQ服务器占用，但无法正常访问。请检查服务器状态或先停止现有进程。`
                    );
                }
            } else {
                throw new Error(
                    `端口 ${port} 已被占用，但不是SFQ服务器。请先释放端口或检查是否有其他进程在使用。`
                );
            }
        }

        const binPath = getBinaryPath();
        await ensureExecutable(binPath);

        const child = spawn(binPath, [], {
            env: getSpawnEnv(),
            stdio: "ignore",
        });

        this.child = child;
        this.startedAt = Date.now();

        const cleanup = () => {
            if (this.child === child) {
                this.child = null;
                this.startedAt = null;
            }
        };
        child.once("exit", cleanup);

        try {
            await waitUntilReady(getBaseUrl());
        } catch (error) {
            child.kill("SIGTERM");
            cleanup();
            throw error;
        }

        return {
            pid: child.pid ?? 0,
            startedAt: this.startedAt,
            baseUrl: getBaseUrl(),
        };
    }

    async stop(): Promise<StopResult> {
        // 如果管理器有自己的进程，先停止它
        if (this.child) {
            const child = this.child;
            return new Promise<StopResult>((resolve) => {
                child.once("exit", () => {
                    this.child = null;
                    this.startedAt = null;
                    resolve({ stopped: true });
                });
                child.kill("SIGTERM");
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill("SIGKILL");
                    }
                }, 5000);
            });
        }

        // 如果没有管理的进程，检查端口是否被SFQ服务器占用
        const port = resolvePort();
        const portCheck = await checkPortAvailable(SFQ_DEFAULT_HOST, port);

        if (!portCheck.available && portCheck.isSfqServer) {
            // 端口被SFQ服务器占用，尝试通过lsof找到进程并关闭
            try {
                // 使用lsof查找占用端口的进程PID
                const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`);
                const pid = stdout.trim();

                if (pid) {
                    console.log(`[SFQ] 检测到外部SFQ服务器进程 (PID: ${pid})，尝试关闭...`);
                    try {
                        // 先发送SIGTERM信号
                        await execAsync(`kill -TERM ${pid} 2>/dev/null || true`);
                        // 等待2秒
                        await sleep(2000);
                        // 检查进程是否还在运行
                        try {
                            await execAsync(`kill -0 ${pid} 2>/dev/null`);
                            // 如果还在运行，发送SIGKILL
                            console.log(`[SFQ] 进程 ${pid} 未响应SIGTERM，发送SIGKILL...`);
                            await execAsync(`kill -KILL ${pid} 2>/dev/null || true`);
                            await sleep(1000);
                        } catch {
                            // kill -0 失败说明进程已不存在，成功
                        }

                        // 验证端口是否已释放
                        await sleep(500);
                        const finalCheck = await checkPortAvailable(SFQ_DEFAULT_HOST, port);
                        if (finalCheck.available) {
                            console.log(`[SFQ] 外部SFQ服务器进程已成功关闭`);
                            return { stopped: true };
                        } else {
                            throw new Error(`进程已发送关闭信号，但端口 ${port} 仍被占用`);
                        }
                    } catch (killError: any) {
                        throw new Error(`无法关闭进程 ${pid}: ${killError.message}`);
                    }
                } else {
                    return { stopped: false };
                }
            } catch (error: any) {
                // lsof或kill命令失败
                console.error(`[SFQ] 关闭外部进程失败:`, error.message);
                throw new Error(`无法关闭外部SFQ服务器: ${error.message}`);
            }
        }

        // 端口未被占用或不是SFQ服务器
        return { stopped: false };
    }

    async status(): Promise<StatusResult> {
        // 先检查自己管理的进程
        if (this.isRunning() && this.child?.pid) {
            return {
                running: true,
                pid: this.child.pid,
                startedAt: this.startedAt,
                baseUrl: getBaseUrl(),
            };
        }

        // 如果没有管理的进程，先检查端口是否被占用
        const port = resolvePort();
        let pid: number | null = null;
        try {
            const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`);
            const pidStr = stdout.trim();
            if (pidStr) {
                pid = parseInt(pidStr, 10);
            }
        } catch {
            // 忽略获取PID失败
        }

        // 如果端口被占用，尝试访问SFQ服务器API验证
        if (pid) {
            const baseUrl = getBaseUrl();
            try {
                // 使用超时控制器
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                let response: Response;
                try {
                    response = await fetch(`${baseUrl}/test/dump`, {
                        cache: "no-store",
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                } catch (fetchErr: any) {
                    clearTimeout(timeoutId);
                    // 即使fetch失败，如果端口被占用且PID存在，也认为服务器可能在运行
                    // 可能是网络配置问题，但进程确实存在
                    console.log(`[SFQ] Fetch失败但端口被占用 (PID: ${pid}): ${fetchErr?.message || "unknown"}`);
                    // 保守处理：端口被占用但没有验证，返回运行中
                    return {
                        running: true,
                        pid: pid,
                        startedAt: this.startedAt || null,
                        baseUrl,
                    };
                }

                if (response.ok) {
                    const text = await response.text();
                    // 验证是SFQ服务器的响应
                    if (text.includes("V time") || text.includes("Flow stats") || text.includes("Serving")) {
                        console.log(`[SFQ] 检测到SFQ服务器在运行 (PID: ${pid || "unknown"})`);
                        return {
                            running: true,
                            pid: pid,
                            startedAt: this.startedAt || null,
                            baseUrl,
                        };
                    } else {
                        console.log(`[SFQ] 端口响应但内容不是SFQ服务器格式`);
                    }
                } else {
                    console.log(`[SFQ] 端口响应但状态码不是200: ${response.status}`);
                }
            } catch (err: any) {
                // 即使验证失败，如果端口被占用，仍然认为可能运行中
                console.log(`[SFQ] 无法验证SFQ服务器但端口被占用 (PID: ${pid}): ${err?.message || "unknown error"}`);
                return {
                    running: true,
                    pid: pid,
                    startedAt: this.startedAt || null,
                    baseUrl: getBaseUrl(),
                };
            }
        }

        // 无法连接或响应无效，服务器未运行
        return {
            running: false,
            pid: null,
            startedAt: null,
            baseUrl: getBaseUrl(),
        };
    }
}

const globalAny = global as typeof global & {
    __sfqManager?: SfqProcessManager;
};

if (!globalAny.__sfqManager) {
    globalAny.__sfqManager = new SfqProcessManager();
}

const manager = globalAny.__sfqManager;

export function getSfqManager() {
    return manager;
}

export async function getSfqDumpData() {
    return fetchDump();
}

export async function requestSfqFlow(
    flow: string,
    weight: number,
    cost: number
) {
    const response = await fetch(`${getBaseUrl()}/test/${flow}/${weight}/${cost}`);
    if (!response.ok) {
        throw new Error(
            `触发 SFQ flow 失败 (${flow}/${weight}): ${response.status}`
        );
    }
    return response.text();
}

export function buildFlowKey(flow: string, weight: number) {
    return `${flow}/${weight}`;
}

export function mapFlowsByKey(flows: SfqFlowInfo[]) {
    return flows.reduce<Record<string, SfqFlowInfo>>((acc, flow) => {
        acc[flow.flow] = flow;
        return acc;
    }, {});
}

export function getSfqBaseUrl() {
    return getBaseUrl();
}

