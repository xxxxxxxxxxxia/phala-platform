// 简化版Gatekeeper调试脚本（不依赖前端API）
const { ApiPromise, WsProvider } = require('@polkadot/api');

const WS_ENDPOINT = 'ws://8.147.107.221:19944';
const WORKER_PUBKEY = '0xe82c4390c38aebdf3d9a0312279133203a98e660bac212905cc343c464b83744';

async function debugGatekeeper() {
  const provider = new WsProvider(WS_ENDPOINT);
  const api = await ApiPromise.create({ provider });
  
  try {
    console.log('🔍 Gatekeeper调试（仅链上数据）\n');
    console.log('=' .repeat(80));
    
    // 1. 检查Gatekeeper配置
    console.log('\n📊 1. Gatekeeper配置\n');
    const gatekeepers = await api.query.phalaRegistry.gatekeeper();
    console.log(`Gatekeeper数量: ${gatekeepers.length}`);
    gatekeepers.forEach((gk, idx) => {
      console.log(`  ${idx + 1}. ${gk.toString()}`);
    });
    
    const masterPubkey = await api.query.phalaRegistry.gatekeeperMasterPubkey();
    if (masterPubkey.isSome) {
      console.log(`\nMaster Public Key: ${masterPubkey.unwrap().toString()}`);
    }
    
    // 2. 检查Worker状态
    console.log('\n\n📊 2. Worker状态\n');
    const pubkey = WORKER_PUBKEY;
    const worker = await api.query.phalaRegistry.workers(pubkey);
    if (worker.isSome) {
      const workerInfo = worker.unwrap().toJSON();
      console.log(`Worker注册信息:`);
      console.log(`  • 最后更新时间: ${new Date(workerInfo.lastUpdated * 1000).toLocaleString('zh-CN')}`);
      console.log(`  • 认证提供商: ${workerInfo.attestationProvider || 'N/A'}`);
      console.log(`  • 信任等级: ${workerInfo.confidenceLevel || 'N/A'}`);
    }
    
    // 3. 检查Session状态
    console.log('\n\n📊 3. Session状态\n');
    const binding = await api.query.phalaComputation.workerBindings(pubkey);
    if (binding.isSome) {
      const sessionId = binding.unwrap();
      console.log(`Session ID: ${sessionId.toString()}`);
      
      const session = await api.query.phalaComputation.sessions(sessionId);
      if (session.isSome) {
        const sessionInfo = session.unwrap().toJSON();
        console.log(`Session状态: ${sessionInfo.state}`);
        
        if (sessionInfo.benchmark) {
          const challengeTime = sessionInfo.benchmark.challengeTimeLast * 1000;
          const now = Date.now();
          const diff = Math.floor((now - challengeTime) / 60000);
          console.log(`上次心跳挑战时间: ${new Date(challengeTime).toLocaleString('zh-CN')}`);
          console.log(`时间差: ${diff} 分钟`);
        }
        
        console.log(`\n完整Session信息:`);
        console.log(JSON.stringify(sessionInfo, null, 2));
      }
    } else {
      console.log(`❌ Worker没有Session绑定`);
    }
    
    // 4. 检查心跳窗口参数
    console.log('\n\n📊 4. 心跳窗口参数\n');
    try {
      const tokenomicParams = await api.query.phalaComputation.tokenomicParameters();
      if (tokenomicParams) {
        const params = tokenomicParams.toJSON();
        console.log(`心跳窗口: ${params.heartbeat_window || 'N/A'} 个区块`);
        console.log(`预期出块时间: ${params.expected_block_time_sec || 'N/A'} 秒`);
      }
    } catch (e) {
      console.log(`无法查询: ${e.message}`);
    }
    
    // 5. 检查最近的Session更新事件
    console.log('\n\n📊 5. 最近的Session更新事件\n');
    const header = await api.rpc.chain.getHeader();
    const currentBlock = header.number.toNumber();
    console.log(`当前区块: ${currentBlock}`);
    console.log(`检查最近20个区块...\n`);
    
    let foundEvent = false;
    for (let i = 0; i < 20; i++) {
      const blockNum = currentBlock - i;
      if (blockNum < 0) break;
      
      try {
        const blockHash = await api.rpc.chain.getBlockHash(blockNum);
        const events = await api.query.system.events.at(blockHash);
        
        events.forEach((record) => {
          const { event } = record;
          if (event.section === 'phalaComputation' && 
              (event.method === 'WorkerEnterUnresponsive' || 
               event.method === 'WorkerExitUnresponsive')) {
            foundEvent = true;
            console.log(`✅ 找到事件:`);
            console.log(`  • 区块: ${blockNum}`);
            console.log(`  • 事件: ${event.method}`);
            console.log(`  • 数据: ${JSON.stringify(event.data.toJSON())}`);
          }
        });
      } catch (e) {
        // 忽略错误
      }
    }
    
    if (!foundEvent) {
      console.log(`⚠️  最近20个区块中没有找到Session更新事件`);
    }
    
    // 6. 总结
    console.log('\n\n📊 6. 调试建议\n');
    console.log('=' .repeat(80));
    console.log('\n要查看pRuntime内部的Gatekeeper状态，需要:');
    console.log('1. 使用前端代理API（需要前端服务运行）');
    console.log('2. 或者直接查看pRuntime日志');
    console.log('3. 或者通过Polkadot网页界面查看链上状态');
    console.log('\nPolkadot网页界面访问:');
    console.log('  https://polkadot.js.org/apps/');
    console.log('  连接到: ws://8.147.107.221:19944');
    console.log('\n详细指南请查看: docs/polkadot-ui-debug-guide.md');
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
  } finally {
    await api.disconnect();
    console.log('\n✅ 已断开连接');
  }
}

debugGatekeeper().catch(console.error);
