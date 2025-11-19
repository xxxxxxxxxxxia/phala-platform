import { NextResponse } from 'next/server';
import { fetchSessionAccounts } from '../summary/route';

export async function GET() {
    try {
        const { accounts, totalRewardSum } = await fetchSessionAccounts();
        return NextResponse.json({
            success: true,
            data: {
                accounts,
                totalRewardSum,
            },
        });
    } catch (error) {
        console.error('Incentive accounts API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}



