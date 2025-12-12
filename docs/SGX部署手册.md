# SGX Worker 容器化部署手册

> 目标：在支持 Intel SGX 的服务器上，通过容器快速部署并运行Worker。

---

## 1. 环境要求

| 项目 | 具体要求 |
| --- | --- |
| 硬件 | Intel SGX 能力的 CPU。 |
| 操作系统 | Ubuntu 22.04 LTS 或 Ubuntu 20.04 LTS。 |
| 权限 | root 或 sudo。 |
| 网络 | 可访问官方镜像仓库、NTP/Chrony、链上节点、AESM 证书服务器。 |

---

## 2.硬件检查

具体检查安装可参考：[构建并验证SGX机密计算环境-云服务器 ECS-阿里云 (aliyun.com)](https://help.aliyun.com/zh/ecs/user-guide/build-an-sgx-encrypted-computing-environment?spm=a2c4g.11186623.help-menu-25365.d_0_8_6_2_0.7ceb62f7bjlkD8&scm=20140722.H_208095._.OR_help-T_cn~zh-V_1#283c174ef4p96)

## 3.Docker
```bash
### 1.卸载旧版

# 首先如果系统中已经存在旧的Docker，则先卸载：

yum remove docker \
    docker-client \
    docker-client-latest \
    docker-common \
    docker-latest \
    docker-latest-logrotate \
    docker-logrotate \
    docker-engine \
    docker-selinux 

### 2.更新软件源
sudo apt update

# 安装基本软件
sudo apt-get install apt-transport-https ca-certificates curl software-properties-common lrzsz -y

# 指定使用阿里云镜像 
sudo curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo apt-key add -

sudo add-apt-repository "deb [arch=amd64] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable"

# 更新软件源
sudo apt update

### 3.安装Docker

# 最后，执行命令，安装Docker

sudo apt-get install docker-ce -y

### 4.启动和校验

# 启动Docker
systemctl start docker

# 停止Docker
systemctl stop docker

# 重启
systemctl restart docker

# 设置开机自启
systemctl enable docker

# 执行docker ps命令，如果不报错，说明安装启动成功
docker ps 
```
---

## 4. 拉取并运行 SGX Worker

### 4.1 拉取镜像
```bash
# 拉取pruntime和pherry的镜像文件模版
docker pull phalanetwork/phala-pruntime-v2-dcap:25022401
docker pull ghcr.io/phala-network/phala-docker/phala-dev-pherry:21072301
```

### 4.2下载文件

```bash
# 访问网址：https://gitee.com/eliauk4813/worker-deploy
# 也可以直接点击worker部署包中的：前往配置仓库
# pruntime
pruntime、start_pruntime.sh、libpink.so.1.0、libpink.so.1.1

# pherry
pherry、start_pherry.sh

# 具体文件放置目录
示例：
root/tmp/my_phala/pruntime
root/tmp/my_phala/pherry

# 将pruntime的文件都放入root/tmp/my_phala/pruntime文件夹下，pherry的文件都放入root/tmp/my_phala/pherry文件夹下
# 在root/tmp目录下执行后续的docker命令
```

### 4.3启动容器

```bash
# 建立网络
docker network create phala-net

# 依次运行两个docker命令

docker run -d \
  --name phala-pruntime \
  --network phala-net \
  -p 8000:8000 \
  --device /dev/sgx_enclave \
  --device /dev/sgx_provision \
  -v /var/run/aesmd/aesm.socket:/var/run/aesmd/aesm.socket \
  -v $(pwd)/my_phala/pruntime/pruntime:/root/pruntime \
  -v $(pwd)/my_phala/pruntime/start_pruntime.sh:/root/start_pruntime.sh \
  -v $(pwd)/my_phala/pruntime/libpink.so.1.0:/root/libpink.so.1.0 \
  -v $(pwd)/my_phala/pruntime/libpink.so.1.1:/root/libpink.so.1.1 \
phalanetwork/phala-pruntime-v2-dcap:25022401


docker run -d \
  --name phala-pherry \
  --network phala-net \
  -e PRUNTIME_ENDPOINT="http://phala-pruntime:8000" \
  -e PHALA_NODE_WS_ENDPOINT="ws://8.147.107.221:19944" \
  -e MNEMONIC="//Ferdie" \
  -v $(pwd)/my_phala/pherry/pherry:/root/pherry \
  -v $(pwd)/my_phala/pherry/start_pherry.sh:/root/start_pherry.sh \
ghcr.io/phala-network/phala-docker/phala-dev-pherry:21072301
```

#### 参数说明
| 参数 | 用途 |
| --- | --- |
| `--device /dev/sgx*` | 暴露 SGX 设备。 |
| `-v /var/run/aesmd` | 让容器访问 AESM 服务（DCAP Quote 必需）。 |
| `--env-file` | 注入 Worker 配置。 |
| -v $(pwd)/... | 挂载文件 |
| PHALA_NODE_WS_ENDPOINT | 要连接到的区块链网络的地址 |

### 4.4 查看日志
```bash
docker logs -f pruntime
docker logs -f pherry
```
应看到类似 `sgx=true`、`Synced block` 的输出。

---

## 5. 常见问题排查

| 现象 | 可能原因 | 解决办法 |
| --- | --- | --- |
| `/dev/sgx_enclave` 不存在 | BIOS 未开启、驱动未装 | 重新启用 SGX，重装驱动。 |
| 日志提示 `aesm service unavailable` | AESM 未运行或挂载错误 | `systemctl restart aesmd`，确保 `-v /var/run/aesmd:/var/run/aesmd`. |
| Quote 验证失败 | DCAP 数据包过期、时间不同步 | 更新 DCAP 包，校准时间。 |
| Worker 无法连上链 | 端口阻断或 `PHALA_PRPC_ENDPOINT` 错误 | 检查防火墙与节点地址。 |
| pherry链接pruntime失败 | pruntime尚未完全启动 | 在pruntime启动后等待几秒，再启动pherry |

