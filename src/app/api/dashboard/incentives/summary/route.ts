import { NextRequest, NextResponse } from 'next/server';

// 获取激励数据汇总
export async function GET(request: NextRequest) {
    try {
        // 调用现有的激励API
        let incentiveData: any = {
            totalRewards: 0,
            totalAmount: 0,
            averageScore: 0,
            rewardDistribution: [],
            rewards: []
        };

        try {
            const incentiveResponse = await fetch(`${request.nextUrl.origin}/api/incentives?action=status`);
            if (incentiveResponse.ok) {
                incentiveData = await incentiveResponse.json();
            }
        } catch (fetchError) {
            console.error('Failed to fetch incentive data:', fetchError);
            // 使用默认值继续
        }

        // 计算奖励类型分布百分比
        const rewardDistribution = (incentiveData.rewardDistribution || []).map((item: any) => ({
            ...item,
            percentage: incentiveData.totalAmount > 0
                ? Math.round((item.amount / incentiveData.totalAmount) * 100)
                : 0
        }));

        // 获取最近奖励
        const recentRewards = (incentiveData.rewards || [])
            .sort((a: any, b: any) => b.timestamp - a.timestamp)
            .slice(0, 10)
            .map((reward: any) => ({
                id: reward.id,
                workerId: reward.workerId,
                amount: reward.amount,
                timestamp: reward.timestamp,
                blockNumber: reward.blockNumber
            }));

        return NextResponse.json({
            success: true,
            data: {
                totalRewards: incentiveData.totalRewards || 0,
                totalAmount: incentiveData.totalAmount || 0,
                averageScore: incentiveData.averageScore || 0,
                rewardDistribution,
                recentRewards
            }
        });
    } catch (error) {
        console.error('Incentives summary API error:', error);
        return NextResponse.json({
            success: true,
            data: {
                totalRewards: 0,
                totalAmount: 0,
                averageScore: 0,
                rewardDistribution: [],
                recentRewards: []
            }
        });
    }
}


