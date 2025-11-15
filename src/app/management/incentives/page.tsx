// src/app/page.tsx
'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Space, Typography } from 'antd';
import { ApiPromise, WsProvider } from '@polkadot/api';
// 动态导入Polkadot扩展，避免服务器端渲染错误
// import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { Keyring } from '@polkadot/keyring';
import { formatBalance as polkadotFormatBalance } from '@polkadot/util';
import { BN } from '@polkadot/util';
import { cryptoWaitReady } from '@polkadot/util-crypto';

// Import child components
import ConnectionCard from '../../components/ConnectionCard';
import LiveData from '../../components/LiveData';
import WorkerDashboard from '../../components/WorkerDashboard'; 
import PoolDashboard from '../../components/PoolDashboard';   
import AssetDashboard from '../../components/AssetDashboard';   
import SessionManager from '../../components/SessionManager';
import TokenomicEditor from '../../components/TokenomicEditor';
import Console from '../../components/Console';
import Modal from '../../components/Modal';
import Toast from '../../components/Toast';
import SystemOperations from '../../components/SystemOperations';
import MainLayout from '../../components/layout/MainLayout';
import AuthGuard from '../../components/AuthGuard';

// Import styles
import styles from './page.module.css';

const { Title } = Typography;

// --- TypeScript Interfaces ---
export interface IAccount extends InjectedAccountWithMeta { }

export interface IChainInfo {
    chain: string;
    version: string;
    blockNumber: number;
}

export interface IWorker {
    pubkey: string;
    operator: string | null;
    initialScore: {
        toLocaleString: () => string;
    };
    lastUpdated: number;
}

export interface IPool {
    StakePool: {
        basepool: {
            pid: number;
            owner: string;
            totalShares: string;
            totalValue: string;
            poolAccountId: string;
        };
        workers: string[];
        lockAccount: string;
    };
}

export interface ISession {
    accountId: string;
    info: {
        state: {
            toString: () => string;
        };
        ve: number;
        v: number;
        benchmark: {
            workingStartTime: number;
            pInstant: number;
            iterations: number;
        };
        stats: {
            totalReward: string;
        };
    };
}

export interface IPruntimeInfo {
    version: number;
    machineId: string;
    pubkey: string;
    ecdhPubkey: string;
    genesisBlockHash: string;
    features: string;
    paraId: number;
    maxConsensusVersion: number;
    operator: string;
}

export interface IToast {
    id: number;
    message: string;
}

// --- Constants ---
const DEFAULT_GATEKEEPER_PUBKEY = '0x3a3d45dc55b57bf542f4c6ff41af080ec675317f4ed50ae1d2713bf9f892692d';
const DEFAULT_ASSET_ID = 10000;
const DEFAULT_SESSION_ACCOUNT = '43E9fDbtyZ4APY7hnnstrkSwyXk5CaQ66AEHZEshjMH4hqaq';


