// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Modal,
  Form,
  Space,
  Table,
  Tag,
  theme as antTheme,
  ConfigProvider,
  Upload,
  message,
  Flex,
  Progress,
  Spin,
  Collapse,
  Alert,
  Typography,
  Divider
} from "antd";
import {
  PlusOutlined,
  InboxOutlined,
  CloseCircleOutlined,
  UnorderedListOutlined,
  SearchOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
const { Title, Text } = Typography;
import axios from "axios";

import MainLayout from "@/components/layout/MainLayout";
import DataCard from "@/components/DataCard";
import AuthGuard from '@/components/AuthGuard';

// 后端服务器的地址，请确保与你的后端服务地址一致
const API_BASE_URL = "http://8.147.106.136:3001/api";
const { Dragger } = Upload;
const { Panel } = Collapse;

type SERVICE = {
  key: string;
  name: string;
  version: string;
  created: string;
  status: string;
  host: string;
};

type HOST = {
  key: string;
  name: string;
  status: "running" | "stopped";
  // refreshTime: number;
  address: string;
  cpu: string;
  memory: string;
};

type DockerService = {
  containerId: string;
  name: string;
  service: string;
  version: string;
  command: string;
  created: string;
  status: string;
  ports: string;
};

type VmServiceData = {
  vmIp: string;
  success: boolean;
  services?: {
    docker: DockerService[];
  };
  error?: string;
};

type DeployResponse = {
  message: string;
  output?: string;
  error?: string;
  command?: string;
};

type MonitorData = {
  cpuUsage: string;
  memory: string;
};

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  // const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [allServicesModalOpen, setAllServicesModalOpen] = useState(false);
  const [currentVmIp, setCurrentVmIp] = useState<string | null>(null);
  const [vmServices, setVmServices] = useState<SERVICE[]>([]);
  const [allVmServices, setAllVmServices] = useState<VmServiceData[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingAllServices, setLoadingAllServices] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeployResponse | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [hosts, setHosts] = useState<HOST[]>([
    {
      key: "1",
      name: "csv-vm",
      status: "running",
      address: "192.168.122.76",
      cpu: "1 cores",
      memory: "4096 MB",
    },
    {
      key: "2",
      name: "csv-vm2",
      status: "running",
      address: "192.168.122.77",
      cpu: "2 cores",
      memory: "2048 MB",
    },
    {
      key: "3",
      name: "csv-vm3",
      status: "running",
      address: "192.168.122.78",
      cpu: "2 cores",
      memory: "4096 MB",
    },
  ]);
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [selectedHost, setSelectedHost] = useState<HOST | null>(null);
  const [stopServiceAlert, setStopServiceAlert] = useState<{
    visible: boolean;
    message: string;
  }>({
    visible: false,
    message: "",
  });

  // 添加状态来跟踪正在删除的服务
  const [stoppingService, setStoppingService] = useState<string | null>(null);

  // 添加状态来存储调度信息
  const [scheduledInfo, setScheduledInfo] = useState<{
    ip: string;
    hostName: string;
  } | null>(null);

  const {
    token: { colorBgContainer, colorText },
  } = antTheme.useToken();

  // 在组件加载时自动获取所有VM服务信息
  useEffect(() => {
    fetchAllVmServices();
  }, []);

  // 定期获取VM状态
  useEffect(() => {
    const fetchHostStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/vm/list`);
        const hostsData = response.data;
        const apiHosts = hostsData.vms;
        console.log(hostsData);

        // 更新VM状态
        setHosts((prevHosts) => {
          // 创建一个映射来快速查找API返回的VM
          const apiHostMap = new Map();
          // 检查apiVms是否为数组，防止apiVms.forEach不是函数的错误
          if (Array.isArray(apiHosts)) {
            apiHosts.forEach((host: HOST) => {
              apiHostMap.set(host.name, host);
            });
          }

          // 更新每个VM的状态
          return prevHosts.map((host) => {
            const apiHost = apiHostMap.get(host.name);
            if (apiHost) {
              // 如果在API响应中找到该VM，保持其状态为running
              return { ...host, status: "running" };
            } else {
              // 如果在API响应中找不到该VM，将其标记为stopped
              return { ...host, status: "stopped" };
            }
          });
        });
      } catch (error) {
        console.error("获取HOST状态失败:", error);
      }
    };

    // 立即执行一次
    fetchHostStatus();

    // 每隔10秒执行一次
    // const interval = setInterval(fetchHostStatus, 10000);

    // // 清除间隔
    // return () => clearInterval(interval);
  }, []);

  const fetchVmServices = async (vmIp: string) => {
    setLoadingServices(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/vm/docker-services`, {
        params: { vmIp },
      });
      const data = response.data;
      console.log(data);

      // 假设返回的数据结构是数组，如果没有数据则默认为空数组
      const servicesData = Array.isArray(data.services) ? data.services : [];

      // 添加 key 字段以满足 Table 组件的需求
      const servicesWithKeys = servicesData.map(
        (service: any, index: number) => ({
          ...service,
          key: index.toString(),
        })
      );

      setVmServices(servicesWithKeys);
      setCurrentVmIp(vmIp);
    } catch (error) {
      console.error("获取服务信息失败:", error);
      message.error("获取服务信息失败");
      setVmServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchAllVmServices = async () => {
    setLoadingAllServices(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/vm/all-services`);
      const data = response.data;
      console.log(data);

      setAllVmServices(data.data || []);
      setAllServicesModalOpen(true);
    } catch (error) {
      console.error("获取所有服务信息失败:", error);
      message.error("获取所有服务信息失败");
      setAllVmServices([]);
    } finally {
      setLoadingAllServices(false);
    }
  };

  const fetchMonitorData = async (vmIp: string) => {
    setLoadingMonitor(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/vm/monitor`, {
        params: { vmIp },
      });
      setMonitorData(response.data);
    } catch (error) {
      console.error("获取监控信息失败:", error);
      message.error("获取监控信息失败");
      setMonitorData(null);
    } finally {
      setLoadingMonitor(false);
    }
  };

  const handleStopService = async (record: any) => {
    // 设置正在删除的服务ID
    const serviceId = record.key || record.name;
    setStoppingService(serviceId);

    try {
      const response = await axios.post(`${API_BASE_URL}/vm/stop-service`, {
        vmIp: record.vmIp,
        serviceName: serviceId,
      });
      console.log(response.data);

      if (response.data.message) {
        // 显示banner样式警告信息
        message.success(response.data.message);
        // 设置警告横幅信息
        setStopServiceAlert({
          visible: true,
          message: response.data.message,
        });

        setAllVmServices([]);
        // 刷新服务列表
        await fetchAllVmServices();
      }
    } catch (error: any) {
      console.error("删除服务失败:", error);
      const errorMessage = error.response?.data?.message || "删除服务失败";
      message.error(errorMessage);
    } finally {
      // 无论成功或失败都清除loading状态
      setStoppingService(null);
    }
  };

  const hostDataSource = hosts.filter((host) =>
    host.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const hostColumns = [
    {
      title: "Worker 名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag color={s === "running" ? "success" : "default"}>{s}</Tag>
      ),
    },
    {
      title: "IP地址",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "CPU信息",
      dataIndex: "cpu",
      key: "cpu",
    },
    {
      title: "内存信息",
      dataIndex: "memory",
      key: "memory",
    },
    {
      title: "操作",
      key: "actions",
      render: (_: any, r: HOST) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<SearchOutlined />}
            onClick={() => {
              setSearchModalOpen(true);
              fetchVmServices(r.address);
            }}
            disabled={r.status === "stopped"}
          >
            查询服务
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<BarChartOutlined />}
            onClick={() => {
              setResourceModalOpen(true);
              setSelectedHost(r);
              fetchMonitorData(r.address);
            }}
            disabled={r.status === "stopped"}
          >
            资源监控
          </Button>
        </Space>
      ),
    },
  ];

  const vmServicesColumns = [
    {
      title: "服务名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
    },
    {
      title: "创建时间",
      dataIndex: "created",
      key: "created",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
    },
  ];

  const allVmServicesColumns = [
    {
      title: "服务ID",
      dataIndex: "containerId",
      key: "containerId",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "服务名称",
      dataIndex: "name",
      key: "serviceName",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "镜像",
      dataIndex: "service",
      key: "service",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "主机IP",
      dataIndex: "vmIp",
      key: "vmIp",
    },
    {
      title: "创建时间",
      dataIndex: "created",
      key: "created",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "容器状态",
      dataIndex: "status",
      key: "status",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return <span style={{ color: "red" }}>错误信息: {record.error}</span>;
        }

        let color = "default";
        if (text?.includes("Up")) {
          color = "success";
        } else if (text?.includes("Exited")) {
          color = "error";
        }
        return <Tag color={color}>{text || "N/A"}</Tag>;
      },
    },
    {
      title: "操作",
      key: "actions",
      render: (_: any, r: SERVICE) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CloseCircleOutlined />}
            danger
            onClick={() => handleStopService(r)}
            disabled={!r.status || !r.status.includes("Up")}
            loading={stoppingService === (r.key || r.name)}
          >
            删除服务
          </Button>
        </Space>
      ),
    },
  ];

  const handleDeploy = async (vals: { name: string }) => {
    console.log("Deploy new instance:", vals.name);
    form.resetFields();
    setDeployModalOpen(false);
  };

  const handleDeployButtonClick = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/scheduled-vm`);
      console.log(response.data);

      if (response.data && response.data.scheduledVmIp) {
        const ip = response.data.scheduledVmIp;

        // 查找对应的主机名称
        const matchedHost = hosts.find((host) => host.address === ip);
        const hostName = matchedHost ? matchedHost.name : "未知主机";
        console.log(hostName);

        // 存储调度信息
        setScheduledInfo({
          ip,
          hostName,
        });

        // 打开部署模态框
        setDeployModalOpen(true);
      }
    } catch (error) {
      console.error("调度接口调用失败:", error);
      message.error("调度失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  /* 上传前校验 */
  const beforeUpload = (file: File) => {
    const isYaml =
      file.type === "application/x-yaml" ||
      file.name.endsWith(".yaml") ||
      file.name.endsWith(".yml");
    if (!isYaml) {
      message.error("只能上传 docker-compose.yaml / *.yml 文件");
      return Upload.LIST_IGNORE;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error("文件大小不能超过 10MB");
      return Upload.LIST_IGNORE;
    }
    return false; // 手动上传
  };

  /* 自定义上传逻辑 */
  const customRequest = async (options: any) => {
    const { file } = options;
    setLoading(true);
    setResult(null);
    const formData = new FormData();
    formData.append("composeFile", file);

    // 获取表单中的部署路径和调度的主机IP
    const values = form.getFieldsValue();
    const vmPath = values.name; // 部署路径
    const vmIp = scheduledInfo?.ip; // 主机IP

    // 添加主机IP和路径到formData
    if (vmIp) {
      formData.append("vmIp", vmIp);
    }

    if (vmPath) {
      formData.append("vmPath", vmPath);
    }

    try {
      const { data } = await axios.post<DeployResponse>(
        `${API_BASE_URL}/deploy`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setResult(data);
      console.log(data);

      message.success(data.message || "部署完成");
      setDeployModalOpen(false);
      fetchAllVmServices();
    } catch (err: any) {
      const resp = err.response?.data as DeployResponse;
      setResult(resp || { message: "网络异常，请稍后重试" });
      message.error(resp?.message || "部署失败");
    } finally {
      setLoading(false);
    }
  };

  // const handleDispatch = (vals: { name: string }) => {
  //   console.log("Dispatch instance:", vals.name);
  //   form.resetFields();
  //   setDispatchModalOpen(false);
  // };

  const onChange = (value: string) => {
    console.log(`selected ${value}`);
  };

  const onSearch = (value: string) => {
    console.log("search:", value);
  };

  // 解析CPU使用率百分比
  const parseCpuUsage = (cpuUsage: string): number => {
    if (!cpuUsage) return 0;
    const match = cpuUsage.match(/(\d+\.?\d*)%/);
    return match ? parseFloat(match[1]) : 0;
  };

  // 解析内存使用率百分比
  const parseMemoryUsage = (memory: string): number => {
    if (!memory) return 0;
    const match = memory.match(/\((\d+\.?\d*)%\)/);
    return match ? parseFloat(match[1]) : 0;
  };

  return (
    <AuthGuard>
      <MainLayout>
        <ConfigProvider
          theme={{
            algorithm: antTheme.darkAlgorithm, // 黑夜模式
            token: {
              colorPrimary: "#9f2cff", // 自定义主色（可选）
            },
          }}
        >
          <div
            style={{
              minHeight: "100vh",
              background: "#0d0e20", // 纯黑背景
              padding: 4,
              color: colorText,
            }}
          >
            <Title level={2} style={{ fontSize: "18pt" }}>
              安全调度
            </Title>
            <Text type="secondary"></Text>
            {/* <Divider /> */}
            <DataCard title="服务列表">
              {/* 显示关闭服务后的警告横幅 */}
              {stopServiceAlert.visible && (
                <Alert
                  message={stopServiceAlert.message}
                  banner
                  type="warning"
                  closable
                  onClose={() =>
                    setStopServiceAlert({ visible: false, message: "" })
                  }
                  style={{ marginBottom: 16 }}
                />
              )}
              {/* 顶部操作区 */}
              <Space style={{ marginBottom: 16 }} wrap>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleDeployButtonClick}
                  loading={loading}
                >
                  部署服务
                </Button>
                <Button
                  type="primary"
                  onClick={fetchAllVmServices}
                  loading={loadingAllServices}
                  icon={<UnorderedListOutlined />}
                >
                  查看服务
                </Button>
              </Space>

              {/* 所有服务信息展示区域 */}
              <Spin
                tip="正在查询服务列表..."
                size="large"
                spinning={loadingAllServices}
              >
                {allVmServices.length > 0 ? (
                  <Table
                    rowKey={(record, index) => `vm-${index}`}
                    columns={allVmServicesColumns}
                    dataSource={(() => {
                      const flattenedData: any[] = [];
                      allVmServices.forEach((vm) => {
                        if (
                          vm.success &&
                          vm.services?.docker &&
                          Array.isArray(vm.services.docker) &&
                          vm.services.docker.length > 0
                        ) {
                          vm.services.docker.forEach((service) => {
                            // 只添加状态包含"Up"的服务
                            if (service.status && service.status.includes("Up")) {
                              flattenedData.push({
                                ...service,
                                vmIp: vm.vmIp,
                                vmStatus: vm.success,
                              });
                            }
                          });
                        } else {
                          // 添加一个表示无服务的条目
                          flattenedData.push({
                            vmIp: vm.vmIp,
                            vmStatus: vm.success,
                            error: vm.error,
                            isEmpty: true,
                          });
                        }
                      });
                      return flattenedData;
                    })()}
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 0",
                      color: "rgba(255, 255, 255, 0.3)",
                    }}
                  >
                    {/* 点击"查看所有服务"按钮获取服务信息 */}
                  </div>
                )}
              </Spin>
            </DataCard>

            <p></p>

            <DataCard title="设备列表">
              {/* 设备信息表格 */}
              <Table
                rowKey="key"
                columns={hostColumns}
                dataSource={hostDataSource}
                pagination={{
                  pageSize: 50,
                  showSizeChanger: false,
                  showTotal: (t) => `设备总数: ${t}台`,
                }}
                size="small"
              />
            </DataCard>

            {/* 部署弹窗 */}
            <Modal
              title="部署信息"
              open={deployModalOpen}
              onCancel={() => {
                setDeployModalOpen(false);
                setScheduledInfo(null);
              }}
              footer={null}
              afterOpenChange={(open) => {
                if (open && scheduledInfo) {
                  // 模态框打开后设置表单字段值
                  form.setFieldsValue({
                    scheduledVmIp: scheduledInfo.ip,
                    hostName: scheduledInfo.hostName,
                  });
                } else if (!open) {
                  // 模态框关闭时重置表单和调度信息
                  form.resetFields();
                  setScheduledInfo(null);
                }
              }}
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleDeploy}
                preserve={false}
              >
                <Form.Item
                  label="部署路径"
                  name="name"
                  rules={[{ required: true, message: "请输入部署路径" }]}
                // initialValue=""
                >
                  <Input placeholder="例如 /root/test" />
                </Form.Item>

                <Form.Item label="主机IP" name="scheduledVmIp" hidden>
                  <Input />
                </Form.Item>

                <Form.Item
                  label="worker名称"
                  name="hostName"
                  rules={[{ required: true, message: "请选择调度主机" }]}
                >
                  {/* <Input readOnly placeholder="调度成功后将显示主机名称" /> */}
                  <Input disabled placeholder="调度成功后将显示主机名称" />
                </Form.Item>

                <Form.Item
                  label="部署文件"
                  name="file"
                  rules={[{ required: true, message: "请上传部署文件" }]}
                >
                  <Dragger
                    fileList={fileList}
                    beforeUpload={beforeUpload}
                    customRequest={customRequest}
                    onChange={(info) => setFileList(info.fileList)}
                    maxCount={1}
                    disabled={loading}
                  >
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">
                      点击或拖拽 docker-compose.yaml 文件到此处
                    </p>
                    <p className="ant-upload-hint">
                      仅支持 .yaml / .yml 文件，大小 ≤ 10MB
                    </p>
                  </Dragger>
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                  <Space>
                    <Button onClick={() => setDeployModalOpen(false)}>
                      取消
                    </Button>
                    <Button
                      type="primary"
                      loading={loading}
                      disabled={fileList.length === 0}
                      onClick={() => {
                        const file = fileList[0].originFileObj;
                        if (file) customRequest({ file });
                      }}
                      block
                    >
                      部署
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Modal>

            {/* 调度弹窗 */}
            {/* <Modal
              title="服务调度"
              open={dispatchModalOpen}
              onCancel={() => setDispatchModalOpen(false)}
              footer={null}
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleDispatch}
                preserve={false}
              >
                <Form.Item
                  label="服务名称"
                  name="name"
                  rules={[{ required: true, message: "请输入服务名称" }]}
                  initialValue="my-host"
                >
                  <Input disabled/>
                </Form.Item>

                <Form.Item
                  label="主机名称"
                  name="host"
                  rules={[{ required: true, message: "请选择主机" }]}
                >
                  <Select
                    showSearch
                    placeholder="请选择调度本服务的主机"
                    optionFilterProp="label"
                    onChange={onChange}
                    onSearch={onSearch}
                    options={hosts.map(host => ({
                      value: host.key,
                      label: host.name,
                    }))}
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                  <Space>
                    <Button onClick={() => setDispatchModalOpen(false)}>按续调度</Button>
                    <Button type="primary" htmlType="submit">
                      选择调度
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Modal> */}

            {/* 查询服务弹窗 */}
            <Modal
              title={`服务信息 - ${currentVmIp || ""}`}
              open={searchModalOpen}
              onCancel={() => {
                setSearchModalOpen(false);
                setCurrentVmIp("");
                setVmServices([]);
              }}
              footer={null}
            >
              <Spin spinning={loadingServices}>
                <Table
                  rowKey="key"
                  columns={vmServicesColumns}
                  dataSource={vmServices}
                  pagination={{
                    pageSize: 50,
                    showSizeChanger: false,
                  }}
                  size="small"
                />
              </Spin>
            </Modal>

            {/* 资源监控弹窗 */}
            <Modal
              title={`资源信息 - ${selectedHost?.address || ""}`}
              open={resourceModalOpen}
              onCancel={() => {
                setResourceModalOpen(false);
                setSelectedHost(null);
                setMonitorData(null);
              }}
              footer={null}
            >
              <Spin spinning={loadingMonitor}>
                {monitorData ? (
                  <Flex gap="middle" vertical>
                    <Flex vertical gap="small">
                      <div>CPU 使用率: {monitorData.cpuUsage}</div>
                      <Progress
                        percent={parseCpuUsage(monitorData.cpuUsage)}
                        status="active"
                        strokeColor={{ from: "#10e992ff", to: "#600aa6ff" }}
                      />
                    </Flex>
                    <Flex vertical gap="small">
                      <div>内存使用情况: {monitorData.memory}</div>
                      <Progress
                        percent={parseMemoryUsage(monitorData.memory)}
                        status="active"
                        strokeColor={{ from: "#86b2ffff", to: "#600aa6ff" }}
                      />
                    </Flex>
                  </Flex>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "200px",
                    }}
                  >
                    正在加载监控数据
                  </div>
                )}
              </Spin>
            </Modal>
          </div>
        </ConfigProvider>
      </MainLayout>
    </AuthGuard>

  );
}
