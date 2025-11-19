import { NextRequest, NextResponse } from 'next/server';
import { getApi, getWorkersInfo } from '@/lib/phalaApi';

type IncentiveAccount = {
    address: string;
    state: string;
    totalRewardRaw: string;
    totalReward: number;
    totalRewardFormatted: string;
    balanceRaw: string;
    balance: number;
    balanceFormatted: string;
    ve: number;
    v: number;
    benchmarkScore: number;
    pendingMessages?: number;
    lastUpdated?: number;
};

const PHA_DECIMALS = 12;
const PHA_FACTOR = 10 ** PHA_DECIMALS;

const toNumeric = (value: unknown): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
        if (!value.trim()) return 0;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value && typeof (value as { toString: () => string }).toString === 'function') {
        const parsed = Number((value as { toString: () => string }).toString());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const formatAmount = (value: number, fractionDigits = 4): string => {
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: fractionDigits,
    });
};

export async function fetchSessionAccounts(): Promise<{ accounts: IncentiveAccount[]; totalRewardSum: number }> {
    try {
        const api = await getApi();
        const entries = await api.query.phalaComputation.sessions.entries();
        const normalized = entries
            .map(([key, opt]) => {
                if (!opt || !(opt as any).isSome) {
                    return null;
                }
                const accountId = key.args[0]?.toString();
                const info = (opt as any).unwrap().toJSON();
                if (!accountId || !info) {
                    return null;
                }
                return { accountId, info };
            })
            .filter(Boolean) as Array<{ accountId: string; info: any }>;

        if (normalized.length === 0) {
            return { accounts: [], totalRewardSum: 0 };
        }

        const accountIds = normalized.map((item) => item.accountId);
        const balances = await api.query.system.account.multi(accountIds);

        let totalRewardSum = 0;
        const accounts: IncentiveAccount[] = normalized.map((item, index) => {
            const stats = item.info?.stats || {};
            const benchmark = item.info?.benchmark || {};
            const totalRewardRaw = toNumeric(stats?.totalReward ?? 0);
            totalRewardSum += totalRewardRaw;
            const totalReward = totalRewardRaw / PHA_FACTOR;

            const balanceCodec = balances[index] as any;
            const freeBalance = toNumeric(balanceCodec?.data?.free ?? 0);
            const balance = freeBalance / PHA_FACTOR;

            return {
                address: item.accountId,
                state: item.info?.state || 'Unknown',
                totalRewardRaw: totalRewardRaw.toString(),
                totalReward,
                totalRewardFormatted: formatAmount(totalReward),
                balanceRaw: freeBalance.toString(),
                balance,
                balanceFormatted: formatAmount(balance),
                ve: typeof item.info?.ve === 'number' ? item.info.ve : Number(item.info?.ve || 0),
                v: typeof item.info?.v === 'number' ? item.info.v : Number(item.info?.v || 0),
                benchmarkScore: typeof benchmark?.pInstant === 'number'
                    ? benchmark.pInstant
                    : Number(benchmark?.p_init || benchmark?.pInit || 0),
                pendingMessages: benchmark?.pendingMessages || 0,
                lastUpdated: benchmark?.workingStartTime || undefined,
            };
        });

        accounts.sort((a, b) => Number(b.totalRewardRaw) - Number(a.totalRewardRaw));

        return { accounts, totalRewardSum };
    } catch (error) {
        console.error('[Incentives] Failed to load session accounts:', error);
        return { accounts: [], totalRewardSum: 0 };
    }
}

// 获取激励数据汇总
export async function GET(request: NextRequest) {
    try {
        const origin = request.nextUrl.origin;
        const incentivePromise = fetch(`${origin}/api/incentives?action=status`);
        const accountsPromise = fetchSessionAccounts();
        const workersPromise = getWorkersInfo().catch(() => []);

        const [incentiveResponse, accountSummary, workers] = await Promise.all([
            incentivePromise,
            accountsPromise,
            workersPromise,
        ]);

        if (!incentiveResponse.ok) {
            throw new Error(`激励数据接口响应异常: ${incentiveResponse.status}`);
        }
        const incentiveData = await incentiveResponse.json();

        const rewardDistribution = (incentiveData.rewardDistribution || []).map((item: any) => ({
            ...item,
            percentage: accountSummary.totalRewardSum > 0
                ? Math.round(((Number(item.amount || 0) || 0) / (accountSummary.totalRewardSum / PHA_FACTOR || 1)) * 100)
                : 0,
        }));

        const recentRewards = (incentiveData.rewards || [])
            .sort((a: any, b: any) => b.timestamp - a.timestamp)
            .slice(0, 10)
            .map((reward: any) => ({
                id: reward.id,
                workerId: reward.workerId,
                amount: reward.amount,
                timestamp: reward.timestamp,
                blockNumber: reward.blockNumber,
            }));

        const workerScores = Array.isArray(workers)
            ? workers
                .map((worker) => worker?.initialScore || 0)
                .filter((score) => typeof score === 'number')
            : [];
        const averageScore = workerScores.length
            ? Number((workerScores.reduce((sum, score) => sum + score, 0) / workerScores.length).toFixed(1))
            : (incentiveData.averageScore || 0);

        const totalRewardNumber = accountSummary.totalRewardSum / PHA_FACTOR;

        return NextResponse.json({
            success: true,
            data: {
                totalRewards: incentiveData.totalRewards || accountSummary.accounts.length,
                totalAmount: totalRewardNumber,
                averageScore,
                rewardDistribution,
                recentRewards,
                accounts: accountSummary.accounts,
                accountSummary: {
                    totalAccounts: accountSummary.accounts.length,
                    totalRewardRaw: accountSummary.totalRewardSum.toString(),
                    totalRewardFormatted: formatAmount(totalRewardNumber, 6),
                },
            },
        });
    } catch (error) {
        console.error('Incentives summary API error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}

