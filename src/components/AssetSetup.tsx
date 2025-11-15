// src/components/AssetSetup.tsx
import React from 'react';
import { Card, Form, Input, Button, Select, Row, Col, Checkbox, Space, Divider} from 'antd';
import styles from '../styles/IncentiveFlow.module.css';
import type { IAccount } from './IncentiveFlow';

// Props 接口定义了所有从 SystemOperations 传递过来的属性
interface Props {
    accounts: IAccount[];
    isTxInProgress: boolean;
    formatAddress: (address: string, length?: number) => string;

    // Create Asset
    createAssetSender: string; setCreateAssetSender: (val: string) => void;
    createAssetId: number; setCreateAssetId: (val: number) => void;
    createAssetMinBalance: number; setCreateAssetMinBalance: (val: number) => void;
    createAssetAdmin: string; setCreateAssetAdmin: (val: string) => void;
    createAsset: () => void;

    // Mint Asset
    mintAssetSender: string; setMintAssetSender: (val: string) => void;
    mintAssetId: number; setMintAssetId: (val: number) => void;
    mintAmount: string; setMintAmount: (val: string) => void;
    mintBeneficiary: string; setMintBeneficiary: (val: string) => void;
    mintAsset: () => void;

    // Contribute
    contributeSender: string; setContributeSender: (val: string) => void;
    touchWho: string; setTouchWho: (val: string) => void;
    touchOther: () => void;
    contribPid: string; setContribPid: (val: string) => void;
    contribAmount: string; setContribAmount: (val: string) => void;
    useAsVault: boolean; setUseAsVault: (val: boolean) => void;
    asVaultValue: string; setAsVaultValue: (val: string) => void;
    contribute: () => void;

    // Touch Lock Account
    touchLockAccountSender: string; setTouchLockAccountSender: (val: string) => void;
    touchLockAccountAddress: string; setTouchLockAccountAddress: (val: string) => void;
    touchOtherForLockAccount: () => void;

    // Transfer
    transferSender: string; setTransferSender: (val: string) => void;
    transferRecipient: string; setTransferRecipient: (val: string) => void;
    transferAmount: number; setTransferAmount: (val: number) => void;
    sendTransfer: () => void;

}

