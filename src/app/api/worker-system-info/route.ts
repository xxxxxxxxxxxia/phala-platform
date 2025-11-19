import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 从endpoint URL中提取主机地址
function extractHostFromEndpoint(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    return url.hostname;
  } catch (e) {
    // 如果不是有效的URL，尝试直接解析
    const match = endpoint.match(/(?:https?:\/\/)?([^:\/]+)/);
    return match ? match[1] : null;
  }
}

// 通过SSH执行命令获取硬件信息
async function getHardwareInfoViaSSH(host: string): Promise<any> {
  try {
    // 尝试通过SSH连接并执行命令
    // 注意：这需要配置SSH密钥或密码
    const commands = {
      lscpu: `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@${host} "lscpu" 2>/dev/null || echo ""`,
      meminfo: `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@${host} "cat /proc/meminfo" 2>/dev/null || echo ""`,
      osinfo: `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@${host} "cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || echo '无法获取OS信息'" 2>/dev/null || echo ""`,
      uname: `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@${host} "uname -a" 2>/dev/null || echo ""`,
      virtualization: `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@${host} "systemd-detect-virt 2>/dev/null || (cat /proc/cpuinfo | grep -i hypervisor > /dev/null && echo 'virtualized' || echo 'physical')" 2>/dev/null || echo ""`,
    };

    const results: any = {};

    // 执行所有命令
    for (const [key, command] of Object.entries(commands)) {
      try {
        const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
        if (stderr && !stderr.includes('systemd-detect-virt')) {
          console.warn(`SSH命令 ${key} 有警告:`, stderr);
        }
        results[key] = stdout.trim();
        // 如果输出为空，说明SSH连接失败
        if (!results[key]) {
          throw new Error(`SSH连接失败或命令执行失败: ${key}`);
        }
      } catch (error: any) {
        console.error(`SSH执行命令 ${key} 失败:`, error.message);
        throw error;
      }
    }

    // 解析lscpu
    const parseLscpu = (output: string) => {
      const lines = output.split('\n');
      const result: any = {};
      lines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          result[key.trim()] = valueParts.join(':').trim();
        }
      });
      return result;
    };

    // 解析meminfo
    const parseMeminfo = (output: string) => {
      const lines = output.split('\n');
      const result: any = {};
      lines.forEach(line => {
        const match = line.match(/^(\w+):\s+(\d+)\s+(\w+)?/);
        if (match) {
          result[match[1]] = {
            value: parseInt(match[2]),
            unit: match[3] || 'kB'
          };
        }
      });
      return result;
    };

    const lscpuParsed = parseLscpu(results.lscpu);
    const meminfoParsed = parseMeminfo(results.meminfo);

    // 解析os-release
    const osInfo: any = {};
    if (results.osinfo && !results.osinfo.includes('无法获取')) {
      results.osinfo.split('\n').forEach((line: string) => {
        const match = line.match(/^(\w+)="?(.+?)"?$/);
        if (match) {
          osInfo[match[1]] = match[2].replace(/"/g, '');
        }
      });
    }

    // 构建返回数据
    return {
      success: true,
      parsed: {
        architecture: lscpuParsed['Architecture'] || 'N/A',
        cpuVendor: lscpuParsed['Vendor ID'] || 'N/A',
        cpuModel: lscpuParsed['Model name'] || 'N/A',
        cpuCores: lscpuParsed['Core(s) per socket'] || 'N/A',
        cpuThreads: lscpuParsed['Thread(s) per core'] || 'N/A',
        cpuFreq: lscpuParsed['CPU MHz'] || 'N/A',
        virtualization: results.virtualization || lscpuParsed['Hypervisor vendor'] || 'N/A',
        totalMemory: meminfoParsed['MemTotal'] ? `${(meminfoParsed['MemTotal'].value / 1024 / 1024).toFixed(2)} GB` : 'N/A',
        osName: osInfo.NAME || 'N/A',
        osPrettyName: osInfo.PRETTY_NAME || 'N/A',
        kernel: results.uname.split(' ')[2] || 'N/A',
      },
      raw: results,
    };
  } catch (error: any) {
    console.error(`通过SSH获取 ${host} 的硬件信息失败:`, error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少 endpoint 参数',
        },
        { status: 400 }
      );
    }

    // 从endpoint中提取主机地址
    const host = extractHostFromEndpoint(endpoint);
    if (!host) {
      return NextResponse.json(
        {
          success: false,
          error: '无法从 endpoint 中提取主机地址',
        },
        { status: 400 }
      );
    }

    console.log(`[Worker System Info API] 查询 ${host} 的硬件信息 (endpoint: ${endpoint})`);

    // 尝试通过SSH获取硬件信息
    try {
      const hardwareInfo = await getHardwareInfoViaSSH(host);
      return NextResponse.json({
        success: true,
        message: '硬件信息获取成功',
        host: host,
        endpoint: endpoint,
        ...hardwareInfo,
      });
    } catch (sshError: any) {
      console.error(`[Worker System Info API] SSH查询失败:`, sshError);
      return NextResponse.json(
        {
          success: false,
          error: '无法通过SSH连接到worker服务器',
          message: sshError.message || 'SSH连接失败，请检查SSH配置和网络连接',
          host: host,
          endpoint: endpoint,
          hint: '需要配置SSH密钥或密码才能查询远程worker的硬件信息',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Worker System Info API] 获取硬件信息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取硬件信息失败',
        message: error.message || '未知错误',
      },
      { status: 500 }
    );
  }
}



