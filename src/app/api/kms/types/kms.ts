export interface AppKeyResponse {
  ca_cert: string;
  disk_crypt_key: string;
  env_crypt_key: string;
  k256_key: string;
  k256_signature: string;
  gateway_app_id: string;
}

export interface PublicKeyResponse {
  public_key: string;
  signature: string;
}

export interface BootstrapResponse {
  ca_pubkey: string;
  k256_pubkey: string;
  quote: string;
  eventlog: string;
}

export interface GetMetaResponse {
  ca_cert: string;
  allow_any_upgrade: boolean;
  k256_pubkey: string;
  bootstrap_info: BootstrapResponse;
}

export interface KeyVersionResponse {
  current_version: number;
  active_version: number;
  rotation_in_progress: boolean;
  rotation_deadline: number;
}

export interface RotateRootKeyResponse {
  new_version: number;
  ca_pubkey: string;
  k256_pubkey: string;
  quote: string;
  eventlog: string;
}

export interface DeriveK256KeyResponse {
  k256_key: string;
  k256_signature_chain: string[];
}

export interface GetAppKeyRequest {
  app_compose: string;
  key_version?: number;
}

export interface DeriveK256KeyRequest {
  path: string;
  purpose: string;
  key_version?: number;
}

export interface RotateRootKeyRequest {
  target_version?: number;
}

export interface AppIdRequest {
  app_id: string;
}
