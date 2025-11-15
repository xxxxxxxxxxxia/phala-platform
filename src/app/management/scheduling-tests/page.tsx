'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Space,
  Alert,
  Statistic,
  Table,
  Tag,
  message,
  Select,
  InputNumber,
  Divider,
  Empty,
} from 'antd';
import {
  ReloadOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  PlayCircleOutlined,
  BranchesOutlined,
  FireOutlined,
} from '@ant-design/icons';
import MainLayout from '@/components/layout/MainLayout';
import dynamic from 'next/dynamic';

const { Title, Text } = Typography;

const LineChart = dynamic(() => import('@ant-design/plots').then((mod) => mod.Line), { ssr: false });
const ColumnChart = dynamic(() => import('@ant-design/plots').then((mod) => mod.Column), { ssr: false });

interface ScenarioConfig {
  id: string;
  title: string;
  description: string;
  tag: string;
  accent: string;
  icon: React.ComponentType;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'fairness',
    title: '公平调度',
    description: '多流请求同时进入，验证 SFQ 在等权场景下能否平均服务。',
    tag: 'Equal Weight',
    accent: '#52c41a',
    icon: BranchesOutlined,
  },
  {
    id: 'weight-distribution',
    title: '带权重调度',
    description: '设置不同权重的合约，看资源是否按比例分配、吞吐是否随权重变化。',
    tag: 'Weighted',
    accent: '#9254de',
    icon: ThunderboltOutlined,
  },
  {
    id: 'overload-protection',
    title: '过载保护',
    description: '模拟流量洪峰，观察服务器如何拒绝部分请求来保护核心任务。',
    tag: 'Overload',
    accent: '#fa8c16',
    icon: FireOutlined,
  },
];

interface WorkerInsight {
  pubkey: string;
  endpoint?: string;
  online: boolean;
  latencyMs?: number;
  version?: string;
  registered: boolean;
  state: string;
  gatekeeper: boolean;
  inCluster: boolean;
  lastUpdated: number;
  score: number;
  isRecommended?: boolean;
}

interface WorkerInsightResponse {
  clusterId: string;
  fetchedAt: number;
  recommended: WorkerInsight | null;
  workers: WorkerInsight[];
}

type ScenarioResult = Record<string, any>;

const scenarioFlowColumns = [
  {
    title: 'Flow ID',
    dataIndex: 'flowId',
    key: 'flowId',
    render: (value: string) => <Text code>{value}</Text>,
  },
  { title: '权重', dataIndex: 'weight', key: 'weight' },
  { title: '总请求', dataIndex: 'total', key: 'total' },
  { title: '已接受', dataIndex: 'accepted', key: 'accepted' },
  { title: '已拒绝', dataIndex: 'rejected', key: 'rejected' },
];

const sfqFlowColumns = [
  {
    title: 'Flow',
    dataIndex: 'flow',
    key: 'flow',
    render: (value: string) => <Text code>{value}</Text>,
  },
  { title: '权重', dataIndex: 'weight', key: 'weight' },
  { title: '虚拟时钟', dataIndex: 'vClock', key: 'vClock' },
  { title: '积压', dataIndex: 'backlog', key: 'backlog' },
  { title: '已接受', dataIndex: 'accepted', key: 'accepted' },
  { title: '已拒绝', dataIndex: 'rejected', key: 'rejected' },
  { title: '总数', dataIndex: 'total', key: 'total' },
];

