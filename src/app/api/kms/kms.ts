import axios from 'axios';
import type {
  GetMetaResponse,
  KeyVersionResponse,
  PublicKeyResponse,
  DeriveK256KeyResponse,
  RotateRootKeyResponse,
  AppKeyResponse,
  GetAppKeyRequest,
  DeriveK256KeyRequest,
  RotateRootKeyRequest,
  AppIdRequest
} from './types/kms';

const BASE_URL = 'http://43.132.154.142:13002';

const api = axios.create({
  baseURL: `${BASE_URL}/prpc`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const kmsApi = {
  // ========== KMS 服务接口 ==========
  
  // 1. 获取 KMS 元数据
  // curl -X POST http://43.132.154.142:13002/prpc/KMS.GetMeta?json -H "Content-Type: application/json" -k -d '{}'
  getMeta: () => 
    api.post<GetMetaResponse>('/KMS.GetMeta?json', {}),

  // 2. 获取密钥版本信息
  // curl -X POST http://43.132.154.142:13002/prpc/KMS.GetKeyVersion?json -H "Content-Type: application/json" -k -d '{}'
  getKeyVersion: () => 
    api.post<KeyVersionResponse>('/KMS.GetKeyVersion?json', {}),

  // 3. 轮换根密钥
  // curl -X POST http://43.132.154.142:13002/prpc/KMS.RotateRootKey?json -H "Content-Type: application/json" -k -d '{}'
  rotateRootKey: (data: RotateRootKeyRequest = {}) => 
    api.post<RotateRootKeyResponse>('/KMS.RotateRootKey?json', data),

  // 4. 派生 K256 密钥
  // curl -X POST http://43.132.154.142:13002/prpc/KMS.DeriveK256Key?json -H "Content-Type: application/json" -k -d '{"path": "data/encryption", "purpose": "encryption"}'
  deriveK256Key: (data: DeriveK256KeyRequest) => 
    api.post<DeriveK256KeyResponse>('/KMS.DeriveK256Key?json', data),

  // 5. 获取应用密钥
  // curl -X POST http://43.132.154.142:13002/prpc/KMS.GetAppKey?json -H "Content-Type: application/json" -k -d '{"app_compose": "...", "key_version": 0}'
  getAppKey: (data: GetAppKeyRequest) => 
    api.post<AppKeyResponse>('/KMS.GetAppKey?json', data),

  // 6. 获取应用环境加密公钥
  // curl -X POST http://43.132.154.142:13002/prpc/KMS.GetAppEnvEncryptPubKey?json -H "Content-Type: application/json" -k -d '{"app_id": "0x..."}'
  getAppEnvEncryptPubKey: (data: AppIdRequest) => 
    api.post<PublicKeyResponse>('/KMS.GetAppEnvEncryptPubKey?json', data),

  // 7. 获取临时 CA 证书
  // curl -X POST http://43.132.154.142:13002/prpc/KMS.GetTempCaCert?json -H "Content-Type: application/json" -k -d '{}'
  getTempCaCert: () => 
    api.post('/KMS.GetTempCaCert?json', {}),

  // 8. 获取 KMS 根密钥（用于密钥复制）
  // curl -X POST http://43.132.154.142:13002/prpc/KMS.GetKmsKey?json -H "Content-Type: application/json" -k -d '{}'
  getKmsKey: () => 
    api.post('/KMS.GetKmsKey?json', {}),

  // 9. 签名证书
  // curl -X POST http://43.132.154.142:13002/prpc/KMS.SignCert?json -H "Content-Type: application/json" -k -d '{"csr": "0x...", "signature": "0x..."}'
  signCert: (data: { csr: string; signature: string }) => 
    api.post('/KMS.SignCert?json', data),
};
