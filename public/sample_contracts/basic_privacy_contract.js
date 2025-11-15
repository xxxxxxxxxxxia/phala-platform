// 基础隐私合约示例
// 适用于浏览器环境，无需Node.js依赖

class BasicPrivacyContract {
    constructor() {
        this.owner = null;
        this.userData = new Map();
        this.totalUsers = 0;
        this.totalDataEntries = 0;
    }

    // 初始化合约
    init(owner) {
        this.owner = owner;
        console.log('基础隐私合约已初始化，所有者:', owner);
        return true;
    }

    // 存储隐私数据
    storePrivateData(user, value, isEncrypted = true) {
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
    getUserData(user) {
        if (!this.userData.has(user)) {
            return [];
        }
        return this.userData.get(user);
    }

    // 计算隐私评分
    calculatePrivacyScore(user) {
        if (!this.userData.has(user)) {
            return 0;
        }

        const userData = this.userData.get(user);
        const encryptedCount = userData.filter(data => data.isEncrypted).length;
        const totalCount = userData.length;

        return totalCount > 0 ? Math.round((encryptedCount / totalCount) * 100) : 0;
    }

    // 获取合约统计
    getContractStats() {
        return {
            totalUsers: this.totalUsers,
            totalDataEntries: this.totalDataEntries,
            averagePrivacyScore: this.getAveragePrivacyScore()
        };
    }

    // 获取平均隐私评分
    getAveragePrivacyScore() {
        let totalScore = 0;
        let userCount = 0;

        for (const [user, data] of this.userData) {
            const score = this.calculatePrivacyScore(user);
            totalScore += score;
            userCount++;
        }

        return userCount > 0 ? Math.round(totalScore / userCount) : 0;
    }

    // 生成数据哈希（浏览器兼容）
    generateHash(value, isEncrypted) {
        const data = `${value}-${isEncrypted}-${Date.now()}`;
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    // 验证数据完整性
    verifyDataIntegrity(user, dataIndex) {
        if (!this.userData.has(user) || dataIndex >= this.userData.get(user).length) {
            return false;
        }

        const data = this.userData.get(user)[dataIndex];
        const expectedHash = this.generateHash(data.value, data.isEncrypted);
        
        return data.dataHash === expectedHash;
    }

    // 隐私计算：安全聚合
    secureAggregation(operation = 'sum') {
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

    // 数据清理
    cleanupData(user) {
        if (this.owner && this.owner !== user) {
            throw new Error('只有所有者可以清理数据');
        }

        if (this.userData.has(user)) {
            this.userData.delete(user);
            this.totalUsers--;
            console.log(`用户 ${user} 的数据已被清理`);
        }
    }

    // 获取所有用户列表
    getAllUsers() {
        return Array.from(this.userData.keys());
    }

    // 获取用户数量
    getUserCount() {
        return this.totalUsers;
    }

    // 获取数据条目总数
    getDataCount() {
        return this.totalDataEntries;
    }
}

// 使用示例
function example() {
    console.log('=== 基础隐私合约示例 ===');
    
    const contract = new BasicPrivacyContract();
    contract.init('0x1234567890123456789012345678901234567890');

    // 存储一些测试数据
    contract.storePrivateData('user1', 100, true);
    contract.storePrivateData('user1', 200, false);
    contract.storePrivateData('user2', 150, true);
    contract.storePrivateData('user3', 300, true);

    // 计算隐私评分
    const score1 = contract.calculatePrivacyScore('user1');
    const score2 = contract.calculatePrivacyScore('user2');
    const score3 = contract.calculatePrivacyScore('user3');
    
    console.log('用户1隐私评分:', score1);
    console.log('用户2隐私评分:', score2);
    console.log('用户3隐私评分:', score3);

    // 获取统计信息
    const stats = contract.getContractStats();
    console.log('合约统计:', stats);

    // 隐私计算
    const sum = contract.secureAggregation('sum');
    const avg = contract.secureAggregation('avg');
    console.log('隐私聚合 - 总和:', sum, '平均值:', avg);

    // 验证数据完整性
    const isValid = contract.verifyDataIntegrity('user1', 0);
    console.log('数据完整性验证:', isValid);

    console.log('=== 示例完成 ===');
}

// 如果在浏览器环境中，将示例函数暴露到全局
if (typeof window !== 'undefined') {
    window.BasicPrivacyContract = BasicPrivacyContract;
    window.runPrivacyContractExample = example;
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BasicPrivacyContract;
}