export default function SchedulingPage() {
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [workerInsights, setWorkerInsights] = useState<WorkerInsightResponse | null>(null);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [scenarioRunning, setScenarioRunning] = useState<string | null>(null);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [addInputs, setAddInputs] = useState({ a: 1, b: 2 });
  const [addWorkerEndpoint, setAddWorkerEndpoint] = useState<string | undefined>();
  const [addResult, setAddResult] = useState<any>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [sfqStatus, setSfqStatus] = useState<any>(null);
  const [sfqLoading, setSfqLoading] = useState(false);
  const [sfqControlLoading, setSfqControlLoading] = useState(false);

  const loadSFQStatus = useCallback(async () => {
    setSfqLoading(true);
    try {
      const response = await fetch('/api/scheduling/flip?action=sfq-status');
      const data = await response.json();
      setSfqStatus(data);
    } catch (error) {
      console.error('Error loading SFQ status:', error);
      setSfqStatus({ success: false, available: false, status: 'SFQ服务器未运行' });
    } finally {
      setSfqLoading(false);
    }
  }, []);

  const loadWorkerInsights = useCallback(async () => {
    setWorkerLoading(true);
    try {
      const res = await fetch('/api/scheduling/workers');
      const data = await res.json();
      if (data.success) {
        setWorkerInsights(data.data);
      } else {
        message.warning(data.error || '无法获取 Worker 信息');
      }
    } catch (error: any) {
      message.error(error?.message || '无法获取 Worker 信息');
    } finally {
      setWorkerLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadWorkerInsights(), loadSFQStatus()]);
    setLoading(false);
  }, [loadWorkerInsights, loadSFQStatus]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadWorkerInsights();
      loadSFQStatus();
    }, 8000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadWorkerInsights, loadSFQStatus]);

  useEffect(() => {
    const recommended =
      workerInsights?.recommended ||
      workerInsights?.workers?.find((worker) => worker.isRecommended) ||
      workerInsights?.workers?.find((worker) => !!worker.endpoint);
    if (recommended?.endpoint) {
      setAddWorkerEndpoint(recommended.endpoint);
    }
  }, [workerInsights]);

  const startSFQServer = async () => {
    setSfqControlLoading(true);
    try {
      const response = await fetch('/api/scheduling/sfq?action=start');
      const data = await response.json();
      if (data.success) {
        message.success('SFQ 服务器启动成功');
        await loadSFQStatus();
      } else {
        message.error(data.error || 'SFQ 服务器启动失败');
      }
    } catch (error: any) {
      message.error(error?.message || 'SFQ 服务器启动失败');
    } finally {
      setSfqControlLoading(false);
    }
  };

  const stopSFQServer = async () => {
    setSfqControlLoading(true);
    try {
      const response = await fetch('/api/scheduling/sfq?action=stop');
      const data = await response.json();
      if (data.success) {
        message.success('SFQ 服务器已停止');
        await loadSFQStatus();
      } else {
        message.error(data.error || 'SFQ 服务器停止失败');
      }
    } catch (error: any) {
      message.error(error?.message || 'SFQ 服务器停止失败');
    } finally {
      setSfqControlLoading(false);
    }
  };

  const runScenario = async (scenarioId: string) => {
    if (!sfqStatus?.available) {
      message.warning('请先启动 SFQ 服务器');
      return;
    }

    setScenarioRunning(scenarioId);
    setScenarioResult(null);
    try {
      const response = await fetch('/api/scheduling/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await response.json();
      if (data.success) {
        setScenarioResult(data.data);
        message.success(`${data.data.scenarioName || '场景'} 运行完成`);
      } else {
        message.error(data.error || '场景运行失败');
      }
    } catch (error: any) {
      message.error(error?.message || '场景运行失败');
    } finally {
      setScenarioRunning(null);
    }
  };

  const runAddQuery = async () => {
    setAddLoading(true);
    setAddResult(null);
    try {
      const params = new URLSearchParams({
        a: addInputs.a.toString(),
        b: addInputs.b.toString(),
      });
      if (addWorkerEndpoint) {
        params.set('workerEndpoint', addWorkerEndpoint);
      }
      const response = await fetch(`/api/contracts/add-query?${params.toString()}`);
      if (!response.ok) {
        throw new Error('查询失败');
      }
      const data = await response.json();
      setAddResult(data);
      message.success('查询成功');
    } catch (error: any) {
      message.error(error?.message || '查询失败');
    } finally {
      setAddLoading(false);
    }
  };

  const workerDataSource = useMemo(() => {
    return (
      workerInsights?.workers?.map((worker, index) => ({
        key: worker.pubkey || `worker-${index}`,
        ...worker,
      })) || []
    );
  }, [workerInsights]);

  const workerColumns = useMemo(
    () => [
      {
        title: 'Worker 公钥',
        dataIndex: 'pubkey',
        key: 'pubkey',
        render: (value: string, record: WorkerInsight) => (
          <Space size="small">
            <Text code style={{ fontSize: 12 }}>
              {value ? `${value.slice(0, 10)}...${value.slice(-6)}` : '--'}
            </Text>
            {record.isRecommended && <Tag color="cyan">推荐</Tag>}
            {!record.inCluster && <Tag>未入集群</Tag>}
          </Space>
        ),
      },
      {
        title: 'Endpoint',
        dataIndex: 'endpoint',
        key: 'endpoint',
        render: (value?: string) => value || '链上注册',
      },
      {
        title: '响应状态',
        dataIndex: 'online',
        key: 'online',
        render: (value: boolean) =>
          value ? <Tag color="green">有响应</Tag> : <Tag color="red">无响应</Tag>,
      },
      {
        title: '延迟 (ms)',
        dataIndex: 'latencyMs',
        key: 'latencyMs',
        render: (value?: number) => (typeof value === 'number' ? value.toFixed(0) : '--'),
      },
      {
        title: '健康得分',
        dataIndex: 'score',
        key: 'score',
        render: (value?: number) => (typeof value === 'number' ? value.toFixed(1) : '--'),
      },
    ],
    []
  );

  const workerSelectOptions = useMemo(
    () =>
      workerDataSource
        .filter((worker) => !!worker.endpoint)
        .map((worker) => ({
          label: `${worker.endpoint} (${worker.pubkey.slice(0, 6)}...)`,
          value: worker.endpoint as string,
        })),
    [workerDataSource]
  );

  const scenarioTotals = useMemo(() => {
    if (!scenarioResult?.flowStats) return null;
    const totals = Object.entries(scenarioResult.flowStats).reduce(
      (acc: { accepted: number; rejected: number; total: number }, [, stats]: [string, any]) => {
        acc.accepted += stats.accepted ?? 0;
        acc.rejected += stats.rejected ?? 0;
        acc.total += stats.total ?? (stats.accepted ?? 0) + (stats.rejected ?? 0);
        return acc;
      },
      { accepted: 0, rejected: 0, total: 0 },
    );
    return totals;
  }, [scenarioResult]);

  const scenarioFlowData = useMemo(() => {
    if (!scenarioResult?.flowStats) return [];
    const flowConfig =
      scenarioResult.flows?.reduce(
        (map: Record<string, any>, flow: any) => ({ ...map, [flow.id]: flow }),
        {},
      ) ?? {};
    return Object.entries(scenarioResult.flowStats).map(([flowId, stats]: [string, any]) => ({
      key: flowId,
      flowId,
      weight: flowConfig[flowId]?.weight ?? stats.weight ?? '--',
      ...stats,
    }));
  }, [scenarioResult]);

  const scenarioStats = useMemo(() => {
    if (!scenarioResult) return [];
    const aggregatedAccepted =
      scenarioResult.totalAccepted ??
      (typeof scenarioTotals?.accepted === 'number' ? scenarioTotals.accepted : undefined);
    const aggregatedRejected =
      scenarioResult.totalRejected ??
      (typeof scenarioTotals?.rejected === 'number' ? scenarioTotals.rejected : undefined);
    const aggregatedTotal =
      scenarioResult.totalRequests ??
      scenarioResult.total ??
      scenarioResult.results?.length ??
      scenarioTotals?.total ??
      (aggregatedAccepted !== undefined && aggregatedRejected !== undefined
        ? aggregatedAccepted + aggregatedRejected
        : undefined);
    const rejectionRateValue =
      typeof scenarioResult.rejectionRate === 'number'
        ? scenarioResult.rejectionRate
        : aggregatedTotal
          ? (aggregatedRejected ?? 0) / (aggregatedTotal || 1)
          : undefined;
    const rejectionRate =
      typeof rejectionRateValue === 'number'
        ? `${(rejectionRateValue * 100).toFixed(1)}%`
        : '--';
    const duration = scenarioResult.totalTime ?? scenarioResult.duration ?? '--';
    return [
      { title: '总请求', value: aggregatedTotal ?? '--' },
      { title: '接受', value: aggregatedAccepted ?? '--' },
      { title: '拒绝', value: aggregatedRejected ?? '--' },
      { title: '拒绝率', value: rejectionRate },
      { title: '耗时 (ms)', value: duration },
    ];
  }, [scenarioResult, scenarioTotals]);

  const sfqSummaryStats = useMemo(() => {
    if (!sfqStatus?.data) return [];
    return [
      {
        title: '虚拟时间',
        value:
          typeof sfqStatus.data.virtualTime === 'number'
            ? sfqStatus.data.virtualTime.toLocaleString()
            : sfqStatus.data.virtualTime ?? '--',
      },
      { title: '当前 Serving', value: sfqStatus.data.serving ?? '--' },
      { title: '队列 Backlog', value: sfqStatus.data.backlog ?? '--' },
      {
        title: '活跃流数量',
        value: sfqStatus.data.flows ? sfqStatus.data.flows.length : 0,
      },
    ];
  }, [sfqStatus]);

  const sfqFlowTableData = useMemo(() => {
    if (!sfqStatus?.data?.flows) return [];
    return sfqStatus.data.flows.map((flow: any, index: number) => ({
      key: flow.flow || `sfq-flow-${index}`,
      ...flow,
    }));
  }, [sfqStatus]);

  const flowChartData = useMemo(() => {
    if (!sfqStatus?.data?.flows) return [];
    return sfqStatus.data.flows.map((flow: any) => ({
      flow: flow.flow,
      label: `${flow.flow || 'unknown'} (w=${flow.weight ?? '--'})`,
      vClock: flow.vClock,
      weight: flow.weight,
      backlog: flow.backlog ?? 0,
    }));
  }, [sfqStatus]);

  const flowPerformanceData = useMemo(() => {
    if (!sfqStatus?.data?.flows) return [];
    return sfqStatus.data.flows.flatMap((flow: any) => {
      const label = `${flow.flow || 'unknown'} (w=${flow.weight ?? '--'})`;
      return [
        {
          label,
          category: 'Accepted',
          value: flow.accepted ?? 0,
        },
        {
          label,
          category: 'Rejected',
          value: flow.rejected ?? 0,
        },
      ];
    });
  }, [sfqStatus]);

  const hasBacklogValue = useMemo(
    () => flowChartData.some((item: { backlog?: number }) => (item.backlog ?? 0) > 0),
    [flowChartData],
  );

  const recommendedWorker = useMemo(() => {
    return (
      workerInsights?.recommended ||
      workerInsights?.workers?.find((worker) => worker.isRecommended) ||
      workerInsights?.workers?.[0] ||
      null
    );
  }, [workerInsights]);

  return (
    <MainLayout>
      <Space direction="vertical" size={24} style={{ width: '100%', marginTop: 24 }}>
        <Card
          variant="outlined"
          style={{
            borderRadius: 18,
            background: 'linear-gradient(125deg,#141e30,#243b55)',
            color: '#fff',
          }}
          styles={{ body: { padding: 32 } }}
        >
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Space direction="vertical" size="small">
                <Title level={3} style={{ color: '#fff', margin: 0 }}>
                  安全调度控制台
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
                  一站式查看 worker 健康度、运行安全调度场景，并直接调用 phat_hello_add 查询。
                </Text>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>
                  刷新
                </Button>
                <Select
                  size="small"
                  value={autoRefresh ? 'auto' : 'manual'}
                  style={{ width: 140 }}
                  onChange={(val) => setAutoRefresh(val === 'auto')}
                  options={[
                    { label: '自动刷新', value: 'auto' },
                    { label: '手动刷新', value: 'manual' },
                  ]}
                />
              </Space>
            </Col>
          </Row>
        </Card>

        <Card
          title={
            <Space>
              <ThunderboltOutlined />
              <span>Worker 推荐与全局视图</span>
            </Space>
          }
        >
          {recommendedWorker ? (
            <>
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                  <Card
                    bordered={false}
                    style={{ background: '#0f111a', color: '#fff', height: '100%' }}
                  >
                    <Space direction="vertical" size="small">
                      <Text type="secondary" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        推荐 Worker
                      </Text>
                      <Text code style={{ color: '#fff' }}>
                        {recommendedWorker.pubkey}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
                        Endpoint：{recommendedWorker.endpoint || '链上注册'}
                      </Text>
                      <Divider style={{ margin: '12px 0', borderColor: 'rgba(255,255,255,0.08)' }} />
                      <Row gutter={12}>
                        <Col span={12}>
                          <Statistic
                            title="得分"
                            value={
                              typeof recommendedWorker.score === 'number'
                                ? recommendedWorker.score.toFixed(1)
                                : '--'
                            }
                            valueStyle={{ color: '#52c41a' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="延迟 (ms)"
                            value={
                              typeof recommendedWorker.latencyMs === 'number'
                                ? recommendedWorker.latencyMs.toFixed(0)
                                : '--'
                            }
                          />
                        </Col>
                      </Row>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Alert
                    type="info"
                    showIcon
                    message="调度建议"
                    description="推荐算法综合考量响应状态、链上注册、Gatekeeper 角色与实时延迟。也可以在下表手动挑选合适的 worker。"
                    style={{ height: '100%' }}
                  />
                </Col>
              </Row>
              <Divider />
              <Table
                size="small"
                dataSource={workerDataSource}
                columns={workerColumns}
                loading={workerLoading}
                pagination={false}
                scroll={{ x: true }}
              />
            </>
          ) : (
            <Empty description="暂无 worker 数据" />
          )}
        </Card>

        <Card
          title={
            <Space>
              <ApiOutlined />
              <span>phat_hello_add 合约查询</span>
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text strong>选择 Worker</Text>
                <Select
                  placeholder="选择 worker"
                  options={workerSelectOptions}
                  value={addWorkerEndpoint}
                  onChange={(value) => setAddWorkerEndpoint(value)}
                  allowClear
                />
              </Space>
            </Col>
            <Col span={12}>
              <Text type="secondary">参数 A</Text>
              <InputNumber
                min={0}
                max={1_000_000}
                value={addInputs.a}
                onChange={(value) =>
                  setAddInputs((prev) => ({ ...prev, a: typeof value === 'number' ? value : prev.a }))
                }
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={12}>
              <Text type="secondary">参数 B</Text>
              <InputNumber
                min={0}
                max={1_000_000}
                value={addInputs.b}
                onChange={(value) =>
                  setAddInputs((prev) => ({ ...prev, b: typeof value === 'number' ? value : prev.b }))
                }
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={24}>
              <Button type="primary" block onClick={runAddQuery} loading={addLoading}>
                查询 add(a, b)
              </Button>
            </Col>
          </Row>
          {addResult && (
            <Alert
              style={{ marginTop: 16 }}
              type="success"
              showIcon
              message="查询结果"
              description={
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(addResult, null, 2)}
                </pre>
              }
            />
          )}
        </Card>

        <Card
          title={
            <Space>
              <PlayCircleOutlined />
              <span>SFQ 请求调度与服务器控制</span>
            </Space>
          }
          extra={
            <Space>
              <Tag color={sfqStatus?.available ? 'green' : 'red'}>
                {sfqStatus?.available ? '运行中' : '未运行'}
              </Tag>
              <Button icon={<ReloadOutlined />} onClick={loadSFQStatus} loading={sfqLoading}>
                刷新状态
              </Button>
              {sfqStatus?.available ? (
                <Button danger onClick={stopSFQServer} loading={sfqControlLoading}>
                  停止服务器
                </Button>
              ) : (
                <Button type="primary" onClick={startSFQServer} loading={sfqControlLoading}>
                  启动服务器
                </Button>
              )}
            </Space>
          }
        >
          <Alert
            type="info"
            showIcon
            message="SFQ 服务器"
            description="SFQ 调度器运行在后端 SideVM 中，负责公平分配 Pink 请求。可在此启动/停止服务器，并查看实时虚拟时钟与队列情况。"
            style={{ marginBottom: 16 }}
          />

          {sfqSummaryStats.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              {sfqSummaryStats.map((stat) => (
                <Col xs={12} md={6} key={stat.title}>
                  <Card size="small">
                    <Statistic title={stat.title} value={stat.value ?? '--'} />
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {flowChartData.length > 0 ? (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} lg={12}>
                  <Card size="small" title="虚拟时间趋势" bordered={false}>
                    <div style={{ height: 260 }}>
                      <LineChart
                        data={flowChartData}
                        xField="label"
                        yField="vClock"
                        color="#13c2c2"
                        smooth
                        autoFit
                        height={240}
                      />
                    </div>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card size="small" title="各流积压情况" bordered={false}>
                    {hasBacklogValue ? (
                      <div style={{ height: 260 }}>
                        <ColumnChart
                          data={flowChartData}
                          xField="label"
                          yField="backlog"
                          color="#faad14"
                          autoFit
                          height={240}
                          meta={{ backlog: { min: 0 } }}
                        />
                      </div>
                    ) : (
                      <Empty description="当前无排队积压" />
                    )}
                  </Card>
                </Col>
              </Row>
              {flowPerformanceData.length > 0 && (
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col span={24}>
                    <Card size="small" title="各流处理结果" bordered={false}>
                      <div style={{ height: 300 }}>
                        <ColumnChart
                          data={flowPerformanceData}
                          xField="label"
                          yField="value"
                          seriesField="category"
                          isGroup
                          color={['#52c41a', '#f5222d']}
                          autoFit
                          height={280}
                          legend={{ position: 'top' }}
                        />
                      </div>
                    </Card>
                  </Col>
                </Row>
              )}
            </>
          ) : (
            <Empty description="等待 SFQ 服务器返回流量数据" style={{ marginBottom: 16 }} />
          )}

          {sfqFlowTableData.length > 0 && (
            <Card
              size="small"
              title="实时流量详情"
              bordered={false}
              style={{ marginBottom: 16, marginTop: 8 }}
            >
              <Table
                size="small"
                dataSource={sfqFlowTableData}
                columns={sfqFlowColumns}
                pagination={false}
                scroll={{ x: true }}
              />
            </Card>
          )}

          <Divider />

          <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 16 }}>
            <Text strong>请求调度场景</Text>
            <Row gutter={[16, 16]}>
              {SCENARIOS.map((scenario) => {
                const ScenarioIcon = scenario.icon;
                const isRunning = scenarioRunning === scenario.id;
                return (
                  <Col xs={24} md={12} lg={8} key={scenario.id}>
                    <Card
                      size="small"
                      style={{
                        height: '100%',
                        borderColor: isRunning ? scenario.accent : undefined,
                      }}
                    >
                      <Space align="start" size="middle" style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: `${scenario.accent}22`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: scenario.accent,
                          }}
                        >
                          <ScenarioIcon />
                        </div>
                        <Space direction="vertical" size={4} style={{ flex: 1 }}>
                          <Space size="small">
                            <Text strong>{scenario.title}</Text>
                            <Tag color={scenario.accent}>{scenario.tag}</Tag>
                          </Space>
                          <Text type="secondary">{scenario.description}</Text>
                        </Space>
                      </Space>
                      <Button
                        block
                        size="large"
                        type={isRunning ? 'primary' : 'default'}
                        loading={isRunning}
                        onClick={() => runScenario(scenario.id)}
                      >
                        运行场景
                      </Button>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Space>

          {scenarioResult ? (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Space direction="vertical" size="small">
                <Text strong>{scenarioResult.scenarioName}</Text>
                <Text type="secondary">{scenarioResult.description}</Text>
              </Space>
              <Row gutter={[16, 16]}>
                {scenarioStats.map((stat) => (
                  <Col xs={12} md={6} key={stat.title}>
                    <Card size="small">
                      <Statistic title={stat.title} value={stat.value ?? '--'} />
                    </Card>
                  </Col>
                ))}
              </Row>
              {scenarioFlowData.length > 0 && (
                <Table
                  size="small"
                  dataSource={scenarioFlowData}
                  columns={scenarioFlowColumns}
                  pagination={false}
                />
              )}
            </Space>
          ) : (
            <Empty description="运行任意场景即可查看结果" />
          )}
        </Card>
      </Space>
    </MainLayout>
  );
}
