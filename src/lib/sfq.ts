import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { constants as fsConstants } from "fs";
import { access } from "fs/promises";

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
        if (!this.child) {
            return { stopped: false };
        }

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

    status(): StatusResult {
        return {
            running: this.isRunning(),
            pid: this.child?.pid ?? null,
            startedAt: this.startedAt,
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

