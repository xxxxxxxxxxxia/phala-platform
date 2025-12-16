import { NextRequest, NextResponse } from 'next/server';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';
import { hexToU8a } from '@polkadot/util';
import { getWorkersInfo, WorkerInfo } from '../../../lib/phalaApi';
import { getNodeUrl, getPruntimeUrl } from '@/lib/config';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import http from 'http';
const WS_ENDPOINT = getNodeUrl();
const PRUNTIME_ENDPOINT = getPruntimeUrl();
let api: ApiPromise | null = null;

// 历史记录文件路径
// 在 standalone 模式下，需要从项目根目录查找 data 目录
// 如果当前目录没有 data，尝试从上级目录查找（standalone 模式在 .next/standalone 目录运行）
function getDataDir() {
  const cwd = process.cwd();
  // 检查当前目录是否有 data 文件夹
  const dataDirInCwd = path.join(cwd, 'data');
  if (fs.existsSync(dataDirInCwd)) {
    return dataDirInCwd;
  }
  // 如果在 standalone 模式下（.next/standalone），向上查找
  if (cwd.includes('.next/standalone')) {
    const projectRoot = cwd.split('.next/standalone')[0];
    const dataDirInRoot = path.join(projectRoot, 'data');
    if (fs.existsSync(dataDirInRoot)) {
      return dataDirInRoot;
    }
  }
  // 默认使用当前目录
  return dataDirInCwd;
}

const DATA_DIR = getDataDir();
const HISTORY_FILE_PATH = path.join(DATA_DIR, 'sgx-key-rotation-history.json');
const CONTRACT_ROTATION_HISTORY_FILE_PATH = path.join(DATA_DIR, 'contract-rotation-history.json');

