import { NextRequest, NextResponse } from "next/server";
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';

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
        const a = toNumber(params.get("a"));
        const b = toNumber(params.get("b"));

        if (!contractAddress) {
            return NextResponse.json({
                success: false,
                error: '缺少必要参数：contractAddress'
            }, { status: 400 });
        }

        console.log(`调用 phat_hello_add 合约: ${contractAddress}, 参数: a=${a}, b=${b}`);

        // 检查路径是否存在
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

        // 检查.env文件并读取环境变量
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

        // 检查调用脚本是否存在
        const scriptPath = `${setupPath}/src/call-phat-hello-add.js`;
        if (!existsSync(scriptPath)) {
            throw new Error(`找不到call-phat-hello-add.js脚本。路径: ${scriptPath}`);
        }

        // 执行调用脚本
        const command = `cd "${setupPath}" && node src/call-phat-hello-add.js`;
        console.log('执行命令:', command);

        const env = {
            ...process.env,
            PATH: process.env.PATH || '',
            NODE_ENV: process.env.NODE_ENV || 'production',
            CONTRACT_ADDRESS: contractAddress,
            A: a.toString(),
            B: b.toString(),
            NODE_OPTIONS: '--dns-result-order=ipv4first',
            ...(endpoint && { ENDPOINT: endpoint }),
            ...(worker && { WORKER: worker })
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
                    return NextResponse.json({
                        success: true,
                        data: {
                            a: result.a,
                            b: result.b,
                            result: result.result,
                            contractAddress: result.contractAddress,
                            executedAt: Date.now()
                        },
                        message: "phat_hello_add 调用完成",
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
        console.error('调用失败:', error);
        return NextResponse.json({
            success: false,
            error: `调用失败: ${error instanceof Error ? error.message : '未知错误'}`,
            details: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}

