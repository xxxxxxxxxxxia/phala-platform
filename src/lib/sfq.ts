import { spawn, ChildProcessWithoutNullStreams, exec } from "child_process";
import { constants as fsConstants, readFileSync } from "fs";
import { access } from "fs/promises";
import { existsSync } from "fs";
import { promisify } from "util";
import { resolve, isAbsolute } from "path";

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
    // 如果环境变量指定了路径，直接使用
    if (process.env.SFQ_BIN_PATH) {
        return process.env.SFQ_BIN_PATH;
    }

    // 定义多个可能的路径（参考隐私合约的路径查找方式）
    const possiblePaths = [
        "/root/tmp/phala-platform/bin/sfq-test",
        "/app/phala-platform/bin/sfq-test",
        "/app/bin/sfq-test",
        process.cwd() + "/bin/sfq-test",
        process.cwd() + "/../bin/sfq-test",
        __dirname + "/../../bin/sfq-test",
        __dirname + "/../../../bin/sfq-test",
        __dirname + "/../../../../bin/sfq-test",
        "./bin/sfq-test",
        "../bin/sfq-test",
        "bin/sfq-test",
    ];

    // 遍历查找存在的文件
    for (const path of possiblePaths) {
        if (existsSync(path)) {
            console.log(`[SFQ] 找到二进制文件: ${path}`);
            return path;
        }
    }

    // 如果都找不到，返回默认路径（让后续的错误处理来提示）
    console.warn(`[SFQ] 未找到二进制文件，尝试使用默认路径: ${SFQ_DEFAULT_BIN}`);
    return SFQ_DEFAULT_BIN;
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
    console.log(`[SFQ PortCheck] 检查端口 ${host}:${port}...`);
    try {
        // 首先使用lsof检查端口是否真的被占用
        // 如果lsof不可用，尝试使用netstat或ss（Alpine Linux兼容）
        let portInUse = false;
        let pid: string | null = null;

        try {
            const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`);
            pid = stdout.trim();
            portInUse = !!pid;
            if (portInUse) {
                console.log(`[SFQ PortCheck] 端口被占用，PID: ${pid}`);
            } else {
                console.log(`[SFQ PortCheck] ✅ 端口 ${port} 可用（lsof未检测到占用）`);
                return { available: true };
            }
        } catch (err: any) {
            console.warn(`[SFQ PortCheck] lsof检查失败: ${err?.message || err}，尝试使用netstat`);
            // 如果lsof失败，尝试使用netstat（Alpine Linux可能没有lsof）
            try {
                const { stdout } = await execAsync(`netstat -tuln 2>/dev/null | grep :${port} || echo ""`);
                if (stdout.trim()) {
                    console.log(`[SFQ PortCheck] netstat检测到端口被占用`);
                    portInUse = true;
                } else {
                    console.log(`[SFQ PortCheck] ✅ 端口 ${port} 可用（netstat未检测到占用）`);
                    return { available: true };
                }
            } catch (netstatErr: any) {
                console.warn(`[SFQ PortCheck] netstat也失败: ${netstatErr?.message || netstatErr}，继续尝试fetch检查`);
                // 如果都失败，继续尝试fetch检查
            }
        }

        // 如果检测到端口被占用，继续检查是否是SFQ服务器
        if (!portInUse) {
            console.log(`[SFQ PortCheck] ✅ 端口 ${port} 可用`);
            return { available: true };
        }

        // 端口被占用，尝试访问SFQ服务器API验证
        const baseUrl = `http://${host}:${port}`;
        console.log(`[SFQ PortCheck] 尝试连接SFQ API: ${baseUrl}/test/dump`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
            const response = await fetch(`${baseUrl}/test/dump`, {
                cache: "no-store",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            console.log(`[SFQ PortCheck] HTTP响应: ${response.status} ${response.statusText}`);

            // 如果能连接并响应OK，说明端口被SFQ服务器占用
            if (response.ok) {
                // 验证响应内容是否是SFQ dump格式
                const text = await response.text();
                console.log(`[SFQ PortCheck] 响应内容预览: ${text.substring(0, 100)}...`);
                if (text.includes("V time") || text.includes("Flow stats") || text.includes("Serving")) {
                    console.log(`[SFQ PortCheck] ✅ 确认为SFQ服务器`);
                    return { available: false, isSfqServer: true };
                }
                // 端口被占用但不是SFQ服务器
                console.log(`[SFQ PortCheck] ❌ 端口被占用但不是SFQ服务器（响应内容不匹配）`);
                return { available: false, isSfqServer: false };
            }
            // 响应不OK，端口被占用但不是SFQ服务器
            console.log(`[SFQ PortCheck] ❌ 端口被占用但不是SFQ服务器（HTTP ${response.status}）`);
            return { available: false, isSfqServer: false };
        } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            // fetch失败，但lsof检测到端口被占用
            // 可能是其他服务占用了端口，或者SFQ服务器启动中
            // 保守处理：认为端口被占用但不是SFQ服务器
            console.warn(`[SFQ PortCheck] ❌ 端口 ${port} 被占用但无法访问SFQ API: ${fetchErr?.message || "unknown"}`);
            console.warn(`[SFQ PortCheck] 错误类型: ${fetchErr?.name || "unknown"}, 错误代码: ${fetchErr?.code || "N/A"}`);
            return { available: false, isSfqServer: false };
        }
    } catch (err) {
        // 其他错误，保守地认为端口可用（允许尝试启动）
        console.warn(`[SFQ PortCheck] ⚠️ 检查端口 ${port} 时出错: ${err instanceof Error ? err.message : String(err)}`);
        return { available: true };
    }
}

async function waitUntilReady(baseUrl: string, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    const startTime = Date.now();
    let attemptCount = 0;
    console.log(`[SFQ WaitReady] 等待服务器就绪: ${baseUrl} (超时: ${timeoutMs}ms)`);

    while (Date.now() < deadline) {
        attemptCount++;
        const elapsed = Date.now() - startTime;
        try {
            const response = await fetch(`${baseUrl}/test/dump`, {
                cache: "no-store",
                signal: AbortSignal.timeout(2000),
            });
            if (response.ok) {
                console.log(`[SFQ WaitReady] ✅ 服务器就绪 (尝试 ${attemptCount} 次, 耗时 ${elapsed}ms)`);
                return true;
            } else {
                if (attemptCount % 5 === 0) {
                    console.log(`[SFQ WaitReady] 等待中... (尝试 ${attemptCount}, 耗时 ${elapsed}ms, HTTP ${response.status})`);
                }
            }
        } catch (err: any) {
            if (attemptCount % 5 === 0) {
                console.log(`[SFQ WaitReady] 等待中... (尝试 ${attemptCount}, 耗时 ${elapsed}ms, 错误: ${err?.message || "unknown"})`);
            }
        }
        await sleep(500);
    }
    const elapsed = Date.now() - startTime;
    console.error(`[SFQ WaitReady] ❌ 等待超时 (尝试 ${attemptCount} 次, 耗时 ${elapsed}ms)`);
    throw new Error(`SFQ 服务启动超时 (${timeoutMs}ms)`);
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
        console.log(`[SFQ Start] 开始启动SFQ服务器...`);
        console.log(`[SFQ Start] 当前工作目录: ${process.cwd()}`);
        console.log(`[SFQ Start] __dirname: ${__dirname}`);

        if (this.isRunning() && this.child?.pid) {
            console.log(`[SFQ Start] SFQ服务器已在运行 (PID: ${this.child.pid})`);
            return {
                pid: this.child.pid,
                startedAt: this.startedAt || Date.now(),
                baseUrl: getBaseUrl(),
            };
        }

        // 检查端口是否已被占用
        const port = resolvePort();
        const host = SFQ_DEFAULT_HOST;
        console.log(`[SFQ Start] 检查端口 ${host}:${port} 是否可用...`);

        const portCheck = await checkPortAvailable(host, port);
        console.log(`[SFQ Start] 端口检查结果: available=${portCheck.available}, isSfqServer=${portCheck.isSfqServer}`);

        if (!portCheck.available) {
            if (portCheck.isSfqServer) {
                // 端口被SFQ服务器占用（可能是外部启动的）
                // 如果能连接，说明SFQ服务器已经在运行，直接返回成功
                const baseUrl = getBaseUrl();
                console.log(`[SFQ Start] 检测到端口被SFQ服务器占用，尝试连接: ${baseUrl}`);
                try {
                    // 快速检查服务器是否正常响应
                    const response = await fetch(`${baseUrl}/test/dump`, {
                        cache: "no-store",
                        signal: AbortSignal.timeout(2000),
                    });
                    if (response.ok) {
                        // SFQ服务器已经在运行，接受现有服务器
                        console.log(`[SFQ Start] ✅ 检测到端口 ${port} 上已有SFQ服务器在运行（可能由外部进程启动），将使用该服务器。`);
                        // 尝试获取PID（通过lsof命令，可选）
                        try {
                            const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`);
                            const pid = stdout.trim();
                            console.log(`[SFQ Start] 外部SFQ服务器PID: ${pid || "未知"}`);
                        } catch {
                            // 忽略获取PID失败
                        }
                        return {
                            pid: 0, // 无法确定PID
                            startedAt: Date.now(), // 使用当前时间作为近似值
                            baseUrl,
                        };
                    } else {
                        console.error(`[SFQ Start] ❌ SFQ服务器响应异常: ${response.status} ${response.statusText}`);
                    }
                } catch (err) {
                    // 连接失败，但之前检测到是SFQ服务器，可能是临时问题
                    console.error(`[SFQ Start] ❌ 无法连接到SFQ服务器:`, err);
                    throw new Error(
                        `端口 ${port} 被SFQ服务器占用，但无法正常访问。请检查服务器状态或先停止现有进程。错误: ${err instanceof Error ? err.message : String(err)}`
                    );
                }
            } else {
                console.error(`[SFQ Start] ❌ 端口 ${port} 已被占用，但不是SFQ服务器`);
                // 尝试获取占用端口的进程信息
                try {
                    const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`);
                    const pid = stdout.trim();
                    if (pid) {
                        console.error(`[SFQ Start] 占用端口的进程PID: ${pid}`);
                        try {
                            const { stdout: psOut } = await execAsync(`ps -p ${pid} -o cmd= 2>/dev/null || echo ""`);
                            console.error(`[SFQ Start] 进程命令: ${psOut.trim() || "无法获取"}`);
                        } catch {
                            // 忽略
                        }
                    }
                } catch {
                    // 忽略
                }
                throw new Error(
                    `端口 ${port} 已被占用，但不是SFQ服务器。请先释放端口或检查是否有其他进程在使用。`
                );
            }
        }

        console.log(`[SFQ Start] 端口可用，准备启动SFQ服务器...`);
        const binPath = getBinaryPath();
        console.log(`[SFQ Start] 二进制文件路径: ${binPath}`);

        try {
            await ensureExecutable(binPath);
            console.log(`[SFQ Start] ✅ 二进制文件可执行`);
        } catch (error) {
            console.error(`[SFQ Start] ❌ 二进制文件检查失败:`, error);
            throw error;
        }

        const spawnEnv = getSpawnEnv();
        console.log(`[SFQ Start] 启动环境变量:`, {
            ROCKET_ADDRESS: spawnEnv.ROCKET_ADDRESS,
            ROCKET_PORT: spawnEnv.ROCKET_PORT,
            PATH: (spawnEnv as any).PATH ? String((spawnEnv as any).PATH).substring(0, 50) + '...' : 'N/A',
        });

        console.log(`[SFQ Start] 执行命令: ${binPath}`);
        console.log(`[SFQ Start] 工作目录: ${process.cwd()}`);
        console.log(`[SFQ Start] __dirname: ${__dirname}`);

        // 参考隐私合约的实现方式，使用绝对路径并设置工作目录和环境变量
        const absoluteBinPath = isAbsolute(binPath)
            ? binPath
            : resolve(process.cwd(), binPath);

        console.log(`[SFQ Start] 使用绝对路径: ${absoluteBinPath}`);

        // 再次检查绝对路径是否存在
        if (!existsSync(absoluteBinPath)) {
            throw new Error(`SFQ二进制文件不存在: ${absoluteBinPath}`);
        }

        // SFQ服务器参数：--backlog 15 --depth 3 (适中的容量，既能触发拒绝又能清晰展示权重差异)
        // backlog控制队列容量，越小越容易过载
        // depth控制调度深度，影响权重调度的敏感度
        const sfqArgs = ['--backlog', '15', '--depth', '3'];
        console.log(`[SFQ Start] SFQ服务器参数: ${sfqArgs.join(' ')}`);

        // 在Docker容器中，使用nohup和shell可能更可靠
        // 参考合约查询的实现方式，使用shell执行
        let isDocker = process.env.NODE_ENV === 'production' || existsSync('/.dockerenv');
        if (!isDocker && existsSync('/proc/self/cgroup')) {
            try {
                const cgroupContent = readFileSync('/proc/self/cgroup', 'utf-8');
                isDocker = cgroupContent.includes('docker');
            } catch {
                // 忽略读取失败
            }
        }

        if (isDocker) {
            // Docker环境：使用nohup在后台执行
            const command = `nohup "${absoluteBinPath}" ${sfqArgs.join(' ')} > /dev/null 2>&1 &`;
            console.log(`[SFQ Start] Docker环境，使用nohup执行: ${command}`);

            try {
                await execAsync(command, {
                    env: spawnEnv,
                    cwd: process.cwd(),
                    shell: '/bin/sh',
                });

                // 等待服务器启动
                await sleep(2000);

                // 检查服务器是否启动成功
                const baseUrl = getBaseUrl();
                await waitUntilReady(baseUrl);

                // 尝试获取PID
                try {
                    const { stdout } = await execAsync(`lsof -ti :${resolvePort()} 2>/dev/null || echo ""`);
                    const pid = parseInt(stdout.trim());
                    if (pid > 0) {
                        console.log(`[SFQ Start] ✅ SFQ服务器启动成功 (PID: ${pid}, URL: ${baseUrl})`);
                        this.startedAt = Date.now();
                        return {
                            pid,
                            startedAt: this.startedAt,
                            baseUrl,
                        };
                    }
                } catch {
                    // 忽略PID获取失败
                }
                console.log(`[SFQ Start] ✅ SFQ服务器启动成功 (URL: ${baseUrl})`);
                this.startedAt = Date.now();
                return {
                    pid: 0,
                    startedAt: this.startedAt,
                    baseUrl,
                };
            } catch (error) {
                console.error(`[SFQ Start] ❌ nohup执行失败:`, error);
                throw new Error(`无法在Docker环境中启动SFQ服务器: ${error instanceof Error ? error.message : String(error)}`);
            }
        } else {
            // 开发环境：使用spawn方式
            const child = spawn(absoluteBinPath, sfqArgs, {
                env: spawnEnv,
                stdio: "ignore",
                cwd: process.cwd(),
                shell: false,
                detached: false, // 保持进程关联，便于管理
            });

            if (!child.pid) {
                throw new Error("无法启动SFQ进程，spawn返回的进程没有PID");
            }

            console.log(`[SFQ Start] ✅ 进程已启动 (PID: ${child.pid})`);
            this.child = child;
            this.startedAt = Date.now();

            const cleanup = () => {
                if (this.child === child) {
                    console.log(`[SFQ Start] 清理进程引用 (PID: ${child.pid})`);
                    this.child = null;
                    this.startedAt = null;
                }
            };
            child.once("exit", (code, signal) => {
                console.log(`[SFQ Start] 进程退出 (PID: ${child.pid}, code: ${code}, signal: ${signal})`);
                cleanup();
            });

            child.on("error", (error) => {
                console.error(`[SFQ Start] ❌ 进程错误 (PID: ${child.pid}):`, error);
            });

            const baseUrl = getBaseUrl();
            console.log(`[SFQ Start] 等待服务器就绪: ${baseUrl}`);
            try {
                await waitUntilReady(baseUrl);
                console.log(`[SFQ Start] ✅ SFQ服务器启动成功 (PID: ${child.pid}, URL: ${baseUrl})`);
            } catch (error) {
                console.error(`[SFQ Start] ❌ 等待服务器就绪失败:`, error);
                console.log(`[SFQ Start] 尝试终止进程...`);
                child.kill("SIGTERM");
                await sleep(1000);
                if (!child.killed) {
                    console.log(`[SFQ Start] 进程未响应SIGTERM，发送SIGKILL...`);
                    child.kill("SIGKILL");
                }
                cleanup();
                throw error;
            }

            return {
                pid: child.pid ?? 0,
                startedAt: this.startedAt,
                baseUrl,
            };
        }
    }

    async stop(): Promise<StopResult> {
        console.log(`[SFQ Stop] 开始停止SFQ服务器...`);

        // 如果管理器有自己的进程，先停止它
        if (this.child && this.child.pid) {
            const child = this.child;
            const pid = child.pid;
            console.log(`[SFQ Stop] 停止管理的进程 (PID: ${pid})`);

            return new Promise<StopResult>((resolve) => {
                const timeout = setTimeout(() => {
                    if (!child.killed) {
                        console.log(`[SFQ Stop] 进程 ${pid} 未响应SIGTERM，发送SIGKILL...`);
                        child.kill("SIGKILL");
                    }
                }, 5000);

                child.once("exit", (code, signal) => {
                    clearTimeout(timeout);
                    console.log(`[SFQ Stop] ✅ 进程已退出 (PID: ${pid}, code: ${code}, signal: ${signal})`);
                    this.child = null;
                    this.startedAt = null;
                    resolve({ stopped: true });
                });

                console.log(`[SFQ Stop] 发送SIGTERM信号到进程 ${pid}...`);
                try {
                    child.kill("SIGTERM");
                } catch (error) {
                    console.error(`[SFQ Stop] ❌ 发送SIGTERM失败:`, error);
                    clearTimeout(timeout);
                    resolve({ stopped: false });
                }
            });
        }

        // 如果没有管理的进程，检查端口是否被SFQ服务器占用
        const port = resolvePort();
        const host = SFQ_DEFAULT_HOST;
        console.log(`[SFQ Stop] 没有管理的进程，检查端口 ${host}:${port}...`);

        const portCheck = await checkPortAvailable(host, port);
        console.log(`[SFQ Stop] 端口检查结果: available=${portCheck.available}, isSfqServer=${portCheck.isSfqServer}`);

        if (!portCheck.available && portCheck.isSfqServer) {
            // 端口被SFQ服务器占用，尝试通过lsof找到进程并关闭
            try {
                // 使用lsof查找占用端口的进程PID
                console.log(`[SFQ Stop] 查找占用端口 ${port} 的进程...`);
                const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`);
                const pid = stdout.trim();

                if (pid) {
                    console.log(`[SFQ Stop] 检测到外部SFQ服务器进程 (PID: ${pid})，尝试关闭...`);
                    try {
                        // 先检查进程是否存在
                        try {
                            await execAsync(`kill -0 ${pid} 2>/dev/null`);
                            console.log(`[SFQ Stop] 进程 ${pid} 存在，准备关闭...`);
                        } catch {
                            console.log(`[SFQ Stop] 进程 ${pid} 不存在，可能已经退出`);
                            return { stopped: false };
                        }

                        // 先发送SIGTERM信号
                        console.log(`[SFQ Stop] 发送SIGTERM到进程 ${pid}...`);
                        await execAsync(`kill -TERM ${pid} 2>/dev/null || true`);
                        // 等待3秒（增加等待时间）
                        await sleep(3000);
                        // 检查进程是否还在运行
                        try {
                            await execAsync(`kill -0 ${pid} 2>/dev/null`);
                            // 如果还在运行，发送SIGKILL
                            console.log(`[SFQ Stop] 进程 ${pid} 未响应SIGTERM，发送SIGKILL...`);
                            await execAsync(`kill -KILL ${pid} 2>/dev/null || true`);
                            await sleep(2000);
                            // 再次检查，如果还在运行，尝试强制杀死整个进程组
                            try {
                                await execAsync(`kill -0 ${pid} 2>/dev/null`);
                                console.log(`[SFQ Stop] 进程 ${pid} 仍未退出，尝试杀死进程组...`);
                                // 尝试杀死进程组（包括子进程）
                                await execAsync(`pkill -P ${pid} 2>/dev/null || true`);
                                await execAsync(`kill -9 ${pid} 2>/dev/null || true`);
                                await sleep(1000);
                            } catch {
                                // 进程已退出
                            }
                        } catch {
                            // kill -0 失败说明进程已不存在，成功
                            console.log(`[SFQ Stop] ✅ 进程 ${pid} 已退出`);
                        }

                        // 验证端口是否已释放
                        await sleep(500);
                        console.log(`[SFQ Stop] 验证端口 ${port} 是否已释放...`);
                        const finalCheck = await checkPortAvailable(host, port);
                        if (finalCheck.available) {
                            console.log(`[SFQ Stop] ✅ 外部SFQ服务器进程已成功关闭，端口已释放`);
                            return { stopped: true };
                        } else {
                            console.error(`[SFQ Stop] ❌ 进程已发送关闭信号，但端口 ${port} 仍被占用`);
                            throw new Error(`进程已发送关闭信号，但端口 ${port} 仍被占用`);
                        }
                    } catch (killError: any) {
                        console.error(`[SFQ Stop] ❌ 关闭进程失败:`, killError);
                        throw new Error(`无法关闭进程 ${pid}: ${killError.message}`);
                    }
                } else {
                    console.log(`[SFQ Stop] 未找到占用端口的进程`);
                    return { stopped: false };
                }
            } catch (error: any) {
                // lsof或kill命令失败
                console.error(`[SFQ Stop] ❌ 关闭外部进程失败:`, error);
                throw new Error(`无法关闭外部SFQ服务器: ${error.message}`);
            }
        }

        // 端口未被占用或不是SFQ服务器
        console.log(`[SFQ Stop] 端口未被SFQ服务器占用，无需停止`);
        return { stopped: false };
    }

    async status(): Promise<StatusResult> {
        console.log(`[SFQ Status] 检查SFQ服务器状态...`);

        // 先检查自己管理的进程
        if (this.isRunning() && this.child?.pid) {
            console.log(`[SFQ Status] ✅ 管理的进程正在运行 (PID: ${this.child.pid})`);
            return {
                running: true,
                pid: this.child.pid,
                startedAt: this.startedAt,
                baseUrl: getBaseUrl(),
            };
        }

        // 如果没有管理的进程，先检查端口是否被占用
        const port = resolvePort();
        const host = SFQ_DEFAULT_HOST;
        console.log(`[SFQ Status] 没有管理的进程，检查端口 ${host}:${port}...`);

        let pid: number | null = null;
        try {
            const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`);
            const pidStr = stdout.trim();
            if (pidStr) {
                pid = parseInt(pidStr, 10);
                console.log(`[SFQ Status] 端口被占用，PID: ${pid}`);
            } else {
                console.log(`[SFQ Status] 端口未被占用`);
            }
        } catch (err) {
            console.warn(`[SFQ Status] 获取PID失败:`, err);
            // 忽略获取PID失败
        }

        // 如果端口被占用，尝试访问SFQ服务器API验证
        if (pid) {
            const baseUrl = getBaseUrl();
            console.log(`[SFQ Status] 尝试连接SFQ API: ${baseUrl}/test/dump`);
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
                    console.log(`[SFQ Status] HTTP响应: ${response.status} ${response.statusText}`);
                } catch (fetchErr: any) {
                    clearTimeout(timeoutId);
                    // 即使fetch失败，如果端口被占用且PID存在，也认为服务器可能在运行
                    // 可能是网络配置问题，但进程确实存在
                    console.warn(`[SFQ Status] ⚠️ Fetch失败但端口被占用 (PID: ${pid}): ${fetchErr?.message || "unknown"}`);
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

