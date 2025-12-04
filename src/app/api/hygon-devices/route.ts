import { NextRequest, NextResponse } from 'next/server';
import { getApi } from '@/lib/phalaApi';
import { fetchHygonDevices } from '@/lib/hygonDevices';

export async function GET(_: NextRequest) {
  try {
    const api = await getApi();
    const devices = await fetchHygonDevices(api);

    return NextResponse.json({
      success: true,
      data: {
        devices,
      },
    });
  } catch (error) {
    console.error('[hygon-devices] 获取链上数据失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}

