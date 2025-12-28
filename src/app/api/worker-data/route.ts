// src/app/api/worker-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPruntimeUrl } from '@/lib/config';
import { getApi } from '@/lib/polkadotApiManager';

// 配置
const PRUNTIME_ENDPOINT = getPruntimeUrl();

// 获取Pruntime信息
async function getPruntimeInfo() {
  try {
    const response = await fetch(`${PRUNTIME_ENDPOINT}/get_info`, {
      method: 'GET',
    });
    
    if (response.ok) {
      const result = await response.json();
      return JSON.parse(result.payload);
    }
    return null;
  } catch (error) {
    console.error('Failed to get pruntime info:', error);
    return null;
  }
}

// 获取账户余额
async function getAccountBalances() {
  try {
    const api = await getApi();
    const accounts = ['//Alice', '//Bob', '//Charlie', '//Dave', '//Ferdie'];
    const balances = {};
    
    for (const seed of accounts) {
      try {
        // 这里需要实际的账户地址，暂时使用模拟数据
        const mockBalance = Math.floor(Math.random() * 1000000) + 9000000;
        balances[seed] = mockBalance;
      } catch (error) {
        balances[seed] = 0;
      }
    }
    
    return balances;
  } catch (error) {
    console.error('Failed to get balances:', error);
    return {};
  }
}

// 获取区块链状态
async function getBlockchainStatus() {
  try {
    const api = await getApi();
    const header = await api.rpc.chain.getHeader();
    const blockNumber = header.number.toNumber();
    const blockHash = header.hash.toHex();
    
    return {
      blockNumber,
      blockHash,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Failed to get blockchain status:', error);
    return {
      blockNumber: 0,
      blockHash: '0x0',
      timestamp: Date.now()
    };
  }
}

// 获取Worker注册信息
async function getWorkerRegistration(workerPubkey: string) {
  try {
    const api = await getApi();
    
    if (api.query.phalaRegistry && api.query.phalaRegistry.workers) {
      const workerInfo = await api.query.phalaRegistry.workers(`0x${workerPubkey}`);
      
      if (workerInfo.isSome) {
        const worker = workerInfo.unwrap();
        return {
          registered: true,
          state: worker.state ? worker.state.toString() : 'Unknown',
          v: worker.v ? worker.v.toString() : 'Unknown',
          ve: worker.ve ? worker.ve.toString() : 'Unknown'
        };
      }
    }
    
    return {
      registered: false,
      state: 'Not Registered',
      v: 'N/A',
      ve: 'N/A'
    };
  } catch (error) {
    console.error('Failed to get worker registration:', error);
    return {
      registered: false,
      state: 'Error',
      v: 'Error',
      ve: 'Error'
    };
  }
}

// 获取代币经济参数
async function getTokenomicParameters() {
  try {
    const api = await getApi();
    
    if (api.query.phalaComputation && api.query.phalaComputation.tokenomicParameters) {
      const params = await api.query.phalaComputation.tokenomicParameters();
      
      if (params.isSome) {
        const tokenomic = params.unwrap();
        return {
          budgetPerBlock: tokenomic.budgetPerBlock.toString(),
          heartbeatWindow: tokenomic.heartbeatWindow.toString(),
          treasuryRatio: tokenomic.treasuryRatio.toString(),
          slashRate: tokenomic.slashRate.toString()
        };
      }
    }
    
    return {
      budgetPerBlock: '1844674407000000000000',
      heartbeatWindow: '10',
      treasuryRatio: '3689348814741910323',
      slashRate: '61489146912365'
    };
  } catch (error) {
    console.error('Failed to get tokenomic parameters:', error);
    return {
      budgetPerBlock: '0',
      heartbeatWindow: '0',
      treasuryRatio: '0',
      slashRate: '0'
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    // 根据类型返回不同的数据
    switch (type) {
      case 'pruntime':
        const pruntimeInfo = await getPruntimeInfo();
        return NextResponse.json({
          success: true,
          data: pruntimeInfo
        });

      case 'balances':
        const balances = await getAccountBalances();
        return NextResponse.json({
          success: true,
          data: balances
        });

      case 'blockchain':
        const blockchainStatus = await getBlockchainStatus();
        return NextResponse.json({
          success: true,
          data: blockchainStatus
        });

      case 'worker':
        const workerPubkey = searchParams.get('pubkey') || '3a3d45dc55b57bf542f4c6ff41af080ec675317f4ed50ae1d2713bf9f892692d';
        const workerData = await getWorkerRegistration(workerPubkey);
        return NextResponse.json({
          success: true,
          data: workerData
        });

      case 'tokenomics':
        const tokenomics = await getTokenomicParameters();
        return NextResponse.json({
          success: true,
          data: tokenomics
        });

      case 'all':
      default:
        // 获取所有数据
        const [pruntime, blockchain, worker, tokenomicParams, accountBalances] = await Promise.all([
          getPruntimeInfo(),
          getBlockchainStatus(),
          getWorkerRegistration('3a3d45dc55b57bf542f4c6ff41af080ec675317f4ed50ae1d2713bf9f892692d'),
          getTokenomicParameters(),
          getAccountBalances()
        ]);

        return NextResponse.json({
          success: true,
          data: {
            pruntime,
            blockchain,
            worker,
            tokenomics: tokenomicParams,
            balances: accountBalances,
            timestamp: Date.now()
          }
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}






























