import { NextRequest, NextResponse } from 'next/server';
import { getApi } from '@/lib/phalaApi';

const ACCOUNT_PAGE_SIZE = 5;
const MAX_BLOCK_SCAN = 150;

function extractTimestampFromBlock(block: any, fallbackTs: number) {
    const timestampExtrinsic = block.block.extrinsics.find(
        (ext: any) => ext.method.section === 'timestamp' && ext.method.method === 'set'
    );
    if (timestampExtrinsic) {
        const tsArg = timestampExtrinsic.args?.[0]?.toJSON();
        if (typeof tsArg === 'number') {
            return tsArg;
        }
        if (typeof tsArg === 'string') {
            const parsed = parseInt(tsArg, 10);
            if (!Number.isNaN(parsed)) {
                return parsed;
            }
        }
    }
    return fallbackTs;
}

async function fetchBlockDetail(api: any, value: string) {
    let blockHash = value;
    if (!value.startsWith('0x')) {
        const blockNumber = parseInt(value, 10);
        if (Number.isNaN(blockNumber)) {
            throw new Error('区块参数有误');
        }
        const hash = await api.rpc.chain.getBlockHash(blockNumber);
        blockHash = hash.toHex();
    }

    const signedBlock = await api.rpc.chain.getBlock(blockHash);
    const header = signedBlock.block.header;
    const timestamp = extractTimestampFromBlock(
        signedBlock,
        Date.now() - (api?.runtimeVersion?.specVersion ? 6000 : 6000)
    );

    let collator = 'Unknown';
    const preRuntimeLog = header.digest?.logs?.find((log: any) => log.isPreRuntime);
    if (preRuntimeLog) {
        try {
            const [, author] = preRuntimeLog.asPreRuntime;
            collator = author?.toString() || collator;
        } catch {
            collator = preRuntimeLog?.toString() || collator;
        }
    }

    return {
        type: 'block',
        data: {
            blockNumber: header.number.toNumber(),
            hash: blockHash,
            parentHash: header.parentHash.toHex(),
            stateRoot: header.stateRoot.toHex(),
            extrinsicsRoot: header.extrinsicsRoot.toHex(),
            status: 'Finalized',
            timestamp,
            extrinsics: signedBlock.block.extrinsics.map((ext: any, index: number) => ({
                index,
                hash: ext.hash.toHex(),
                method: `${ext.method.section}.${ext.method.method}`,
                signer: ext.signer?.toString() || 'System',
            })),
            collator,
        },
    };
}

async function fetchTransactionDetail(api: any, value: string) {
    let blockHash: string | null = null;
    let extrinsicIndex: number | null = null;

    try {
        const tx = await (api.rpc.chain as any).getTransaction(value);
        if (tx) {
            blockHash = tx.blockHash?.toHex ? tx.blockHash.toHex() : tx.blockHash;
            extrinsicIndex = tx.txIndex !== undefined ? Number(tx.txIndex) : null;
        }
    } catch (error) {
        console.warn('[Explorer Search] chain_getTransaction 不可用或查询失败:', error);
    }

    if (!blockHash) {
        // fallback: 逆向扫描最近区块
        const header = await api.rpc.chain.getHeader();
        const latestNumber = header.number.toNumber();
        for (let i = 0; i < MAX_BLOCK_SCAN; i++) {
            const target = latestNumber - i;
            if (target < 0) break;
            const hash = await api.rpc.chain.getBlockHash(target);
            const block = await api.rpc.chain.getBlock(hash);
            const matchIndex = block.block.extrinsics.findIndex(
                (ext: any) => ext.hash.toHex() === value
            );
            if (matchIndex !== -1) {
                blockHash = hash.toHex();
                extrinsicIndex = matchIndex;
                break;
            }
        }
    }

    if (!blockHash) {
        throw new Error('未找到对应的交易');
    }

    const signedBlock = await api.rpc.chain.getBlock(blockHash);
    const timestamp = extractTimestampFromBlock(signedBlock, Date.now());
    let extrinsic: any = null;

    if (extrinsicIndex !== null && signedBlock.block.extrinsics[extrinsicIndex]) {
        extrinsic = signedBlock.block.extrinsics[extrinsicIndex];
    } else {
        extrinsic = signedBlock.block.extrinsics.find((ext: any) => ext.hash.toHex() === value);
    }

    if (!extrinsic) {
        throw new Error('未找到交易详情');
    }

    return {
        type: 'transaction',
        data: {
            hash: extrinsic.hash.toHex(),
            blockHash,
            blockNumber: signedBlock.block.header.number.toNumber(),
            timestamp,
            method: `${extrinsic.method.section}.${extrinsic.method.method}`,
            signer: extrinsic.signer?.toString() || 'System',
            args: extrinsic.method.args?.map((arg: any) => {
                try {
                    return arg.toJSON();
                } catch {
                    return arg.toString();
                }
            }) || [],
            status: 'success',
        },
    };
}

async function fetchAccountDetail(api: any, value: string, page: number) {
    const accountInfo = await api.query.system.account(value);
    const human = accountInfo.toJSON() as any;
    const header = await api.rpc.chain.getHeader();
    const latestNumber = header.number.toNumber();
    const pageSize = ACCOUNT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;
    const items: any[] = [];
    let matched = 0;

    for (let scanned = 0, blockNumber = latestNumber; scanned < MAX_BLOCK_SCAN && blockNumber >= 0; scanned++, blockNumber--) {
        if (items.length >= pageSize + 1) break;

        const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
        const block = await api.rpc.chain.getBlock(blockHash);
        const timestamp = extractTimestampFromBlock(block, Date.now());

        for (const extrinsic of block.block.extrinsics) {
            const signer = extrinsic.signer?.toString();
            if (signer && signer === value) {
                if (matched >= offset && items.length < pageSize + 1) {
                    items.push({
                        hash: extrinsic.hash.toHex(),
                        blockNumber,
                        blockHash: blockHash.toHex(),
                        timestamp,
                        method: `${extrinsic.method.section}.${extrinsic.method.method}`,
                        status: 'success',
                        args: extrinsic.method.args?.map((arg: any) => {
                            try {
                                return arg.toJSON();
                            } catch {
                                return arg.toString();
                            }
                        }) || [],
                    });
                }
                matched++;
            }
        }
    }

    const hasMore = items.length > pageSize;
    const slicedItems = items.slice(0, pageSize);

    return {
        type: 'account',
        data: {
            account: {
                address: value,
                nonce: human?.nonce ?? 0,
                free: human?.data?.free ?? '0',
                reserved: human?.data?.reserved ?? '0',
                miscFrozen: human?.data?.miscFrozen ?? '0',
                feeFrozen: human?.data?.feeFrozen ?? '0',
            },
            transactions: {
                items: slicedItems,
                page,
                hasMore,
            },
        },
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'block' | 'transaction' | 'account' | null;
    const value = searchParams.get('value');
    const page = parseInt(searchParams.get('page') || '1', 10);

    if (!type || !value) {
        return NextResponse.json({
            success: false,
            error: '缺少必要的查询参数',
        }, { status: 400 });
    }

    try {
        const api = await getApi();
        let result;

        if (type === 'block') {
            result = await fetchBlockDetail(api, value);
        } else if (type === 'transaction') {
            result = await fetchTransactionDetail(api, value);
        } else {
            result = await fetchAccountDetail(api, value, Math.max(page, 1));
        }

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('[Explorer Search] 查询失败:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '未知错误',
        }, { status: 500 });
    }
}

