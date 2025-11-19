import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let tempPath: string | undefined;

  try {
    const formData = await request.formData();
    const contractFile = formData.get('contractFile') as File;
    const description = formData.get('description') as string;

    if (!contractFile) {
      return NextResponse.json({
        success: false,
        error: '没有上传文件'
      }, { status: 400 });
    }

    console.log(`开始上传合约: ${contractFile.name}`);
    console.log(`合约描述: ${description || '无'}`);

    // 保存文件到临时位置
    const fs = await import('fs');
    const path = await import('path');

    // 清理文件名，移除特殊字符
    const cleanFileName = contractFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    tempPath = path.default.join('/tmp', `upload_${Date.now()}_${cleanFileName}`);

    const arrayBuffer = await contractFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.default.writeFileSync(tempPath, buffer);

    console.log(`文件已保存到: ${tempPath}`);

    // 检查路径是否存在，提供多个可能的路径
    const possiblePaths = [
      '/app/phala-blockchain-setup',
      '/root/tmp/phala-blockchain-setup',
      '/home/user1/Desktop/tmp/phala-blockchain-setup',
      './phala-blockchain-setup',
      '../phala-blockchain-setup'
    ];

    let setupPath = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        setupPath = path;
        break;
      }
    }

    if (!setupPath) {
      throw new Error(`找不到phala-blockchain-setup目录。检查的路径: ${possiblePaths.join(', ')}`);
    }

    console.log(`使用路径: ${setupPath}`);

    // 检查.env文件是否存在并读取环境变量
    const envFilePath = `${setupPath}/.env`;
    let endpoint = '';
    let worker = '';

    if (existsSync(envFilePath)) {
      console.log(`读取.env文件: ${envFilePath}`);
      const envContent = readFileSync(envFilePath, 'utf-8');
      const envLines = envContent.split('\n');
      for (const line of envLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim();
          if (key === 'ENDPOINT') {
            endpoint = value;
          } else if (key === 'WORKERS') {
            // WORKERS可能是逗号分隔的多个值，取第一个
            worker = value.split(',')[0].trim();
          }
        }
      }
      console.log(`从.env读取: ENDPOINT=${endpoint}, WORKER=${worker}`);
    } else {
      console.warn(`未找到.env文件: ${envFilePath}，将使用脚本默认值`);
    }

    // 检查deploy-phat-hello-add.js脚本是否存在（专门用于部署phat_hello_add合约）
    const scriptPath = `${setupPath}/src/deploy-phat-hello-add.js`;
    if (!existsSync(scriptPath)) {
      throw new Error(`找不到deploy-phat-hello-add.js脚本。路径: ${scriptPath}`);
    }
    console.log('使用deploy-phat-hello-add.js脚本部署phat_hello_add合约');

    // 使用deploy-phat-hello-add.js脚本部署合约
    // 脚本会优先使用CONTRACT_PATH环境变量，如果没有则使用默认的phat_hello_add.contract
    // CONTRACT_PATH指定上传的合约文件路径
    const deployCommand = `cd "${setupPath}" && node src/deploy-phat-hello-add.js`;
    console.log('执行命令:', deployCommand);
    console.log('合约文件路径:', tempPath);

    // 构建环境变量对象
    const env = {
      ...process.env,
      PATH: process.env.PATH || '',
      NODE_ENV: process.env.NODE_ENV || 'production',
      CONTRACT_PATH: tempPath,
      NODE_OPTIONS: '--dns-result-order=ipv4first',
      ...(endpoint && { ENDPOINT: endpoint }),
      ...(worker && { WORKER: worker })
    };

    console.log('环境变量:', {
      ENDPOINT: env.ENDPOINT || '使用脚本默认值',
      WORKER: env.WORKER || '使用脚本默认值',
      CONTRACT_PATH: env.CONTRACT_PATH
    });

    const { stdout, stderr } = await execAsync(deployCommand, {
      timeout: 600000, // 10分钟超时（部署合约可能需要较长时间）
      cwd: setupPath,
      shell: '/bin/sh',
      env
    });

    console.log('部署输出:', stdout);
    if (stderr) {
      console.error('部署错误:', stderr);
    }

    // 检查是否有错误输出
    if (stderr && stderr.includes('Error:') && !stderr.includes('✅')) {
      throw new Error(`脚本执行错误: ${stderr}`);
    }

    // 清理临时文件
    try {
      fs.unlinkSync(tempPath);
    } catch (cleanupError) {
      console.warn('清理临时文件失败:', cleanupError);
    }

    // 解析输出获取合约地址
    // deploy-phat-hello-add.js输出格式: 
    // "📍 合约地址: 0x..." 或 "🆔 合约ID: 0x..." 或 "✅ 合约 phat_hello_add 已部署到地址: 0x..."
    const fullOutput = stdout + (stderr || '');

    // 排除的地址（集群ID和系统合约地址）
    const excludedAddresses = [
      '0x0000000000000000000000000000000000000000000000000000000000000001', // 默认集群ID
    ];

    // 尝试多种匹配模式，按优先级排序（最精确的在前）
    const patterns = [
      /📍\s*合约地址:\s*(0x[a-f0-9]{64})/i,  // 匹配"📍 合约地址:"后面的64位地址
      /🆔\s*合约ID:\s*(0x[a-f0-9]{64})/i,  // 匹配"🆔 合约ID:"后面的64位地址
      /合约地址:\s*(0x[a-f0-9]{64})/i,  // 匹配"合约地址:"后面的64位地址
      /已部署到地址:\s*(0x[a-f0-9]{64})/i,  // 匹配"已部署到地址:"后面的64位地址
      /✅\s*合约\s+[\w_]+\s+已部署到地址:\s*(0x[a-f0-9]{64})/i,  // 匹配完整的成功消息
    ];

    let contractAddress: string | null = null;
    for (const pattern of patterns) {
      const matches = fullOutput.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
      for (const match of matches) {
        if (match && match[1]) {
          const address = match[1];
          // 排除已知的系统地址，确保是64位十六进制地址
          if (!excludedAddresses.includes(address) && address.length === 66 && /^0x[a-f0-9]{64}$/i.test(address)) {
            contractAddress = address;
            console.log(`从输出中解析到合约地址: ${contractAddress}`);
            break;
          }
        }
      }
      if (contractAddress) break;
    }

    // 如果上面的模式都没匹配到，尝试从包含"合约地址"或"合约ID"的行中提取
    if (!contractAddress) {
      const lines = fullOutput.split('\n');
      for (const line of lines) {
        // 查找包含"合约地址"或"合约ID"的行
        if (line.includes('合约地址') || line.includes('合约ID') || line.includes('已部署到地址')) {
          const addressMatch = line.match(/(0x[a-f0-9]{64})/i);
          if (addressMatch && addressMatch[1]) {
            const address = addressMatch[1];
            // 排除已知的系统地址
            if (!excludedAddresses.includes(address)) {
              contractAddress = address;
              console.log(`从行中解析到合约地址: ${contractAddress}`);
              break;
            }
          }
        }
      }
    }

    if (!contractAddress) {
      console.warn('未能从输出中解析合约地址');
      console.warn('stdout内容:', stdout);
      console.warn('stderr内容:', stderr);
      // 如果部署成功但没有解析到地址，仍然返回成功，但提示用户查看输出
      if (stdout.includes('部署成功') || stdout.includes('✅') || stdout.includes('成功')) {
        return NextResponse.json({
          success: true,
          message: '合约部署成功，但无法解析合约地址，请查看输出',
          data: {
            address: 'unknown',
            contractId: 'unknown'
          },
          contractAddress: 'unknown',
          output: stdout,
          error: stderr,
          warning: '无法从输出中解析合约地址，请手动查看输出内容'
        });
      }
      throw new Error('部署失败或无法解析合约地址，请检查脚本输出');
    }

    return NextResponse.json({
      success: true,
      message: '合约部署成功',
      data: {
        address: contractAddress,
        contractId: contractAddress
      },
      contractAddress,
      output: stdout,
      error: stderr
    });

  } catch (error) {
    console.error('上传失败:', error);

    // 清理临时文件
    try {
      const fs = await import('fs');
      if (typeof tempPath !== 'undefined' && tempPath && fs.default.existsSync(tempPath)) {
        fs.default.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      console.warn('清理临时文件失败:', cleanupError);
    }

    // 提供更详细的错误信息
    let errorMessage = '未知错误';
    if (error instanceof Error) {
      errorMessage = error.message;
      // 如果是命令执行错误，尝试提取更具体的信息
      if (error.message.includes('Command failed')) {
        errorMessage = '脚本执行失败，请检查区块链节点是否运行';
      }
    }

    return NextResponse.json({
      success: false,
      error: `上传失败: ${errorMessage}`,
      message: '合约上传失败',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}