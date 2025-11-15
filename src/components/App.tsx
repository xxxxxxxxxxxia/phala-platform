// App.tsx
import React, { useState } from 'react';
import { Card, Upload, Button, Alert, Space, Spin, message } from 'antd';
import { InboxOutlined, CloudUploadOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import type { UploadFile } from 'antd/es/upload/interface';

const { Dragger } = Upload;

type DeployResponse = {
  message: string;
  output?: string;
  error?: string;
  command?: string;
};

type Props = {
  embedded?: boolean;
};

export default function App({ embedded = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeployResponse | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  /* 上传前校验 */
  const beforeUpload = (file: File) => {
    const isYaml =
      file.type === 'application/x-yaml' ||
      file.name.endsWith('.yaml') ||
      file.name.endsWith('.yml');
    if (!isYaml) {
      message.error('只能上传 docker-compose.yaml / *.yml 文件');
      return Upload.LIST_IGNORE;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超过 10MB');
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
    formData.append('composeFile', file);
    try {
      const { data } = await axios.post<DeployResponse>('/api/deploy', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      console.log(data);
      
      message.success('部署完成');
    } catch (err: any) {
      const resp = err.response?.data as DeployResponse;
      setResult(resp || { message: '网络异常，请稍后重试' });
      message.error('部署失败');
    } finally {
      setLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = embedded
    ? { maxWidth: '100%', margin: 0 }
    : { maxWidth: 600, margin: '64px auto' };

  const cardProps = embedded
    ? { bordered: false, style: { background: 'transparent' } as React.CSSProperties }
    : { bordered: false };

  // 下载docker-compose.yml文件
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/api/download-compose';
    link.download = 'docker-compose.yml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('开始下载docker-compose.yml文件');
  };

  return (
    <div style={containerStyle}>
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Docker Compose 部署工具</span>
            <Button 
              type="default" 
              icon={<DownloadOutlined />} 
              onClick={handleDownload}
              size="small"
            >
              下载部署文件
            </Button>
          </div>
        }
        {...cardProps}
      >
        <Spin spinning={loading} tip="正在部署，请稍候…">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
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
              <p className="ant-upload-text">点击或拖拽 docker-compose.yaml 文件到此处</p>
              <p className="ant-upload-hint">仅支持 .yaml / .yml 文件，大小 ≤ 10MB</p>
            </Dragger>

            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={loading}
              disabled={fileList.length === 0}
              onClick={() => {
                const file = fileList[0].originFileObj;
                if (file) customRequest({ file });
              }}
              block
            >
              开始部署
            </Button>

            {result && (
              <div>
                {!result.error && result.output && (
                  <Button
                    type="primary"
                    onClick={() => window.open('http://43.132.154.142:9876/privacy_demo.html', '_blank')}
                    block
                    style={{ marginBottom: '16px' }}
                  >
                    部署页面
                  </Button>
                )}
                
                <Alert
                  message={!result.error ? '部署成功！' : '部署失败'}
                  description={
                    !result.error ? (
                      <div>
                        <p style={{ color: '#52c41a', fontWeight: 'bold' }}>
                          ✅ docker-compose.yaml 文件已成功部署并启动服务
                        </p>
                        <p style={{ color: '#52c41a' }}>success</p>
                      </div>
                    ) : (
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {result.error || result.message}
                      </pre>
                    )
                  }
                  type={!result.error ? 'success' : 'error'}
                  showIcon
                  closable
                  onClose={() => setResult(null)}
                />
              </div>
            )}
          </Space>
        </Spin>
      </Card>
    </div>
  );
}