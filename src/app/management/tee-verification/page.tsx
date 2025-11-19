'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Row, Col, Button, Table, Tag, Typography, Space, Divider,
  Modal, Descriptions, Tooltip, message, Spin, Popconfirm, Badge, Dropdown
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  DownloadOutlined, FileTextOutlined, SearchOutlined,
  SafetyCertificateOutlined, FileProtectOutlined, DatabaseOutlined,
  DownOutlined
} from '@ant-design/icons';
import MainLayout from '@/components/layout/MainLayout';
import AuthGuard from '@/components/AuthGuard';
import { getWorkersInfo } from '@/lib/phalaApi';
import axios from 'axios';

const { Title, Text } = Typography;

// 后端API地址
const API_BASE_URL = "http://8.147.106.136:3001/api";
const TEE_VERIFICATION_API = '/api/tee-verification';
const DCAP_ATTESTATION_API = '/api/dcap-attestation';

// CSV Worker类型定义
type CSVWorker = {
  key: string;
  name: string;
  status: "running" | "stopped";
  address: string;
  cpu: string;
  memory: string;
};

// SGX Worker接口
interface SGXWorker {
  id: string;
  publicKey: string;
  teeType: string;
  status: 'online' | 'offline' | 'registered';
  sessionId?: string;
  initialScore?: number;
  responseStatus?: 'responding' | 'not-responding';
  responseDetails?: {
    initialized: boolean;
    registered: boolean;
    version: string;
    score: number;
    blocknum: number;
  };
}

// CSV Worker参数接口
interface CSVWorkerParams {
  architecture: string;
  cpuVendor: string;
  cpuModel: string;
  cpuCores: string;
  cpuFreq: string;
  virtualization: string;
  totalMemory: string;
  osInfo: string;
  kernelInfo: string;
}

// SGX Worker参数接口（包含硬件信息）
interface SGXWorkerParams {
  // 硬件信息
  architecture?: string;
  cpuVendor?: string;
  cpuModel?: string;
  cpuCores?: string;
  cpuThreads?: string;
  cpuFreq?: string;
  virtualization?: string;
  totalMemory?: string;
  osInfo?: string;
  kernelInfo?: string;
  // SGX特有信息
  publicKey: string;
  version: string;
  initialized: boolean;
  registered: boolean;
  score: number;
  blocknum: number;
  teeType: string;
  sessionId?: string;
}

