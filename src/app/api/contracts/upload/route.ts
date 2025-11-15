import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { getNodeUrl, getPruntimeUrl } from '@/lib/config';

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

    // 检查脚本文件是否存在
    const scriptPath = `${setupPath}/deploy_single_contract.js`;
    if (existsSync(scriptPath)) {
      console.log('使用setup目录中的部署脚本（推荐）');
      const nodeUrl = getNodeUrl();
      const pruntimeUrl = getPruntimeUrl();
      const deployCommand = `cd "${setupPath}" && NODE_URL=${nodeUrl} PRUNTIME_URL=${pruntimeUrl} node deploy_single_contract.js "${tempPath}" "UploadedContract"`;
      console.log('执行命令:', deployCommand);

      const { stdout, stderr } = await execAsync(deployCommand, {
        timeout: 300000, // 5分钟超时
        cwd: setupPath,
        shell: '/bin/sh',
        env: {
          ...process.env,
          PATH: process.env.PATH,
          NODE_ENV: 'production'
        }
      });

      console.log('部署输出:', stdout);
      if (stderr) {
        console.error('部署错误:', stderr);
      }

      // 检查是否有错误输出
      if (stderr && stderr.includes('Error:')) {
        throw new Error(`脚本执行错误: ${stderr}`);
      }

      // 清理临时文件
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError);
      }

      // 解析输出获取合约地址
      const contractMatch = stdout.match(/合约地址: (0x[a-f0-9]+)/);
      const contractIdMatch = stdout.match(/合约ID: (0x[a-f0-9]+)/);
      const contractAddress = contractMatch ? contractMatch[1] : (contractIdMatch ? contractIdMatch[1] : 'unknown');

      return NextResponse.json({
        success: true,
        message: '合约部署成功',
        contractAddress,
        output: stdout,
        error: stderr
      });
    } else {
      // 如果setup目录中没有脚本，尝试使用public/scripts目录
      const publicScriptPath = './public/scripts/deploy_single_contract.js';
      if (existsSync(publicScriptPath)) {
        console.log('使用public/scripts目录中的部署脚本（备用方案）');
        const nodeUrl = getNodeUrl();
        const pruntimeUrl = getPruntimeUrl();
        const deployCommand = `NODE_URL=${nodeUrl} PRUNTIME_URL=${pruntimeUrl} node ${publicScriptPath} "${tempPath}" "UploadedContract"`;
        console.log('执行命令:', deployCommand);

        const { stdout, stderr } = await execAsync(deployCommand, {
          timeout: 300000, // 5分钟超时
          cwd: process.cwd(),
          shell: '/bin/sh',
          env: {
            ...process.env,
            PATH: process.env.PATH,
            NODE_ENV: 'production'
          }
        });

        console.log('部署输出:', stdout);
        if (stderr) {
          console.error('部署错误:', stderr);
        }

        // 检查是否有错误输出
        if (stderr && stderr.includes('Error:')) {
          throw new Error(`脚本执行错误: ${stderr}`);
        }

        // 清理临时文件
        try {
          fs.unlinkSync(tempPath);
        } catch (cleanupError) {
          console.warn('清理临时文件失败:', cleanupError);
        }

        // 解析输出获取合约地址
        const contractMatch = stdout.match(/合约地址: (0x[a-f0-9]+)/);
        const contractIdMatch = stdout.match(/合约ID: (0x[a-f0-9]+)/);
        const contractAddress = contractMatch ? contractMatch[1] : (contractIdMatch ? contractIdMatch[1] : 'unknown');

        return NextResponse.json({
          success: true,
          message: '合约部署成功',
          contractAddress,
          output: stdout,
          error: stderr
        });
      } else {
        throw new Error(`找不到deploy_single_contract.js脚本。检查的路径: ${scriptPath}, ${publicScriptPath}`);
      }
    }

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