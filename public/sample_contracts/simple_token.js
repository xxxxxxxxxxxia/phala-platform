// 简单Token合约示例
// 这个合约包含基本的token功能，包括查询版本

class SimpleToken {
    constructor() {
        this.name = "SimpleToken";
        this.symbol = "STK";
        this.decimals = 18;
        this.totalSupply = 1000000;
        this.version = "1.0.0";
        this.balances = new Map();
        this.owner = null;
    }

    // 初始化合约
    init(owner) {
        this.owner = owner;
        this.balances.set(owner, this.totalSupply);
        console.log(`Token合约已初始化，所有者: ${owner}`);
        return { success: true, message: "Token合约初始化成功" };
    }

    // 获取版本信息
    getVersion() {
        return {
            name: this.name,
            symbol: this.symbol,
            version: this.version,
            decimals: this.decimals,
            totalSupply: this.totalSupply
        };
    }

    // 获取余额
    balanceOf(address) {
        return this.balances.get(address) || 0;
    }

    // 转账
    transfer(to, amount) {
        const from = this.owner;
        const fromBalance = this.balances.get(from) || 0;
        
        if (fromBalance < amount) {
            return { success: false, error: "余额不足" };
        }
        
        this.balances.set(from, fromBalance - amount);
        this.balances.set(to, (this.balances.get(to) || 0) + amount);
        
        return { 
            success: true, 
            message: `转账成功: ${amount} ${this.symbol}`,
            from,
            to,
            amount
        };
    }

    // 获取合约信息
    getInfo() {
        return {
            name: this.name,
            symbol: this.symbol,
            version: this.version,
            decimals: this.decimals,
            totalSupply: this.totalSupply,
            owner: this.owner,
            balances: Object.fromEntries(this.balances)
        };
    }

    // 铸造新代币（仅所有者）
    mint(to, amount) {
        if (this.owner !== this.owner) {
            return { success: false, error: "只有所有者可以铸造代币" };
        }
        
        this.balances.set(to, (this.balances.get(to) || 0) + amount);
        this.totalSupply += amount;
        
        return { 
            success: true, 
            message: `铸造成功: ${amount} ${this.symbol}`,
            to,
            amount,
            newTotalSupply: this.totalSupply
        };
    }
}

// 导出合约
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleToken;
} else if (typeof window !== 'undefined') {
    window.SimpleToken = SimpleToken;
}



