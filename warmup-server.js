// 服务器预热脚本 - 在服务器启动后预热首页，避免第一个用户访问时编译
const http = require('http');

function warmupServer(port = 3000, hostname = '127.0.0.1', maxRetries = 10) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    
    const tryWarmup = () => {
      // 关键修复：强制使用IPv4，避免IPv6连接失败导致阻塞
      const options = {
        hostname: hostname === 'localhost' ? '127.0.0.1' : hostname,
        port,
        path: '/',
        method: 'GET',
        timeout: 5000, // 减少到5秒超时，快速失败
        headers: {
          'User-Agent': 'Server-Warmup/1.0',
        },
        family: 4, // 强制使用IPv4
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ 服务器预热成功');
            resolve();
          } else {
            console.warn(`⚠️  服务器响应状态码: ${res.statusCode}`);
            if (retries < maxRetries) {
              retries++;
              console.log(`⏳ 等待服务器就绪，重试 ${retries}/${maxRetries}...`);
              setTimeout(tryWarmup, 2000);
            } else {
              reject(new Error('服务器预热失败：达到最大重试次数'));
            }
          }
        });
      });

      req.on('error', (err) => {
        if (retries < maxRetries) {
          retries++;
          console.log(`⏳ 等待服务器就绪，重试 ${retries}/${maxRetries}...`);
          setTimeout(tryWarmup, 2000);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (retries < maxRetries) {
          retries++;
          console.log(`⏳ 请求超时，重试 ${retries}/${maxRetries}...`);
          setTimeout(tryWarmup, 2000);
        } else {
          reject(new Error('服务器预热超时'));
        }
      });

      req.end();
    };

    // 等待2秒后开始预热（给服务器启动时间）
    setTimeout(tryWarmup, 2000);
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  const port = process.env.PORT || 3000;
  // 关键修复：默认使用127.0.0.1而不是localhost，避免IPv6问题
  const hostname = process.env.HOSTNAME || '127.0.0.1';
  
  warmupServer(port, hostname)
    .then(() => {
      console.log('🎉 服务器预热完成');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ 服务器预热失败:', err.message);
      process.exit(1);
    });
}

module.exports = warmupServer;

