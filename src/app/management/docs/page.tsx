// src/app/docs/page.tsx
'use client';

import React from 'react';
import MainLayout from "@/components/layout/MainLayout";
import { Row, Col, Typography, Button, Card, Space, Steps, Alert, Descriptions, Tag, Divider } from 'antd';
import { QuestionCircleOutlined, SettingOutlined, PlayCircleOutlined, WarningOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { getHealthCheckUrl, getPruntimeInfoUrl, getApiUrl } from '@/lib/config';

const { Title, Paragraph, Text } = Typography;

const DocsPage = () => {
  return (
    <MainLayout>
      <Title level={2} style={{ fontSize: '18pt' }}>系统帮助</Title>
      <Paragraph type="secondary">
        链计算隐私平台系统操作指南、故障排除和最佳实践。
      </Paragraph>
      <Divider />

      <Row gutter={[24, 24]}>
        {/* 系统架构概览 */}
        <Col span={24}>
          <Card title="系统架构概览" extra={<PlayCircleOutlined />}>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={8}>
                <Card size="small" title="区块链节点" style={{ textAlign: 'center' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>ws://8.147.107.221:19944</Text>
                    <Text type="secondary">Substrate区块链网络</Text>
                    <Tag color="green">在线</Tag>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card size="small" title="中继器服务" style={{ textAlign: 'center' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>http://8.147.107.221:18000</Text>
                    <Text type="secondary">TEE计算中继</Text>
                    <Tag color="green">在线</Tag>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card size="small" title="前端服务" style={{ textAlign: 'center' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>http://8.147.107.221:3000</Text>
                    <Text type="secondary">Web管理界面</Text>
                    <Tag color="green">在线</Tag>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 服务监控指南 */}
        <Col span={24}>
          <Card title="服务监控指南" extra={<CheckCircleOutlined />}>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={8}>
                <Card size="small" title="区块链节点健康检查">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>检查节点连接状态</Text>
                    <Text code>curl -s http://8.147.107.221:19944/health</Text>
                    <Tag color="green">正常</Tag>
                  </Space>
                </Card>
              </Col>

              <Col xs={24} lg={8}>
                <Card size="small" title="中继器服务状态">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>检查中继器运行状态</Text>
                    <Text code>curl -s http://8.147.107.221:18000/prpc/PhactoryAPI.GetInfo</Text>
                    <Tag color="green">正常</Tag>
                  </Space>
                </Card>
              </Col>

              <Col xs={24} lg={8}>
                <Card size="small" title="前端服务状态">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>检查前端服务状态</Text>
                    <Text code>curl -s http://8.147.107.221:3000</Text>
                    <Tag color="green">正常</Tag>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 常见问题 */}
        <Col span={24}>
          <Card title="常见问题" extra={<QuestionCircleOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Title level={4}>Q: 服务状态显示离线怎么办？</Title>
                <Paragraph>
                  <Text>A: 服务离线可能的原因和解决方案：</Text>
                  <ul>
                    <li>检查服务是否正在运行：<Text code>ps aux | grep node</Text></li>
                    <li>检查端口是否被占用：<Text code>netstat -tulpn | grep :3000</Text></li>
                    <li>查看服务日志：<Text code>tail -f logs/service.log</Text></li>
                    <li>重启相关服务：<Text code>systemctl restart service-name</Text></li>
                  </ul>
                </Paragraph>
              </div>

              <div>
                <Title level={4}>Q: 跨域请求被阻止怎么办？</Title>
                <Paragraph>
                  <Text>A: CORS问题通常通过代理解决：</Text>
                  <ul>
                    <li>使用内置的API代理：<Text code>/api/node-health</Text></li>
                    <li>使用中继器代理：<Text code>/api/pruntime-proxy</Text></li>
                    <li>检查代理服务是否正常运行</li>
                    <li>确认请求URL格式正确</li>
                  </ul>
                </Paragraph>
              </div>

              <div>
                <Title level={4}>Q: 区块链节点连接失败怎么办？</Title>
                <Paragraph>
                  <Text>A: 节点连接问题的排查步骤：</Text>
                  <ul>
                    <li>检查节点是否启动：<Text code>curl -s http://8.147.107.221:19944/health</Text></li>
                    <li>确认WebSocket连接：<Text code>ws://8.147.107.221:19944</Text></li>
                    <li>检查防火墙设置</li>
                    <li>查看节点同步状态</li>
                  </ul>
                </Paragraph>
              </div>

              <div>
                <Title level={4}>Q: 如何优化系统性能？</Title>
                <Paragraph>
                  <Text>A: 性能优化建议：</Text>
                  <ul>
                    <li>定期清理日志文件</li>
                    <li>监控内存和CPU使用率</li>
                    <li>使用SSD存储提高I/O性能</li>
                    <li>配置适当的缓存策略</li>
                    <li>定期重启长时间运行的服务</li>
                  </ul>
                </Paragraph>
              </div>
            </Space>
          </Card>
        </Col>

        {/* 系统配置说明 */}
        <Col span={24}>
          <Card title="系统配置说明" extra={<SettingOutlined />}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="区块链节点地址">
                <Text code>ws://8.147.107.221:19944</Text>
              </Descriptions.Item>
              <Descriptions.Item label="中继器服务地址">
                <Text code>http://8.147.107.221:18000</Text>
              </Descriptions.Item>
              <Descriptions.Item label="前端服务地址">
                <Text code>http://8.147.107.221:3000</Text>
              </Descriptions.Item>
              <Descriptions.Item label="API代理端点">
                <Text code>/api/node-health, /api/pruntime-proxy</Text>
              </Descriptions.Item>
              <Descriptions.Item label="健康检查端点">
                <Text code>http://8.147.107.221:19944/health</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* 故障排除 */}
        <Col span={24}>
          <Card title="故障排除" extra={<WarningOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Alert
                message="服务连接超时"
                description="如果服务显示连接超时，检查服务是否正常运行，网络连接是否正常，防火墙设置是否正确。"
                type="warning"
                showIcon
              />

              <Alert
                message="CORS跨域问题"
                description="前端直接访问外部服务可能遇到CORS问题，使用内置的API代理可以解决此问题。"
                type="info"
                showIcon
              />

              <Alert
                message="服务状态异常"
                description="如果服务状态显示异常，检查服务日志，确认配置正确，必要时重启相关服务。"
                type="warning"
                showIcon
              />

              <Alert
                message="性能优化"
                description="定期监控系统资源使用情况，清理日志文件，优化数据库查询，确保系统稳定运行。"
                type="info"
                showIcon
              />
            </Space>
          </Card>
        </Col>

        {/* 最佳实践 */}
        <Col span={24}>
          <Card title="最佳实践" extra={<InfoCircleOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Title level={4}>系统监控</Title>
              <ul>
                <li>定期检查服务状态和健康指标</li>
                <li>监控系统资源使用情况（CPU、内存、磁盘）</li>
                <li>设置告警机制，及时发现异常</li>
                <li>建立日志轮转和清理机制</li>
              </ul>

              <Title level={4}>安全建议</Title>
              <ul>
                <li>定期更新系统和依赖包</li>
                <li>配置防火墙规则，限制不必要的端口访问</li>
                <li>使用HTTPS加密传输</li>
                <li>定期备份重要数据和配置</li>
              </ul>

              <Title level={4}>性能优化</Title>
              <ul>
                <li>使用SSD存储提高I/O性能</li>
                <li>配置适当的缓存策略</li>
                <li>优化数据库查询和索引</li>
                <li>定期清理临时文件和日志</li>
              </ul>
            </Space>
          </Card>
        </Col>
      </Row>
    </MainLayout>
  );
};

export default DocsPage;