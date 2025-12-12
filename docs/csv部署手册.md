# 海光csv

## 部署教程

### 拉取项目仓库

```
git clone https://github.com/djy0612/csv
```

### 安装依赖项

```shell
sudo apt install -y build-essential chrpath diffstat lz4 wireguard-tools xorriso

# 安装rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 编译

```shell
cd csv/dstack
cargo build --release -p dstack-vmm -p supervisor
mkdir -p vmm-data
cp target/release/dstack-vmm vmm-data/
cp target/release/supervisor vmm-data/
cd vmm-data/
```

### 修改配置文件

```
# create vmm.toml. Edit the config as needed.
cat <<EOF > vmm.toml
log_level = "info"
address = "0.0.0.0"
port = 10340
image_path = "./images"
run_path = "./run/vm"

[cvm]
kms_urls = ["https://kms.020919.xyz:9201"]
gateway_urls = ["https://gateway.020919.xyz:9202"]
cid_start = 856000
cid_pool_size = 1000

[cvm.port_mapping]
enabled = true
address = "127.0.0.1"
range = [
    { protocol = "tcp", from = 1, to = 20000 },
    { protocol = "udp", from = 1, to = 20000 },
]
[gateway]
base_domain = "020919.xyz"
port = 9204
agent_port = 9206

[host_api]
port = 10330
EOF
```

### 下载客户端镜像

```sh
VERSION=1.0.0
wget "https://github.com/djy0612/csv/releases/download/v${DSTACK_VERSION}/guest-${DSTACK_VERSION}.tar.gz"
mkdir -p images/
tar -xvf guest-${DSTACK_VERSION}.tar.gz -C images/
rm -f guest-${DSTACK_VERSION}.tar.gz

#启动dstack-vmm
./dstack-vmm -c vmm.toml
```

## 使用说明

当启动完成dstack-vmm之后，他会自动向区块链上注册设备信息，当用户在平台上部署隐私智能合约依据调度算法选中了本设备之后，平台则会根据激励机制与算法对设备的贡献进行奖励。

