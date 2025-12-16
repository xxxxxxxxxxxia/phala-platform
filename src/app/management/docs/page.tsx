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
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <Title level={5} style={{ fontSize: '14px', marginBottom: 8 }}>Q: 服务状态显示离线怎么办？</Title>
                  <Paragraph style={{ marginBottom: 0, fontSize: '13px' }}>
                    <Text style={{ fontSize: '12px' }}>A: 服务离线可能的原因和解决方案：</Text>
                    <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, fontSize: '12px' }}>
                      <li>检查服务是否正在运行：<Text code style={{ fontSize: '11px' }}>ps aux | grep node</Text></li>
                      <li>检查端口是否被占用：<Text code style={{ fontSize: '11px' }}>netstat -tulpn | grep :3000</Text></li>
                      <li>查看服务日志：<Text code style={{ fontSize: '11px' }}>tail -f logs/service.log</Text></li>
                      <li>重启相关服务：<Text code style={{ fontSize: '11px' }}>systemctl restart service-name</Text></li>
                    </ul>
                  </Paragraph>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <Title level={5} style={{ fontSize: '14px', marginBottom: 8 }}>Q: 跨域请求被阻止怎么办？</Title>
                  <Paragraph style={{ marginBottom: 0, fontSize: '13px' }}>
                    <Text style={{ fontSize: '12px' }}>A: CORS问题通常通过代理解决：</Text>
                    <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, fontSize: '12px' }}>
                      <li>使用内置的API代理：<Text code style={{ fontSize: '11px' }}>/api/node-health</Text></li>
                      <li>使用中继器代理：<Text code style={{ fontSize: '11px' }}>/api/pruntime-proxy</Text></li>
                      <li>检查代理服务是否正常运行</li>
                      <li>确认请求URL格式正确</li>
                    </ul>
                  </Paragraph>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <Title level={5} style={{ fontSize: '14px', marginBottom: 8 }}>Q: 区块链节点连接失败怎么办？</Title>
                  <Paragraph style={{ marginBottom: 0, fontSize: '13px' }}>
                    <Text style={{ fontSize: '12px' }}>A: 节点连接问题的排查步骤：</Text>
                    <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, fontSize: '12px' }}>
                      <li>检查节点是否启动：<Text code style={{ fontSize: '11px' }}>curl -s http://8.147.107.221:19944/health</Text></li>
                      <li>确认WebSocket连接：<Text code style={{ fontSize: '11px' }}>ws://8.147.107.221:19944</Text></li>
                      <li>检查防火墙设置</li>
                      <li>查看节点同步状态</li>
                    </ul>
                  </Paragraph>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <Title level={5} style={{ fontSize: '14px', marginBottom: 8 }}>Q: 如何优化系统性能？</Title>
                  <Paragraph style={{ marginBottom: 0, fontSize: '13px' }}>
                    <Text style={{ fontSize: '12px' }}>A: 性能优化建议：</Text>
                    <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, fontSize: '12px' }}>
                      <li>定期清理日志文件</li>
                      <li>监控内存和CPU使用率</li>
                      <li>使用SSD存储提高I/O性能</li>
                      <li>配置适当的缓存策略</li>
                      <li>定期重启长时间运行的服务</li>
                    </ul>
                  </Paragraph>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 系统配置说明 */}
        <Col span={24}>
          <Card title="系统配置说明" extra={<SettingOutlined />}>
            <style dangerouslySetInnerHTML={{
              __html: `
                .config-descriptions table {
                  table-layout: fixed;
                  width: 100%;
                }
                .config-descriptions .ant-descriptions-item-label {
                  width: 140px !important;
                }
                .config-descriptions .ant-descriptions-item-content {
                  word-break: keep-all;
                }
                .config-descriptions tbody tr td:nth-child(1) {
                  width: 75% !important;
                }
                .config-descriptions tbody tr td:nth-child(2) {
                  width: 25% !important;
                }
              `
            }} />
            <div className="config-descriptions">
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="区块链节点地址" span={1}>
                  <Text code style={{ whiteSpace: 'nowrap' }}>ws://8.147.107.221:19944</Text>
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={1}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Substrate区块链网络的WebSocket连接地址，用于前端应用与区块链节点建立实时连接，支持查询链上数据、提交交易、监听区块事件等操作。
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="中继器服务地址" span={1}>
                  <Text code style={{ whiteSpace: 'nowrap' }}>http://8.147.107.221:18000</Text>
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={1}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    pRuntime（隐私运行时）中继服务地址，作为区块链与TEE（可信执行环境）设备之间的通信桥梁。负责转发隐私计算任务到TEE Worker节点，处理加密数据交互，并确保TEE设备与链上合约之间的安全通信。
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="前端服务地址" span={1}>
                  <Text code style={{ whiteSpace: 'nowrap' }}>http://8.147.107.221:3000</Text>
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={1}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Web管理界面的HTTP访问地址，提供链计算平台的用户交互界面。用户可通过该地址访问系统管理、资源监控、合约部署、密钥管理等功能的可视化操作界面，该服务集成了前端应用和后端API代理。
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="API代理端点" span={1}>
                  <Text code style={{ whiteSpace: 'nowrap' }}>/api/node-health, /api/pruntime-proxy</Text>
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={1}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    前端应用内置的API代理端点，用于解决浏览器跨域（CORS）限制问题。/api/node-health用于代理访问区块链节点的健康检查接口，/api/pruntime-proxy用于代理访问pRuntime中继服务的RPC接口。
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="健康检查端点" span={1}>
                  <Text code style={{ whiteSpace: 'nowrap' }}>http://8.147.107.221:19944/health</Text>
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={1}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    区块链节点提供的HTTP健康检查接口，用于监控节点的运行状态和可用性。通过定期访问该端点，可以判断节点是否正常运行、是否已完成同步，以及网络连接是否正常。
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </div>
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
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}>
                <Card size="small" style={{ height: '100%' }}>
                  <Title level={5} style={{ fontSize: '14px', marginBottom: 12 }}>系统监控</Title>
                  <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: 20, fontSize: '13px' }}>
                    <li>定期检查服务状态和健康指标</li>
                    <li>监控系统资源使用情况（CPU、内存、磁盘）</li>
                    <li>设置告警机制，及时发现异常</li>
                    <li>建立日志轮转和清理机制</li>
                  </ul>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={8}>
                <Card size="small" style={{ height: '100%' }}>
                  <Title level={5} style={{ fontSize: '14px', marginBottom: 12 }}>安全建议</Title>
                  <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: 20, fontSize: '13px' }}>
                    <li>定期更新系统和依赖包</li>
                    <li>配置防火墙规则，限制不必要的端口访问</li>
                    <li>使用HTTPS加密传输</li>
                    <li>定期备份重要数据和配置</li>
                  </ul>
                </Card>
              </Col>

              <Col xs={24} sm={12} lg={8}>
                <Card size="small" style={{ height: '100%' }}>
                  <Title level={5} style={{ fontSize: '14px', marginBottom: 12 }}>性能优化</Title>
                  <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: 20, fontSize: '13px' }}>
                    <li>使用SSD存储提高I/O性能</li>
                    <li>配置适当的缓存策略</li>
                    <li>优化数据库查询和索引</li>
                    <li>定期清理临时文件和日志</li>
                  </ul>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </MainLayout>
  );
};

export default DocsPage;