import { NextRequest, NextResponse } from 'next/server';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { options } from '@phala/sdk';
import { getNodeUrl } from '@/lib/config';

// 连接本地区块链节点
const getApi = async () => {
  const api = await ApiPromise.create(options({
    provider: new WsProvider(getNodeUrl()),
    noInitWarn: true,
  }));
  return api;
};

// 获取真实Worker数据
export async function GET(request: NextRequest) {
  try {
    const api = await getApi();

    console.log('🔗 连接本地区块链节点...');

    // 获取链基本信息
    const chain = await api.rpc.system.chain();
    const version = await api.rpc.system.version();
    const health = await api.rpc.system.health();
    const header = await api.rpc.chain.getHeader();

    console.log('📊 链状态:', {
      chain: chain.toString(),
      version: version.toString(),
      health: health.toHuman(),
      blockNumber: header.number.toNumber()
    });

    // 获取真实Worker数据
    console.log('👷 查询Worker数据...');
    const workers = await api.query.phalaRegistry.workers.entries();
    console.log(`找到 ${workers.length} 个Worker`);

    const workerData = workers.map(([key, value], index) => {
      const workerInfo = value.toHuman() as any;
      return {
        id: index + 1,
        publicKey: key.toHex(),
        status: workerInfo.status || 'Unknown',
        initialScore: workerInfo.initialScore || 0,
        confidenceLevel: workerInfo.confidenceLevel || 1,
        registeredAt: workerInfo.registeredAt || Date.now(),
        lastHeartbeat: workerInfo.lastHeartbeat || Date.now(),
        stake: workerInfo.stake || '0',
        v: workerInfo.v || '0',
        ve: workerInfo.ve || '0'
      };
    });

    // 获取真实计算会话数据
    console.log('💻 查询计算会话...');
    const sessions = await api.query.phalaComputation.sessions.entries();
    console.log(`找到 ${sessions.length} 个计算会话`);

    const sessionData = sessions.map(([key, value], index) => {
      const sessionInfo = value.toHuman() as any;
      return {
        id: index + 1,
        account: key.toHuman(),
        state: sessionInfo.state || 'Unknown',
        ve: sessionInfo.ve || '0',
        v: sessionInfo.v || '0',
        vUpdatedAt: sessionInfo.vUpdatedAt || 0,
        stake: sessionInfo.stake || '0',
        totalReward: sessionInfo.stats?.totalReward || '0'
      };
    });

    // 获取真实质押数据
    console.log('💰 查询质押数据...');
    const stakes = await api.query.phalaComputation.stakes.entries();
    console.log(`找到 ${stakes.length} 个质押记录`);

    const stakeData = stakes.map(([key, value], index) => {
      return {
        id: index + 1,
        account: key.toHuman(),
        amount: value.toHuman()
      };
    });

    // 获取真实Tokenomic参数
    console.log('⚙️ 查询Tokenomic参数...');
    const tokenomicParams = await api.query.phalaComputation.tokenomicParameters();
    const tokenomicData = tokenomicParams.toHuman() as any;

    // 获取真实在线Worker数量
    const onlineWorkers = await api.query.phalaComputation.onlineWorkers();

    // 获取真实预算数据（如果存在的话）
    let budget = null;
    try {
      budget = await api.query.phalaComputation.budgetPerBlock();
    } catch (e) {
      console.log('预算数据查询不可用，使用默认值');
      budget = { toHuman: () => '0' };
    }

    const realData = {
      chain: {
        name: chain.toString(),
        version: version.toString(),
        health: health.toHuman(),
        blockNumber: header.number.toNumber(),
        blockHash: header.hash.toHex()
      },
      workers: {
        total: workers.length,
        online: onlineWorkers.toNumber(),
        data: workerData
      },
      sessions: {
        total: sessions.length,
        data: sessionData
      },
      stakes: {
        total: stakes.length,
        data: stakeData
      },
      tokenomic: {
        parameters: tokenomicData,
        budgetPerBlock: budget.toHuman()
      },
      timestamp: Date.now()
    };

    console.log('✅ 真实数据获取完成');

    await api.disconnect();

    return NextResponse.json({
      success: true,
      data: realData,
      message: '成功获取真实区块链数据'
    });

  } catch (error) {
    console.error('❌ 获取真实数据失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '获取真实数据失败，请检查节点连接'
    }, { status: 500 });
  }
}

