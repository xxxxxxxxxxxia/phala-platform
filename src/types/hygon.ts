export interface HygonCvmInfo {
  id: string;
  cpuCount: number;
  memoryMb: number;
  createdAt: number;
  lastHeartbeat: number;
  heartbeatCount: number;
  teeDeviceId?: string;
}

export interface HygonDeviceInfo {
  deviceId: string;
  cpuCount: number;
  memoryMb: number;
  createdAt: number;
  lastHeartbeat: number;
  heartbeatCount: number;
  totalRewards: string;
  cvms: HygonCvmInfo[];
}