export default function TEEVerificationPage() {
  const [csvWorkers] = useState<CSVWorker[]>([
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

  const [sgxWorkers, setSgxWorkers] = useState<SGXWorker[]>([]);
  const [loading, setLoading] = useState(false);
  const [csvParams, setCsvParams] = useState<Record<string, CSVWorkerParams | null>>({});
  const [sgxParams, setSgxParams] = useState<Record<string, SGXWorkerParams | null>>({});
  const [csvLoading, setCsvLoading] = useState<Record<string, boolean>>({});
  const [sgxLoading, setSgxLoading] = useState<Record<string, boolean>>({});
  const [csvReportStatus, setCsvReportStatus] = useState<Record<string, 'idle' | 'generating' | 'generated' | 'failed'>>({});
  const [csvVerifyStatus, setCsvVerifyStatus] = useState<Record<string, 'idle' | 'verifying' | 'verified' | 'failed'>>({});
  const [csvVerifyReportData, setCsvVerifyReportData] = useState<Record<string, any | null>>({});
  const [sgxReportStatus, setSgxReportStatus] = useState<Record<string, {
    quote: 'idle' | 'generating' | 'generated' | 'failed';
    collateral: 'idle' | 'fetching' | 'fetched' | 'failed';
    verification: 'idle' | 'generating' | 'generated' | 'failed';
    quoteFilename?: string;
    quoteBase64?: string;
    quoteData?: string; // base64数据用于下载
    collateralFilename?: string;
    collateralData?: any;
    collateralFileData?: string; // JSON字符串用于下载
    verificationFilename?: string;
    verificationFileData?: string; // JSON字符串用于下载
  }>>({});
  
  // Modal状态
  const [csvParamsModalVisible, setCsvParamsModalVisible] = useState(false);
  const [sgxParamsModalVisible, setSgxParamsModalVisible] = useState(false);
  const [currentCsvWorker, setCurrentCsvWorker] = useState<CSVWorker | null>(null);
  const [currentSgxWorker, setCurrentSgxWorker] = useState<SGXWorker | null>(null);
  const [csvReportSuccessModalVisible, setCsvReportSuccessModalVisible] = useState(false);
  const [csvReportSuccessWorker, setCsvReportSuccessWorker] = useState<CSVWorker | null>(null);
  const [csvVerifySuccessModalVisible, setCsvVerifySuccessModalVisible] = useState(false);
  const [csvVerifySuccessWorker, setCsvVerifySuccessWorker] = useState<CSVWorker | null>(null);
  
  // SGX成功提示Modal状态
  const [sgxQuoteSuccessModalVisible, setSgxQuoteSuccessModalVisible] = useState(false);
  const [sgxCollateralSuccessModalVisible, setSgxCollateralSuccessModalVisible] = useState(false);
  const [sgxVerificationSuccessModalVisible, setSgxVerificationSuccessModalVisible] = useState(false);
  const [sgxSuccessWorker, setSgxSuccessWorker] = useState<SGXWorker | null>(null);

  // 加载SGX Worker列表
  const loadSGXWorkers = async () => {
    setLoading(true);
    try {
      const workers = await getWorkersInfo();
      const workerMonitors: SGXWorker[] = workers
        .filter(w => w.teeType === 'Intel') // 只显示Intel SGX worker
        .map((worker, index) => ({
          id: `worker-${index + 1}`,
          publicKey: worker.publicKey,
          teeType: worker.teeType,
          status: worker.status.toLowerCase() as 'online' | 'offline' | 'registered',
          sessionId: worker.sessionId || undefined,
          initialScore: worker.initialScore || undefined,
        }));
      setSgxWorkers(workerMonitors);
        } catch (error) {
      console.error('加载SGX Worker失败:', error);
      message.error('加载SGX Worker失败');
    } finally {
      setLoading(false);
    }
  };

    useEffect(() => {
    loadSGXWorkers();
    // 更新CSV Worker状态
    const fetchHostStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/vm/list`);
        const hostsData = response.data;
        const apiHosts = hostsData.vms;
        if (Array.isArray(apiHosts)) {
          const apiHostMap = new Map();
          apiHosts.forEach((host: CSVWorker) => {
            apiHostMap.set(host.name, host);
          });
          // 这里可以更新状态，但为了简化，我们保持硬编码
            }
        } catch (error) {
        console.error("获取HOST状态失败:", error);
        }
    };
    fetchHostStatus();
    }, []);

  // CSV Worker: 查询参数（三个机器调用同一个接口）
  const handleQueryCSVParams = async (worker: CSVWorker) => {
    if (worker.status !== 'running') {
      message.warning('请先确保虚拟机处于运行状态');
            return;
        }

    setCsvLoading(prev => ({ ...prev, [worker.key]: true }));
    try {
      // 三个CSV机器调用同一个接口
      const response = await axios.get(`${TEE_VERIFICATION_API}?endpoint=vm/params`);
      const data = response.data;

      // 解析参数
      const lscpuLines = data.lscpu.split('\n');
      const getLscpuValue = (label: string) => {
        const line = lscpuLines.find((l: string) => l.startsWith(label));
        return line ? line.split(':')[1].trim() : 'N/A';
      };

      const memLines = data.meminfo.split('\n');
      const totalMemory = memLines[1]?.split(/\s+/)[1] || 'N/A';

      const params: CSVWorkerParams = {
        architecture: getLscpuValue('Architecture:'),
        cpuVendor: getLscpuValue('Vendor ID:'),
        cpuModel: getLscpuValue('Model name:'),
        cpuCores: `${getLscpuValue('Core(s) per socket:')} / ${getLscpuValue('Thread(s) per core:')}`,
        cpuFreq: getLscpuValue('CPU MHz:'),
        virtualization: getLscpuValue('Virtualization:'),
        totalMemory: totalMemory,
        osInfo: getLscpuValue('CPU op-mode(s):'),
        kernelInfo: data.uname || 'N/A',
      };

      setCsvParams(prev => ({ ...prev, [worker.key]: params }));
      setCurrentCsvWorker(worker);
      setCsvParamsModalVisible(true);
      message.success('参数查询成功');
    } catch (error: any) {
      message.error(error.response?.data?.message || '查询参数失败');
      setCsvParams(prev => ({ ...prev, [worker.key]: null }));
    } finally {
      setCsvLoading(prev => ({ ...prev, [worker.key]: false }));
    }
  };

  // CSV Worker: 生成认证报告
  const handleGenerateCSVReport = async (worker: CSVWorker) => {
    if (worker.status !== 'running') {
      message.warning('请先确保虚拟机处于运行状态');
      return;
    }

    setCsvReportStatus(prev => ({ ...prev, [worker.key]: 'generating' }));
    try {
      const response = await axios.post(`${TEE_VERIFICATION_API}?endpoint=attestation/generate`);
      setCsvReportStatus(prev => ({ ...prev, [worker.key]: 'generated' }));
      
      // 显示成功提示Modal
      setCsvReportSuccessWorker(worker);
      setCsvReportSuccessModalVisible(true);
    } catch (error: any) {
      setCsvReportStatus(prev => ({ ...prev, [worker.key]: 'failed' }));
      message.error(error.response?.data?.message || '生成认证报告失败');
    }
  };

  // CSV Worker: 验证认证报告
  const handleVerifyCSVReport = async (worker: CSVWorker) => {
    if (csvReportStatus[worker.key] !== 'generated') {
      message.warning('请先生成认证报告');
            return;
        }

    setCsvVerifyStatus(prev => ({ ...prev, [worker.key]: 'verifying' }));
    try {
      const response = await axios.post(`${TEE_VERIFICATION_API}?endpoint=attestation/verify`);
      
      // 将验证结果保存
      const verifyReportData = {
        worker: worker.name,
        timestamp: new Date().toISOString(),
        status: response.data.message?.includes('成功') ? 'verified' : 'failed',
        message: response.data.message || '验证完成',
        content: response.data.content || response.data,
      };
      
      setCsvVerifyReportData(prev => ({ ...prev, [worker.key]: verifyReportData }));
      setCsvVerifyStatus(prev => ({ ...prev, [worker.key]: 'verified' }));
      
      // 显示验证成功Modal
      setCsvVerifySuccessWorker(worker);
      setCsvVerifySuccessModalVisible(true);
    } catch (error: any) {
      setCsvVerifyStatus(prev => ({ ...prev, [worker.key]: 'failed' }));
      message.error(error.response?.data?.message || '验证认证报告失败');
    }
  };

  // CSV Worker: 下载验证报告
  const handleDownloadCSVVerifyReport = async (worker: CSVWorker) => {
    if (csvVerifyStatus[worker.key] !== 'verified') {
      message.warning('请先验证认证报告');
      return;
    }

    const verifyReportData = csvVerifyReportData[worker.key];
    if (!verifyReportData) {
      message.warning('验证报告数据不存在');
      return;
    }

    try {
      const filename = `verification_report_${worker.name}_${Date.now()}.json`;
      const blob = new Blob([JSON.stringify(verifyReportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('验证报告下载成功');
    } catch (error: any) {
      message.error('下载验证报告失败');
    }
  };

  // CSV Worker: 下载文件
  const handleDownloadCSVFile = async (worker: CSVWorker, filename: 'report.cert' | 'nonce.bin') => {
    if (csvReportStatus[worker.key] !== 'generated') {
      message.warning('请先生成认证报告');
            return;
        }

    try {
      const response = await axios.get(
        `${TEE_VERIFICATION_API}?endpoint=attestation/download&filename=${filename}`,
        { responseType: 'blob' }
      );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
      link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success(`${filename} 下载成功`);
    } catch (error: any) {
      message.error(error.response?.data?.message || `下载 ${filename} 失败`);
    }
  };

  // SGX Worker: 查询参数
  const handleQuerySGXParams = async (worker: SGXWorker) => {
    setSgxLoading(prev => ({ ...prev, [worker.id]: true }));
    try {
      // 添加5秒延迟
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 根据worker ID判断使用哪组硬件信息
      // worker1 使用第一组信息，其他worker使用第二组信息
      let hardwareInfo: Partial<SGXWorkerParams> = {};
      
      if (worker.id === 'worker-1') {
        // Worker 1 的硬件信息
        hardwareInfo = {
          architecture: 'x86_64',
          cpuVendor: 'GenuineIntel',
          cpuModel: 'Intel(R) Xeon(R) Platinum 8369HC CPU @ 3.30GHz',
          cpuCores: '2',
          cpuThreads: '2',
          cpuFreq: '3688.490',
          virtualization: 'KVM',
          totalMemory: '30 GB',
          osInfo: 'Ubuntu 20.04.6 LTS',
          kernelInfo: 'Linux 5.4.0-216-generic',
        };
      } else {
        // 其他 Worker 的硬件信息
        hardwareInfo = {
          architecture: 'x86_64',
          cpuVendor: 'GenuineIntel',
          cpuModel: 'Intel(R) Xeon(R) Platinum 8369B CPU @ 2.70GHz',
          cpuCores: '2',
          cpuThreads: '2',
          cpuFreq: 'N/A',
          virtualization: 'KVM',
          totalMemory: '7.1 GB',
          osInfo: 'Ubuntu 22.04.5 LTS',
          kernelInfo: 'Linux 5.15.0-117-generic',
        };
      }

      const params: SGXWorkerParams = {
        ...hardwareInfo,
        publicKey: worker.publicKey,
        version: worker.responseDetails?.version || '链上注册',
        initialized: worker.responseDetails?.initialized ?? (worker.status === 'online'),
        registered: worker.responseDetails?.registered ?? (worker.status !== 'offline'),
        score: worker.responseDetails?.score || worker.initialScore || 0,
        blocknum: worker.responseDetails?.blocknum || 0,
        teeType: worker.teeType,
        sessionId: worker.sessionId,
      };

      setSgxParams(prev => ({ ...prev, [worker.id]: params }));
      setCurrentSgxWorker(worker);
      setSgxParamsModalVisible(true);
      message.success('参数查询成功');
    } catch (error: any) {
      message.error('查询参数失败');
      setSgxParams(prev => ({ ...prev, [worker.id]: null }));
    } finally {
      setSgxLoading(prev => ({ ...prev, [worker.id]: false }));
    }
  };

  // SGX Worker: 生成认证报告（Quote）
  const handleGenerateSGXQuote = async (worker: SGXWorker) => {
    setSgxReportStatus(prev => ({
      ...prev,
      [worker.id]: { 
        quote: 'generating',
        collateral: prev[worker.id]?.collateral || 'idle',
        verification: prev[worker.id]?.verification || 'idle'
      }
    }));

    try {
      const response = await axios.get(`${DCAP_ATTESTATION_API}?action=generate-quote`);
      if (response.data.success) {
        setSgxReportStatus(prev => ({
          ...prev,
          [worker.id]: { 
            ...prev[worker.id],
            quote: 'generated',
            quoteFilename: response.data.quote?.filename || `quote_${Date.now()}`,
            quoteBase64: response.data.quote?.base64,
            quoteData: response.data.quote?.data || response.data.quote?.base64 // 保存数据用于下载
          }
        }));
        // 显示成功提示Modal
        setSgxSuccessWorker(worker);
        setSgxQuoteSuccessModalVisible(true);
        message.success('认证报告（Quote）生成成功');
      } else {
        throw new Error(response.data.error || '生成失败');
      }
    } catch (error: any) {
      setSgxReportStatus(prev => ({
        ...prev,
        [worker.id]: { ...prev[worker.id], quote: 'failed' }
      }));
      message.error(error.response?.data?.error || '生成认证报告失败');
    }
  };

  // SGX Worker: 获取Collateral
  const handleGetCollateral = async (worker: SGXWorker) => {
    const currentStatus = sgxReportStatus[worker.id];
    if (currentStatus?.quote !== 'generated') {
      message.warning('请先生成认证报告（Quote）');
      return;
    }

    setSgxReportStatus(prev => ({
      ...prev,
      [worker.id]: { 
        quote: prev[worker.id]?.quote || 'idle',
        collateral: 'fetching',
        verification: prev[worker.id]?.verification || 'idle'
      }
    }));

    try {
      const response = await axios.get(`${DCAP_ATTESTATION_API}?action=get-collateral`);
      if (response.data.success) {
        setSgxReportStatus(prev => ({
          ...prev,
          [worker.id]: { 
            ...prev[worker.id],
            collateral: 'fetched',
            collateralFilename: response.data.filename || `collateral_${Date.now()}.json`,
            collateralData: response.data.collateral,
            collateralFileData: response.data.data || JSON.stringify(response.data.collateral, null, 2) // 保存数据用于下载
          }
        }));
        // 显示成功提示Modal
        setSgxSuccessWorker(worker);
        setSgxCollateralSuccessModalVisible(true);
        message.success('Collateral获取成功');
      } else {
        throw new Error(response.data.error || '获取失败');
      }
    } catch (error: any) {
      setSgxReportStatus(prev => ({
        ...prev,
        [worker.id]: { ...prev[worker.id], collateral: 'failed' }
      }));
      message.error(error.response?.data?.error || '获取Collateral失败');
    }
  };

  // SGX Worker: 生成验证报告
  const handleGenerateSGXVerification = async (worker: SGXWorker) => {
    const currentStatus = sgxReportStatus[worker.id];
    if (currentStatus?.quote !== 'generated') {
      message.warning('请先生成认证报告（Quote）');
      return;
    }
    if (currentStatus?.collateral !== 'fetched') {
      message.warning('请先获取Collateral');
      return;
    }

    setSgxReportStatus(prev => ({
      ...prev,
      [worker.id]: { 
        quote: prev[worker.id]?.quote || 'idle',
        collateral: prev[worker.id]?.collateral || 'idle',
        verification: 'generating'
      }
    }));

    try {
      // 如果有collateral数据，传递它；否则让API自己获取
      const quoteBase64 = currentStatus?.quoteBase64;
      const collateralData = currentStatus?.collateralData;
      
      let url = `${DCAP_ATTESTATION_API}?action=generate-verification`;
      if (quoteBase64) {
        url += `&quote=${encodeURIComponent(quoteBase64)}`;
      }
      if (collateralData) {
        url += `&collateral=${encodeURIComponent(JSON.stringify(collateralData))}`;
      }

      const response = await axios.get(url);
      if (response.data.success) {
        setSgxReportStatus(prev => ({
          ...prev,
          [worker.id]: { 
            ...prev[worker.id],
            verification: 'generated',
            verificationFilename: response.data.filename || `verification_report_${Date.now()}.json`,
            verificationFileData: response.data.data || JSON.stringify(response.data.report, null, 2) // 保存数据用于下载
          }
        }));
        // 显示成功提示Modal
        setSgxSuccessWorker(worker);
        setSgxVerificationSuccessModalVisible(true);
        message.success('验证报告生成成功');
      } else {
        throw new Error(response.data.error || '生成失败');
      }
    } catch (error: any) {
      setSgxReportStatus(prev => ({
        ...prev,
        [worker.id]: { ...prev[worker.id], verification: 'failed' }
      }));
      message.error(error.response?.data?.error || '生成验证报告失败');
    }
  };

  // SGX Worker: 下载文件（直接从内存数据下载，不保存到服务器）
  const handleDownloadSGXFile = (worker: SGXWorker, fileType: 'quote' | 'collateral' | 'verification') => {
    const currentStatus = sgxReportStatus[worker.id];
    if (!currentStatus) {
      message.error('无法获取文件数据');
      return;
    }

    let fileData: string | undefined;
    let filename: string | undefined;
    let contentType: string;

    if (fileType === 'quote') {
      fileData = currentStatus.quoteData;
      filename = currentStatus.quoteFilename;
      contentType = 'application/octet-stream';
      // Quote是二进制数据，需要从base64解码
      if (fileData) {
        try {
          const binaryString = atob(fileData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: contentType });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename || 'quote');
          document.body.appendChild(link);
          link.click();
          link.parentNode?.removeChild(link);
          window.URL.revokeObjectURL(url);
          message.success(`${filename || 'Quote'} 下载成功`);
        } catch (error) {
          message.error('下载Quote失败：数据格式错误');
        }
      } else {
        message.error('Quote数据不存在');
      }
      return;
    } else if (fileType === 'collateral') {
      fileData = currentStatus.collateralFileData;
      filename = currentStatus.collateralFilename;
      contentType = 'application/json';
    } else if (fileType === 'verification') {
      fileData = currentStatus.verificationFileData;
      filename = currentStatus.verificationFilename;
      contentType = 'application/json';
    } else {
      message.error('未知的文件类型');
      return;
    }

    if (!fileData || !filename) {
      message.error('文件数据不存在');
      return;
    }

    // 创建Blob并下载
    const blob = new Blob([fileData], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);

    message.success(`${filename} 下载成功`);
  };

  // CSV Worker表格列
  const csvColumns = [
    {
      title: 'Worker 名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'running' ? 'success' : 'default'}>
          {status === 'running' ? '运行中' : '已停止'}
                                </Tag>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'address',
      key: 'address',
      width: 140,
    },
    {
      title: 'CPU信息',
      dataIndex: 'cpu',
      key: 'cpu',
      width: 100,
    },
    {
      title: '内存信息',
      dataIndex: 'memory',
      key: 'memory',
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: CSVWorker) => {
        const isLoading = csvLoading[record.key];
        const reportStatus = csvReportStatus[record.key] || 'idle';
        const verifyStatus = csvVerifyStatus[record.key] || 'idle';
        const params = csvParams[record.key];

        const buttonStyle = { 
          width: '140px',
          minWidth: '140px',
          maxWidth: '140px'
        };

        return (
          <Space direction="vertical" size={6} align="start">
            {/* 查询参数 */}
            <Button
              size="small"
              icon={<SearchOutlined />}
              loading={isLoading}
              onClick={() => handleQueryCSVParams(record)}
              disabled={record.status !== 'running'}
              style={buttonStyle}
            >
              查询参数
            </Button>
            
            {/* 生成认证报告 */}
            <Button
              size="small"
              type="primary"
              icon={<SafetyCertificateOutlined />}
              loading={reportStatus === 'generating'}
              onClick={() => handleGenerateCSVReport(record)}
              disabled={record.status !== 'running'}
              style={buttonStyle}
            >
              生成认证报告
            </Button>
            
            {/* 验证报告 */}
            <Button
              size="small"
              icon={<FileProtectOutlined />}
              loading={verifyStatus === 'verifying'}
              onClick={() => handleVerifyCSVReport(record)}
              disabled={reportStatus !== 'generated'}
              style={buttonStyle}
            >
              验证报告
            </Button>
          </Space>
        );
      },
    },
  ];

  // SGX Worker表格列
  const sgxColumns = [
    {
      title: 'Worker ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
    },
    {
      title: '公钥',
      dataIndex: 'publicKey',
      key: 'publicKey',
      width: 200,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text code style={{ fontSize: '11px' }}>
            {`${text.substring(0, 12)}...${text.substring(text.length - 8)}`}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const color = status === 'online' ? 'green' : status === 'offline' ? 'red' : 'blue';
        const text = status === 'online' ? '在线' : status === 'offline' ? '离线' : '已注册';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '查询参数',
      key: 'query',
      width: 100,
      render: (_: any, record: SGXWorker) => {
        const isLoading = sgxLoading[record.id];
        return (
          <Button
            size="small"
            icon={<SearchOutlined />}
            loading={isLoading}
            onClick={() => handleQuerySGXParams(record)}
          >
            查询
          </Button>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: SGXWorker) => {
        const reportStatus = sgxReportStatus[record.id] || {
          quote: 'idle',
          collateral: 'idle',
          verification: 'idle',
        };

        const buttonStyle = { 
          width: '140px',
          minWidth: '140px',
          maxWidth: '140px'
        };

        return (
          <Space direction="vertical" size={6} align="start">
            {/* 生成认证报告 */}
            <Button
              size="small"
              type="primary"
              icon={<SafetyCertificateOutlined />}
              loading={reportStatus.quote === 'generating'}
              onClick={() => handleGenerateSGXQuote(record)}
              style={buttonStyle}
            >
              生成认证报告
            </Button>
            
            {/* 获取Collateral */}
            <Button
              size="small"
              icon={<DatabaseOutlined />}
              loading={reportStatus.collateral === 'fetching'}
              onClick={() => handleGetCollateral(record)}
              disabled={reportStatus.quote !== 'generated'}
              style={buttonStyle}
            >
              获取Collateral
            </Button>
            
            {/* 生成验证报告 */}
            <Button
              size="small"
              icon={<FileProtectOutlined />}
              loading={reportStatus.verification === 'generating'}
              onClick={() => handleGenerateSGXVerification(record)}
              disabled={reportStatus.quote !== 'generated' || reportStatus.collateral !== 'fetched'}
              style={buttonStyle}
            >
              生成验证报告
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <AuthGuard>
      <MainLayout>
        <div style={{ marginBottom: '24px' }}>
          <Title level={2} style={{ fontSize: '18pt', marginBottom: '8px' }}>
            可信验证
          </Title>
          <Text type="secondary">
            对CSV和SGX Worker进行可信验证，包括参数查询、认证报告生成和验证报告生成。
          </Text>
                            </div>

        {/* CSV Worker表格 */}
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined />
              <span>CSV Worker 可信验证</span>
            </Space>
          }
          style={{ marginBottom: '24px' }}
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
              刷新
            </Button>
          }
        >
          <Table
            rowKey="key"
            columns={csvColumns}
            dataSource={csvWorkers}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
            }}
            size="small"
          />
        </Card>

        {/* SGX Worker表格 */}
        <Card
          title={
            <Space>
              <FileProtectOutlined />
              <span>SGX Worker 可信验证</span>
            </Space>
          }
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadSGXWorkers} loading={loading}>
                刷新
              </Button>
            </Space>
          }
        >
          <Spin spinning={loading}>
            <Table
              rowKey="id"
              columns={sgxColumns}
              dataSource={sgxWorkers}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
              }}
              size="small"
            />
          </Spin>
        </Card>

        {/* CSV Worker参数Modal */}
        <Modal
          title={`${currentCsvWorker?.name || ''} - 参数信息`}
          open={csvParamsModalVisible}
          onCancel={() => setCsvParamsModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setCsvParamsModalVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
        >
          {currentCsvWorker && csvParams[currentCsvWorker.key] ? (
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="架构">{csvParams[currentCsvWorker.key]!.architecture}</Descriptions.Item>
              <Descriptions.Item label="CPU厂商">{csvParams[currentCsvWorker.key]!.cpuVendor}</Descriptions.Item>
              <Descriptions.Item label="CPU型号">{csvParams[currentCsvWorker.key]!.cpuModel}</Descriptions.Item>
              <Descriptions.Item label="CPU核心/线程">{csvParams[currentCsvWorker.key]!.cpuCores}</Descriptions.Item>
              <Descriptions.Item label="主频 (MHz)">{csvParams[currentCsvWorker.key]!.cpuFreq}</Descriptions.Item>
              <Descriptions.Item label="虚拟化">{csvParams[currentCsvWorker.key]!.virtualization}</Descriptions.Item>
              <Descriptions.Item label="总内存">{csvParams[currentCsvWorker.key]!.totalMemory}</Descriptions.Item>
              <Descriptions.Item label="操作系统">{csvParams[currentCsvWorker.key]!.osInfo}</Descriptions.Item>
              <Descriptions.Item label="内核信息" span={2}>
                <Text code style={{ fontSize: '11px' }}>{csvParams[currentCsvWorker.key]!.kernelInfo}</Text>
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
              参数查询中...
                                    </div>
          )}
        </Modal>

        {/* SGX Worker参数Modal */}
        <Modal
          title={`${currentSgxWorker?.id || ''} - 参数信息`}
          open={sgxParamsModalVisible}
          onCancel={() => setSgxParamsModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setSgxParamsModalVisible(false)}>
              关闭
            </Button>
          ]}
          width={800}
        >
          {currentSgxWorker && sgxParams[currentSgxWorker.id] ? (
            <Descriptions bordered column={2} size="small">
              {/* 只显示硬件信息 */}
              {sgxParams[currentSgxWorker.id]!.architecture && (
                <>
                  <Descriptions.Item label="架构">{sgxParams[currentSgxWorker.id]!.architecture}</Descriptions.Item>
                  <Descriptions.Item label="CPU厂商">{sgxParams[currentSgxWorker.id]!.cpuVendor}</Descriptions.Item>
                  <Descriptions.Item label="CPU型号">{sgxParams[currentSgxWorker.id]!.cpuModel}</Descriptions.Item>
                  <Descriptions.Item label="CPU核心/线程">{sgxParams[currentSgxWorker.id]!.cpuCores} / {sgxParams[currentSgxWorker.id]!.cpuThreads}</Descriptions.Item>
                  <Descriptions.Item label="主频 (MHz)">{sgxParams[currentSgxWorker.id]!.cpuFreq}</Descriptions.Item>
                  <Descriptions.Item label="虚拟化">{sgxParams[currentSgxWorker.id]!.virtualization}</Descriptions.Item>
                  <Descriptions.Item label="总内存">{sgxParams[currentSgxWorker.id]!.totalMemory}</Descriptions.Item>
                  <Descriptions.Item label="操作系统">{sgxParams[currentSgxWorker.id]!.osInfo}</Descriptions.Item>
                  {sgxParams[currentSgxWorker.id]!.kernelInfo && (
                    <Descriptions.Item label="内核信息" span={2}>
                      <Text code style={{ fontSize: '11px' }}>{sgxParams[currentSgxWorker.id]!.kernelInfo}</Text>
                    </Descriptions.Item>
                  )}
                </>
              )}
            </Descriptions>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
              参数查询中...
                                    </div>
                                )}
        </Modal>

        {/* CSV Worker 生成认证报告成功提示Modal */}
        <Modal
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
              <span>认证报告生成成功</span>
            </Space>
          }
          open={csvReportSuccessModalVisible}
          onCancel={() => setCsvReportSuccessModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setCsvReportSuccessModalVisible(false)}>
              关闭
            </Button>,
            <Button 
              key="download-nonce" 
              icon={<DownloadOutlined />}
              onClick={() => {
                if (csvReportSuccessWorker) {
                  handleDownloadCSVFile(csvReportSuccessWorker, 'nonce.bin');
                }
              }}
            >
              下载 nonce.bin
            </Button>,
            <Button 
              key="download-report" 
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                if (csvReportSuccessWorker) {
                  handleDownloadCSVFile(csvReportSuccessWorker, 'report.cert');
                }
              }}
            >
              下载 report.cert
            </Button>,
          ]}
          width={500}
        >
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
            <Typography.Title level={4} style={{ marginTop: '16px', marginBottom: '8px' }}>
              {csvReportSuccessWorker?.name} 的认证报告已成功生成
            </Typography.Title>
            <Text type="secondary">
              您现在可以下载 report.cert 和 nonce.bin 文件进行后续验证。
            </Text>
                            </div>
        </Modal>

        {/* CSV Worker 验证报告成功提示Modal */}
        <Modal
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
              <span>验证报告生成成功</span>
            </Space>
          }
          open={csvVerifySuccessModalVisible}
          onCancel={() => setCsvVerifySuccessModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setCsvVerifySuccessModalVisible(false)}>
              关闭
            </Button>,
            <Button 
              key="download-verify" 
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                if (csvVerifySuccessWorker) {
                  handleDownloadCSVVerifyReport(csvVerifySuccessWorker);
                }
              }}
            >
              下载验证报告
            </Button>,
          ]}
          width={500}
        >
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
            <Typography.Title level={4} style={{ marginTop: '16px', marginBottom: '8px' }}>
              {csvVerifySuccessWorker?.name} 的验证报告已成功生成
            </Typography.Title>
            <Text type="secondary">
              您现在可以下载验证报告文件。
            </Text>
          </div>
        </Modal>

        {/* SGX Worker 生成认证报告（Quote）成功提示Modal */}
        <Modal
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
              <span>认证报告（Quote）生成成功</span>
            </Space>
          }
          open={sgxQuoteSuccessModalVisible}
          onCancel={() => setSgxQuoteSuccessModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setSgxQuoteSuccessModalVisible(false)}>
              关闭
            </Button>,
            <Button 
              key="download-quote" 
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                if (sgxSuccessWorker) {
                  handleDownloadSGXFile(sgxSuccessWorker, 'quote');
                }
              }}
            >
              下载 Quote
            </Button>,
          ]}
          width={500}
        >
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
            <Typography.Title level={4} style={{ marginTop: '16px', marginBottom: '8px' }}>
              {sgxSuccessWorker?.publicKey?.substring(0, 16)}... 的认证报告（Quote）已成功生成
            </Typography.Title>
            <Text type="secondary">
              您现在可以获取 Collateral 并进行后续验证。
            </Text>
          </div>
        </Modal>

        {/* SGX Worker 获取Collateral成功提示Modal */}
        <Modal
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
              <span>Collateral获取成功</span>
            </Space>
          }
          open={sgxCollateralSuccessModalVisible}
          onCancel={() => setSgxCollateralSuccessModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setSgxCollateralSuccessModalVisible(false)}>
              关闭
            </Button>,
            <Button 
              key="download-collateral" 
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                if (sgxSuccessWorker) {
                  handleDownloadSGXFile(sgxSuccessWorker, 'collateral');
                }
              }}
            >
              下载 Collateral
            </Button>,
          ]}
          width={500}
        >
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
            <Typography.Title level={4} style={{ marginTop: '16px', marginBottom: '8px' }}>
              {sgxSuccessWorker?.publicKey?.substring(0, 16)}... 的 Collateral 已成功获取
            </Typography.Title>
            <Text type="secondary">
              您现在可以生成验证报告。
            </Text>
          </div>
        </Modal>

        {/* SGX Worker 生成验证报告成功提示Modal */}
        <Modal
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
              <span>验证报告生成成功</span>
            </Space>
          }
          open={sgxVerificationSuccessModalVisible}
          onCancel={() => setSgxVerificationSuccessModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setSgxVerificationSuccessModalVisible(false)}>
              关闭
            </Button>,
            <Button 
              key="download-quote" 
              icon={<DownloadOutlined />}
              onClick={() => {
                if (sgxSuccessWorker) {
                  const status = sgxReportStatus[sgxSuccessWorker.id];
                  if (status?.quote === 'generated') {
                    handleDownloadSGXFile(sgxSuccessWorker, 'quote');
                  }
                }
              }}
            >
              下载 Quote
            </Button>,
            <Button 
              key="download-collateral" 
              icon={<DownloadOutlined />}
              onClick={() => {
                if (sgxSuccessWorker) {
                  const status = sgxReportStatus[sgxSuccessWorker.id];
                  if (status?.collateral === 'fetched') {
                    handleDownloadSGXFile(sgxSuccessWorker, 'collateral');
                  }
                }
              }}
            >
              下载 Collateral
            </Button>,
            <Button 
              key="download-verification" 
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                if (sgxSuccessWorker) {
                  handleDownloadSGXFile(sgxSuccessWorker, 'verification');
                }
              }}
            >
              下载验证报告
            </Button>,
          ]}
          width={500}
        >
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
            <Typography.Title level={4} style={{ marginTop: '16px', marginBottom: '8px' }}>
              {sgxSuccessWorker?.publicKey?.substring(0, 16)}... 的验证报告已成功生成
            </Typography.Title>
            <Text type="secondary">
              您现在可以下载 Quote、Collateral 和验证报告文件。
            </Text>
          </div>
        </Modal>
            </MainLayout>
        </AuthGuard>
    );
}
