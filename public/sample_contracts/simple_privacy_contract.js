// 简单的隐私计算合约示例
// 适用于Phala Network的Pink合约环境

class SimplePrivacyContract {
    constructor() {
        this.owner = null;
        this.userData = new Map();
        this.totalUsers = 0;
        this.totalDataEntries = 0;
    }

    // 初始化合约
    async init(owner) {
        this.owner = owner;
        console.log('隐私合约已初始化，所有者:', owner);
    }

    // 存储隐私数据
    async storePrivateData(user, value, isEncrypted = true) {
        if (!this.userData.has(user)) {
            this.userData.set(user, []);
            this.totalUsers++;
        }

        const dataEntry = {
            value: value,
            isEncrypted: isEncrypted,
            timestamp: Date.now(),
            dataHash: this.generateHash(value, isEncrypted)
        };

        this.userData.get(user).push(dataEntry);
        this.totalDataEntries++;

        console.log(`用户 ${user} 存储了隐私数据:`, dataEntry);
        return dataEntry;
    }

    // 获取用户数据
    async getUserData(user) {
        if (!this.userData.has(user)) {
            return [];
        }
        return this.userData.get(user);
    }

    // 计算隐私评分
    async calculatePrivacyScore(user) {
        if (!this.userData.has(user)) {
            return 0;
        }

        const userData = this.userData.get(user);
        const encryptedCount = userData.filter(data => data.isEncrypted).length;
        const totalCount = userData.length;

        return totalCount > 0 ? Math.round((encryptedCount / totalCount) * 100) : 0;
    }

    // 获取合约统计
    async getContractStats() {
        return {
            totalUsers: this.totalUsers,
            totalDataEntries: this.totalDataEntries,
            averagePrivacyScore: await this.getAveragePrivacyScore()
        };
    }

    // 获取平均隐私评分
    async getAveragePrivacyScore() {
        let totalScore = 0;
        let userCount = 0;

        for (const [user, data] of this.userData) {
            const score = await this.calculatePrivacyScore(user);
            totalScore += score;
            userCount++;
        }

        return userCount > 0 ? Math.round(totalScore / userCount) : 0;
    }

    // 生成数据哈希
    generateHash(value, isEncrypted) {
        // 使用浏览器兼容的哈希方法
        const data = `${value}-${isEncrypted}-${Date.now()}`;
        // 简单的哈希实现，避免Node.js依赖
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(16);
    }

    // 验证数据完整性
    async verifyDataIntegrity(user, dataIndex) {
        if (!this.userData.has(user) || dataIndex >= this.userData.get(user).length) {
            return false;
        }

        const data = this.userData.get(user)[dataIndex];
        const expectedHash = this.generateHash(data.value, data.isEncrypted);
        
        return data.dataHash === expectedHash;
    }

    // 隐私计算：安全聚合
    async secureAggregation(operation = 'sum') {
        let result = 0;
        const allData = [];

        for (const [user, data] of this.userData) {
            for (const entry of data) {
                if (entry.isEncrypted) {
                    allData.push(entry.value);
                }
            }
        }

        switch (operation) {
            case 'sum':
                result = allData.reduce((sum, val) => sum + val, 0);
                break;
            case 'avg':
                result = allData.length > 0 ? allData.reduce((sum, val) => sum + val, 0) / allData.length : 0;
                break;
            case 'max':
                result = allData.length > 0 ? Math.max(...allData) : 0;
                break;
            case 'min':
                result = allData.length > 0 ? Math.min(...allData) : 0;
                break;
        }

        console.log(`隐私计算完成 - 操作: ${operation}, 结果: ${result}`);
        return result;
    }

    // 数据清理（仅所有者）
    async cleanupData(user) {
        if (this.owner && this.owner !== user) {
            throw new Error('只有所有者可以清理数据');
        }

        if (this.userData.has(user)) {
            this.userData.delete(user);
            this.totalUsers--;
            console.log(`用户 ${user} 的数据已被清理`);
        }
    }
}

// 导出合约类
module.exports = SimplePrivacyContract;

// 使用示例
if (require.main === module) {
    async function example() {
        const contract = new SimplePrivacyContract();
        await contract.init('0x1234567890123456789012345678901234567890');

        // 存储一些测试数据
        await contract.storePrivateData('user1', 100, true);
        await contract.storePrivateData('user1', 200, false);
        await contract.storePrivateData('user2', 150, true);

        // 计算隐私评分
        const score1 = await contract.calculatePrivacyScore('user1');
        const score2 = await contract.calculatePrivacyScore('user2');
        console.log('用户1隐私评分:', score1);
        console.log('用户2隐私评分:', score2);

        // 获取统计信息
        const stats = await contract.getContractStats();
        console.log('合约统计:', stats);

        // 隐私计算
        const sum = await contract.secureAggregation('sum');
        const avg = await contract.secureAggregation('avg');
        console.log('隐私聚合 - 总和:', sum, '平均值:', avg);
    }

    example().catch(console.error);
}
