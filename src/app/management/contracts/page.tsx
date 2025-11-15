'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Table, Tag, Progress, Alert, Spin, Typography, Space, Divider, Modal, Descriptions, Badge, Tooltip, Timeline, Rate, Switch, Upload, message, Form, Input, Select } from 'antd';
import DeployApp from '@/components/App';
import { FileProtectOutlined, LockOutlined, SafetyCertificateOutlined, CodeOutlined, ReloadOutlined, EyeOutlined, InfoCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, UploadOutlined, PlusOutlined, FileTextOutlined, ApiOutlined, MonitorOutlined } from '@ant-design/icons';
// import ReactECharts from 'echarts-for-react'; // 移除复杂图表组件
import MainLayout from '../../components/layout/MainLayout';
import AuthGuard from '../../components/AuthGuard';

const { Title, Text } = Typography;

// 添加科技感样式
const techStyles = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3); }
    50% { box-shadow: 0 6px 25px rgba(0, 212, 255, 0.5); }
  }
`;

// 样式注入将在组件内部处理

interface PrivacyContract {
  id: string;
  name: string;
  address: string;
  type: 'SGX' | 'ZK' | 'MPC' | 'HE' | 'SGX+SideVM';
  status: 'active' | 'inactive' | 'pending' | 'error';
  deployedAt: number;
  lastUpdate: number;
  gasUsed: number;
  storageUsed: number; // bytes
  privacyLevel: number; // 0-100
  securityScore: number; // 0-100
  executionCount: number;
  owner: string;
  version: string;
  isVerified: boolean;
  codeHash?: string;
  weight?: number;
  sideVM?: any;
  description?: string;
}

interface ContractState {
  contracts: PrivacyContract[];
  totalContracts: number;
  activeContracts: number;
  totalGasUsed: number;
  totalStorageUsed: number;
  averagePrivacyLevel: number;
  lastUpdate: number;
}

const initialContractState: ContractState = {
  contracts: [
    {
      id: 'system-contract',
      name: 'System Contract',
      address: '0x0000000000000000000000000000000000000000000000000000000000000001',
      type: 'SGX',
      status: 'active',
      deployedAt: Date.now() - 86400000,
      lastUpdate: Date.now(),
      gasUsed: 1000000,
      storageUsed: 1024 * 1024,
      privacyLevel: 95,
      securityScore: 98,
      executionCount: 150,
      owner: 'System',
      version: '1.0.0',
      isVerified: true
    },
    {
      id: 'tokenomic-contract',
      name: 'Tokenomic Contract',
      address: '0xd62eac577584da5e0776e63e3bd9c0c8db8b411dc459d3eec903ff80e3b8eebf',
      type: 'SGX',
      status: 'active',
      deployedAt: Date.now() - 3600000, // 1小时前部署
      lastUpdate: Date.now(),
      gasUsed: 500000,
      storageUsed: 42239,
      privacyLevel: 88,
      securityScore: 92,
      executionCount: 0,
      owner: 'User',
      version: '0.1.0',
      isVerified: true
    }
  ],
  totalContracts: 2,
  activeContracts: 2,
  totalGasUsed: 1500000,
  totalStorageUsed: 1067263,
  averagePrivacyLevel: 91.5,
  lastUpdate: Date.now(),
};

export default function ContractsPage() {
  const [contractState, setContractState] = useState<ContractState>(initialContractState);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<PrivacyContract | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm] = Form.useForm();
  const [callingContract, setCallingContract] = useState(false);
  const [contractCallResult, setContractCallResult] = useState<any>(null);
  const [deploymentProgress, setDeploymentProgress] = useState<string>('');
  const [showDeploymentOutput, setShowDeploymentOutput] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('等待操作...');
  const [isTerminalActive, setIsTerminalActive] = useState(false);

  useEffect(() => {
    loadContractState();
    // 移除自动刷新逻辑，避免频繁API调用
  }, []);

  // 注入科技感样式
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const styleSheet = document.createElement('style');
      styleSheet.textContent = techStyles;
      document.head.appendChild(styleSheet);

      // 清理函数
      return () => {
        if (styleSheet.parentNode) {
          styleSheet.parentNode.removeChild(styleSheet);
        }
      };
    }
  }, []);

  const loadContractState = async () => {
    setLoading(true);
    try {
      // 先尝试真实API，如果超时则回退到快速API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      try {
        const response = await fetch('/api/contracts/real', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await response.json();

        if (result.success) {
          setContractState(result.data);
          console.log(`✅ 加载了 ${result.data.contracts.length} 个真实链上合约`);
          return;
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.log('真实API超时，回退到快速API');
        } else {
          console.log('真实API失败，回退到快速API:', error.message);
        }
      }

      // 回退到快速API
      const response = await fetch('/api/contracts/fast?action=status');
      const result = await response.json();

      if (result.success) {
        setContractState(result.data);
        console.log(`✅ 加载了 ${result.data.contracts.length} 个合约 (快速模式)`);
      } else {
        console.error('API returned error:', result.error);
      }
    } catch (error: any) {
      console.error('Failed to load contract state:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadContract = async (values: any) => {
    setUploading(true);
    setIsTerminalActive(true);
    setTerminalOutput('📤 开始上传合约...\n正在处理合约文件...');

    // 立即关闭弹窗，让用户看到终端输出
    setUploadModalVisible(false);
    uploadForm.resetFields();

    try {
      const formData = new FormData();
      formData.append('description', values.description || '');
      if (values.contractFile && values.contractFile.length > 0) {
        formData.append('contractFile', values.contractFile[0].originFileObj);
      }

      setTerminalOutput(prev => prev + '\n📋 合约信息:');
      setTerminalOutput(prev => prev + '\n正在上传到链上...');
      setTerminalOutput(prev => prev + '\n⏳ 这可能需要20-30秒，请耐心等待...');

      const response = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Upload response status:', response.status);
      console.log('Upload response headers:', response.headers);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Upload result:', result);

      if (result.success) {
        setTerminalOutput(prev => prev + '\n✅ 合约上传成功！');
        setTerminalOutput(prev => prev + `\n📋 部署详情:`);
        if (result.data && result.data.contractId) {
          setTerminalOutput(prev => prev + `\n   - 合约ID: ${result.data.contractId}`);
        }
        if (result.data && result.data.address) {
          setTerminalOutput(prev => prev + `\n   - 合约地址: ${result.data.address}`);
        }
        message.success('合约上传成功！');
        loadContractState(); // 刷新合约列表
      } else {
        setTerminalOutput(prev => prev + '\n❌ 上传失败！');
        setTerminalOutput(prev => prev + `\n错误: ${result.error || '未知错误'}`);
        message.error(result.error || '上传失败');
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      setTerminalOutput(prev => prev + '\n❌ 上传失败！');
      setTerminalOutput(prev => prev + `\n错误: ${error.message}`);
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
      setIsTerminalActive(false);
    }
  };

  const deploySystemContract = async () => {
    try {
      setUploading(true);
      setIsTerminalActive(true);
      setTerminalOutput('🚀 开始部署系统合约...\n正在连接区块链节点...');
      setTerminalOutput(prev => prev + '\n⏳ 系统合约部署需要1-2分钟，请耐心等待...');

      const response = await fetch('/api/contracts/deploy-system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setTerminalOutput(prev => prev + '\n✅ 系统合约部署成功！');
        message.success(`系统合约部署成功！`);

        // 显示部署输出
        if (result.output) {
          console.log('部署输出:', result.output);
          setTerminalOutput(prev => prev + '\n\n📋 部署详情:\n' + result.output);
        }

        loadContractState(); // 刷新合约列表
      } else {
        setTerminalOutput(prev => prev + '\n❌ 部署失败！');
        message.error(result.error || '部署失败');
        if (result.error) {
          console.error('部署错误:', result.error);
          setTerminalOutput(prev => prev + '\n错误: ' + result.error);
        }
      }
    } catch (error: any) {
      console.error('Deploy failed:', error);
      setTerminalOutput(prev => prev + '\n❌ 部署失败！');
      setTerminalOutput(prev => prev + `\n错误: ${error.message}`);
      message.error('部署失败，请重试');
    } finally {
      setUploading(false);
      setIsTerminalActive(false);
    }
  };

  // 检测是否为Tokenomic合约的通用函数
  const isTokenomicContract = (contract: PrivacyContract) => {
    // 通过实际调用合约来判断是否支持version方法
    // 这里我们使用一个简化的判断：检查合约地址是否在已知的Tokenomic合约列表中
    // 或者通过合约名称包含特定关键词来判断

    const name = contract.name.toLowerCase();

    // 1. 通过名称判断（包含tokenomic、token、version等关键词）
    const isTokenomicName = name.includes('tokenomic') ||
      name.includes('token') ||
      name.includes('version') ||
      name.includes('test') ||
      name.includes('upload');

    // 2. 通过合约地址判断（排除明显的系统合约地址）
    const isNotSystemContract = !contract.address.includes('0000000000000000000000000000000000000000000000000000000000000001');

    // 3. 通过合约类型判断
    const isSgxContract = contract.type === 'SGX' && contract.status === 'active';

    // 4. 通过合约描述判断
    const isTokenomicDescription = contract.description &&
      (contract.description.toLowerCase().includes('tokenomic') ||
        contract.description.toLowerCase().includes('version') ||
        contract.description.toLowerCase().includes('tee'));

    // 5. 通过合约地址长度判断（Tokenomic合约通常有特定的地址格式）
    const isTokenomicAddress = contract.address.startsWith('0x') &&
      contract.address.length >= 64;

    // 6. 通过合约ID判断（用户上传的合约通常有特定的ID格式）
    const isUserContractId = contract.id &&
      !contract.id.startsWith('contract-0x0d746931e7a6bf'); // 排除系统合约的ID前缀

    // 综合判断：满足多个条件才认为是Tokenomic合约
    const conditions = [
      isTokenomicName,
      isNotSystemContract,
      isSgxContract,
      isTokenomicDescription,
      isTokenomicAddress,
      isUserContractId
    ];

    // 至少满足2个条件才认为是Tokenomic合约
    const satisfiedConditions = conditions.filter(Boolean).length;
    return satisfiedConditions >= 2;
  };

  const callContractMethod = async (method: string, params: any[] = []) => {
    if (!selectedContract) return;

    try {
      setCallingContract(true);
      setContractCallResult(null);
      message.loading(`正在调用合约方法: ${method}...`, 0);

      // 检测是否为系统合约（通过合约ID判断）
      const isSystemContract = selectedContract.address.startsWith('0x') &&
        selectedContract.address.length === 66;

      // 检测是否为tokenomic合约
      const isTokenomic = isTokenomicContract(selectedContract);

      let apiUrl;
      let requestBody;

      if (isSystemContract) {
        // 使用新的系统合约调用API
        apiUrl = '/api/contracts/system-call';
        requestBody = {
          contractId: selectedContract.address,
          method,
          params
        };
      } else if (isTokenomic) {
        // 使用合约调用API
        apiUrl = '/api/contracts/call';
        requestBody = {
          contractAddress: selectedContract.address,
          method,
          params,
          contractName: 'tokenomic-contract'
        };
      } else {
        // 使用通用合约调用API
        apiUrl = '/api/contracts/call';
        requestBody = {
          contractAddress: selectedContract.address,
          method,
          params,
          contractName: isTokenomic ? 'tokenomic-contract' : undefined
        };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      message.destroy();

      if (result.success) {
        message.success(`合约方法 ${method} 调用成功！`);
        setContractCallResult(result.data);

        // 如果是tokenomic合约的version方法，显示特殊格式
        if (isTokenomic && method === 'version' && Array.isArray(result.data.result)) {
          const versionArray = result.data.result;
          setTerminalOutput(prev => prev + `\n✅ Tokenomic合约版本查询成功！`);
          setTerminalOutput(prev => prev + `\n📊 版本信息: ${versionArray.join('.')}`);
          setTerminalOutput(prev => prev + `\n📋 详细结果: [${versionArray.join(', ')}]`);
        } else {
          // 显示通用调用结果
          setTerminalOutput(prev => prev + `\n✅ 合约方法 ${method} 调用成功！`);

          // 优化结果显示
          if (result.data.result) {
            if (Array.isArray(result.data.result)) {
              if (result.data.result.length === 1) {
                setTerminalOutput(prev => prev + `\n📊 返回结果: ${result.data.result[0]}`);
              } else {
                setTerminalOutput(prev => prev + `\n📊 返回结果: [${result.data.result.join(', ')}]`);
              }
            } else {
              setTerminalOutput(prev => prev + `\n📊 返回结果: ${JSON.stringify(result.data.result)}`);
            }
          } else {
            setTerminalOutput(prev => prev + `\n💡 方法调用成功，无返回值（这是正常的）`);
          }
        }
      } else {
        setContractCallResult({ error: result.error || '调用失败' });
        message.error(result.error || '调用失败');
        setTerminalOutput(prev => prev + `\n❌ 合约方法调用失败: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Contract call failed:', error);
      setContractCallResult({ error: error.message });
      message.error('调用失败，请重试');
      setTerminalOutput(prev => prev + `\n❌ 调用失败: ${error.message}`);
      message.destroy();
    } finally {
      setCallingContract(false);
    }
  };

  const downloadSampleContract = () => {
    // 创建下载链接 - 下载真正的.contract文件
    const link = document.createElement('a');
    link.href = '/sample_contracts/tokenomic.contract';
    link.download = 'tokenomic.contract';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success('示例合约下载成功！请使用 tokenomic.contract 文件上传部署。注意：只支持.contract和.wasm文件格式。');
  };


  // 移除复杂的图表配置

  // 移除复杂的图表配置

  const columns = [
    {
      title: '合约名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: PrivacyContract) => (
        <Space>
          <Text strong>{text}</Text>
          {record.isVerified && <Tag color="green" icon={<CheckCircleOutlined />}>已验证</Tag>}
          {isTokenomicContract(record) && (
            <Tag color="blue" icon={<ApiOutlined />} style={{
              background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
              border: 'none',
              color: 'white',
              fontWeight: 'bold'
            }}>
              🚀 可调用
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '合约地址',
      dataIndex: 'address',
      key: 'address',
      render: (text: string) => <Text copyable>{text.substring(0, 12)}...</Text>,
    },
    {
      title: '技术方案',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colors = {
          'SGX': 'blue',
          'ZK': 'purple',
          'MPC': 'orange',
          'HE': 'green',
          'SGX+SideVM': 'cyan'
        };
        return (
          <Tag color={colors[type as keyof typeof colors]}>
            {type === 'SGX+SideVM' ? 'SGX+SideVM' : type}
          </Tag>
        );
      },
    },
    {
      title: '运行状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: PrivacyContract) => {
        const statusMap: { [key: string]: { color: string; text: string } } = {
          'active': { color: 'green', text: '运行中' },
          'inactive': { color: 'orange', text: '已停止' },
          'pending': { color: 'blue', text: '等待中' },
          'error': { color: 'red', text: '错误' }
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status.toUpperCase() };
        return (
          <Space direction="vertical" size="small">
            <Tag color={statusInfo.color}>
              {statusInfo.text}
            </Tag>
            {isTokenomicContract(record) && (
              <Tag color="cyan" style={{ fontSize: '10px' }}>
                🚀 支持调用
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PrivacyContract) => (
        <Button icon={<EyeOutlined />} onClick={() => setSelectedContract(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <AuthGuard>
      <MainLayout>
        <Title level={2} style={{ fontSize: '18pt' }}>隐私智能合约</Title>
        <Text type="secondary">
          基于TEE的区块链隐私合约管理，支持多种隐私保护机制。
        </Text>
        <Divider />

        {/* 顶部统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="链上合约总数"
                value={contractState.totalContracts}
                prefix={<FileProtectOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="活跃合约数量"
                value={contractState.activeContracts}
                prefix={<SafetyCertificateOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="SideVM支持"
                value="侧虚拟机"
                prefix={<LockOutlined />}
                valueStyle={{ color: '#722ed1' }}
                suffix={<Text type="secondary" style={{ fontSize: '12px' }}>扩展</Text>}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Confidential VM"
                value="机密虚拟机"
                prefix={<CodeOutlined />}
                valueStyle={{ color: '#fa8c16' }}
                suffix={<Text type="secondary" style={{ fontSize: '12px' }}>隔离</Text>}
              />
            </Card>
          </Col>
        </Row>

        {/* 操作按钮和控制面板 */}
        <Card style={{ marginBottom: '24px' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button type="primary" icon={<ReloadOutlined />} onClick={loadContractState} loading={loading}>刷新状态</Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setUploadModalVisible(true)}
                  style={{ background: '#1890ff', borderColor: '#1890ff' }}
                >
                  上传合约
                </Button>
                <Button
                  icon={<MonitorOutlined />}
                  onClick={() => window.open('http://43.132.154.142:9876/privacy_demo.html', '_blank')}
                  style={{ background: '#722ed1', borderColor: '#722ed1', color: 'white' }}
                >
                  国产TEE隐私合约
                </Button>
              </Space>
            </Col>
            <Col>
              <Space>
                <Text>自动刷新:</Text>
                <Switch checked={autoRefresh} onChange={setAutoRefresh} checkedChildren="开启" unCheckedChildren="关闭" />
              </Space>
            </Col>
          </Row>
        </Card>


        {/* 终端输出区域 */}
        <Card style={{ marginBottom: '24px' }}>
          <Title level={4}>
            终端输出
            {isTerminalActive && <Badge status="processing" text="运行中" />}
          </Title>
          <pre style={{
            background: '#000000',
            color: '#00ff00',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '13px',
            maxHeight: '400px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'Monaco, Consolas, "Courier New", monospace',
            border: '1px solid #333',
            lineHeight: '1.4'
          }}>
            {terminalOutput}
          </pre>
          <div style={{ marginTop: '8px' }}>
            <Button
              type="link"
              onClick={() => setTerminalOutput('等待操作...')}
              size="small"
            >
              清空终端
            </Button>
            <Button
              type="link"
              onClick={() => setTerminalOutput(prev => prev + '\n' + new Date().toLocaleTimeString() + ' - 手动刷新')}
              size="small"
            >
              添加时间戳
            </Button>
          </div>
        </Card>

        {/* 部署工具弹窗 */}
        <Modal
          title="部署工具"
          open={deployModalVisible}
          onCancel={() => setDeployModalVisible(false)}
          footer={null}
          width={760}
        >
          <DeployApp embedded />
        </Modal>

        {/* 合约列表 */}
        <Card title="隐私合约列表" extra={
          <Badge count={contractState.totalContracts} showZero>
            <Text>合约总数</Text>
          </Badge>
        }>
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={contractState.contracts}
              rowKey="address"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1000 }}
            />
          </Spin>
        </Card>

        {/* 合约详情Modal */}
        <Modal
          title="合约详情"
          open={selectedContract !== null}
          onCancel={() => setSelectedContract(null)}
          footer={null}
          width={800}
          style={{ maxHeight: '95vh' }}
          styles={{ body: { maxHeight: '85vh', overflowY: 'auto' } }}
        >
          {selectedContract && (
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="合约名称">{selectedContract.name}</Descriptions.Item>
              <Descriptions.Item label="合约地址">{selectedContract.address}</Descriptions.Item>
              <Descriptions.Item label="技术方案">
                <Tag color={selectedContract.type === 'SGX' ? 'blue' : selectedContract.type === 'ZK' ? 'purple' : selectedContract.type === 'MPC' ? 'orange' : selectedContract.type === 'SGX+SideVM' ? 'cyan' : 'green'}>
                  {selectedContract.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedContract.status === 'active' ? 'green' : selectedContract.status === 'inactive' ? 'orange' : selectedContract.status === 'pending' ? 'blue' : 'red'}>
                  {selectedContract.status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Gas消耗">{(selectedContract.gasUsed || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="存储使用">{(selectedContract.storageUsed || 0).toLocaleString()} bytes</Descriptions.Item>
              <Descriptions.Item label="运行状态">
                <Tag color={selectedContract.status === 'active' ? 'green' : selectedContract.status === 'inactive' ? 'orange' : selectedContract.status === 'pending' ? 'blue' : 'red'}>
                  {selectedContract.status === 'active' ? '运行中' :
                    selectedContract.status === 'inactive' ? '已停止' :
                      selectedContract.status === 'pending' ? '等待中' : '错误'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="安全评分">
                <Rate disabled defaultValue={(selectedContract.securityScore || 0) / 20} count={5} />
              </Descriptions.Item>
              <Descriptions.Item label="合约所有者">{selectedContract.owner}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedContract.version}</Descriptions.Item>
              <Descriptions.Item label="验证状态">
                <Tag color={selectedContract.isVerified ? 'green' : 'red'} icon={selectedContract.isVerified ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                  {selectedContract.isVerified ? '已验证' : '未验证'}
                </Tag>
              </Descriptions.Item>
              {selectedContract.codeHash && (
                <Descriptions.Item label="代码哈希">
                  <Text copyable style={{ fontFamily: 'monospace' }}>
                    {selectedContract.codeHash.substring(0, 16)}...
                  </Text>
                </Descriptions.Item>
              )}
              {selectedContract.weight !== undefined && (
                <Descriptions.Item label="权重">
                  {selectedContract.weight}
                </Descriptions.Item>
              )}
              {selectedContract.description && (
                <Descriptions.Item label="描述">
                  {selectedContract.description}
                </Descriptions.Item>
              )}
              {selectedContract.sideVM && (
                <Descriptions.Item label="SideVM状态">
                  <Tag color={selectedContract.sideVM.state === 'running' ? 'green' : 'orange'}>
                    {selectedContract.sideVM.state === 'running' ? '运行中' : selectedContract.sideVM.state}
                  </Tag>
                  {selectedContract.sideVM.state === 'running' && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        启动时间: {new Date(selectedContract.sideVM.start_time).toLocaleString()}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        最大内存: {selectedContract.sideVM.max_memory_pages} 页
                      </Text>
                    </div>
                  )}
                </Descriptions.Item>
              )}
            </Descriptions>
          )}

          {/* 合约调用功能 */}
          {selectedContract && selectedContract.status === 'active' && (
            <div style={{
              marginTop: 20,
              padding: 20,
              background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
              borderRadius: 12,
              border: '1px solid #30363d',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* 科技感背景装饰 */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, #00d4ff, #0099ff, #00d4ff)',
                animation: 'pulse 2s ease-in-out infinite'
              }} />
              <Title level={4} style={{ color: '#f0f6fc', textShadow: '0 0 10px rgba(0, 212, 255, 0.3)' }}>
                🚀 合约调用
                {isTokenomicContract(selectedContract) && (
                  <Tag color="blue" style={{ marginLeft: 8, background: 'rgba(0, 212, 255, 0.2)', borderColor: '#00d4ff', color: '#00d4ff' }}>Tokenomic Contract</Tag>
                )}
              </Title>

              {/* Tokenomic合约特殊说明 */}
              {isTokenomicContract(selectedContract) && (
                <Alert
                  message="Tokenomic合约已部署"
                  description="此合约支持version方法调用，返回版本信息。"
                  type="info"
                  showIcon
                  style={{
                    marginBottom: 16,
                    background: 'rgba(0, 212, 255, 0.1)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '8px'
                  }}
                  action={
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => callContractMethod('version', [])}
                      loading={callingContract}
                      style={{
                        background: 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)',
                        borderColor: '#00d4ff',
                        boxShadow: '0 2px 8px rgba(0, 212, 255, 0.3)',
                        border: 'none',
                        fontWeight: 'bold'
                      }}
                    >
                      调用version方法
                    </Button>
                  }
                />
              )}

              {/* 其他系统合约说明 */}
              {!isTokenomicContract(selectedContract) && (
                <Alert
                  message="系统合约"
                  description="此合约是系统合约，可能不支持直接方法调用。建议使用Tokenomic合约进行测试。"
                  type="warning"
                  showIcon
                  style={{
                    marginBottom: 16,
                    background: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid rgba(255, 193, 7, 0.3)',
                    borderRadius: '8px'
                  }}
                />
              )}

              {/* 只有已部署的合约才显示查询功能 */}
              {selectedContract.status === 'active' ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Input
                      placeholder="方法名 (如: version)"
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '6px',
                        color: '#f0f6fc'
                      }}
                      id="methodInput"
                      defaultValue={selectedContract.address === '0xd1addfb72bb05b60ab0152303eaddf4a47565fff525a62371e6e5df7e31432ea' ? 'version' : ''}
                    />
                    <Input
                      placeholder="参数 (JSON格式，可选)"
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '6px',
                        color: '#f0f6fc'
                      }}
                      id="paramsInput"
                    />
                    <Button
                      type="primary"
                      onClick={() => {
                        const methodInput = document.getElementById('methodInput') as HTMLInputElement;
                        const paramsInput = document.getElementById('paramsInput') as HTMLInputElement;
                        const method = methodInput.value.trim();
                        let params = [];
                        try {
                          params = paramsInput.value.trim() ? JSON.parse(paramsInput.value) : [];
                        } catch (e) {
                          message.error('参数格式错误，请使用JSON格式');
                          return;
                        }
                        if (method) {
                          callContractMethod(method, params);
                        } else {
                          message.error('请输入方法名');
                        }
                      }}
                      loading={callingContract}
                      style={{
                        background: 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)',
                        borderColor: '#00d4ff',
                        boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)',
                        border: 'none',
                        fontWeight: 'bold',
                        textShadow: '0 0 5px rgba(0, 212, 255, 0.5)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #00b8e6 0%, #0088cc 100%)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 212, 255, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)';
                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.3)';
                      }}
                    >
                      调用方法
                    </Button>
                  </div>
                </Space>
              ) : (
                <Alert
                  message="合约未部署"
                  description={`此合约状态为 "${selectedContract.status}"，需要先部署到链上才能进行查询操作。`}
                  type="warning"
                  showIcon
                  style={{
                    marginBottom: 16,
                    background: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid rgba(255, 193, 7, 0.3)',
                    borderRadius: '8px'
                  }}
                />
              )}

              {/* 快速按钮只在已部署合约中显示 */}
              {selectedContract.status === 'active' && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    onClick={() => {
                      const methodInput = document.getElementById('methodInput') as HTMLInputElement;
                      const paramsInput = document.getElementById('paramsInput') as HTMLInputElement;
                      methodInput.value = 'version';
                      paramsInput.value = '[]';
                    }}
                    style={{
                      background: 'rgba(0, 212, 255, 0.1)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      color: '#00d4ff',
                      borderRadius: '6px'
                    }}
                  >
                    快速: version
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      const methodInput = document.getElementById('methodInput') as HTMLInputElement;
                      const paramsInput = document.getElementById('paramsInput') as HTMLInputElement;
                      methodInput.value = 'getVersion';
                      paramsInput.value = '[]';
                    }}
                    style={{
                      background: 'rgba(0, 212, 255, 0.1)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      color: '#00d4ff',
                      borderRadius: '6px'
                    }}
                  >
                    快速: getVersion
                  </Button>
                </div>
              )}

              {contractCallResult && (
                <div style={{
                  marginTop: 16,
                  padding: 16,
                  background: '#0d1117',
                  borderRadius: 8,
                  border: '1px solid #30363d',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                }}>
                  <Text strong style={{
                    color: '#58a6ff',
                    fontSize: '14px',
                    marginBottom: '12px',
                    display: 'block'
                  }}>
                    📋 调用结果
                  </Text>

                  <div style={{
                    background: '#161b22',
                    borderRadius: 6,
                    border: '1px solid #21262d',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      background: '#21262d',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: '#8b949e',
                      fontWeight: '500',
                      borderBottom: '1px solid #30363d'
                    }}>
                      📊 调用结果
                    </div>
                    <div style={{
                      padding: 12,
                      fontSize: '13px',
                      color: '#f0f6fc',
                      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                      lineHeight: '1.5',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}>
                      {(() => {
                        // 优化显示格式 - 添加更多描述信息
                        const result = contractCallResult;
                        if (!result) return '';

                        let displayText = '';

                        // 显示调用结果（最重要的信息）
                        if (result.result) {
                          if (Array.isArray(result.result)) {
                            // 如果是数组，添加描述信息
                            if (result.result.length === 1) {
                              displayText += `📊 调用结果: ${result.result[0]}\n`;
                              displayText += `💡 说明: 方法返回单个值`;
                            } else {
                              displayText += `📊 调用结果: [${result.result.join(', ')}]\n`;
                              displayText += `💡 说明: 方法返回数组，包含 ${result.result.length} 个元素`;

                              // 如果是版本号数组，添加特殊说明
                              if (result.result.length === 3 && result.result.every(v => typeof v === 'number')) {
                                displayText += `🔢 版本信息: ${result.result.join('.')} (主版本.次版本.修订版本)\n`;
                                displayText += `📋 详细说明: 这是合约的版本号，格式为 [主版本, 次版本, 修订版本]`;
                              }
                            }
                          } else if (typeof result.result === 'string') {
                            displayText += `📊 调用结果: "${result.result}"\n`;
                            displayText += `💡 说明: 方法返回字符串值`;
                          } else {
                            displayText += `📊 调用结果: ${JSON.stringify(result.result)}\n`;
                            displayText += `💡 说明: 方法返回复杂对象`;
                          }
                        }

                        // 如果有错误，显示错误信息
                        if (result.error) {
                          displayText += `❌ 错误: ${result.error}\n`;
                          displayText += `💡 说明: 合约调用失败，请检查方法名和参数`;
                        }

                        // 如果没有结果也没有错误，显示简洁提示
                        if (!result.result && !result.error) {
                          displayText += `✅ 调用成功（无返回值）\n`;
                          displayText += `💡 说明: 该方法执行成功但没有返回数据，这是正常的`;
                        }

                        return displayText;
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>


        {/* 上传合约Modal */}
        <Modal
          title="上传隐私智能合约"
          open={uploadModalVisible}
          onCancel={() => {
            setUploadModalVisible(false);
            uploadForm.resetFields();
          }}
          footer={null}
          width={600}
        >
          <Form
            form={uploadForm}
            layout="vertical"
            onFinish={handleUploadContract}
          >


            <Form.Item
              label="合约描述"
              name="description"
            >
              <Input.TextArea
                placeholder="请输入合约描述（可选）"
                rows={3}
              />
            </Form.Item>

            <Form.Item
              label="合约文件"
              name="contractFile"
              rules={[{ required: true, message: '请上传合约文件' }]}
              valuePropName="fileList"
              getValueFromEvent={(e) => {
                if (Array.isArray(e)) {
                  return e;
                }
                return e && e.fileList;
              }}
            >
              <Upload.Dragger
                name="contractFile"
                multiple={false}
                accept=".sol,.wasm,.contract"
                beforeUpload={() => false} // 阻止自动上传
                listType="text"
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                  支持 .sol, .wasm, .contract 格式文件
                </p>
              </Upload.Dragger>
            </Form.Item>

            <Alert
              message="上传说明"
              description="请确保您的合约文件符合隐私保护要求，系统将自动进行安全验证和隐私等级评估。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item>
              <Space wrap>
                <Button type="primary" htmlType="submit" loading={uploading}>
                  上传合约
                </Button>
                <Button
                  icon={<FileTextOutlined />}
                  onClick={downloadSampleContract}
                >
                  下载示例合约
                </Button>
                <Button
                  icon={<SafetyCertificateOutlined />}
                  onClick={deploySystemContract}
                  loading={uploading}
                  style={{ background: '#1890ff', borderColor: '#1890ff' }}
                >
                  部署系统合约
                </Button>
                <Button onClick={() => {
                  setUploadModalVisible(false);
                  uploadForm.resetFields();
                }}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </MainLayout>
    </AuthGuard>
  );
}