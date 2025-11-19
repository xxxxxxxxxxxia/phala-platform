import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const composeFile = formData.get('composeFile') as Blob | null;

    if (!composeFile) {
      return NextResponse.json(
        { message: '未找到上传的文件' },
        { status: 400 }
      );
    }

    // 将上传的文件保存到临时目录
    // 尝试多个可能的临时目录位置
    const possibleTempDirs = [
      join(process.cwd(), 'temp'),
      '/tmp/phala-platform',
      '/app/temp',
      join(__dirname, '..', '..', '..', 'temp')
    ];
    
    let tempDir = null;
    for (const dir of possibleTempDirs) {
      try {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        // 测试写入权限
        const testFile = join(dir, 'test-write.tmp');
        writeFileSync(testFile, 'test');
        require('fs').unlinkSync(testFile);
        tempDir = dir;
        break;
      } catch (error) {
        console.log(`无法使用目录 ${dir}:`, error.message);
        continue;
      }
    }
    
    if (!tempDir) {
      throw new Error('无法找到可写的临时目录');
    }
    
    const tempFilePath = join(tempDir, 'docker-compose.yml');
    const arrayBuffer = await composeFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(tempFilePath, buffer);

    // 检查docker-compose.yml是否需要构建文件
    const composeContent = buffer.toString();
    const needsBuild = composeContent.includes('build:') && !composeContent.includes('#build:');
    
    if (needsBuild) {
      // 复制必要的文件到temp目录（仅在需要构建时）
      const { copyFileSync } = require('fs');
      const dockerfilePath = join(process.cwd(), 'Dockerfile');
      const nginxConfPath = join(process.cwd(), 'nginx.conf');
      
      if (existsSync(dockerfilePath)) {
        copyFileSync(dockerfilePath, join(tempDir, 'Dockerfile'));
      }
      if (existsSync(nginxConfPath)) {
        copyFileSync(nginxConfPath, join(tempDir, 'nginx.conf'));
      }
    }

    // 执行docker-compose部署 - 尝试多个可能的命令
    const possibleCommands = [
      `/usr/local/bin/docker-compose-v2 up -d --build`,
      `docker-compose up -d --build`,
      `docker compose up -d --build`
    ];
    
    let command = '';
    let success = false;
    let output = '';
    let error = '';
    
    for (const cmd of possibleCommands) {
      try {
        command = `cd ${tempDir} && ${cmd}`;
        console.log('尝试执行命令:', command);
        
        const { stdout, stderr } = await execAsync(command, {
          timeout: 300000, // 5分钟超时
        });
        
        console.log('命令执行成功:', stdout);
        if (stderr) {
          console.log('命令警告:', stderr);
        }
        
        output = stdout || stderr || '部署成功';
        success = true;
        break;
      } catch (err: any) {
        console.log(`命令 ${cmd} 失败:`, err.message);
        error = err.message;
        continue;
      }
    }
    
    if (!success) {
      throw new Error(`所有docker-compose命令都失败了。最后错误: ${error}`);
    }

    // 检查是否真的成功（容器启动成功）
    const isSuccess = output.includes('Started') || output.includes('Up') || 
                     output.includes('Running') || output.includes('Created');

    console.log('成功检测:', { isSuccess, output });

    return NextResponse.json({
      message: isSuccess ? '部署完成' : '部署失败',
      output: isSuccess ? output : null,
      error: isSuccess ? null : output
    });

  } catch (error) {
    console.error('部署失败:', error);
    return NextResponse.json(
      { 
        message: '部署失败',
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
