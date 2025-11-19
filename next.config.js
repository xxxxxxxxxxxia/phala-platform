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
    optimizePackageImports: ['antd', '@ant-design/icons', 'echarts', 'echarts-for-react'],
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
  
  // 开发模式优化 - 减少页面缓冲，提升性能
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 增加到60秒
    pagesBufferLength: 1, // 减少到1个页面
  },
  
  // 强制刷新配置
  experimental: {
    // 启用更严格的HMR
    esmExternals: false,
  },
  
  // 优化webpack
  webpack: (config, { dev, isServer }) => {
    // 开发模式优化
    if (dev) {
      config.watchOptions = {
        poll: 3000, // 增加轮询间隔到3秒
        aggregateTimeout: 1000, // 增加聚合超时到1秒
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/.vscode/**',
          '**/.idea/**',
          '**/src/app/api/**', // 忽略API路由监听
          '**/src/components/**', // 忽略组件监听
          '**/src/lib/**', // 忽略库文件监听
          '**/src/app/polkadot-wall/**', // 忽略数据大屏页面，减少编译负担
          '**/src/app/management/**', // 忽略管理端页面，减少编译负担
          '**/src/app/developers/**', // 忽略开发者页面，减少编译负担
          '**/node_modules/@antv/**', // 忽略图表库，减少编译负担
          '**/node_modules/@ant-design/plots/**', // 忽略图表组件
          '**/node_modules/echarts/**', // 忽略echarts
        ],
      };
      
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
            },
          },
        },
        minimize: false, // 开发时不压缩
        // 启用持久化缓存
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
      };
      
      // 开发模式启用缓存，提升性能
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
  outputFileTracingRoot: '/home/user1/Desktop/tmp/phala-blockchain/my-phala-platform',
  
  // 启用压缩
  compress: true,
  
  // 优化图片
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    qualities: [75, 100], // 添加质量配置
  },
  
  // 减少开发时的构建时间 - 已在上方定义，移除重复
  
  // 开发模式下排除数据大屏页面，减少编译负担
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      // 排除特定路由的预编译
      serverActions: {
        bodySizeLimit: '2mb',
      },
    },
  }),
  
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

