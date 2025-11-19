import { NextRequest, NextResponse } from "next/server";
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { options, OnChainRegistry, signCertificate, PinkContractPromise } from '@phala/sdk';
import { existsSync, readFileSync } from 'fs';
import { getNodeUrl, getPruntimeUrl } from '@/lib/config';

function toNumber(value: string | null, fallback = 0) {
    if (value === null) return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

export async function GET(request: NextRequest) {
    let api: ApiPromise | null = null;

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

        console.log(`查询 phat_hello_add 合约: ${contractAddress}, 参数: a=${a}, b=${b}`);
        if (workerEndpoint) {
            console.log(`使用指定的 Worker 端点: ${workerEndpoint}`);
        }

        // 获取节点和worker URL
        const nodeUrl = getNodeUrl();
        const pruntimeUrl = workerEndpoint || getPruntimeUrl();

        console.log(`连接到节点: ${nodeUrl}`);
        console.log(`使用 Pruntime: ${pruntimeUrl}`);

        // 连接到Polkadot节点
        api = await ApiPromise.create(
            options({
                provider: new WsProvider(nodeUrl),
                noInitWarn: true,
            }) as any
        );
        await api.isReady;
        console.log('✅ 已连接到 Phala 节点');

        // 创建keyring和证书
        const keyring = new Keyring({ type: 'sr25519' });
        const deployer = keyring.addFromUri('//Alice');
        const cert = await signCertificate({ pair: deployer });
        console.log(`👤 使用账户: ${deployer.address}`);

        // 查找集群
        const defaultCluster = '0x0000000000000000000000000000000000000000000000000000000000000001';
        let clusterId = defaultCluster;

        try {
            const clusterInfo = await api.query.phalaPhatContracts.clusters(defaultCluster);
            if (clusterInfo && clusterInfo.toString() !== '') {
                console.log('✅ 找到默认集群');
            } else {
                throw new Error('默认集群不存在');
            }
        } catch (error) {
            console.log('⚠️ 默认集群不存在，尝试查找其他集群...');
            const allClusters = await api.query.phalaPhatContracts.clusters.entries();
            if (allClusters.length === 0) {
                throw new Error('没有找到任何集群');
            }
            const [clusterIdHex] = allClusters[0];
            clusterId = clusterIdHex.toHex();
            console.log(`✅ 使用集群: ${clusterId}`);
        }

        // 获取集群中的worker
        const clusterWorkersResult = await api.query.phalaPhatContracts.clusterWorkers(clusterId);
        let workerId: string | undefined = undefined;
        if (clusterWorkersResult && clusterWorkersResult.toString() !== '') {
            // 尝试转换为数组
            const workers = clusterWorkersResult as any;
            if (Array.isArray(workers)) {
                workerId = workers.length > 0 ? workers[0].toHex() : undefined;
            } else if (workers.toArray) {
                const workersArray = workers.toArray();
                workerId = workersArray.length > 0 ? workersArray[0].toHex() : undefined;
            }
        }

        // 创建OnChainRegistry
        const registry = await OnChainRegistry.create(api as any, {
            clusterId,
            workerId,
            pruntimeURL: pruntimeUrl,
            skipCheck: true,
        });
        console.log('✅ 已连接到 Pruntime');

        // 查找合约metadata文件
        const possiblePaths = [
            '/root/tmp/phala-blockchain-setup/src/phat_hello_add.contract',
            '/root/tmp/phala-blockchain-setup/src/phat_hello.contract',
            '/home/user1/Desktop/tmp/phala-blockchain/phala-blockchain-setup/src/phat_hello_add.contract',
            '/app/phala-blockchain-setup/src/phat_hello_add.contract',
            './phala-blockchain-setup/src/phat_hello_add.contract',
            '../phala-blockchain-setup/src/phat_hello_add.contract',
        ];

        let contractMetadataPath = null;
        for (const path of possiblePaths) {
            if (existsSync(path)) {
                contractMetadataPath = path;
                break;
            }
        }

        if (!contractMetadataPath) {
            throw new Error(`找不到 phat_hello_add.contract 文件。检查的路径: ${possiblePaths.join(', ')}`);
        }

        console.log(`📄 加载合约metadata: ${contractMetadataPath}`);
        const contractMetadata = JSON.parse(readFileSync(contractMetadataPath, 'utf8'));

        // 创建合约实例
        const contract = new PinkContractPromise(api, registry, contractMetadata, contractAddress);
        console.log(`📞 调用 add(${a}, ${b}) 方法...`);

        // 调用add方法（查询方法）
        // query.add的参数：origin, options, a, b
        const queryResult = await contract.query.add(deployer.address, { cert }, a, b) as any;
        const { output } = queryResult;

        if (output.isErr) {
            throw new Error(`合约调用失败: ${output.asErr}`);
        }

        const result = output.asOk.toPrimitive();
        console.log(`✅ 调用成功！结果: ${JSON.stringify(result)}`);

        return NextResponse.json({
            success: true,
            data: {
                a,
                b,
                result: result,
                contractAddress: contractAddress,
                executedAt: Date.now()
            },
            message: "phat_hello_add 查询完成",
        });

    } catch (error) {
        console.error('查询失败:', error);
        return NextResponse.json({
            success: false,
            error: `查询失败: ${error instanceof Error ? error.message : '未知错误'}`,
            details: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    } finally {
        // 断开连接
        if (api && api.isConnected) {
            await api.disconnect();
            console.log('🔌 已断开连接');
        }
    }
}
