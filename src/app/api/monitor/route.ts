// src/app/api/monitor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPruntimeUrl } from '@/lib/config';

// 配置
const PRUNTIME_ENDPOINT = getPruntimeUrl();

// 存储历史数据
let rewardHistory: Array<{
  timestamp: number;
  blockNumber: number;
  rewards: Record<string, number>;
}> = [];

const initialBalances: Record<string, number> = {};

// 获取Pruntime状态
async function getPruntimeStatus() {
  try {
    const response = await fetch(`${PRUNTIME_ENDPOINT}/get_info`, {
      method: 'GET',
    });

    if (response.ok) {
      const result = await response.json();
      const data = JSON.parse(result.payload);
      return {
        connected: true,
        initialized: data.initialized || false,
        registered: data.registered || false,
        version: data.version || 'Unknown',
        blocknum: data.blocknum || 0,
        score: data.score || 0,
        devMode: data.dev_mode || false,
        publicKey: data.public_key || '',
        genesisBlockHash: data.genesis_block_hash || ''
      };
    } else {
      return { connected: false };
    }
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

// 模拟获取账户余额变化
function getBalanceChanges() {
  const accounts = ['//Alice', '//Bob', '//Charlie', '//Dave', '//Ferdie'];
  const currentBalances = {};

  // 如果没有初始余额，设置初始值
  if (Object.keys(initialBalances).length === 0) {
    accounts.forEach(account => {
      initialBalances[account] = account === '//Alice' ? 9989999 : 10000000;
    });
  }

  // 模拟余额变化（Alice可能获得奖励）
  accounts.forEach(account => {
    if (account === '//Alice') {
      // Alice有机会获得奖励
      const rewardChance = Math.random();
      if (rewardChance > 0.7) { // 30%概率获得奖励
        const reward = Math.random() * 10 + 1; // 1-11 PHA奖励
        currentBalances[account] = initialBalances[account] + reward;
        initialBalances[account] = currentBalances[account]; // 更新基准
      } else {
        currentBalances[account] = initialBalances[account];
      }
    } else {
      // 其他账户余额基本不变，偶尔有小变动
      const change = (Math.random() - 0.5) * 2; // -1 到 1 的变化
      currentBalances[account] = initialBalances[account] + change;
    }
  });

  return currentBalances;
}

// 获取网络活动状态
function getNetworkActivity() {
  const currentTime = Date.now();
  const blockNumber = Math.floor(currentTime / 3000) + 400; // 模拟每3秒一个块

  return {
    blockNumber,
    blockTime: 3,
    isActive: true,
    lastBlockTime: currentTime
  };
}

// 获取挖矿状态
async function getMiningStatus() {
  const pruntimeStatus = await getPruntimeStatus();

  return {
    isOnline: pruntimeStatus.connected && pruntimeStatus.initialized,
    isRegistered: pruntimeStatus.registered,
    isMining: pruntimeStatus.connected && pruntimeStatus.initialized && pruntimeStatus.registered,
    workerState: pruntimeStatus.connected ? 'Ready' : 'Offline',
    score: pruntimeStatus.score || 0
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'status';

    switch (type) {
      case 'pruntime':
        const pruntimeStatus = await getPruntimeStatus();
        return NextResponse.json({
          success: true,
          data: pruntimeStatus
        });

      case 'balances':
        const balances = getBalanceChanges();
        return NextResponse.json({
          success: true,
          data: balances
        });

      case 'network':
        const networkActivity = getNetworkActivity();
        return NextResponse.json({
          success: true,
          data: networkActivity
        });

      case 'mining':
        const miningStatus = await getMiningStatus();
        return NextResponse.json({
          success: true,
          data: miningStatus
        });

      case 'status':
      default:
        // 获取完整的监控状态
        const [pruntime, network, mining] = await Promise.all([
          getPruntimeStatus(),
          Promise.resolve(getNetworkActivity()),
          getMiningStatus()
        ]);

        const currentBalances = getBalanceChanges();

        // 记录历史数据
        const historyEntry = {
          timestamp: Date.now(),
          blockNumber: network.blockNumber,
          rewards: currentBalances
        };

        rewardHistory.push(historyEntry);

        // 只保留最近50条记录
        if (rewardHistory.length > 50) {
          rewardHistory = rewardHistory.slice(-50);
        }

        return NextResponse.json({
          success: true,
          data: {
            pruntime,
            network,
            mining,
            balances: currentBalances,
            history: rewardHistory.slice(-10), // 返回最近10条历史记录
            timestamp: Date.now(),
            uptime: Date.now() - (Date.now() - 3600000) // 假设运行了1小时
          }
        });
    }
  } catch (error) {
    console.error('Monitor API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}


