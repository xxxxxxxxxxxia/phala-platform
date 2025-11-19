import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 开始部署系统合约...');

    // 检查路径是否存在，优先使用服务器上的目录
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

    console.log(`使用路径: ${setupPath}`);

    // 检查.env文件是否存在
    const envFilePath = `${setupPath}/.env`;
    if (!existsSync(envFilePath)) {
      throw new Error(`找不到.env文件。路径: ${envFilePath}`);
    }
    console.log(`使用.env文件: ${envFilePath}`);

    // 直接执行setup脚本，让脚本自动读取.env文件中的配置
    // setup-drivers.js脚本会通过dotenv自动加载.env文件中的ENDPOINT、WORKERS、GKS等变量
    const command = `cd "${setupPath}" && yarn setup:drivers`;

    console.log('执行命令:', command);
    console.log('脚本将自动从.env文件读取环境变量配置');

    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000, // 5分钟超时
      cwd: setupPath,
      shell: '/bin/sh', // 使用Alpine Linux默认shell
      env: {
        ...process.env,
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        // 确保使用IPv4而不是IPv6
        NODE_OPTIONS: '--dns-result-order=ipv4first'
        // 不再传入ENDPOINT、WORKERS、GKS，让脚本从.env文件读取
      }
    });

    console.log('部署输出:', stdout);
    if (stderr) {
      console.error('部署错误:', stderr);
    }

    // 解析输出获取系统合约地址
    const systemContractMatch = stdout.match(/系统合约地址: (0x[a-f0-9]+)/);
    const clusterIdMatch = stdout.match(/集群ID: (0x[a-f0-9]+)/);
    const systemContract = systemContractMatch ? systemContractMatch[1] : 'unknown';
    const clusterId = clusterIdMatch ? clusterIdMatch[1] : 'unknown';

    // 解析输出，提取关键信息
    const outputLines = stdout.split('\n');
    const keyInfo = outputLines.filter(line =>
      line.includes('✅') ||
      line.includes('❌') ||
      line.includes('合约') ||
      line.includes('部署') ||
      line.includes('成功') ||
      line.includes('失败') ||
      line.includes('Worker') ||
      line.includes('Gatekeeper') ||
      line.includes('Cluster') ||
      line.includes('Stake') ||
      line.includes('Driver')
    ).join('\n');

    return NextResponse.json({
      success: true,
      message: '系统合约部署完成',
      output: keyInfo || stdout,
      fullOutput: stdout,
      systemContract,
      clusterId,
      error: stderr
    });

  } catch (error) {
    console.error('部署失败:', error);

    // 提取错误信息
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const errorDetails = error instanceof Error ? error.stack : undefined;

    return NextResponse.json({
      success: false,
      error: `部署失败: ${errorMessage}`,
      message: '系统合约部署失败',
      details: errorDetails,
      output: `❌ 部署过程中发生错误:\n${errorMessage}`
    }, { status: 500 });
  }
}
