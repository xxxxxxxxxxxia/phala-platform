# 多阶段构建 - 构建阶段
# 使用基础镜像 chain-base（包含已安装的依赖）
FROM chain-base:latest AS builder

# 设置工作目录
WORKDIR /app

# 依赖已经在基础镜像中安装，这里不需要再安装

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:18-alpine AS runner

# 设置工作目录
WORKDIR /app

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制package.json
COPY --from=builder /app/package*.json ./

# 安装生产依赖
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# 不再复制phala-blockchain-setup目录，直接使用服务器上的目录

# 切换到非root用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动应用
CMD ["npm", "start"]