// 确保数据目录存在
function ensureDataDir() {
  const dataDir = path.dirname(HISTORY_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// 从文件加载合约轮换历史记录
function loadContractRotationHistoryFromFile(): any[] {
  try {
    ensureDataDir();
    if (fs.existsSync(CONTRACT_ROTATION_HISTORY_FILE_PATH)) {
      const fileContent = fs.readFileSync(CONTRACT_ROTATION_HISTORY_FILE_PATH, 'utf-8').trim();
      // 检查文件内容是否为空
      if (!fileContent || fileContent === '') {
        return [];
      }
      const history = JSON.parse(fileContent);
      return Array.isArray(history) ? history : [];
    }
  } catch (error) {
    console.error('Failed to load contract rotation history from file:', error);
    // 如果文件损坏，返回空数组而不是抛出错误
    return [];
  }
  return [];
}

// 保存合约轮换历史记录到文件
function saveContractRotationHistoryToFile(history: any[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(CONTRACT_ROTATION_HISTORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save contract rotation history to file:', error);
  }
}

// 从文件加载历史记录
function loadRotationHistoryFromFile(): any[] {
  try {
    ensureDataDir();
    if (fs.existsSync(HISTORY_FILE_PATH)) {
      const fileContent = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8');
      const data = JSON.parse(fileContent);
      // 验证数据格式
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (error) {
    console.error('Failed to load rotation history from file:', error);
  }
  return [];
}

// 保存历史记录到文件
function saveRotationHistoryToFile(history: any[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save rotation history to file:', error);
  }
}

// 清除历史记录文件（当node关闭时调用）
function clearRotationHistoryFile() {
  try {
    if (fs.existsSync(HISTORY_FILE_PATH)) {
      fs.unlinkSync(HISTORY_FILE_PATH);
    }
  } catch (error) {
    console.error('Failed to clear rotation history file:', error);
  }
}

async function getApi(): Promise<ApiPromise> {
  if (api && api.isConnected) {
    return api;
  }
  const wsProvider = new WsProvider(WS_ENDPOINT);
  api = await ApiPromise.create({ provider: wsProvider });
  return api;
}

// 获取Pruntime的真实密钥信息
async function getPruntimeKeyInfo() {
  try {
    const response = await fetch(`${PRUNTIME_ENDPOINT}/info`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Pruntime info:', error);
    return null;
  }
}

// 从链上查询主密钥
async function getMasterPubkeyFromChain(): Promise<string | null> {
  try {
    const api = await getApi();
    const masterPubkeyData = await api.query.phalaRegistry.gatekeeperMasterPubkey();
    
    if (masterPubkeyData && (masterPubkeyData as any).isSome) {
      const masterPubkeyHex = (masterPubkeyData as any).unwrap().toString();
      // 移除 0x 前缀并转换为小写
      const masterPubkey = masterPubkeyHex.startsWith('0x') 
        ? masterPubkeyHex.slice(2).toLowerCase() 
        : masterPubkeyHex.toLowerCase();
      return masterPubkey;
    } else if (masterPubkeyData && masterPubkeyData.toString && masterPubkeyData.toString() !== '') {
      // 如果不是 Option 类型，直接使用 toString()
      const masterPubkeyHex = masterPubkeyData.toString();
      const masterPubkey = masterPubkeyHex.startsWith('0x') 
        ? masterPubkeyHex.slice(2).toLowerCase() 
        : masterPubkeyHex.toLowerCase();
      return masterPubkey;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to query master pubkey from chain:', error);
    return null;
  }
}

// 等待轮换完成（等待 masterKeyRotationLock 被清除）
async function waitForRotationComplete(maxWaitTime: number = 120000): Promise<boolean> {
  const api = await getApi();
  const startTime = Date.now();
  const checkInterval = 3000; // 每3秒检查一次
  
  console.log('等待轮换完成（检查 masterKeyRotationLock）...');
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // 检查 masterKeyRotationLock 是否被清除
      const lockData = await api.query.phalaRegistry.masterKeyRotationLock();
      let lockValue: number;
      
      // 尝试多种方式获取数值
      if ((lockData as any).toNumber) {
        lockValue = (lockData as any).toNumber();
      } else if ((lockData as any).toBn) {
        lockValue = (lockData as any).toBn().toNumber();
      } else {
        const lockStr = lockData.toString();
        lockValue = lockStr === '0' || lockStr === 'false' || lockStr === '' ? 0 : 1;
      }
      
      if (lockValue === 0) {
        console.log('✅ masterKeyRotationLock 已清除，轮换完成');
        // 再等待一个区块确认，确保状态已更新
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
      }
      
      console.log(`masterKeyRotationLock 仍为 ${lockValue}，继续等待...`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      console.error('检查 masterKeyRotationLock 时出错:', error);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  console.warn('⚠️ 等待轮换完成超时');
  return false;
}

interface KeyRotation {
  id: string;
  keyId: string;
  keyType: 'ECDSA' | 'Ed25519' | 'SR25519' | 'BLS';
  owner: string; // Worker_前缀+密钥ID 或 Gatekeeper_前缀+密钥ID
  algorithm: string;
  keySize: number; // bits
  // 只保留真实可获取的数据
  publicKey?: string; // 真实的公钥
  pendingMessages?: number; // 待处理消息数
}

interface RotationState {
  keys: KeyRotation[];
  totalKeys: number;
  activeKeys: number;
  rotatingKeys: number;
  expiredKeys: number;
  lastUpdate: number;
}

let rotationState: RotationState = {
  keys: [],
  totalKeys: 0,
  activeKeys: 0,
  rotatingKeys: 0,
  expiredKeys: 0,
  lastUpdate: 0,
};

// 真实的轮换历史记录存储（从文件加载，持久化保存）
let rotationHistory: any[] = loadRotationHistoryFromFile();

// 轮换配置存储
let rotationConfig = {
  interval: 24 * 60 * 60 * 1000, // 默认24小时
  autoRotation: false,
  lastRotation: null as number | null,
  nextRotation: null as number | null,
};

// 自动轮换定时器
let rotationTimer: NodeJS.Timeout | null = null;

// 自动轮换执行锁，防止并发执行
let isAutoRotationRunning = false;

// 启动自动轮换
function startAutoRotation() {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
  
  if (rotationConfig.autoRotation && rotationConfig.interval > 0) {
    console.log(`启动自动轮换，间隔: ${rotationConfig.interval}ms`);
    rotationTimer = setInterval(async () => {
      try {
        // 首先检查自动轮换是否仍然启用
        if (!rotationConfig.autoRotation) {
          console.log('自动轮换已关闭，停止定时器');
          stopAutoRotation();
          return;
        }
        // 检查是否正在执行，如果是则跳过
        if (isAutoRotationRunning) {
          console.log('自动轮换正在执行中，跳过本次触发');
          return;
        }
        console.log('执行自动轮换...');
        await performAutoRotation();
      } catch (error) {
        console.error('自动轮换失败:', error);
        // 确保在出错时也释放锁
        isAutoRotationRunning = false;
      }
    }, rotationConfig.interval);
  }
}

// 停止自动轮换
function stopAutoRotation() {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
    console.log('停止自动轮换');
  }
  isAutoRotationRunning = false;
}

// 执行自动轮换
async function performAutoRotation() {
  // 首先检查自动轮换是否仍然启用
  if (!rotationConfig.autoRotation) {
    console.log('自动轮换已关闭，停止执行');
    stopAutoRotation();
    return;
  }
  
  // 检查是否正在执行，防止并发
  if (isAutoRotationRunning) {
    console.log('自动轮换正在执行中，跳过本次调用');
    return;
  }
  
  // 检查轮换间隔
  const currentTime = Date.now();
  if (rotationConfig.lastRotation && (currentTime - rotationConfig.lastRotation) < rotationConfig.interval) {
    console.log('轮换间隔未到，跳过本次自动轮换');
    return;
  }
  
  // 再次检查自动轮换状态（双重检查）
  if (!rotationConfig.autoRotation) {
    console.log('自动轮换已关闭，停止执行');
    return;
  }
  
  // 立即设置执行锁和更新 lastRotation，防止并发执行
  isAutoRotationRunning = true;
  rotationConfig.lastRotation = currentTime; // 立即更新，防止并发
  
  try {
    console.log('开始执行自动轮换...');
    
    const rotationId = `auto_rotation_${Date.now()}`;
    const startTime = Date.now();
    
    // 先获取轮换前的gatekeeper主密钥（从链上查询）
    console.log('查询轮换前的gatekeeper主密钥...');
    const oldKey = await getMasterPubkeyFromChain();
    console.log('轮换前gatekeeper主密钥:', oldKey);
    
    // 创建轮换记录，此时 oldKey 已经获取
    const rotationRecord = {
      id: rotationId,
      type: 'master_key',
      status: 'rotating',
      startTime: startTime,
      endTime: null,
      txHash: null,
      error: null,
      account: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      autoRotation: true,
      oldKey: oldKey,
      newKey: null,
    };
    
    // 将记录添加到历史中
    rotationHistory.push(rotationRecord);
    // 保存到文件
    saveRotationHistoryToFile(rotationHistory);
    
     // 执行真实的轮换过程 - 和立即轮换完全一样
     console.log('🔄 自动轮换触发，执行真实密钥轮换...');
     
     // 获取API连接
     const api = await getApi();
     
     // 使用sudo调用phalaRegistry.rotateMasterKey()
     const sudoCall = api.tx.sudo.sudo(
       api.tx.phalaRegistry.rotateMasterKey()
     );
     
      // 创建签名者
      const keyring = new Keyring({ type: 'sr25519' });
      const alice = keyring.addFromUri('//Alice');
      
      console.log('使用签名者:', alice.address);
      
      // 发送交易
    const txHash = await new Promise<string>((resolve, reject) => {
        sudoCall.signAndSend(alice, (result) => {
          console.log('交易状态更新:', result.status.toString());
          
          if (result.status.isInBlock) {
            console.log('交易已包含在区块中:', result.txHash.toString());
            resolve(result.txHash.toString());
          } else if (result.status.isFinalized) {
            console.log('交易已最终确认:', result.txHash.toString());
            resolve(result.txHash.toString());
          } else if (result.isError) {
            console.error('交易失败:', result);
            reject(new Error('交易执行失败'));
          }
        });
      });
     
    // 更新交易哈希
    rotationRecord.txHash = txHash;
     
     // 等待轮换完成（等待 masterKeyRotationLock 被清除）
     console.log('等待轮换完成...');
     const rotationComplete = await waitForRotationComplete(120000); // 最多等待2分钟
     
     if (!rotationComplete) {
       console.warn('⚠️ 轮换可能未完成，但继续查询新密钥');
     }
     
     // 获取轮换后的gatekeeper主密钥（从链上查询）
     console.log('查询轮换后的gatekeeper主密钥...');
    let newKey: string | null = null;
     let attempts = 0;
     const maxAttempts = 10; // 增加重试次数
     
     while (attempts < maxAttempts) {
       const currentKey = await getMasterPubkeyFromChain();
       
       if (currentKey) {
         console.log(`第${attempts + 1}次查询轮换后gatekeeper主密钥:`, currentKey);
         console.log('旧密钥:', oldKey ? oldKey.substring(0, 16) + '...' : 'null');
         console.log('当前查询到的密钥:', currentKey.substring(0, 16) + '...');
         console.log('是否相同:', currentKey === oldKey);
         
         // 如果新密钥与旧密钥不同，说明轮换成功
         if (currentKey && currentKey !== oldKey) {
           newKey = currentKey;
           console.log('🎉 密钥轮换成功！新密钥已生效');
           console.log('旧密钥:', oldKey ? oldKey.substring(0, 16) + '...' : 'null');
           console.log('新密钥:', newKey.substring(0, 16) + '...');
           break;
         } else {
           console.log('⚠️ 密钥尚未更新，仍与旧密钥相同');
         }
       } else {
         console.log('⚠️ 未查询到主密钥');
       }
       
       attempts++;
       if (attempts < maxAttempts) {
         console.log(`等待3秒后重试... (${attempts}/${maxAttempts})`);
         await new Promise(resolve => setTimeout(resolve, 3000));
       }
     }
     
     // 如果轮换后密钥仍为 null 或与旧密钥相同，再次尝试查询
     if (!newKey || newKey === oldKey) {
       console.log('⚠️ 循环结束后仍未获取到新密钥，进行最终查询...');
       const finalKey = await getMasterPubkeyFromChain();
       console.log('最终查询到的密钥:', finalKey ? finalKey.substring(0, 16) + '...' : 'null');
       console.log('旧密钥:', oldKey ? oldKey.substring(0, 16) + '...' : 'null');
       console.log('是否相同:', finalKey === oldKey);
       
       if (finalKey && finalKey !== oldKey) {
         newKey = finalKey;
         console.log('✅ 最终查询到新密钥:', newKey.substring(0, 16) + '...');
       } else {
         console.warn('⚠️ 未能获取到新密钥，可能轮换尚未完成');
         // 确保 newKey 不会被设置为 oldKey
         newKey = null;
       }
     }
     
     // 最终验证：确保 newKey 不等于 oldKey
     if (newKey && newKey === oldKey) {
       console.error('❌ 错误：新密钥与旧密钥相同，这不应该发生！');
       newKey = null;
     }
     
     // 更新轮换记录
     rotationRecord.status = 'completed';
     rotationRecord.endTime = Date.now();
     rotationRecord.newKey = newKey;
     // 保存到文件
     saveRotationHistoryToFile(rotationHistory);
     
     // 更新配置（lastRotation 已经在开始时更新了）
     rotationConfig.nextRotation = Date.now() + rotationConfig.interval;
     
     console.log('✅ 自动轮换成功完成');
     console.log('交易哈希:', txHash);
     console.log('下次自动轮换时间:', new Date(rotationConfig.nextRotation).toLocaleString());
    
  } catch (error) {
    console.error('自动轮换执行失败:', error);
    
    // 记录错误（如果 rotationRecord 存在，更新它；否则创建新的错误记录）
    const errorRecord = {
      id: `auto_error_${Date.now()}`,
      type: 'master_key',
      status: 'failed',
      startTime: Date.now(),
      endTime: Date.now(),
      txHash: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      account: 'auto',
      autoRotation: true,
      oldKey: null,
      newKey: null,
    };
    
    rotationHistory.push(errorRecord);
    // 保存到文件
    saveRotationHistoryToFile(rotationHistory);
  } finally {
    // 无论成功还是失败，都要释放执行锁
    isAutoRotationRunning = false;
  }
}

async function updateRotationState(): Promise<RotationState> {
  try {
    // 获取Pruntime的真实密钥信息
    const pruntimeInfo = await getPruntimeKeyInfo();
    const workers = await getWorkersInfo();

    // 从链上查询 Gatekeeper 和主密钥信息
    const api = await getApi();
    let chainGatekeepers: string[] = [];
    let chainMasterPubkey: string | null = null;
    
    try {
      // 查询所有 Gatekeeper worker
      const gatekeepersData = await api.query.phalaRegistry.gatekeeper();
      if (gatekeepersData && Array.isArray(gatekeepersData)) {
        chainGatekeepers = gatekeepersData.map((gk: any) => {
          const hex = gk.toHex ? gk.toHex() : gk.toString();
          // 移除 0x 前缀并转换为小写，便于比较
          return hex.startsWith('0x') ? hex.slice(2).toLowerCase() : hex.toLowerCase();
        });
      }
      
      // 查询链上的主密钥
      const masterPubkeyData = await api.query.phalaRegistry.gatekeeperMasterPubkey();
      if (masterPubkeyData && (masterPubkeyData as any).isSome) {
        const masterPubkeyHex = (masterPubkeyData as any).unwrap().toString();
        chainMasterPubkey = masterPubkeyHex.startsWith('0x') 
          ? masterPubkeyHex.slice(2).toLowerCase() 
          : masterPubkeyHex.toLowerCase();
      } else if (masterPubkeyData && masterPubkeyData.toString && masterPubkeyData.toString() !== '') {
        // 如果不是 Option 类型，直接使用 toString()
        const masterPubkeyHex = masterPubkeyData.toString();
        chainMasterPubkey = masterPubkeyHex.startsWith('0x') 
          ? masterPubkeyHex.slice(2).toLowerCase() 
          : masterPubkeyHex.toLowerCase();
      }
    } catch (error) {
      console.error('Failed to query chain gatekeeper info:', error);
    }

    const newKeys: KeyRotation[] = [];
    let activeKeysCount = 0;
    let rotatingKeysCount = 0;
    let expiredKeysCount = 0;

    // 基于真实Pruntime数据生成密钥信息
    if (pruntimeInfo) {
      // 1. Worker身份密钥 (基于Pruntime的public_key)
      const workerIdentityKey: KeyRotation = {
        id: 'worker-identity-key',
        keyId: `SR25519_${pruntimeInfo.public_key.substring(0, 8)}...`,
        keyType: 'SR25519',
        owner: `Worker_${pruntimeInfo.public_key.substring(0, 8)}`,
        algorithm: 'Sr25519',
        keySize: 256,
        publicKey: pruntimeInfo.public_key,
        pendingMessages: pruntimeInfo.pending_messages || 0,
      };
      newKeys.push(workerIdentityKey);
      activeKeysCount++;

      // 2. Worker通信密钥 (基于Pruntime的ecdh_public_key)
      const workerCommunicationKey: KeyRotation = {
        id: 'worker-communication-key',
        keyId: `ECDSA_${pruntimeInfo.ecdh_public_key.substring(0, 8)}...`,
        keyType: 'ECDSA',
        owner: `Worker_${pruntimeInfo.ecdh_public_key.substring(0, 8)}`,
        algorithm: 'secp256k1',
        keySize: 256,
        publicKey: pruntimeInfo.ecdh_public_key,
        pendingMessages: pruntimeInfo.pending_messages || 0,
      };
      newKeys.push(workerCommunicationKey);
      activeKeysCount++;

      // 3. Gatekeeper主密钥 - 优先使用链上的主密钥，如果链上没有则使用 pruntime 本地的
      const pruntimePubkey = pruntimeInfo.public_key.startsWith('0x') 
        ? pruntimeInfo.public_key.slice(2).toLowerCase() 
        : pruntimeInfo.public_key.toLowerCase();
      
      const isGatekeeper = chainGatekeepers.includes(pruntimePubkey);
      const masterKeyToUse = chainMasterPubkey || 
        (pruntimeInfo.gatekeeper && pruntimeInfo.gatekeeper.master_public_key && pruntimeInfo.gatekeeper.master_public_key !== '' 
          ? (pruntimeInfo.gatekeeper.master_public_key.startsWith('0x') 
              ? pruntimeInfo.gatekeeper.master_public_key.slice(2).toLowerCase() 
              : pruntimeInfo.gatekeeper.master_public_key.toLowerCase())
          : null);
      
      // 如果当前 worker 是 gatekeeper 且主密钥存在，则显示主密钥
      if (isGatekeeper && masterKeyToUse) {
        const gatekeeperKey: KeyRotation = {
          id: 'gatekeeper-key',
          keyId: `GK_${masterKeyToUse.substring(0, 8)}...`,
          keyType: 'SR25519',
          owner: `Worker_${pruntimeInfo.public_key.substring(0, 8)}`,
          algorithm: 'Sr25519',
          keySize: 256,
          publicKey: masterKeyToUse.startsWith('0x') ? masterKeyToUse : '0x' + masterKeyToUse,
        };
        newKeys.push(gatekeeperKey);
        activeKeysCount++;
      }
    }

    // 4. 基于区块链Worker数据生成真实的Worker密钥（跳过当前pRuntime）
    for (let i = 0; i < Math.min(workers.length, 5); i++) {
      const worker = workers[i];
      
      // 跳过当前pRuntime的Worker，避免重复
      if (pruntimeInfo) {
        const workerKey = worker.publicKey.startsWith('0x') ? worker.publicKey.slice(2).toLowerCase() : worker.publicKey.toLowerCase();
        const pruntimeKey = pruntimeInfo.public_key.startsWith('0x') 
          ? pruntimeInfo.public_key.slice(2).toLowerCase() 
          : pruntimeInfo.public_key.toLowerCase();
        if (workerKey === pruntimeKey) {
          continue;
        }
      }
      
      // 移除0x前缀（如果有的话）
      const cleanPublicKey = worker.publicKey.startsWith('0x') ? worker.publicKey.slice(2) : worker.publicKey;
      const displayKey = cleanPublicKey.length >= 8 ? cleanPublicKey.substring(0, 8) : cleanPublicKey;
      
      // 简化：所有Worker密钥都算作活跃
      activeKeysCount++;

      // 为每个Worker生成两个真实密钥：SR25519身份密钥和ECDSA通信密钥
      
      // 1. SR25519身份密钥 (基于worker.publicKey)
      const identityKey: KeyRotation = {
        id: `worker-identity-${worker.key}`,
        keyId: `SR25519_${displayKey}...`,
        keyType: 'SR25519',
        owner: `Worker_${displayKey}`,
        algorithm: 'Sr25519',
        keySize: 256,
        publicKey: worker.publicKey,
      };
      newKeys.push(identityKey);

      // 2. ECDSA通信密钥 (基于worker.publicKey，因为Worker通常只有publicKey)
      const communicationKey: KeyRotation = {
        id: `worker-communication-${worker.key}`,
        keyId: `ECDSA_${displayKey}...`,
        keyType: 'ECDSA',
        owner: `Worker_${displayKey}`,
        algorithm: 'secp256k1',
        keySize: 256,
        publicKey: worker.publicKey, // 注意：这里使用同一个publicKey，因为Worker通常只有这一个密钥
      };
      newKeys.push(communicationKey);
      
      // 3. 如果这个 worker 是 gatekeeper 且链上有主密钥，也显示主密钥
      const workerPubkeyLower = cleanPublicKey.toLowerCase();
      if (chainGatekeepers.includes(workerPubkeyLower) && chainMasterPubkey) {
        const gatekeeperKey: KeyRotation = {
          id: `gatekeeper-key-${worker.key}`,
          keyId: `GK_${chainMasterPubkey.substring(0, 8)}...`,
          keyType: 'SR25519',
          owner: `Worker_${displayKey}`,
          algorithm: 'Sr25519',
          keySize: 256,
          publicKey: chainMasterPubkey.startsWith('0x') ? chainMasterPubkey : '0x' + chainMasterPubkey,
        };
        newKeys.push(gatekeeperKey);
        activeKeysCount++;
      }
    }

    rotationState = {
      keys: newKeys,
      totalKeys: newKeys.length,
      activeKeys: activeKeysCount,
      rotatingKeys: rotatingKeysCount,
      expiredKeys: expiredKeysCount,
      lastUpdate: Date.now(),
    };

    return rotationState;
  } catch (error) {
    console.error('Error updating rotation state:', error);
    return rotationState;
  }
}

export async function GET(request: NextRequest) {
  try {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

    if (action === 'cluster-keys') {
      return await getClusterAndContractKeys();
    }

  if (action === 'status') {
    const state = await updateRotationState();
    return NextResponse.json(state);
  }

    // 默认返回密钥状态
    return NextResponse.json(await updateRotationState());
  } catch (error) {
    console.error('Key rotation API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 处理主密钥轮换（简化版，用于测试前端提示）
async function handleMasterKeyRotation() {
  try {
    console.log('开始主密钥轮换...');
    
    const rotationId = `master_rotation_${Date.now()}`;
    const startTime = Date.now();
    
    // 先获取轮换前的gatekeeper主密钥（从链上查询）
    console.log('查询轮换前的gatekeeper主密钥...');
    const oldKey = await getMasterPubkeyFromChain();
    console.log('轮换前gatekeeper主密钥:', oldKey);
    
    // 创建轮换记录，此时 oldKey 已经获取
    const rotationRecord = {
      id: rotationId,
      type: 'master_key',
      status: 'rotating',
      startTime: startTime,
      endTime: null,
      txHash: null,
      error: null,
      account: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      oldKey: oldKey,
      newKey: null,
    };
    
    // 将记录添加到历史中
    rotationHistory.push(rotationRecord);
    // 保存到文件
    saveRotationHistoryToFile(rotationHistory);
    
    // 执行真实的区块链轮换
    try {
      console.log('开始执行真实的区块链轮换...');
      
      // 获取API连接
      const api = await getApi();
      
      // 使用sudo调用phalaRegistry.rotateMasterKey()
      const sudoCall = api.tx.sudo.sudo(
        api.tx.phalaRegistry.rotateMasterKey()
      );
      
       // 创建签名者
       const keyring = new Keyring({ type: 'sr25519' });
       const alice = keyring.addFromUri('//Alice');
       
       console.log('使用签名者:', alice.address);
       
       // 发送交易
      const txHash = await new Promise<string>((resolve, reject) => {
         sudoCall.signAndSend(alice, (result) => {
           console.log('交易状态更新:', result.status.toString());
           
           if (result.status.isInBlock) {
             console.log('交易已包含在区块中:', result.txHash.toString());
             resolve(result.txHash.toString());
           } else if (result.status.isFinalized) {
             console.log('交易已最终确认:', result.txHash.toString());
             resolve(result.txHash.toString());
           } else if (result.isError) {
             console.error('交易失败:', result);
             reject(new Error('交易执行失败'));
           }
         });
       });
      
      // 更新交易哈希
      rotationRecord.txHash = txHash;
      
      // 等待轮换完成（等待 masterKeyRotationLock 被清除）
      console.log('等待轮换完成...');
      const rotationComplete = await waitForRotationComplete(120000); // 最多等待2分钟
      
      if (!rotationComplete) {
        console.warn('⚠️ 轮换可能未完成，但继续查询新密钥');
      }
      
      // 获取轮换后的gatekeeper主密钥（从链上查询）
      console.log('查询轮换后的gatekeeper主密钥...');
      let newKey: string | null = null;
      let attempts = 0;
      const maxAttempts = 10; // 增加重试次数
      
      while (attempts < maxAttempts) {
        const currentKey = await getMasterPubkeyFromChain();
        
        if (currentKey) {
          console.log(`第${attempts + 1}次查询轮换后gatekeeper主密钥:`, currentKey);
          console.log('旧密钥:', oldKey ? oldKey.substring(0, 16) + '...' : 'null');
          console.log('当前查询到的密钥:', currentKey.substring(0, 16) + '...');
          console.log('是否相同:', currentKey === oldKey);
        
          // 如果新密钥与旧密钥不同，说明轮换成功
          if (currentKey && currentKey !== oldKey) {
            newKey = currentKey;
            console.log('🎉 密钥轮换成功！新密钥已生效');
            console.log('旧密钥:', oldKey ? oldKey.substring(0, 16) + '...' : 'null');
            console.log('新密钥:', newKey.substring(0, 16) + '...');
            break;
          } else {
            console.log('⚠️ 密钥尚未更新，仍与旧密钥相同');
          }
        } else {
          console.log('⚠️ 未查询到主密钥');
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`等待3秒后重试... (${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // 如果轮换后密钥仍为 null 或与旧密钥相同，再次尝试查询
      if (!newKey || newKey === oldKey) {
        console.log('⚠️ 循环结束后仍未获取到新密钥，进行最终查询...');
        const finalKey = await getMasterPubkeyFromChain();
        console.log('最终查询到的密钥:', finalKey ? finalKey.substring(0, 16) + '...' : 'null');
        console.log('旧密钥:', oldKey ? oldKey.substring(0, 16) + '...' : 'null');
        console.log('是否相同:', finalKey === oldKey);
        
        if (finalKey && finalKey !== oldKey) {
          newKey = finalKey;
          console.log('✅ 最终查询到新密钥:', newKey.substring(0, 16) + '...');
        } else {
          console.warn('⚠️ 未能获取到新密钥，可能轮换尚未完成');
          // 确保 newKey 不会被设置为 oldKey
          newKey = null;
        }
      }
      
      // 最终验证：确保 newKey 不等于 oldKey
      if (newKey && newKey === oldKey) {
        console.error('❌ 错误：新密钥与旧密钥相同，这不应该发生！');
        newKey = null;
      }
      
      // 更新轮换记录
      rotationRecord.status = 'completed';
      rotationRecord.endTime = Date.now();
      rotationRecord.newKey = newKey;
      // 保存到文件
      saveRotationHistoryToFile(rotationHistory);
      
      // 更新配置
      rotationConfig.lastRotation = Date.now();
      rotationConfig.nextRotation = Date.now() + rotationConfig.interval;
      
      console.log('真实的主密钥轮换完成，交易哈希:', txHash);
      
    } catch (error) {
      console.error('区块链轮换失败:', error);
      
      // 更新轮换记录为失败
      rotationRecord.status = 'failed';
      rotationRecord.endTime = Date.now();
      rotationRecord.error = error instanceof Error ? error.message : 'Unknown error';
      // 保存到文件
      saveRotationHistoryToFile(rotationHistory);
      
      throw error;
    }
    
    return NextResponse.json({
      success: true,
      rotationId: rotationId,
      message: '主密钥轮换成功完成',
      txHash: rotationRecord.txHash,
      directCall: true,
      realTransaction: true, // 标记为真实交易
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      account: rotationRecord.account
    });
    
  } catch (error) {
    console.error('Master key rotation error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 设置轮换间隔
async function handleSetRotationInterval(interval: number) {
  try {
    if (interval < 60 * 1000) { // 最少1分钟
      return NextResponse.json({ 
        success: false, 
        error: 'Interval must be at least 1 minute' 
      }, { status: 400 });
    }
    
    rotationConfig.interval = interval;
    
    if (rotationConfig.lastRotation) {
      rotationConfig.nextRotation = rotationConfig.lastRotation + interval;
    }
    
    // 重启自动轮换
    if (rotationConfig.autoRotation) {
      startAutoRotation();
    }
    
    return NextResponse.json({
      success: true,
      config: rotationConfig,
      message: 'Rotation interval updated'
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 从链上查询 MasterKeyRotated 事件（优化版本）
async function queryChainRotationHistory(): Promise<any[]> {
  try {
    const api = await getApi();
    const chainHistory: any[] = [];
    
    // 获取当前区块高度
    const header = await api.rpc.chain.getHeader();
    const currentBlock = header.number.toNumber();
    
    // 查询最近5000个区块的事件（可以根据需要调整）
    // 使用更大的范围，但只查询包含事件的区块
    const startBlock = Math.max(1, currentBlock - 5000);
    
    // 批量查询，每次查询100个区块
    const batchSize = 100;
    for (let batchStart = startBlock; batchStart <= currentBlock; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, currentBlock);
      
      try {
        // 并行查询多个区块
        const blockPromises = [];
        for (let blockNum = batchStart; blockNum <= batchEnd; blockNum++) {
          blockPromises.push(
            api.rpc.chain.getBlockHash(blockNum)
              .then(async (hash) => {
                const [events, signedBlock] = await Promise.all([
                  api.query.system.events.at(hash),
                  api.rpc.chain.getBlock(hash)
                ]);
                return { blockNum, hash, events, signedBlock };
              })
              .catch(() => null)
          );
        }
        
        const results = await Promise.all(blockPromises);
        
        for (const result of results) {
          if (!result) continue;
          
          const { blockNum, hash, events, signedBlock } = result;
          
          for (let i = 0; i < events.length; i++) {
            const eventRecord = events[i];
            const { event, phase } = eventRecord;
            
            // 检查是否是 MasterKeyRotated 事件
            if (event.section === 'phalaRegistry' && event.method === 'MasterKeyRotated') {
              const rotationId = (event.data as any)[0]?.toNumber?.() || (event.data as any)[0];
              const masterPubkey = (event.data as any)[1]?.toString?.() || (event.data as any)[1];
              
              // 获取真实的交易哈希
              let txHash = hash.toString(); // 默认使用区块哈希作为后备
              
              // 如果事件是由 extrinsic 触发的，获取对应的交易哈希
              if (phase && (phase as any).isApplyExtrinsic) {
                const extrinsicIndex = (phase as any).asApplyExtrinsic.toNumber();
                if (signedBlock && signedBlock.block && signedBlock.block.extrinsics) {
                  const extrinsic = signedBlock.block.extrinsics[extrinsicIndex];
                  if (extrinsic) {
                    // 计算交易的哈希值
                    txHash = extrinsic.hash.toHex();
                  }
                }
              }
              
              // 使用区块号估算时间戳（如果链支持，可以查询实际时间戳）
              const estimatedTimestamp = Date.now() - (currentBlock - blockNum) * 6000; // 假设6秒一个区块
              
              chainHistory.push({
                id: `chain_rotation_${rotationId}_${blockNum}`,
                type: 'master_key',
                status: 'completed',
                startTime: estimatedTimestamp,
                endTime: estimatedTimestamp,
                txHash: txHash,
                error: null,
                account: 'chain',
                rotationId: rotationId,
                masterPubkey: masterPubkey,
                blockNumber: blockNum,
                source: 'chain' // 标记来源为链上
              });
            }
          }
        }
      } catch (error) {
        // 忽略批次查询错误，继续查询下一批
        console.warn(`Failed to query blocks ${batchStart}-${batchEnd}:`, error);
      }
    }
    
    // 按区块号倒序排列（最新的在前）
    chainHistory.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
    
    return chainHistory;
  } catch (error) {
    console.error('Failed to query chain rotation history:', error);
    return [];
  }
}

// 检查node是否在线
async function checkNodeOnline(): Promise<boolean> {
  try {
    const api = await getApi();
    if (api && api.isConnected) {
      // 尝试查询一个简单的链上数据来验证连接
      await api.rpc.chain.getHeader();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Node connection check failed:', error);
    return false;
  }
}

// 获取轮换配置（从文件加载的持久化历史）
async function getRotationConfig() {
  try {
    // 检查node是否在线，如果不在线则清除历史记录
    const nodeOnline = await checkNodeOnline();
    if (!nodeOnline) {
      console.log('Node is offline, clearing rotation history');
      rotationHistory = [];
      clearRotationHistoryFile();
    } else {
      // 如果node在线，确保历史记录已从文件加载
      if (rotationHistory.length === 0) {
        rotationHistory = loadRotationHistoryFromFile();
      }
    }
    
    // 按时间倒序排列
    const sortedHistory = [...rotationHistory].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    
  return NextResponse.json({
    success: true,
    config: rotationConfig,
      history: sortedHistory.slice(-100), // 返回最近100条记录
    });
  } catch (error) {
    console.error('Failed to get rotation config:', error);
    return NextResponse.json({
      success: true,
      config: rotationConfig,
      history: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 获取集群和合约密钥信息
async function getClusterAndContractKeys() {
  try {
    const api = await getApi();
    const clusters: any[] = [];
    
    // 查询所有集群
    // 由于没有直接的 API 查询所有集群，我们需要通过已知的集群ID查询
    // 或者通过事件查询已创建的集群
    // 这里先查询默认集群 '0x0000000000000000000000000000000000000000000000000000000000000001'
    const defaultClusterId = '0x0000000000000000000000000000000000000000000000000000000000000001';
    
    try {
      // 查询集群信息
      const clusterInfo: any = await api.query.phalaPhatContracts.clusters(defaultClusterId);
      
      if (clusterInfo && (clusterInfo as any).isSome) {
        const clusterData = (clusterInfo as any).unwrap();
        const clusterId = defaultClusterId;
        const systemContract = clusterData.systemContract.toHex();
        const ownerHex = clusterData.owner.toHex();
        
        // 将所有者地址转换为SS58格式，以便匹配开发账户列表
        let ownerSS58 = '';
        let ownerName = '';
        let ownerBytes: Uint8Array | null = null;
        
        try {
          // 获取链的SS58前缀（Substrate默认是42，Phala可能是30或42）
          const ss58Format = api.registry.chainSS58 ?? 42;
          
          // ownerHex 是 AccountId 的十六进制表示（如 "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d"）
          // 需要将其转换为字节数组，然后编码为SS58格式
          try {
            // 先尝试直接解码（如果已经是SS58格式）
            ownerBytes = decodeAddress(ownerHex);
            ownerSS58 = ownerHex; // 如果已经是SS58格式，直接使用
          } catch (e) {
            // 如果不是SS58格式，说明是十六进制，使用 hexToU8a 转换为字节数组
            ownerBytes = hexToU8a(ownerHex);
            // 编码为SS58格式
            ownerSS58 = encodeAddress(ownerBytes, ss58Format);
          }
          
          // 开发账户名称列表
          const devAccountNames = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Ferdie'];
          
          // 尝试匹配开发账户名称（使用默认SS58前缀）
          const keyring = new Keyring({ type: 'sr25519', ss58Format });
          
          for (const name of devAccountNames) {
            try {
              const devAccount = keyring.addFromUri(`//${name}`);
              if (devAccount.address === ownerSS58) {
                ownerName = name.toUpperCase();
                break;
              }
            } catch (error) {
              // 忽略错误，继续尝试下一个
            }
          }
          
          // 如果没匹配到，尝试不同的SS58前缀
          if (!ownerName && ownerBytes) {
            const alternativeFormats = [30, 42]; // Phala可能是30，Substrate默认是42
            for (const format of alternativeFormats) {
              if (format === ss58Format) continue; // 跳过已经尝试过的格式
              
              try {
                // 使用新的SS58前缀重新编码
                const ownerSS58Alt = encodeAddress(ownerBytes, format);
                const keyringAlt = new Keyring({ type: 'sr25519', ss58Format: format });
                
                // 尝试匹配所有开发账户
                for (const name of devAccountNames) {
                  try {
                    const devAccountAlt = keyringAlt.addFromUri(`//${name}`);
                    if (devAccountAlt.address === ownerSS58Alt) {
                      ownerSS58 = ownerSS58Alt;
                      ownerName = name.toUpperCase();
                      break;
                    }
                  } catch (error) {
                    // 忽略错误
                  }
                }
                
                if (ownerName) break; // 如果匹配到了，退出循环
              } catch (error) {
                // 忽略错误，继续尝试下一个格式
              }
            }
          }
        } catch (error) {
          console.error('Failed to convert owner address to SS58:', error);
          // 如果转换失败，使用原始地址
          ownerSS58 = ownerHex;
        }
        
        const owner = {
          hex: ownerHex,
          ss58: ownerSS58,
          name: ownerName || null,
        };
        
        const permission = clusterData.permission.toString();
        
        // 查询集群密钥
        let clusterKey = null;
        try {
          const clusterKeyData: any = await api.query.phalaRegistry.clusterKeys(clusterId);
          if (clusterKeyData && (clusterKeyData as any).isSome) {
            clusterKey = (clusterKeyData as any).unwrap().toString();
          }
        } catch (error) {
          console.error('Failed to query cluster key:', error);
        }
        
        // 查询集群下的合约列表
        const contracts: any[] = [];
        try {
          // 查询集群下的所有合约
          // clusterContracts 直接返回数组，不是Option类型
          const clusterContracts: any = await api.query.phalaPhatContracts.clusterContracts(clusterId);
          
          // 处理返回结果 - 可能是Codec类型，需要转换为数组
          let contractsArray: any[] = [];
          if (clusterContracts) {
            // 尝试转换为数组
            if (Array.isArray(clusterContracts)) {
              contractsArray = clusterContracts;
            } else if ((clusterContracts as any).toArray) {
              contractsArray = (clusterContracts as any).toArray();
            } else if ((clusterContracts as any).toHuman) {
              // 如果是Codec类型，使用toHuman()转换
              const humanized = (clusterContracts as any).toHuman();
              if (Array.isArray(humanized)) {
                contractsArray = humanized.map((item: any) => {
                  // 处理humanized后的数据
                  if (typeof item === 'string') {
                    return item;
                  }
                  return item?.toString() || item;
                });
              }
            } else {
              // 尝试直接toString
              const str = clusterContracts.toString();
              if (str) {
                contractsArray = [str];
              }
            }
          }
          
          // 处理每个合约
          for (const contractId of contractsArray) {
            try {
              // 处理contractId，可能是字符串或Codec类型
              let contractIdHex = '';
              if (typeof contractId === 'string') {
                contractIdHex = contractId.startsWith('0x') ? contractId : `0x${contractId}`;
              } else if (contractId && (contractId as any).toHex) {
                contractIdHex = (contractId as any).toHex();
              } else if (contractId && (contractId as any).toString) {
                const str = (contractId as any).toString();
                contractIdHex = str.startsWith('0x') ? str : `0x${str}`;
              } else {
                contractIdHex = String(contractId);
              }
              
              // 查询合约密钥
              let contractKey = null;
              try {
                const contractKeyData: any = await api.query.phalaRegistry.contractKeys(contractIdHex);
                if (contractKeyData && (contractKeyData as any).isSome) {
                  contractKey = (contractKeyData as any).unwrap().toString();
                }
              } catch (error) {
                console.error(`Failed to query contract key for ${contractIdHex}:`, error);
              }
              
              // 查询合约信息（如果有的话）
              let contractInfo = null;
              try {
                const contractInfoData: any = await api.query.phalaPhatContracts.contracts(contractIdHex);
                if (contractInfoData && (contractInfoData as any).isSome) {
                  contractInfo = (contractInfoData as any).unwrap().toHuman();
                }
              } catch (error) {
                // 合约信息查询失败不影响整体流程
              }
              
              contracts.push({
                contractId: contractIdHex,
                contractKey: contractKey,
                contractInfo: contractInfo,
                hasKey: contractKey !== null,
              });
            } catch (error) {
              console.error('Failed to process contract:', error);
            }
          }
        } catch (error) {
          console.error('Failed to query cluster contracts:', error);
          // 如果查询失败，不影响整体流程，只是合约列表为空
        }
        
        clusters.push({
          clusterId: clusterId,
          systemContract: systemContract,
          owner: owner,
          permission: permission,
          clusterKey: clusterKey,
          hasClusterKey: clusterKey !== null,
          contracts: contracts,
          contractCount: contracts.length,
        });
      }
    } catch (error) {
      console.error('Failed to query cluster info:', error);
    }
    
    return NextResponse.json({
      success: true,
      clusters: clusters,
      totalClusters: clusters.length,
    });
  } catch (error) {
    console.error('Failed to get cluster and contract keys:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      clusters: [],
      totalClusters: 0,
    }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, interval, enabled } = body;

    switch (action) {
      case 'rotate-master-key':
        return await handleMasterKeyRotation();
      case 'set-rotation-interval':
        return await handleSetRotationInterval(interval);
      case 'get-rotation-config':
        return await getRotationConfig();
      case 'get-cluster-keys':
        return await getClusterAndContractKeys();
      case 'toggle-auto-rotation':
        rotationConfig.autoRotation = enabled;
        
        if (enabled) {
          startAutoRotation();
        } else {
          stopAutoRotation();
        }
        
        return NextResponse.json({
          success: true,
          config: rotationConfig,
          message: `Auto rotation ${enabled ? 'enabled' : 'disabled'}`
        });
      case 'clear-history':
        // 清除历史记录（当node关闭时调用）
        rotationHistory = [];
        clearRotationHistoryFile();
        return NextResponse.json({
          success: true,
          message: 'Rotation history cleared'
        });
      case 'query-contract-key':
        // 查询合约密钥 - 使用DeriveK256Key接口获取每个合约的派生密钥
        const contractId = body.contractId;
        if (!contractId) {
          return NextResponse.json({ success: false, error: 'Contract ID is required' }, { status: 400 });
        }
        return await handleQueryContractDerivedKey(contractId);
      case 'rotate-kms-root-key':
        // 轮换合约的派生密钥
        const rotateContractId = body.contractId;
        if (!rotateContractId) {
          return NextResponse.json({ success: false, error: 'Contract ID is required' }, { status: 400 });
        }
        return await handleRotateContractDerivedKey(rotateContractId);
      case 'save-contract-rotation-history':
        // 保存合约轮换历史
        const record = body.record;
        if (record) {
          const history = loadContractRotationHistoryFromFile();
          history.push(record);
          saveContractRotationHistoryToFile(history);
          return NextResponse.json({ success: true, message: 'History saved' });
        }
        return NextResponse.json({ success: false, error: 'Invalid record' }, { status: 400 });
      case 'save-batch-contract-rotation-history':
        // 批量保存合约轮换历史
        const records = body.records;
        if (Array.isArray(records) && records.length > 0) {
          const history = loadContractRotationHistoryFromFile();
          history.push(...records);
          saveContractRotationHistoryToFile(history);
          return NextResponse.json({ success: true, message: `Saved ${records.length} history records` });
        }
        return NextResponse.json({ success: false, error: 'Invalid records' }, { status: 400 });
      case 'get-contract-rotation-history':
        // 获取合约轮换历史
        const contractHistory = loadContractRotationHistoryFromFile();
        return NextResponse.json({ success: true, history: contractHistory });
      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Key rotation API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 调用KMS接口的辅助函数
async function callKmsApi(endpoint: string, requestBody: any, useHttps: boolean = false): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const url = new URL(endpoint);
    const requestModule = useHttps ? https : http;
    
    const options: any = {
      hostname: url.hostname,
      port: url.port || (useHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (useHttps) {
      options.rejectUnauthorized = false;
      options.secureProtocol = 'TLSv1_2_method';
      options.checkServerIdentity = () => undefined;
    }

    const req = requestModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

// 获取密钥版本信息
async function getKeyVersion(): Promise<{ current_version: number; active_version: number; rotation_in_progress: boolean; rotation_deadline: number }> {
  const httpUrl = 'http://43.132.154.142:13002/prpc/KMS.GetKeyVersion?json';
  try {
    const response = await callKmsApi(httpUrl, {}, false);
    return response;
  } catch (httpError: any) {
    console.warn('HTTP request failed, trying HTTPS:', httpError?.message || httpError);
    try {
      const httpsUrl = 'http://43.132.154.142:13002/prpc/KMS.GetKeyVersion?json';
      const response = await callKmsApi(httpsUrl, {}, true);
      return response;
    } catch (httpsError: any) {
      throw new Error(`Failed to get key version: HTTP error: ${httpError?.message || httpError}, HTTPS error: ${httpsError?.message || httpsError}`);
    }
  }
}

// 派生密钥
async function deriveKey(contractId: string, keyVersion: number): Promise<any> {
  const url = 'http://43.132.154.142:13002/prpc/KMS.DeriveK256Key?json';
  const requestBody = {
    path: `contract/${contractId}`,
    purpose: 'encryption',
    key_version: keyVersion
  };
  return await callKmsApi(url, requestBody, false);
}

// 查询合约的派生密钥 - 返回当前密钥和下一次轮换后的密钥
async function handleQueryContractDerivedKey(contractId: string) {
  try {
    // 第一步：获取密钥版本信息
    let versionInfo: { current_version: number; active_version: number; rotation_in_progress: boolean; rotation_deadline: number } | null = null;
    let activeVersion = 0;
    
    try {
      versionInfo = await getKeyVersion();
      activeVersion = versionInfo.active_version; // 当前激活的版本
    } catch (versionError: any) {
      // 如果获取版本信息失败，使用默认版本0
      console.warn('Failed to get key version, using default version 0:', versionError?.message || versionError);
    }
    
    // 第二步：派生当前使用的密钥（使用 active_version - 1）
    // 例如：如果 active_version = 47，则使用版本 46
    let currentKeyResponse = null;
    let currentKey = null;
    const currentVersion = activeVersion > 0 ? activeVersion - 1 : 0;
    
    try {
      currentKeyResponse = await deriveKey(contractId, currentVersion);
      currentKey = currentKeyResponse.k256_key || null;
    } catch (error) {
      console.warn(`Failed to derive current key (version ${currentVersion}):`, error);
    }
    
    // 第三步：派生下一次轮换后的密钥（使用 active_version）
    // 例如：如果 active_version = 47，则使用版本 47（下一次轮换后会使用的）
    let nextKeyResponse = null;
    let nextKey = null;
    const nextVersion = activeVersion;
    
    try {
      console.log(`[Key Rotation] 派生下一次密钥: contractId=${contractId}, version=${nextVersion}`);
      nextKeyResponse = await deriveKey(contractId, nextVersion);
      nextKey = nextKeyResponse.k256_key || null;
      console.log(`[Key Rotation] 下一次密钥派生结果: ${nextKey ? '成功' : '失败（密钥为空）'}`);
    } catch (error: any) {
      console.warn(`[Key Rotation] 派生下一次密钥失败 (version ${nextVersion}):`, error?.message || error);
    }
    
    return NextResponse.json({
      success: true,
      // 当前使用的密钥（基于 active_version - 1）
      current_key: currentKey,
      currentKey: currentKey, // 兼容旧字段
      store_key: currentKey, // 兼容旧字段
      contractKey: currentKey, // 兼容旧字段
      k256Pubkey: currentKey, // 兼容旧字段
      // 下一次轮换后的密钥（基于 active_version）
      next_key: nextKey,
      nextKey: nextKey, // 兼容旧字段
      next_store_key: nextKey, // 兼容旧字段
      // 版本信息
      currentVersion: currentVersion,
      nextVersion: nextVersion,
      activeVersion: activeVersion,
      // 是否有密钥
      hasKey: !!currentKey,
      hasNextKey: !!nextKey,
      // 签名链
      signatureChain: currentKeyResponse?.k256_signature_chain || null
    });
  } catch (error) {
    console.error('Failed to query contract derived key:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 轮换合约的派生密钥 - 先轮换根密钥，然后重新派生
async function handleRotateContractDerivedKey(contractId: string) {
  try {

    
    const rotateResponse = await new Promise<any>((resolve, reject) => {
      const req = http.request(
        {
          hostname: rotateUrl.hostname,
          port: rotateUrl.port || 80,
          path: rotateUrl.pathname + rotateUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } catch (error) {
              reject(new Error(`Failed to parse response: ${error}`));
            }
          });
        }
      );

      req.on('error', (error) => {
        reject(error);
      });

      req.write(JSON.stringify({}));
      req.end();
    });

    // 第二步：轮换根密钥后，重新派生该合约的密钥
    const deriveUrl = new URL('http://43.132.154.142:13002/prpc/KMS.DeriveK256Key?json');
    const requestBody = {
      path: `contract/${contractId}`,
      purpose: 'encryption',
      key_version: 0
    };
    
    const deriveResponse = await new Promise<any>((resolve, reject) => {
      const req = http.request(
        {
          hostname: deriveUrl.hostname,
          port: deriveUrl.port || 80,
          path: deriveUrl.pathname + deriveUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } catch (error) {
              reject(new Error(`Failed to parse response: ${error}`));
            }
          });
        }
      );

      req.on('error', (error) => {
        reject(error);
      });

      req.write(JSON.stringify(requestBody));
      req.end();
    });

    return NextResponse.json({
      success: true,
      data: {
        rootKeyRotation: rotateResponse,
        derivedKey: deriveResponse
      },
      newVersion: rotateResponse.new_version,
      caPubkey: rotateResponse.ca_pubkey,
      k256Pubkey: deriveResponse.k256_key, // 返回派生后的新密钥
      signatureChain: deriveResponse.k256_signature_chain
    });
  } catch (error) {
    console.error('Failed to rotate contract derived key:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}










    // 第一步：轮换根密钥
    const rotateUrl = new URL('http://43.132.154.142:13002/prpc/KMS.RotateRootKey?json');