const IncentiveFlow = (): React.ReactElement => {
    const [view, setView] = useState<'dashboard' | 'system'>('dashboard');
    // --- State Management ---
    const [isCryptoReady, setIsCryptoReady] = useState<boolean>(false);
    const [wsUrl, setWsUrl] = useState<string>('ws://8.147.107.221:19944');
    const [pruntimeUrl, setPruntimeUrl] = useState<string>('http://8.147.107.221:18000');
    const [connecting, setConnecting] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [api, setApi] = useState<ApiPromise | null>(null);
    const [isTxInProgress, setIsTxInProgress] = useState<boolean>(false);

    const [chainInfo, setChainInfo] = useState<IChainInfo>({ chain: '', version: '', blockNumber: 0 });
    const [accounts, setAccounts] = useState<IAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [lastResult, setLastResult] = useState<string>('');

    const [isErrorModalVisible, setIsErrorModalVisible] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [toasts, setToasts] = useState<IToast[]>([]);

    // Data stores
    const [workers, setWorkers] = useState<IWorker[]>([]);
    const [sessions, setSessions] = useState<ISession[]>([]);
    const [pools, setPools] = useState<IPool[]>([]);
    const [gatekeepers, setGatekeepers] = useState<string[]>([]);

    // Form inputs
    const [gatekeeperPub, setGatekeeperPub] = useState<string>(DEFAULT_GATEKEEPER_PUBKEY);
    const [forcePub, setForcePub] = useState<string>(DEFAULT_GATEKEEPER_PUBKEY);
    const [forceEcdhPub, setForceEcdhPub] = useState<string>(DEFAULT_GATEKEEPER_PUBKEY);
    const [forceOperator, setForceOperator] = useState<string>('');
    const [registerV2Sender, setRegisterV2Sender] = useState<string>('');
    const [pruntimeInfoForRegister, setPruntimeInfoForRegister] = useState<IPruntimeInfo>({
        version: 0, machineId: '0x', pubkey: '0x', ecdhPubkey: '0x', genesisBlockHash: '0x',
        features: '8,2', paraId: 0, maxConsensusVersion: 0, operator: ''
    });
    const [setOperatorForV2, setSetOperatorForV2] = useState<boolean>(true);
    const [pid, setPid] = useState<string>('0');
    const [createPoolSender, setCreatePoolSender] = useState<string>('');
    const [workerToAdd, setWorkerToAdd] = useState<string>(DEFAULT_GATEKEEPER_PUBKEY);
    const [addWorkerSender, setAddWorkerSender] = useState<string>('');
    const [createAssetSender, setCreateAssetSender] = useState<string>('');
    const [createAssetId, setCreateAssetId] = useState<number>(DEFAULT_ASSET_ID);
    const [createAssetAdmin, setCreateAssetAdmin] = useState<string>('');
    const [createAssetMinBalance, setCreateAssetMinBalance] = useState<number>(1);
    const [mintAssetSender, setMintAssetSender] = useState<string>('');
    const [mintAssetId, setMintAssetId] = useState<number>(DEFAULT_ASSET_ID);
    const [mintAmount, setMintAmount] = useState<string>('100000000000000000000');
    const [mintBeneficiary, setMintBeneficiary] = useState<string>('');
    const [touchWho, setTouchWho] = useState<string>('42qrmpXrY6abpaN8dtdU66D1uZmFQV3GJz9hJ53agR8iCLqR');
    const [touchLockAccountAddress, setTouchLockAccountAddress] = useState<string>('43E8Q7hLhu4wmnXNgTPfo45w5HGwwkzVRs6n9WXV3bqubnTb');
    const [touchLockAccountSender, setTouchLockAccountSender] = useState<string>('');
    const [contribPid, setContribPid] = useState<string>('0');
    const [contribAmount, setContribAmount] = useState<string>('1000000000000000008');
    const [useAsVault, setUseAsVault] = useState<boolean>(false);
    const [asVaultValue, setAsVaultValue] = useState<string>('');
    const [transferSender, setTransferSender] = useState<string>('');
    const [transferRecipient, setTransferRecipient] = useState<string>(DEFAULT_SESSION_ACCOUNT);
    const [transferAmount, setTransferAmount] = useState<number>(0.5);
    const [startWorker, setStartWorker] = useState<string>(DEFAULT_GATEKEEPER_PUBKEY);
    const [startStake, setStartStake] = useState<string>('10000000000000006');
    const [sessionAccount, setSessionAccount] = useState<string>('43E9fDbtyZ4APY7hnnstrkSwyXk5CaQ66AEHZEshjMH4hqaq');
    const [tokenomicJson, setTokenomicJson] = useState<string>('{}');
    const [contributeSender, setContributeSender] = useState<string>('');
    const [startComputingSender, setStartComputingSender] = useState<string>('');
    const [startComputingPid, setStartComputingPid] = useState<string>('0');
    const [withdrawSender, setWithdrawSender] = useState<string>('');
    const [withdrawPoolId, setWithdrawPoolId] = useState<string>('0');
    const [withdrawWorkerPubkey, setWithdrawWorkerPubkey] = useState<string>(DEFAULT_GATEKEEPER_PUBKEY);

    // --- Refs for timers/subscriptions ---
    const autoRefreshTimer = useRef<NodeJS.Timeout | null>(null);
    const unsubscribeBlock = useRef<(() => void) | null>(null);

    // --- Computed properties (useMemo) ---
    const totalRewards = useMemo<bigint>(() => {
        return sessions.reduce((total, s) => {
            const reward = s.info?.stats?.totalReward ? BigInt(s.info.stats.totalReward.toString()) : BigInt(0);
            return total + reward;
        }, BigInt(0));
    }, [sessions]);

    // --- Utility Functions ---
    const formatAddress = useCallback((address: string, length = 6): string => {
        if (!address) return '';
        return `${address.substring(0, length)}...${address.substring(address.length - length)}`;
    }, []);

    const formatBalance = useCallback((value: bigint | string | number | undefined | null, decimals = 12, unit = 'PHA'): string => {
        if (!api || value === undefined || value === null) return `0.0000 ${unit}`;
        polkadotFormatBalance.setDefaults({ decimals, unit });
        return polkadotFormatBalance(value.toString(), { withUnit: true, forceUnit: '-' });
    }, [api]);

    const formatLargeNumber = (value: number | string | undefined | null): string => {
        if (!value) return '0';
        try {
            return BigInt(value).toLocaleString('en-US');
        } catch (e) {
            return String(value);
        }
    };

    const formatTimestamp = (timestamp: number | undefined | null): string => {
        if (!timestamp || timestamp === 0) return 'N/A';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    };

    const log = useCallback((message: string, isError = false): void => {
        const color = isError ? 'style="color: #ff8a8a;"' : 'style="color: #b1e89a;"';
        const timestamp = new Date().toLocaleTimeString();
        setLastResult(prev => `<span ${color}>[${timestamp}] ${message}</span><br/>` + prev);
    }, []);

    const handleError = useCallback((message: string): void => {
        log(message, true);
        setErrorMessage(message);
        setIsErrorModalVisible(true);
    }, [log]);

    const showSuccessToast = useCallback((message: string): void => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message }]);
        setTimeout(() => {
            setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const queryWithTimeout = (promise: Promise<any>, timeout = 15000): Promise<any> => {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`查询超时 (${timeout / 1000} 秒)。`));
            }, timeout);
        });
        return Promise.race([promise, timeoutPromise]);
    }

    // --- Core API and Data Fetching ---
    const stopAutoRefresh = useCallback(() => {
        if (autoRefreshTimer.current) {
            clearTimeout(autoRefreshTimer.current);
            autoRefreshTimer.current = null;
        }
    }, []);

    const querySessions = useCallback(async (isSilent = false, isManualRefresh = false, fetchAll = false): Promise<void> => {
        if (!api) return;
        if (!isSilent || isManualRefresh) log("正在查询会话信息...");
        try {
            if (sessionAccount && !fetchAll) { // <--- 修改这里
                const result = await queryWithTimeout(api.query.phalaComputation.sessions(sessionAccount));
                setSessions(result.isSome ? [{
                    accountId: sessionAccount,
                    info: result.unwrap().toJSON()
                }] : [])
            } else {
                const results = await queryWithTimeout(api.query.phalaComputation.sessions.entries());
                setSessions(results.map(([key, value]: [any, any]) => ({
                    accountId: key.args[0].toString(),
                    info: value.unwrap().toJSON()
                })))
            }
            if (!isSilent || isManualRefresh) log(`查询到 ${sessions.length} 个会话。`)
        } catch (e: any) {
            if (!isSilent) handleError(`查询会话失败: ${e.message}`)
        }
    }, [api, log, handleError, sessionAccount]);

    const refreshAllData = useCallback(async (isManual = false): Promise<void> => {
        if (!api || (loading && !isManual)) return;
        setLoading(true);
        if (isManual) log('正在刷新所有链上数据...');

        const normalizePoolData = (rawData: any, pid: number | null = null): IPool | null => {
            try {
                if (!rawData) return null;
                const stakePool = rawData.StakePool || rawData.stakePool;
                if (stakePool && stakePool.basepool) {
                    if (stakePool.basepool.pid == null && pid != null) {
                        stakePool.basepool.pid = pid;
                    }
                    return { StakePool: stakePool } as IPool;
                }
                return null;
            } catch (e) {
                return null;
            }
        };

        try {
            // Fetch Workers
            if (isManual) log('1/4: 查询 Workers...');
            try {
                const workersData = await queryWithTimeout(api.query.phalaRegistry.workers.entries(), 10000);
                setWorkers(workersData.map(([, worker]: [any, any]) => worker.isSome ? worker.unwrap().toJSON() : null).filter(Boolean));
                if (isManual) log(`  > 成功! 找到 ${workers.length} 个 Worker。`);
            } catch (e: any) {
                setWorkers([]);
                log(`查询 Workers 失败: ${e.message}`, true);
            }

            // Fetch Pools
            if (isManual) log('2/4: 查询质押池...');
            let foundPools: (IPool | null)[] = [];
            try {
                const poolCountRaw = await queryWithTimeout(api.query.phalaBasePool.poolCount(), 8000);
                const count = (poolCountRaw && typeof poolCountRaw.toNumber === 'function') ? poolCountRaw.toNumber() : 0;

                if (count > 0) {
                    const batchSize = 20;
                    for (let i = 0; i < count; i += batchSize) {
                        const ids = Array.from({ length: Math.min(batchSize, count - i) }, (_, k) => i + k);
                        const infos = await queryWithTimeout(api.query.phalaBasePool.pools.multi(ids), 12000);

                        const normalized = infos.map((p: any) => p.isSome ? normalizePoolData(p.unwrap().toJSON()) : null).filter(Boolean);
                        foundPools.push(...normalized);
                    }
                }
            } catch (multiError: any) {
                log(`注意: 查询质押池主方案失败(${multiError.message})，启动备用方案...`, true);
                try {
                    const poolEntries = await queryWithTimeout(api.query.phalaBasePool.pools.entries(), 20000);
                    foundPools = poolEntries.map(([key, poolInfo]: [any, any]) => {
                        const pid = key.args[0] ? key.args[0].toNumber() : null;
                        return poolInfo.isSome ? normalizePoolData(poolInfo.unwrap().toJSON(), pid) : null;
                    }).filter(Boolean);
                } catch (entryError: any) {
                    log(`备用方案查询质押池也失败: ${entryError.message}`, true);
                    foundPools = [];
                }
            }
            setPools(foundPools.filter((p): p is IPool => p !== null));
            if (isManual) log(`  > 成功! 找到 ${foundPools.length} 个质押池。`);

            // Fetch Gatekeepers
            if (isManual) log('3/4: 查询 Gatekeeper...');
            try {
                const gatekeepersData = await queryWithTimeout(api.query.phalaRegistry.gatekeeper(), 8000);
                setGatekeepers(Array.isArray(gatekeepersData) ? gatekeepersData.map(gk => gk.toHex()) : []);
                if (isManual) log(`  > 成功! 找到 ${gatekeepers.length} 个 Gatekeeper。`);
            } catch (e: any) {
                setGatekeepers([]);
                log(`查询 Gatekeeper 失败: ${e.message}`, true);
            }

            if (isManual) log('4/4: 查询会话 (静默)...');
            await querySessions(true, isManual, true);

            if (isManual) showSuccessToast('✅ 所有数据刷新完毕。');
        } catch (e: any) {
            const message = `刷新数据时发生严重错误: ${e.message}`;
            if (isManual) handleError(message); else log(message, true);
        } finally {
            setLoading(false);
        }
    }, [api, log, handleError, showSuccessToast, querySessions]);

    const startAutoRefresh = useCallback(() => {
        stopAutoRefresh();
        const autoRefresh = async () => {
            if (api) {
                await refreshAllData(false);
            }
            autoRefreshTimer.current = setTimeout(autoRefresh, 12000);
        };
        autoRefresh();
    }, [api, refreshAllData, stopAutoRefresh]);

    const disconnect = useCallback(async (): Promise<void> => {
        stopAutoRefresh();
        if (unsubscribeBlock.current) {
            unsubscribeBlock.current();
            unsubscribeBlock.current = null;
        }
        if (api) {
            await api.disconnect();
            setApi(null);
        }
        setChainInfo({ chain: '', version: '', blockNumber: 0 });
        log('已断开连接。');
    }, [api, stopAutoRefresh, log]);

    const loadAccounts = useCallback(async (): Promise<void> => {
        log('正在自动加载本地开发账户...');

        try {
            const keyring = new Keyring({ type: 'sr25519', ss58Format: 30 });
            const devAccountNames = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Ferdie'];

            const devAccounts = devAccountNames.map(name => {
                const account = keyring.addFromUri(`//${name}`);
                return { address: account.address, meta: { name, source: 'Dev' } } as IAccount;
            });

            // 直接更新账户列表 state
            setAccounts(devAccounts);
            log(`成功加载 ${devAccounts.length} 个本地开发账户。`);

            // 如果找到了账户，则自动设置所有操作的默认发送者
            if (devAccounts.length > 0) {
                const aliceAddress = devAccounts.find(a => a.meta.name === 'Alice')?.address || devAccounts[0].address;
                const bobAddress = devAccounts.find(a => a.meta.name === 'Bob')?.address || devAccounts[0].address;

                log(`已设置默认操作账户为: Alice`);

                // 全局默认账户
                setSelectedAccount(aliceAddress);
                // 各个模块的默认发送账户
                setRegisterV2Sender(aliceAddress);
                setTransferSender(aliceAddress);
                setForceOperator(aliceAddress);
                setCreatePoolSender(aliceAddress);
                setCreateAssetSender(aliceAddress);
                setCreateAssetAdmin(bobAddress);
                setMintAssetSender(bobAddress);
                setMintBeneficiary(aliceAddress);
                setContributeSender(aliceAddress);
                setStartComputingSender(aliceAddress);
                setWithdrawSender(aliceAddress);
                setTouchLockAccountSender(aliceAddress);
                setAddWorkerSender(aliceAddress);

                // 设置默认pruntime操作者
                setPruntimeInfoForRegister(p => ({ ...p, operator: aliceAddress }));
            } else {
                // 理论上开发账户总能加载成功，但保留错误处理
                handleError("未能加载任何开发账户。");
            }

        } catch (e: any) {
            log(`加载开发账户时出错: ${e.message}`, true);
            handleError(`加载开发账户时出错: ${e.message}`);
        }

    }, [log, handleError]);

    const subscribeChainInfo = useCallback(async (currentApi: ApiPromise): Promise<void> => {
        try {
            const [chain, nodeName, nodeVersion] = await Promise.all([currentApi.rpc.system.chain(), currentApi.rpc.system.name(), currentApi.rpc.system.version()]);
            setChainInfo(prev => ({ ...prev, chain: chain.toString(), version: `${nodeName} v${nodeVersion}` }));
            if (unsubscribeBlock.current) unsubscribeBlock.current();
            unsubscribeBlock.current = await currentApi.rpc.chain.subscribeNewHeads((header) => {
                setChainInfo(prev => ({ ...prev, blockNumber: header.number.toNumber() }));
            });
        } catch (e: any) {
            handleError(`获取链信息失败: ${e.message}`);
        }
    }, [handleError]);

    const connect = useCallback(async (): Promise<void> => {
        if (api || connecting) return;
        setConnecting(true);
        setLastResult('');
        log(`正在连接到 ${wsUrl}...`);
        try {
            const provider = new WsProvider(wsUrl);
            const apiPromise = ApiPromise.create({ provider });
            const newApi = await queryWithTimeout(apiPromise, 10000);
            await newApi.isReady;

            setConnecting(false);
            setApi(newApi);
            showSuccessToast('✅ 连接成功!');

            newApi.on('disconnected', async () => {
                //handleError('🔌 已断开连接。');
                showSuccessToast('❌ 已断开连接!');
                stopAutoRefresh();
                await disconnect();
            });
            newApi.on('error', (error: Error) => handleError(`API 出现错误: ${error.message}`));

            await subscribeChainInfo(newApi);
        } catch (e: any) {
            handleError(`❌ 连接失败: ${e.message}`);
            setApi(null);
            setConnecting(false);
        }
    }, [api, connecting, wsUrl, log, showSuccessToast, handleError, disconnect, subscribeChainInfo, stopAutoRefresh]);

    useEffect(() => {
        const setup = async () => {
            if (api) {
                // 连接成功后，立即加载账户
                await loadAccounts();
                // 然后刷新链上数据并开启自动刷新
                refreshAllData(true);
                startAutoRefresh();
            }
        };
        setup();

        return () => {
            stopAutoRefresh();
        }
    }, [api, loadAccounts, refreshAllData, startAutoRefresh, stopAutoRefresh]); // 添加新的依赖

    useEffect(() => {
        const initCrypto = async () => {
            try {
                await cryptoWaitReady();
                console.log("✅ Crypto WASM is ready.");
                setIsCryptoReady(true);
            } catch (err) {
                console.error("❌ Failed to initialize crypto WASM", err);
                // 您可以在这里设置一个错误状态来提醒用户
                handleError("加密模块初始化失败，请刷新页面重试。");
            }
        };
        initCrypto();
    }, []); // 空依赖数组确保这个 effect 只运行一次

    const enableExtension = useCallback(async (): Promise<void> => {
        try {
            // 动态导入Polkadot扩展，避免服务器端渲染错误
            const { web3Enable, web3Accounts } = await import('@polkadot/extension-dapp');
            await web3Enable('Phala-Incentive-UI');
            const extAccounts = await web3Accounts();
            if (!extAccounts.length) {
                handleError('找不到浏览器扩展账户。');
                return;
            }
            const newAccounts = [...accounts, ...extAccounts].filter((v, i, a) => a.findIndex(t => (t.address === v.address)) === i);
            setAccounts(newAccounts);
            if (newAccounts.length > 0 && !selectedAccount) {
                setSelectedAccount(newAccounts[0].address);
            }
            showSuccessToast('浏览器扩展账户加载成功。');
        } catch (e: any) {
            handleError(`加载扩展失败: ${e.message}`);
        }
    }, [accounts, handleError, showSuccessToast, selectedAccount]);

    const loadDevAccount = useCallback((): void => {
        const keyring = new Keyring({ type: 'sr25519', ss58Format: 30 });
        const devAccountNames = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Ferdie'];

        // 1. 从 URI 创建所有开发账户的密钥对
        const devAccounts = devAccountNames.map(name => {
            const account = keyring.addFromUri(`//${name}`);
            return { address: account.address, meta: { name, source: 'Dev' } } as IAccount;
        });

        // 2. 将新账户添加到 state 中，并去重
        const newAccounts = [...accounts, ...devAccounts].filter((v, i, a) => a.findIndex(t => (t.address === v.address)) === i);
        setAccounts(newAccounts);

        // 3. 【重要】使用 addFromUri 获取特定账户地址，而不是 getPair
        const aliceAddress = keyring.addFromUri('//Alice').address;
        const bobAddress = keyring.addFromUri('//Bob').address;
        const aliceStashAddress = keyring.addFromUri('//Alice//stash').address;

        // 4. 使用正确获取的地址设置各个表单的默认值
        if (!selectedAccount) setSelectedAccount(aliceAddress);
        if (!registerV2Sender) setRegisterV2Sender(aliceAddress);
        if (!transferSender) setTransferSender(aliceAddress);
        setForceOperator(aliceAddress);
        setPruntimeInfoForRegister(p => ({ ...p, operator: aliceAddress }));
        if (!createPoolSender) setCreatePoolSender(aliceAddress);
        if (!createAssetSender) setCreateAssetSender(aliceAddress);
        if (!createAssetAdmin) setCreateAssetAdmin(bobAddress);
        if (!mintAssetSender) setMintAssetSender(bobAddress);
        if (!mintBeneficiary) setMintBeneficiary(aliceAddress);
        if (!contributeSender) setContributeSender(aliceAddress);
        if (!startComputingSender) setStartComputingSender(aliceAddress);
        if (!withdrawSender) setWithdrawSender(aliceAddress);
        if (!touchLockAccountSender) setTouchLockAccountSender(aliceAddress);
        setSessionAccount(aliceStashAddress); // 使用正确派生的 stash 地址

        log('开发账户 (Alice, Bob...) 已加载。');
    }, [
        accounts, log, selectedAccount, registerV2Sender, transferSender, forceOperator,
        createPoolSender, createAssetSender, createAssetAdmin, mintAssetSender, mintBeneficiary,
        contributeSender, startComputingSender, withdrawSender, touchLockAccountSender,
        pruntimeInfoForRegister.operator // 添加所有依赖项以遵循 React Hooks 规则
    ]);

    const sendTransaction = useCallback(async (extrinsic: any, isSudo = false, senderAddress: string | null = null): Promise<void> => {
        if (isTxInProgress) {
            handleError("请等待上一笔交易完成后再操作。");
            return;
        }

        const finalSender = senderAddress || selectedAccount;
        if (!finalSender || !api) {
            handleError('请先选择一个操作账户或API未连接!');
            return;
        }

        setIsTxInProgress(true);
        stopAutoRefresh();
        log(`准备提交交易: ${extrinsic.method.section}.${extrinsic.method.method}`);

        try {
            const account = accounts.find(a => a.address === finalSender);
            if (!account) throw new Error(`发送账户 ${finalSender} 未找到。`);

            let finalExtrinsic = isSudo ? api.tx.sudo.sudo(extrinsic) : extrinsic;

            const handleStatus = ({ status, dispatchError }: { status: any, dispatchError: any }): void => {
                if (status.isInBlock) log(`交易已打包进区块: ${status.asInBlock}`);
                else if (status.isFinalized) {
                    unsubscribe();
                    setIsTxInProgress(false);

                    if (dispatchError) {
                        let dispatchErrorMessage = '';
                        if (dispatchError.isModule) {
                            const decoded = api.registry.findMetaError(dispatchError.asModule);
                            dispatchErrorMessage = `交易失败: ${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                        } else {
                            dispatchErrorMessage = `交易失败: ${dispatchError.toString()}`;
                        }
                        handleError(dispatchErrorMessage);
                    } else {
                        log(`✅ 交易在区块 ${status.asFinalized} 中最终确认并成功！`);
                        showSuccessToast(`✅ 交易 ${extrinsic.method.section}.${extrinsic.method.method} 已成功！`);
                        refreshAllData(true);
                    }
                    startAutoRefresh();
                }
            };

            let unsubscribe: () => void;
            if (account.meta.source === 'Dev') {
                const keyring = new Keyring({ type: 'sr25519', ss58Format: 30 });
                const signer = keyring.addFromUri(`//${account.meta.name}`);
                unsubscribe = await finalExtrinsic.signAndSend(signer, handleStatus);
            } else {
                // 动态导入Polkadot扩展，避免服务器端渲染错误
                const { web3FromAddress } = await import('@polkadot/extension-dapp');
                const injector = await web3FromAddress(finalSender);
                unsubscribe = await finalExtrinsic.signAndSend(finalSender, { signer: injector.signer }, handleStatus);
            }

        } catch (e: any) {
            handleError(`交易签名或发送错误: ${e.message}`);
            setIsTxInProgress(false);
            startAutoRefresh();
        }
    }, [api, accounts, selectedAccount, isTxInProgress, handleError, log, showSuccessToast, startAutoRefresh, stopAutoRefresh, refreshAllData]);

    // --- Feature Functions ---
    // (All feature functions like registerGatekeeper, etc. would be defined here, using the sendTransaction callback)
    const registerGatekeeper = useCallback(() => {
        if (!api) return;
        sendTransaction(api.tx.phalaRegistry.registerGatekeeper(gatekeeperPub), true);
    }, [api, sendTransaction, gatekeeperPub]);

    const forceRegisterWorker = useCallback(() => {
        if (!api || !forceOperator) return handleError("请选择一个操作者！");
        const extrinsic = api.tx.phalaRegistry.forceRegisterWorker(forcePub, forceEcdhPub, forceOperator);
        sendTransaction(extrinsic, true);
    }, [api, sendTransaction, forceOperator, forcePub, forceEcdhPub]);

    const getPruntimeInfo = useCallback(async () => {
        log(`正在从 ${pruntimeUrl} 获取信息...`);
        setPruntimeInfoForRegister({
            version: 0, machineId: '0x', pubkey: '0x', ecdhPubkey: '0x', genesisBlockHash: '0x',
            features: '8,2', paraId: 0, maxConsensusVersion: 0, operator: ''
        });
        try {
            // 使用Next.js API代理，避免CORS问题
            const response = await fetch(`/api/pruntime-proxy?target=${encodeURIComponent(pruntimeUrl)}&endpoint=prpc/PhactoryAPI.GetInfo`, { method: 'GET' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
            const data = await response.json();
            setPruntimeInfoForRegister({
                version: 0,
                machineId: '0xdddddddddddddddddddddddddddddddddddddddddddd',
                pubkey: '0x' + data.public_key,
                ecdhPubkey: '0x' + data.ecdh_public_key,
                genesisBlockHash: '0x' + data.genesis_block_hash,
                features: "8,2",
                paraId: 0,
                maxConsensusVersion: data.max_supported_consensus_version ?? 0,
                operator: selectedAccount || ''
            });
            showSuccessToast("✅ pRuntime 信息已自动填充!");
        } catch (e: any) {
            handleError(`获取pRuntime信息失败: ${e.message}`);
        }
    }, [pruntimeUrl, log, handleError, showSuccessToast, selectedAccount]);

    const registerWorkerV2 = useCallback(() => {
        if (!api) return;
        try {
            const info = {
                version: Number(pruntimeInfoForRegister.version),
                machineId: pruntimeInfoForRegister.machineId,
                pubkey: pruntimeInfoForRegister.pubkey,
                ecdhPubkey: pruntimeInfoForRegister.ecdhPubkey,
                genesisBlockHash: pruntimeInfoForRegister.genesisBlockHash,
                features: pruntimeInfoForRegister.features.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
                paraId: Number(pruntimeInfoForRegister.paraId),
                maxConsensusVersion: Number(pruntimeInfoForRegister.maxConsensusVersion),
                operator: setOperatorForV2 && pruntimeInfoForRegister.operator ? pruntimeInfoForRegister.operator : null
            };
            const attestation = null;
            const extrinsic = api.tx.phalaRegistry.registerWorkerV2(info, attestation);
            sendTransaction(extrinsic, false, registerV2Sender);
        } catch (e: any) {
            handleError(`构建 Worker V2 注册交易失败: ${e.message}`);
        }
    }, [api, sendTransaction, pruntimeInfoForRegister, setOperatorForV2, registerV2Sender]);

    const createPool = useCallback(() => {
        if (!api || !createPoolSender) return handleError("请选择一个操作账户！");
        sendTransaction(api.tx.phalaStakePoolv2.create(), false, createPoolSender);
    }, [api, sendTransaction, createPoolSender]);

    const addWorkerToPool = useCallback(() => {
        if (!api || !addWorkerSender) return handleError("请选择一个交易发送账户！");
        sendTransaction(api.tx.phalaStakePoolv2.addWorker(pid, workerToAdd), false, addWorkerSender);
    }, [api, sendTransaction, pid, workerToAdd, addWorkerSender, handleError]);

    const createAsset = useCallback(() => {
        if (!api || !createAssetSender || !createAssetAdmin) return handleError("请选择交易发送账户和管理员账户。");
        const extrinsic = api.tx.assets.create(createAssetId, createAssetAdmin, createAssetMinBalance);
        sendTransaction(extrinsic, false, createAssetSender);
    }, [api, sendTransaction, createAssetId, createAssetAdmin, createAssetMinBalance, createAssetSender]);

    const mintAsset = useCallback(() => {
        if (!api || !mintAssetSender || !mintBeneficiary) return handleError("请选择交易发送账户和受益人账户。");
        const extrinsic = api.tx.assets.mint(mintAssetId, mintBeneficiary, mintAmount);
        sendTransaction(extrinsic, false, mintAssetSender);
    }, [api, sendTransaction, mintAssetId, mintBeneficiary, mintAmount, mintAssetSender]);

    const touchOther = useCallback(() => {
        if (!api || !contributeSender || !touchWho) return handleError("请选择操作账户和目标池账户。");
        sendTransaction(api.tx.assets.touchOther(mintAssetId, touchWho), false, contributeSender);
    }, [api, sendTransaction, mintAssetId, touchWho, contributeSender]);

    const touchOtherForLockAccount = useCallback(() => {
        if (!api || !touchLockAccountSender || !touchLockAccountAddress) return handleError("请选择发送账户和目标锁仓账户！");
        const extrinsic = api.tx.assets.touchOther(mintAssetId, touchLockAccountAddress);
        sendTransaction(extrinsic, false, touchLockAccountSender);
    }, [api, sendTransaction, mintAssetId, touchLockAccountAddress, touchLockAccountSender]);

    const sendTransfer = useCallback(() => {
        if (!api || !transferSender || !transferRecipient || !transferAmount) return handleError("请填写完整的转账信息。");
        try {
            const decimals = 12;
            const amountStr = transferAmount.toString();
            const fractionalPart = amountStr.split('.')[1] || '';
            if (fractionalPart.length > decimals) return handleError("转账金额的小数位数不能超过12位。");
            const amountInBaseUnit = new BN(transferAmount * (10 ** decimals));
            const extrinsic = api.tx.balances.transferKeepAlive(transferRecipient, amountInBaseUnit.toString());
            sendTransaction(extrinsic, false, transferSender);
        } catch (e: any) {
            handleError(`创建转账交易失败: ${e.message}`);
        }
    }, [api, sendTransaction, transferSender, transferRecipient, transferAmount]);

    const contribute = useCallback(() => {
        if (!api || !contributeSender) return handleError("请选择操作账户。");
        const asVaultParam = useAsVault ? asVaultValue : null;
        if (useAsVault && (asVaultValue === '' || isNaN(parseInt(asVaultValue, 10)))) return handleError("设置了 asVault，但 Vault ID 无效。");
        const extrinsic = api.tx.phalaStakePoolv2.contribute(contribPid, contribAmount, asVaultParam);
        sendTransaction(extrinsic, false, contributeSender);
    }, [api, sendTransaction, contributeSender, useAsVault, asVaultValue, contribPid, contribAmount]);

    const startComputing = useCallback(() => {
        if (!api || !startComputingSender) return handleError("请选择操作账户。");
        const extrinsic = api.tx.phalaStakePoolv2.startComputing(startComputingPid, startWorker, startStake);
        sendTransaction(extrinsic, false, startComputingSender);
    }, [api, sendTransaction, startComputingSender, startComputingPid, startWorker, startStake]);

    const withdrawSessionReward = useCallback(() => {
        if (!api || !withdrawSender) return handleError("请选择一个交易发送账户！");
        const extrinsic = api.tx.phalaComputation.withdrawSessionReward(withdrawPoolId, withdrawWorkerPubkey);
        sendTransaction(extrinsic, false, withdrawSender);
    }, [api, sendTransaction, withdrawSender, withdrawPoolId, withdrawWorkerPubkey]);

    const loadDefaultTokenomic = useCallback(() => {
        const params = {
            phaRate: "18446744073709551616", rho: "18446756370313412349", budgetPerBlock: "1844674407370955161600", vMax: "553402322211286548480000",
            costK: "291740030655", costB: "621866907450610", slashRate: "61489146912365", treasuryRatio: "3689348814741910323", heartbeatWindow: 10,
            rigK: "5534023222112865485", rigB: "0", re: "23980767295822417101", k: "1844674407370955161600", kappa: "18446744073709551616"
        };
        setTokenomicJson(JSON.stringify(params, null, 2));
        log("已加载文档中的默认Tokenomic参数。")
    }, [log]);

    const updateTokenomic = useCallback(() => {
        if (!api) return;
        try {
            const params = JSON.parse(tokenomicJson);
            sendTransaction(api.tx.phalaComputation.updateTokenomic(params), true);
        } catch (e: any) {
            handleError(`解析Tokenomic参数失败: ${e.message}`);
        }
    }, [api, sendTransaction, tokenomicJson]);

    // --- Render ---
    return (
        <AuthGuard>
            <MainLayout>
                <Space direction="vertical" size="large" className={styles.incentiveRoot} style={{ display: 'flex' }}>
                    <Title level={2} style={{ fontSize: '18pt' }}>激励机制控制台</Title>

                    {view === 'dashboard' ? (
                        <>

                            <ConnectionCard
                                wsUrl={wsUrl} setWsUrl={setWsUrl}
                                isCryptoReady={isCryptoReady}
                                api={api} connecting={connecting} isTxInProgress={isTxInProgress}
                                connect={connect} disconnect={disconnect}
                                chainInfo={chainInfo} formatAddress={formatAddress}
                                setView={setView}
                            />

                            {api && (
                                <LiveData
                                    workers={workers} pools={pools} activeSessions={sessions}
                                    totalRewards={totalRewards} formatBalance={formatBalance}
                                    refreshAllData={refreshAllData} loading={loading} isTxInProgress={isTxInProgress}
                                />
                            )}

                            {api && (
                                <WorkerDashboard
                                    pruntimeUrl={pruntimeUrl} setPruntimeUrl={setPruntimeUrl}
                                    getPruntimeInfo={getPruntimeInfo}
                                    pruntimeInfoForRegister={pruntimeInfoForRegister}
                                    setPruntimeInfoForRegister={setPruntimeInfoForRegister}
                                    registerV2Sender={registerV2Sender} setRegisterV2Sender={setRegisterV2Sender}
                                    setOperatorForV2={setOperatorForV2} setSetOperatorForV2={setSetOperatorForV2}
                                    registerWorkerV2={registerWorkerV2}
                                    workers={workers}
                                    gatekeepers={gatekeepers}
                                    accounts={accounts}
                                    formatAddress={formatAddress}
                                    isTxInProgress={isTxInProgress}
                                />
                            )}

                            {api && (
                                <PoolDashboard
                                    pools={pools}
                                    pid={pid} setPid={setPid}
                                    workerToAdd={workerToAdd} setWorkerToAdd={setWorkerToAdd}
                                    addWorkerToPool={addWorkerToPool}
                                    accounts={accounts}
                                    addWorkerSender={addWorkerSender}
                                    setAddWorkerSender={setAddWorkerSender}
                                    selectedAccount={selectedAccount}
                                    isTxInProgress={isTxInProgress}
                                    formatAddress={formatAddress}
                                    formatBalance={formatBalance}
                                />
                            )}

                            {api && (
                                <AssetDashboard
                                    accounts={accounts} isTxInProgress={isTxInProgress} formatAddress={formatAddress}
                                    startComputingSender={startComputingSender}
                                    setStartComputingSender={setStartComputingSender}
                                    startComputingPid={startComputingPid} setStartComputingPid={setStartComputingPid}
                                    startWorker={startWorker} setStartWorker={setStartWorker}
                                    startStake={startStake} setStartStake={setStartStake}
                                    startComputing={startComputing}
                                />
                            )}

                            {api && (
                                <SessionManager
                                    sessions={sessions} sessionAccount={sessionAccount}
                                    setSessionAccount={setSessionAccount} querySessions={querySessions}
                                    isTxInProgress={isTxInProgress} withdrawSender={withdrawSender}
                                    setWithdrawSender={setWithdrawSender} withdrawPoolId={withdrawPoolId}
                                    setWithdrawPoolId={setWithdrawPoolId} withdrawWorkerPubkey={withdrawWorkerPubkey}
                                    setWithdrawWorkerPubkey={setWithdrawWorkerPubkey}
                                    withdrawSessionReward={withdrawSessionReward}
                                    accounts={accounts} formatAddress={formatAddress}
                                    formatLargeNumber={formatLargeNumber} formatTimestamp={formatTimestamp}
                                    formatBalance={formatBalance}
                                />
                            )}

                            {lastResult && <Console lastResult={lastResult} />}
                        </>
                    ) : (
                        // 当 view === 'system' 时，渲染系统操作页面
                        <SystemOperations
                            setView={setView}
                            lastResult={lastResult}
                            api={api} accounts={accounts} selectedAccount={selectedAccount}
                            isTxInProgress={isTxInProgress}
                            formatAddress={formatAddress} sendTransaction={sendTransaction} handleError={handleError}
                            log={log}
                            // Gatekeeper
                            gatekeeperPub={gatekeeperPub} setGatekeeperPub={setGatekeeperPub}
                            registerGatekeeper={registerGatekeeper}
                            // Force Register
                            forcePub={forcePub} setForcePub={setForcePub} forceEcdhPub={forceEcdhPub}
                            setForceEcdhPub={setForceEcdhPub}
                            forceOperator={forceOperator} setForceOperator={setForceOperator}
                            forceRegisterWorker={forceRegisterWorker}
                            // Create Pool
                            createPoolSender={createPoolSender} setCreatePoolSender={setCreatePoolSender}
                            createPool={createPool}
                            // Asset Management
                            createAssetSender={createAssetSender} setCreateAssetSender={setCreateAssetSender}
                            createAssetId={createAssetId}
                            setCreateAssetId={setCreateAssetId} createAssetMinBalance={createAssetMinBalance}
                            setCreateAssetMinBalance={setCreateAssetMinBalance} createAssetAdmin={createAssetAdmin}
                            setCreateAssetAdmin={setCreateAssetAdmin} createAsset={createAsset}
                            mintAssetSender={mintAssetSender}
                            setMintAssetSender={setMintAssetSender} mintAssetId={mintAssetId}
                            setMintAssetId={setMintAssetId}
                            mintAmount={mintAmount} setMintAmount={setMintAmount} mintBeneficiary={mintBeneficiary}
                            setMintBeneficiary={setMintBeneficiary} mintAsset={mintAsset}
                            contributeSender={contributeSender}
                            setContributeSender={setContributeSender} touchWho={touchWho} setTouchWho={setTouchWho}
                            touchOther={touchOther} contribPid={contribPid} setContribPid={setContribPid}
                            contribAmount={contribAmount} setContribAmount={setContribAmount} useAsVault={useAsVault}
                            setUseAsVault={setUseAsVault} asVaultValue={asVaultValue} setAsVaultValue={setAsVaultValue}
                            contribute={contribute} touchLockAccountSender={touchLockAccountSender}
                            setTouchLockAccountSender={setTouchLockAccountSender}
                            touchLockAccountAddress={touchLockAccountAddress}
                            setTouchLockAccountAddress={setTouchLockAccountAddress}
                            touchOtherForLockAccount={touchOtherForLockAccount}
                            transferSender={transferSender} setTransferSender={setTransferSender}
                            transferRecipient={transferRecipient} setTransferRecipient={setTransferRecipient}
                            transferAmount={transferAmount} setTransferAmount={setTransferAmount}
                            sendTransfer={sendTransfer}
                            // Tokenomic
                            tokenomicJson={tokenomicJson} setTokenomicJson={setTokenomicJson}
                            loadDefaultTokenomic={loadDefaultTokenomic} updateTokenomic={updateTokenomic}
                        />
                    )}

                    <Modal isVisible={isErrorModalVisible} onClose={() => setIsErrorModalVisible(false)}
                        title="操作失败">
                        <p>{errorMessage}</p>
                    </Modal>
                    {/*<AntdModal open={isErrorModalVisible} onCancel={() => setIsErrorModalVisible(false)}
                                title="操作失败" footer={null}>
                        <p>{errorMessage}</p>
                    </AntdModal>*/}

                    <Toast toasts={toasts} />
                </Space>
            </MainLayout>
        </AuthGuard>
    );
};

export default IncentiveFlow;