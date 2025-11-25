import { NextRequest, NextResponse } from "next/server";
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { getNodeUrl, getPruntimeUrl } from '@/lib/config';

const execAsync = promisify(exec);

function toNumber(value: string | null, fallback = 0) {
    if (value === null) return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams;
        const contractAddress = params.get("contractAddress");
        const workerEndpoint = params.get("workerEndpoint"); // 可选的worker端点
        const a = toNumber(params.get("a"));
        const b = toNumber(params.get("b"));

        if (!contractAddress) {
            return NextResponse.json({
                success: false,
                error: '缺少必要参数：contractAddress'
            }, { status: 400 });
        }

        console.log(`查询 phat_hello 合约: ${contractAddress}, 参数: a=${a}, b=${b}`);
        if (workerEndpoint) {
            console.log(`使用指定的 Worker 端点: ${workerEndpoint}`);
        }

        // 查找setup目录
        const possiblePaths = [
            '/root/tmp/phala-blockchain-setup',
            '/home/user1/Desktop/tmp/phala-blockchain/phala-blockchain-setup',
            '/app/phala-blockchain-setup',
            './phala-blockchain-setup',
            '../phala-blockchain-setup'
        ];

        let setupPath = null;
        for (const path of possiblePaths) {
            if (existsSync(path) && existsSync(`${path}/package.json`)) {
                setupPath = path;
                break;
            }
        }

        if (!setupPath) {
            throw new Error(`找不到phala-blockchain-setup目录。检查的路径: ${possiblePaths.join(', ')}`);
        }

        console.log(`使用路径: ${setupPath}`);

        // 检查调用脚本是否存在（优先使用test-phat-hello-add-query.js，这是之前能工作的脚本）
        const scriptPath = `${setupPath}/src/test-phat-hello-add-query.js`;
        const fallbackScriptPath = `${setupPath}/src/test-phat-hello-add.js`;

        let useTestScript = false;
        if (existsSync(scriptPath)) {
            useTestScript = true;
            console.log(`使用脚本: ${scriptPath}`);
        } else if (existsSync(fallbackScriptPath)) {
            console.log(`使用备用脚本: ${fallbackScriptPath}`);
        } else {
            throw new Error(`找不到查询脚本。检查的路径: ${scriptPath}, ${fallbackScriptPath}`);
        }

        // 检查合约文件是否存在（先尝试新的phat_hello.contract，如果不存在则尝试phat_hello_add.contract）
        const possibleContractPaths = [
            `${setupPath}/src/phat_hello.contract`,
            `${setupPath}/res/phat_hello.contract`,
            `${setupPath}/phat_hello.contract`,
            `${setupPath}/res/phat_hello_add.contract`,
            `${setupPath}/src/phat_hello_add.contract`,
            `${setupPath}/phat_hello_add.contract`,
        ];

        let contractPath = null;
        for (const path of possibleContractPaths) {
            if (existsSync(path)) {
                contractPath = path;
                break;
            }
        }

        if (!contractPath) {
            throw new Error(`找不到合约文件。检查的路径: ${possibleContractPaths.join(', ')}`);
        }

        // 计算相对路径（从setup目录）
        const relativeContractPath = contractPath.replace(setupPath + '/', './');
        console.log(`使用合约文件: ${contractPath} (相对路径: ${relativeContractPath})`);

        // 读取.env文件获取endpoint和worker
        const envFilePath = `${setupPath}/.env`;
        let endpoint = '';
        let worker = '';

        if (existsSync(envFilePath)) {
            console.log(`读取.env文件: ${envFilePath}`);
            const envContent = readFileSync(envFilePath, 'utf-8');
            const envLines = envContent.split('\n');
            for (const line of envLines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    const value = valueParts.join('=').trim();
                    if (key === 'ENDPOINT') {
                        endpoint = value;
                    } else if (key === 'WORKERS') {
                        worker = value.split(',')[0].trim();
                    }
                }
            }
            console.log(`从.env读取: ENDPOINT=${endpoint}, WORKER=${worker}`);
        }

        // 执行调用脚本
        const scriptName = useTestScript ? 'src/test-phat-hello-add-query.js' : 'src/test-phat-hello-add.js';
        const command = `cd "${setupPath}" && node ${scriptName}`;
        console.log('执行命令:', command);

        const env = {
            ...process.env,
            PATH: process.env.PATH || '',
            NODE_ENV: process.env.NODE_ENV || 'production',
            CONTRACT_ADDRESS: contractAddress,
            CONTRACT_PATH: relativeContractPath,
            NODE_OPTIONS: '--dns-result-order=ipv4first',
            ...(endpoint && { ENDPOINT: endpoint }),
            ...(workerEndpoint && { WORKER: workerEndpoint }),
            ...(worker && !workerEndpoint && { WORKER: worker }),
            // test-phat-hello-add.js 会测试多个用例，但也会支持单个用例查询
            ...(useTestScript ? { A: a.toString(), B: b.toString() } : { A: a.toString(), B: b.toString() })
        };

        const { stdout, stderr } = await execAsync(command, {
            timeout: 60000, // 60秒超时
            cwd: setupPath,
            shell: '/bin/sh',
            env
        });

        console.log('脚本输出:', stdout);
        if (stderr) {
            console.error('脚本错误:', stderr);
        }

        // 解析脚本结果
        const resultMatch = stdout.match(/SCRIPT_RESULT: (.+)/);
        const errorMatch = stdout.match(/SCRIPT_ERROR: (.+)/);

        if (errorMatch) {
            return NextResponse.json({
                success: false,
                error: `合约调用失败: ${errorMatch[1]}`,
                details: stderr
            }, { status: 500 });
        }

        if (resultMatch) {
            try {
                const result = JSON.parse(resultMatch[1]);
                if (result.success) {
                    // 提取result中的值（可能直接是数字，或者在某些情况下是对象）
                    let finalResult = result.result;
                    // 如果result是对象且有ok字段，取ok的值
                    if (result.result && typeof result.result === 'object' && 'ok' in result.result) {
                        finalResult = result.result.ok;
                    }
                    // 确保finalResult是数字类型
                    if (typeof finalResult !== 'number') {
                        finalResult = Number(finalResult) || finalResult;
                    }

                    return NextResponse.json({
                        success: true,
                        data: {
                            a: result.a,
                            b: result.b,
                            result: finalResult,
                            contractAddress: result.contractAddress,
                            executedAt: Date.now()
                        },
                        message: "phat_hello 查询完成",
                    });
                } else {
                    return NextResponse.json({
                        success: false,
                        error: result.error || '合约调用失败'
                    }, { status: 500 });
                }
            } catch (parseError) {
                return NextResponse.json({
                    success: false,
                    error: '解析脚本结果失败',
                    details: stdout
                }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: false,
            error: '脚本执行失败，无法解析结果',
            details: stdout
        }, { status: 500 });

    } catch (error) {
        console.error('查询失败:', error);
        return NextResponse.json({
            success: false,
            error: `查询失败: ${error instanceof Error ? error.message : '未知错误'}`,
            details: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
