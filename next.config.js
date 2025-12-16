/** @type {import('next').NextConfig} */
const nextConfig = {
  // 禁用严格模式以提升性能
  reactStrictMode: false,
  
  // 禁用ESLint检查以加快构建
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // 禁用TypeScript检查以加快构建
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 优化编译
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'antd', 
      '@ant-design/icons', 
      'echarts', 
      'echarts-for-react',
      // 排除polkadot相关包，避免自动优化导致编译
    ],
    // 启用 SWC 编译器优化（Next.js 15+默认启用）
    webpackBuildWorker: true, // 启用webpack构建工作进程
  },
  
  // 外部化大型包 - Next.js 15+ 已移除此配置
  // serverComponentsExternalPackages: ['antd', '@ant-design/icons'],
  
  // 使用新的turbopack配置
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // 编译器优化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // 开发服务器优化
  devIndicators: {
    position: 'bottom-right',
  },
  
  // 开发模式优化 - 减少页面缓冲，降低内存和CPU占用
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 增加到60秒
    pagesBufferLength: 1, // 减少到1个页面，降低内存占用
  },
  
  // 强制刷新配置
  // 注意：esmExternals 已移除，Next.js 不推荐修改此选项
  
  // 优化webpack
  webpack: (config, { dev, isServer }) => {
    // 开发模式优化
    if (dev) {
      // 注意：watchOptions.ignored只影响文件监听，不影响首次编译
      // 当用户访问页面时，Next.js仍会编译它
      // 这是Next.js的按需编译机制，无法完全避免
      // 但我们可以通过以下方式优化：
      // 1. 忽略文件监听，减少重新编译
      // 2. 使用缓存加速后续编译
      // 3. 优化splitChunks，将polkadot模块单独打包
      
      config.watchOptions = {
        poll: 3000, // 增加轮询间隔到3秒
        aggregateTimeout: 1000, // 增加聚合超时到1秒
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          // 注意：不要忽略API路由，worker推荐等功能需要API
          // '**/src/app/api/**', // 保留API路由监听
          '**/src/components/**', // 忽略组件监听
          '**/src/lib/**', // 忽略库文件监听
          // 只编译这三个页面，其他管理端页面都忽略
          '**/src/app/management/tee-verification/**',
          '**/src/app/management/incentives/**',
          '**/src/app/management/monitoring/**',
          '**/src/app/management/scheduling-tests/**',
          '**/src/app/management/login/**',
          '**/src/app/management/register/**',
          '**/src/app/management/tools/**',
          '**/src/app/management/page.tsx', // 管理端首页
          // 忽略其他页面（已恢复大屏编译）
          // '**/src/app/polkadot-wall/**', // 已恢复，不再忽略
          // '**/src/app/developers/**',
          '**/src/app/providers/**',
          '**/src/app/scenarios/**',
          // 忽略图表库和polkadot模块，减少编译负担
          '**/node_modules/@antv/**',
          '**/node_modules/@ant-design/plots/**',
          '**/node_modules/echarts/**',
          '**/node_modules/@polkadot/**', // 忽略polkadot模块监听
        ],
      };
      
      // 注意：watchOptions.ignored只影响文件监听，不影响首次编译
      // 当用户访问页面时，Next.js仍会按需编译它（包括polkadot模块）
      
      // 减少开发时的内存使用
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 0,
          cacheGroups: {
            default: {
              minChunks: 1,
              priority: -20,
              reuseExistingChunk: true,
            },
            polkadot: {
              test: /[\\/]node_modules[\\/](@polkadot)[\\/]/,
              name: 'polkadot',
              chunks: 'all',
              priority: 10,
              // 将polkadot模块单独打包，避免重复编译
              enforce: true,
            },
          },
        },
        minimize: false, // 开发时不压缩
        // 启用持久化缓存
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
      };
      
      // 开发模式启用文件系统缓存，提升性能
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      };
    }
    
    // 生产模式优化
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          antd: {
            test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
            name: 'antd',
            chunks: 'all',
            priority: 20,
          },
          echarts: {
            test: /[\\/]node_modules[\\/](echarts|echarts-for-react)[\\/]/,
            name: 'echarts',
            chunks: 'all',
            priority: 15,
          },
        },
      };
    }
    
    // 优化解析
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,
        '@': require('path').resolve(__dirname, 'src'),
      },
    };
    
    return config;
  },
  
  // 减少输出文件大小
  // outputFileTracingRoot 已移除，让 Next.js 自动检测（在 Docker 中工作目录为 /app）
  
  // 启用压缩
  compress: true,
  
  // 优化图片
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    qualities: [75, 100], // 添加质量配置
  },
  
  // 减少开发时的构建时间
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // 启用standalone模式用于Docker部署
  output: 'standalone',
  
  // 添加代理配置解决CORS问题
  async rewrites() {
    return [
      {
        source: '/api/vm/:path*',
        destination: 'http://8.147.107.221:3001/api/vm/:path*',
      },
      // /api/scheduling/* 和 /api/contracts/* 由本地Next.js API路由处理，不需要rewrite
    ];
  },
  
  // 优化开发服务器 - 移除devServer配置，Next.js 15不再支持
};

module.exports = nextConfig;

