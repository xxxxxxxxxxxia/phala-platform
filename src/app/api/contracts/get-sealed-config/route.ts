import { NextRequest, NextResponse } from "next/server";
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams;
        const contractAddress = params.get("contractAddress");
        const workerEndpoint = params.get("workerEndpoint"); // 可选的worker端点

        if (!contractAddress) {
            return NextResponse.json({
                success: false,
                error: '缺少必要参数：contractAddress'
            }, { status: 400 });
        }

        console.log(`[Get Sealed Config API] 查询 phat_hello 合约 get_sealed_config: ${contractAddress}`);
        if (workerEndpoint) {
            console.log(`[Get Sealed Config API] 使用指定的 Worker 端点: ${workerEndpoint}`);
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

        console.log(`[Get Sealed Config API] 使用路径: ${setupPath}`);

        // 检查调用脚本是否存在（优先使用test-phat-hello-config.js，如果不存在则使用test-phat-hello-seal-all.js）
        const scriptPath = `${setupPath}/src/test-phat-hello-config.js`;
        const fallbackScriptPath = `${setupPath}/src/test-phat-hello-seal-all.js`;

        let finalScriptPath = null;
        if (existsSync(scriptPath)) {
            finalScriptPath = scriptPath;
            console.log(`[Get Sealed Config API] 使用脚本: ${scriptPath}`);
        } else if (existsSync(fallbackScriptPath)) {
            finalScriptPath = fallbackScriptPath;
            console.log(`[Get Sealed Config API] 使用备用脚本: ${fallbackScriptPath}`);
        } else {
            throw new Error(`找不到查询脚本。检查的路径: ${scriptPath}, ${fallbackScriptPath}`);
        }

        // 检查合约文件是否存在
        const possibleContractPaths = [
            `${setupPath}/src/phat_hello.contract`,
            `${setupPath}/res/phat_hello.contract`,
            `${setupPath}/phat_hello.contract`,
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
        console.log(`[Get Sealed Config API] 使用合约文件: ${contractPath} (相对路径: ${relativeContractPath})`);

        // 读取.env文件获取endpoint和worker
        const envFilePath = `${setupPath}/.env`;
        let endpoint = '';
        let worker = '';

        if (existsSync(envFilePath)) {
            console.log(`[Get Sealed Config API] 读取.env文件: ${envFilePath}`);
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
            console.log(`[Get Sealed Config API] 从.env读取: ENDPOINT=${endpoint}, WORKER=${worker}`);
        }

        // 执行调用脚本
        const scriptName = finalScriptPath.replace(setupPath + '/', '');
        const command = `cd "${setupPath}" && node ${scriptName}`;
        console.log('[Get Sealed Config API] 执行命令:', command);

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
        };

        const { stdout, stderr } = await execAsync(command, {
            timeout: 60000, // 60秒超时
            cwd: setupPath,
            shell: '/bin/sh',
            env
        });

        console.log('[Get Sealed Config API] 脚本输出:', stdout);
        if (stderr) {
            console.error('[Get Sealed Config API] 脚本错误:', stderr);
        }

        // 解析脚本结果
        // 使用更精确的正则表达式匹配完整的 JSON 对象（匹配到最后一个 }）
        const resultMatch = stdout.match(/SCRIPT_RESULT:\s*(\{[\s\S]*\})/);
        const errorMatch = stdout.match(/SCRIPT_ERROR:\s*(.+)/);

        if (errorMatch) {
            return NextResponse.json({
                success: false,
                error: `合约调用失败: ${errorMatch[1]}`,
                details: stderr
            }, { status: 500 });
        }

        if (resultMatch) {
            try {
                const resultStr = resultMatch[1];
                console.log('[Get Sealed Config API] 提取的 JSON 字符串长度:', resultStr.length);
                const result = JSON.parse(resultStr);
                console.log('[Get Sealed Config API] JSON 解析成功，result 结构:', Object.keys(result));

                // 提取 store_key 和 next_store_key
                let store_key = null;
                let next_store_key = null;

                // 优先级1: 直接从 result.result.ok 中解析（这是最常见的格式）
                if (result.result && typeof result.result === 'object' && result.result.ok) {
                    try {
                        if (typeof result.result.ok === 'string') {
                            const innerParsed = JSON.parse(result.result.ok);
                            if (innerParsed.store_key) store_key = innerParsed.store_key;
                            if (innerParsed.next_store_key) next_store_key = innerParsed.next_store_key;
                            console.log('[Get Sealed Config API] 从 result.result.ok 解析成功');
                        } else if (typeof result.result.ok === 'object') {
                            // ok 直接是对象
                            if (result.result.ok.store_key) store_key = result.result.ok.store_key;
                            if (result.result.ok.next_store_key) next_store_key = result.result.ok.next_store_key;
                        }
                    } catch (e) {
                        console.error('[Get Sealed Config API] 解析 result.result.ok 失败:', e);
                    }
                }

                // 优先级2: 从 result.result 中直接获取（如果 result.result 是对象）
                if (!store_key && !next_store_key && result.result && typeof result.result === 'object') {
                    if (result.result.store_key) store_key = result.result.store_key;
                    if (result.result.next_store_key) next_store_key = result.result.next_store_key;
                }

                // 优先级3: 从 rawResult 中解析
                if (!store_key && !next_store_key && result.rawResult) {
                    try {
                        const rawParsed = JSON.parse(result.rawResult);
                        if (rawParsed.ok && typeof rawParsed.ok === 'string') {
                            const innerParsed = JSON.parse(rawParsed.ok);
                            if (innerParsed.store_key) store_key = innerParsed.store_key;
                            if (innerParsed.next_store_key) next_store_key = innerParsed.next_store_key;
                        }
                    } catch (e) {
                        console.error('[Get Sealed Config API] 解析 rawResult 失败:', e);
                    }
                }

                // 优先级4: 直接从 result 顶层获取
                if (!store_key && result.store_key) store_key = result.store_key;
                if (!next_store_key && result.next_store_key) next_store_key = result.next_store_key;

                console.log('[Get Sealed Config API] 提取的密钥 - store_key:', store_key ? store_key.substring(0, 20) + '...' : 'null');
                console.log('[Get Sealed Config API] 提取的密钥 - next_store_key:', next_store_key ? next_store_key.substring(0, 20) + '...' : 'null');

                if (result.success !== false && !result.error) {
                    return NextResponse.json({
                        success: true,
                        data: {
                            store_key,
                            next_store_key,
                            contractAddress: result.contractAddress || contractAddress,
                            executedAt: Date.now()
                        },
                        raw: result,
                        message: "get_sealed_config 查询完成",
                    });
                } else {
                    return NextResponse.json({
                        success: false,
                        error: result.error || '合约调用失败',
                        details: result
                    }, { status: 500 });
                }
            } catch (parseError: any) {
                console.error('[Get Sealed Config API] JSON 解析失败:', parseError.message);
                console.error('[Get Sealed Config API] 提取的字符串:', resultMatch[1].substring(0, 200));
                return NextResponse.json({
                    success: false,
                    error: '解析脚本结果失败: ' + parseError.message,
                    details: stdout.substring(0, 1000)
                }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: false,
            error: '脚本执行失败，无法解析结果',
            details: stdout
        }, { status: 500 });

    } catch (error) {
        console.error('[Get Sealed Config API] 查询失败:', error);
        return NextResponse.json({
            success: false,
            error: `查询失败: ${error instanceof Error ? error.message : '未知错误'}`,
            details: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
