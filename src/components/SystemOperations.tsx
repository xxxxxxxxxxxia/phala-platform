// src/components/SystemOperations.tsx
import React from 'react';
import { Button, Space } from 'antd';
import styles from '../styles/IncentiveFlow.module.css';
import WorkerSetup from './WorkerSetup';
import PoolSetup from './PoolSetup';
import AssetSetup from './AssetSetup';
import TokenomicEditor from './TokenomicEditor';
import Console from './Console';
import type { IAccount } from './IncentiveFlow';
import { ApiPromise } from "@polkadot/api";

interface Props {
    setView: (view: 'dashboard' | 'system') => void;
    lastResult: string;
    api: ApiPromise | null;
    accounts: IAccount[];
    selectedAccount: string;
    isTxInProgress: boolean;
    formatAddress: (address: string, length?: number) => string;
    sendTransaction: (extrinsic: any, isSudo?: boolean, senderAddress?: string | null) => Promise<void>;
    handleError: (message: string) => void;
    log: (message: string, isError?: boolean) => void;
    gatekeeperPub: string; setGatekeeperPub: (v: string) => void; registerGatekeeper: () => void;
    forcePub: string; setForcePub: (v: string) => void;
    forceEcdhPub: string; setForceEcdhPub: (v: string) => void;
    forceOperator: string; setForceOperator: (v: string) => void;
    forceRegisterWorker: () => void;
    createPoolSender: string; setCreatePoolSender: (v: string) => void; createPool: () => void;
    createAssetSender: string; setCreateAssetSender: (v: string) => void;
    createAssetId: number; setCreateAssetId: (v: number) => void;
    createAssetMinBalance: number; setCreateAssetMinBalance: (v: number) => void;
    createAssetAdmin: string; setCreateAssetAdmin: (v: string) => void;
    createAsset: () => void;
    mintAssetSender: string; setMintAssetSender: (v: string) => void;
    mintAssetId: number; setMintAssetId: (v: number) => void;
    mintAmount: string; setMintAmount: (v: string) => void;
    mintBeneficiary: string; setMintBeneficiary: (v: string) => void;
    mintAsset: () => void;
    contributeSender: string; setContributeSender: (v: string) => void;
    touchWho: string; setTouchWho: (v: string) => void; touchOther: () => void;
    contribPid: string; setContribPid: (v: string) => void;
    contribAmount: string; setContribAmount: (v: string) => void;
    useAsVault: boolean; setUseAsVault: (v: boolean) => void;
    asVaultValue: string; setAsVaultValue: (v: string) => void;
    contribute: () => void;
    touchLockAccountSender: string; setTouchLockAccountSender: (v: string) => void;
    touchLockAccountAddress: string; setTouchLockAccountAddress: (v: string) => void;
    touchOtherForLockAccount: () => void;
    transferSender: string; setTransferSender: (v: string) => void;
    transferRecipient: string; setTransferRecipient: (v: string) => void;
    transferAmount: number; setTransferAmount: (v: number) => void;
    sendTransfer: () => void;
    tokenomicJson: string; setTokenomicJson: (v: string) => void;
    loadDefaultTokenomic: () => void; updateTokenomic: () => void;
}

const SystemOperations: React.FC<Props> = (props) => {
    return (
        <Space direction="vertical" size="large" style={{ display: 'flex' }}>
            <div>
                <Button onClick={() => props.setView('dashboard')} type="primary" style={{ minWidth: 125 }}>
                    &larr; 返回主面板
                </Button>
            </div>

            <WorkerSetup
                gatekeeperPub={props.gatekeeperPub} setGatekeeperPub={props.setGatekeeperPub}
                registerGatekeeper={props.registerGatekeeper} selectedAccount={props.selectedAccount}
                isTxInProgress={props.isTxInProgress} forcePub={props.forcePub} setForcePub={props.setForcePub}
                forceEcdhPub={props.forceEcdhPub} setForceEcdhPub={props.setForceEcdhPub}
                forceOperator={props.forceOperator} setForceOperator={props.setForceOperator}
                accounts={props.accounts} formatAddress={props.formatAddress}
                forceRegisterWorker={props.forceRegisterWorker}
            />

            <PoolSetup
                createPool={props.createPool}
                createPoolSender={props.createPoolSender}
                setCreatePoolSender={props.setCreatePoolSender}
                accounts={props.accounts}
                isTxInProgress={props.isTxInProgress}
                formatAddress={props.formatAddress}
            />

            <AssetSetup
                accounts={props.accounts} isTxInProgress={props.isTxInProgress} formatAddress={props.formatAddress}
                createAssetSender={props.createAssetSender} setCreateAssetSender={props.setCreateAssetSender}
                createAssetId={props.createAssetId} setCreateAssetId={props.setCreateAssetId}
                createAssetMinBalance={props.createAssetMinBalance} setCreateAssetMinBalance={props.setCreateAssetMinBalance}
                createAssetAdmin={props.createAssetAdmin} setCreateAssetAdmin={props.setCreateAssetAdmin}
                createAsset={props.createAsset}
                mintAssetSender={props.mintAssetSender} setMintAssetSender={props.setMintAssetSender}
                mintAssetId={props.mintAssetId} setMintAssetId={props.setMintAssetId}
                mintAmount={props.mintAmount} setMintAmount={props.setMintAmount}
                mintBeneficiary={props.mintBeneficiary} setMintBeneficiary={props.setMintBeneficiary}
                mintAsset={props.mintAsset}
                contributeSender={props.contributeSender} setContributeSender={props.setContributeSender}
                touchWho={props.touchWho} setTouchWho={props.setTouchWho} touchOther={props.touchOther}
                contribPid={props.contribPid} setContribPid={props.setContribPid}
                contribAmount={props.contribAmount} setContribAmount={props.setContribAmount}
                useAsVault={props.useAsVault} setUseAsVault={props.setUseAsVault}
                asVaultValue={props.asVaultValue} setAsVaultValue={props.setAsVaultValue}
                contribute={props.contribute}
                touchLockAccountSender={props.touchLockAccountSender} setTouchLockAccountSender={props.setTouchLockAccountSender}
                touchLockAccountAddress={props.touchLockAccountAddress} setTouchLockAccountAddress={props.setTouchLockAccountAddress}
                touchOtherForLockAccount={props.touchOtherForLockAccount}
                transferSender={props.transferSender} setTransferSender={props.setTransferSender}
                transferRecipient={props.transferRecipient} setTransferRecipient={props.setTransferRecipient}
                transferAmount={props.transferAmount} setTransferAmount={props.setTransferAmount}
                sendTransfer={props.sendTransfer}
            />


            <TokenomicEditor
                loadDefaultTokenomic={props.loadDefaultTokenomic} tokenomicJson={props.tokenomicJson}
                setTokenomicJson={props.setTokenomicJson} updateTokenomic={props.updateTokenomic}
                selectedAccount={props.selectedAccount} isTxInProgress={props.isTxInProgress}
            />
            {props.lastResult && <Console lastResult={props.lastResult} />}
        </Space>
    );
};

export default SystemOperations;