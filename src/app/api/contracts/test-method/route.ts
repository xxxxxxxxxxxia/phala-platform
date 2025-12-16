import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getNodeUrl, getPruntimeUrl } from '@/lib/config';

const execAsync = promisify(exec);

// 验证合约地址格式（0x + 64位十六进制）
function validateContractAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  // 必须是 0x 开头，后面跟 64 位十六进制字符
  const hexPattern = /^0x[a-fA-F0-9]{64}$/;
  return hexPattern.test(address);
}

// 转义 shell 参数中的特殊字符
function escapeShellArg(arg: string): string {
  // 移除所有单引号并用转义的单引号替换
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

export async function POST(request: NextRequest) {
  try {
    const { contractAddress } = await request.json();

    if (!contractAddress) {
      return NextResponse.json({
        success: false,
        error: '缺少合约地址'
      }, { status: 400 });
    }

    // 【安全修复】验证合约地址格式，防止命令注入
    if (!validateContractAddress(contractAddress)) {
      return NextResponse.json({
        success: false,
        error: '无效的合约地址格式。合约地址必须是 0x 开头的 64 位十六进制字符串'
      }, { status: 400 });
    }

    console.log(`测试合约方法支持: ${contractAddress}`);

    // 使用脚本测试合约是否支持version方法
    const nodeUrl = getNodeUrl();
    const pruntimeUrl = getPruntimeUrl();
    const setupPath = '/app/phala-blockchain-setup';
    
    // 【安全修复】使用环境变量传递参数，避免命令注入
    // 转义所有参数，确保安全
    const escapedNodeUrl = escapeShellArg(nodeUrl);
    const escapedPruntimeUrl = escapeShellArg(pruntimeUrl);
    const escapedContractAddress = escapeShellArg(contractAddress);
    const escapedSetupPath = escapeShellArg(setupPath);
    
    const testCommand = `cd ${escapedSetupPath} && NODE_URL=${escapedNodeUrl} PRUNTIME_URL=${escapedPruntimeUrl} CONTRACT_ID=${escapedContractAddress} node -e "
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { options, OnChainRegistry, signCertificate, PinkContractPromise } = require('@phala/sdk');
const fs = require('fs');

const NODE_URL = process.env.NODE_URL;
const PRUNTIME_URL = process.env.PRUNTIME_URL;
const CONTRACT_ID = process.env.CONTRACT_ID;

async function testContractMethod() {
  let api;
  try {
    api = await ApiPromise.create(options({
      provider: new WsProvider(NODE_URL),
      noInitWarn: true,
    }));
    await api.isReady;
    
    const phatRegistry = await OnChainRegistry.create(api);
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    const certAlice = await signCertificate({ pair: alice });
    
    const contractPath = './res/tokenomic.contract';
    const metadata = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const contract = new PinkContractPromise(api, phatRegistry, metadata, CONTRACT_ID);
    
    // 尝试调用version方法
    try {
      const { output } = await contract.query.version(alice.address, { cert: certAlice });
      const result = output.asOk.toPrimitive();
      console.log('TEST_RESULT: SUCCESS');
    } catch (error) {
      console.log('TEST_RESULT: FAILED');
    }
  } catch (error) {
    console.log('TEST_RESULT: ERROR');
  } finally {
    if (api && api.isConnected) {
      await api.disconnect();
    }
  }
}

testContractMethod();
"`;

    const { stdout, stderr } = await execAsync(testCommand, {
      timeout: 10000, // 10秒超时
      cwd: setupPath,
      env: {
        ...process.env,
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        // 【安全修复】通过环境变量传递参数，而不是字符串拼接
        NODE_URL: nodeUrl,
        PRUNTIME_URL: pruntimeUrl,
        CONTRACT_ID: contractAddress
      }
    });

    console.log('测试输出:', stdout);
    if (stderr) {
      console.error('测试错误:', stderr);
    }

    // 解析测试结果
    const isSupported = stdout.includes('TEST_RESULT: SUCCESS');

    return NextResponse.json({
      success: true,
      data: {
        contractAddress,
        supportsVersion: isSupported,
        testOutput: stdout
      }
    });

  } catch (error) {
    console.error('合约方法测试失败:', error);
    return NextResponse.json({
      success: false,
      error: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
