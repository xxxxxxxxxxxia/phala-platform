import { ApiPromise } from "@polkadot/api";
import { HygonCvmInfo, HygonDeviceInfo } from "@/types/hygon";

const parseNumberValue = (value: unknown): number => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const sanitized = value.replace(/[,_\s]/g, "");
    const parsed = Number(sanitized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return 0;
};

const formatTotalRewards = (value: unknown): string => {
  if (value === undefined || value === null) return "0";
  if (typeof value === "string") return value;
  return typeof value === "number" || typeof value === "bigint"
    ? value.toString()
    : String(value);
};

export async function fetchHygonDevices(api: ApiPromise): Promise<HygonDeviceInfo[]> {
  if (!api.query.phalaComputation?.hygonTeeDevices) {
    return [];
  }

  const teeEntriesPromise = api.query.phalaComputation.hygonTeeDevices.entries();
  const cvmEntriesPromise = api.query.phalaComputation.hygonCvms
    ? api.query.phalaComputation.hygonCvms.entries()
    : Promise.resolve([]);

  const [teeEntries, cvmEntries] = await Promise.all([teeEntriesPromise, cvmEntriesPromise]);

  const cvmMap = new Map<string, HygonCvmInfo[]>();
  for (const [cvmKey, cvmValue] of cvmEntries) {
    const cvmId = cvmKey.args?.[0]?.toString() || cvmKey.toString();
    const raw = (cvmValue.toJSON() || {}) as Record<string, unknown>;
    const deviceId = raw.teeDeviceId ? String(raw.teeDeviceId) : "unknown";

    const info: HygonCvmInfo = {
      id: cvmId,
      cpuCount: parseNumberValue(raw.cpuCount),
      memoryMb: parseNumberValue(raw.memoryMb),
      createdAt: parseNumberValue(raw.createdAt),
      lastHeartbeat: parseNumberValue(raw.lastHeartbeat),
      heartbeatCount: parseNumberValue(raw.heartbeatCount),
      teeDeviceId: raw.teeDeviceId ? String(raw.teeDeviceId) : undefined,
    };

    const list = cvmMap.get(deviceId) || [];
    list.push(info);
    cvmMap.set(deviceId, list);
  }

  const devices: HygonDeviceInfo[] = teeEntries.map(([deviceKey, deviceValue]) => {
    const deviceId = deviceKey.args?.[0]?.toString() || deviceKey.toString();
    const raw = (deviceValue.toJSON() || {}) as Record<string, unknown>;

    return {
      deviceId,
      cpuCount: parseNumberValue(raw.cpuCount),
      memoryMb: parseNumberValue(raw.memoryMb),
      createdAt: parseNumberValue(raw.createdAt),
      lastHeartbeat: parseNumberValue(raw.lastHeartbeat),
      heartbeatCount: parseNumberValue(raw.heartbeatCount),
      totalRewards: formatTotalRewards(raw.totalRewards),
      cvms: cvmMap.get(deviceId) || [],
    };
  });

  return devices;
}

