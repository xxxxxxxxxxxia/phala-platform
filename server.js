const path = require('path')
const fs = require('fs')

const dir = path.join(__dirname)

process.env.NODE_ENV = 'production'
// 强制使用IPv4，避免IPv6连接失败导致超时
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('dns-result-order')) {
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --dns-result-order=ipv4first'
}
process.chdir(__dirname)

const currentPort = parseInt(process.env.PORT, 10) || 3000
const hostname = process.env.HOSTNAME || '0.0.0.0'

// 优化keep-alive超时，提升连接复用（65秒，与nginx标准一致）
let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10) || 65000

// 从 next.config.js 读取配置，确保 onDemandEntries 配置正确
// 在standalone模式下，Next.js会使用构建时的配置，但我们可以通过环境变量覆盖运行时配置
try {
  const configPath = path.join(__dirname, 'next.config.js')
  if (fs.existsSync(configPath)) {
    delete require.cache[require.resolve(configPath)]
    const userConfig = require(configPath)
    
    // 如果是函数，需要调用它
    const config = typeof userConfig === 'function' ? userConfig({}, {}) : userConfig
    
    // 确保 onDemandEntries 配置正确（24小时，100个页面）
    // 关键：设置非常大的缓存时间，确保页面编译后一直保留在内存中，不被自动清除
    const onDemandEntries = {
      maxInactiveAge: config.onDemandEntries?.maxInactiveAge || 60 * 1000 * 60 * 24,  // 24小时
      pagesBufferLength: config.onDemandEntries?.pagesBufferLength || 100,        // 100个页面
    }
    
    // 读取standalone配置（如果存在）
    let standaloneConfig = {}
    const standaloneConfigPath = path.join(__dirname, '.next', 'standalone', '.next', 'required-server-files.json')
    if (fs.existsSync(standaloneConfigPath)) {
      const requiredFiles = JSON.parse(fs.readFileSync(standaloneConfigPath, 'utf8'))
      if (requiredFiles.config) {
        standaloneConfig = requiredFiles.config
      }
    }
    
    // 更新onDemandEntries配置
    standaloneConfig.onDemandEntries = onDemandEntries
    
    // 设置环境变量，Next.js会读取它
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(standaloneConfig)
    
    console.log(`✅ 从 next.config.js 加载配置`)
    console.log(`📦 onDemandEntries: maxInactiveAge=${onDemandEntries.maxInactiveAge}ms (${onDemandEntries.maxInactiveAge/1000/60}分钟), pagesBufferLength=${onDemandEntries.pagesBufferLength}`)
  } else {
    console.warn('⚠️  next.config.js 不存在，使用默认配置')
    // 设置默认的onDemandEntries配置（24小时，100个页面）
    const defaultConfig = {
      onDemandEntries: {
        maxInactiveAge: 60 * 1000 * 60 * 24,  // 24小时
        pagesBufferLength: 100,            // 100个页面
      }
    }
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(defaultConfig)
  }
} catch (error) {
  console.warn('⚠️  读取配置时出错，使用默认配置:', error.message)
  // 设置默认的onDemandEntries配置
  const defaultConfig = {
    onDemandEntries: {
      maxInactiveAge: 60 * 1000 * 5,  // 5分钟
      pagesBufferLength: 15,            // 15个页面
    }
  }
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(defaultConfig)
}

require('next')
const { startServer } = require('next/dist/server/lib/start-server')

if (
  Number.isNaN(keepAliveTimeout) ||
  !Number.isFinite(keepAliveTimeout) ||
  keepAliveTimeout < 0
) {
  keepAliveTimeout = 65000 // 默认65秒
}

console.log(`🚀 启动优化的Next.js服务器...`)
console.log(`📦 Keep-Alive超时: ${keepAliveTimeout}ms`)
console.log(`⚡ 静态文件缓存已通过中间件优化`)

// 在standalone模式下，Next.js会自动从.standalone目录加载配置
// 我们通过环境变量已经设置了onDemandEntries
startServer({
  dir,
  isDev: false,
  hostname,
  port: currentPort,
  allowRetry: false,
  keepAliveTimeout,
}).then((app) => {
  // 优化HTTP服务器配置，防止连接重置
  // Next.js的startServer返回的是app对象，HTTP服务器在app.server中
  if (app && app.server) {
    const httpServer = app.server
    
    // 设置keep-alive超时
    httpServer.keepAliveTimeout = keepAliveTimeout
    httpServer.headersTimeout = keepAliveTimeout + 1000 // headersTimeout应该大于keepAliveTimeout
    
    // 设置最大连接数
    httpServer.maxConnections = 1000
    
    // 监听错误事件，优雅处理连接重置
    httpServer.on('clientError', (err, socket) => {
      // 忽略ECONNRESET和EPIPE错误，这是客户端断开连接的正常情况
      if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE' && err.code !== 'ECONNABORTED') {
        console.error('HTTP服务器客户端错误:', err.code, err.message)
      }
      if (!socket.destroyed) {
        socket.destroy()
      }
    })
    
    // 监听服务器错误
    httpServer.on('error', (err) => {
      if (err.code !== 'EADDRINUSE') {
        console.error('HTTP服务器错误:', err)
      }
    })
    
    console.log(`✅ HTTP服务器配置优化完成`)
    console.log(`📦 Keep-Alive超时: ${keepAliveTimeout}ms`)
    console.log(`📦 Headers超时: ${httpServer.headersTimeout}ms`)
    console.log(`📦 最大连接数: ${httpServer.maxConnections}`)
  } else {
    console.warn('⚠️  无法访问HTTP服务器对象，跳过优化配置')
  }
  
  // 服务器启动后预热首页，避免第一个用户访问时编译
  setTimeout(() => {
    try {
      const warmup = require('./warmup-server.js');
      // 关键修复：使用127.0.0.1而不是localhost，避免IPv6连接问题导致阻塞
      const warmupHost = hostname === '0.0.0.0' ? '127.0.0.1' : hostname;
      warmup(currentPort, warmupHost)
        .then(() => {
          console.log('🎉 首页预热完成，新用户访问将更快');
        })
        .catch((err) => {
          console.warn('⚠️  首页预热失败（不影响服务）:', err.message);
        });
    } catch (err) {
      console.warn('⚠️  无法加载预热脚本（不影响服务）:', err.message);
    }
  }, 3000); // 等待3秒后开始预热
  
  return app
}).catch((err) => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});