const AssetSetup: React.FC<Props> = (props) => {
    const {
        accounts, isTxInProgress, formatAddress, createAssetSender, setCreateAssetSender,
        createAssetId, setCreateAssetId, createAssetMinBalance, setCreateAssetMinBalance,
        createAssetAdmin, setCreateAssetAdmin, createAsset, mintAssetSender, setMintAssetSender,
        mintAssetId, setMintAssetId, mintAmount, setMintAmount, mintBeneficiary, setMintBeneficiary,
        mintAsset, contributeSender, setContributeSender, touchWho, setTouchWho, touchOther,
        contribPid, setContribPid, contribAmount, setContribAmount, useAsVault, setUseAsVault,
        asVaultValue, setAsVaultValue, contribute, touchLockAccountSender, setTouchLockAccountSender,
        touchLockAccountAddress, setTouchLockAccountAddress, touchOtherForLockAccount, transferSender,
        setTransferSender, transferRecipient, setTransferRecipient, transferAmount, setTransferAmount,
        sendTransfer
    } = props;
    return (
        <Card title="资产设置与分配">
            <Form layout="vertical">
                <Space direction="vertical" size="large" style={{ display: 'flex' }}>

                    <Card type="inner" title="创建 & 铸造资产">
                        <Form.Item label="交易发送账户 (创建者)">
                            <Select value={createAssetSender} onChange={setCreateAssetSender} disabled={!accounts.length} placeholder="请选择创建资产的账户">
                                {accounts.map(a => (<Select.Option key={a.address} value={a.address}>{a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}</Select.Option>))}
                            </Select>
                        </Form.Item>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item label="资产 ID (id)"><Input value={createAssetId} onChange={e => setCreateAssetId(Number(e.target.value))} type="number" /></Form.Item></Col>
                            <Col span={12}><Form.Item label="最小余额 (minBalance)"><Input value={createAssetMinBalance} onChange={e => setCreateAssetMinBalance(Number(e.target.value))} type="number" /></Form.Item></Col>
                        </Row>
                        <Form.Item label="管理员 (admin)">
                             <Select value={createAssetAdmin} onChange={setCreateAssetAdmin} disabled={!accounts.length} placeholder="请选择一个管理员账户">
                                {accounts.map(a => (<Select.Option key={a.address} value={a.address}>{a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}</Select.Option>))}
                            </Select>
                        </Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                            <Button type="primary" onClick={createAsset} disabled={!createAssetSender || isTxInProgress} style={{ minWidth: 125 }}>创建资产</Button>
                        </div>
                        <Divider />
                        
                        <Form.Item label="交易发送账户 (铸造者)">
                            <Select value={mintAssetSender} onChange={setMintAssetSender} disabled={!accounts.length} placeholder="请选择铸造资产的账户">
                               {accounts.map(a => (<Select.Option key={a.address} value={a.address}>{a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}</Select.Option>))}
                            </Select>
                        </Form.Item>
                         <Row gutter={16}>
                            <Col span={12}><Form.Item label="资产 ID"><Input value={mintAssetId} onChange={e => setMintAssetId(Number(e.target.value))} type="number"/></Form.Item></Col>
                            <Col span={12}><Form.Item label="铸造数量 (最小单位)"><Input value={mintAmount} onChange={e => setMintAmount(e.target.value)} /></Form.Item></Col>
                        </Row>
                        <Form.Item label="受益人 (beneficiary)">
                             <Select value={mintBeneficiary} onChange={setMintBeneficiary} disabled={!accounts.length} placeholder="请选择一个受益人账户">
                                {accounts.map(a => (<Select.Option key={a.address} value={a.address}>{a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}</Select.Option>))}
                            </Select>
                        </Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%'}}>
                            <Button type="primary" onClick={mintAsset} disabled={!mintAssetSender || isTxInProgress} style={{ minWidth: 125 }}>铸造资产</Button>
                        </div>
                    </Card>

                    <Card type="inner" title="为池账户注入资产">
                        <Form.Item label="操作账户">
                            <Select value={contributeSender} onChange={setContributeSender} disabled={!accounts.length} placeholder="请选择发送交易的账户">
                                {accounts.map(a => (<Select.Option key={a.address} value={a.address}>{a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}</Select.Option>))}
                            </Select>
                        </Form.Item>
                        <Form.Item label="目标池账户 & 资产ID">
                            <Space.Compact style={{ width: '100%' }}>
                                <Input value={touchWho} onChange={e => setTouchWho(e.target.value)} placeholder="从上方列表复制池账户地址" />
                                <Input style={{ width: 200 }} value={mintAssetId} onChange={e => setMintAssetId(Number(e.target.value))} type="number" addonBefore="ID" />
                            </Space.Compact>
                        </Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                            <Button type="primary" onClick={touchOther} disabled={!contributeSender || isTxInProgress} style={{ minWidth: 125 }}>创建资产账户</Button>
                        </div>
                        
                        <Divider />

                        <Row gutter={16}>
                            <Col span={12}><Form.Item label="池ID (pid)"><Input value={contribPid} onChange={e => setContribPid(e.target.value)} type="number" /></Form.Item></Col>
                            <Col span={12}><Form.Item label="贡献数量"><Input value={contribAmount} onChange={e => setContribAmount(e.target.value)} /></Form.Item></Col>
                        </Row>
                        <Checkbox checked={useAsVault} onChange={e => setUseAsVault(e.target.checked)}>设置 asVault (可选)</Checkbox>
                        {useAsVault && <Input value={asVaultValue} onChange={e => setAsVaultValue(e.target.value)} type="number" placeholder="输入 Vault ID" style={{marginTop: 8}}/>}
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginTop: 16 }}>
                            <Button type="primary" onClick={contribute} disabled={!contributeSender || isTxInProgress} style={{ minWidth: 125 }}>贡献资产到池</Button>
                        </div>
                    </Card>

                    <Card type="inner" title="为锁仓/Session账户操作">
                         <Form.Item label="操作账户">
                             <Select value={touchLockAccountSender} onChange={setTouchLockAccountSender} disabled={!accounts.length} placeholder="请选择发送交易的账户">
                                {accounts.map(a => (<Select.Option key={a.address} value={a.address}>{a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}</Select.Option>))}
                            </Select>
                        </Form.Item>
                        <Form.Item label="目标锁仓账户 & 资产ID">
                            <Space.Compact style={{ width: '100%' }}>
                                <Input value={touchLockAccountAddress} onChange={e => setTouchLockAccountAddress(e.target.value)} placeholder="从上方列表复制锁仓账户地址" />
                                <Input style={{ width: 200 }} value={mintAssetId} onChange={e => setMintAssetId(Number(e.target.value))} type="number" addonBefore="ID" />
                            </Space.Compact>
                        </Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                            <Button type="primary" onClick={touchOtherForLockAccount} disabled={!touchLockAccountSender || isTxInProgress} style={{ minWidth: 125 }}>创建资产账户</Button>
                        </div>

                        <Divider />
                        
                        <Form.Item label="操作账户">
                             <Select value={transferSender} onChange={setTransferSender} disabled={!accounts.length} placeholder="请选择发送交易的账户">
                                {accounts.map(a => (<Select.Option key={a.address} value={a.address}>{a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}</Select.Option>))}
                            </Select>
                        </Form.Item>
                        <Row gutter={16}>
                            <Col span={16}><Form.Item label="接收账户 (Session)"><Input value={transferRecipient} onChange={e => setTransferRecipient(e.target.value)}/></Form.Item></Col>
                            <Col span={8}><Form.Item label="转账金额 (CMC)"><Input value={transferAmount} onChange={e => setTransferAmount(Number(e.target.value))} type="number"/></Form.Item></Col>
                        </Row>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                            <Button type="primary" onClick={sendTransfer} disabled={!transferSender || isTxInProgress} style={{ minWidth: 125 }}>转账</Button>
                        </div>
                    </Card>
                </Space>
            </Form>
        </Card>
    );
}

export default AssetSetup;