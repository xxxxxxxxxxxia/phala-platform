// 使用内置的fetch (Node.js 18+)

async function testTokenomicAPI() {
  console.log('🧪 测试Tokenomic合约API调用...');
  
  const contractAddress = '0xd62eac577584da5e0776e63e3bd9c0c8db8b411dc459d3eec903ff80e3b8eebf';
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  const fullApiUrl = `${apiUrl}/api/contracts/call`;
  
  try {
    console.log('📡 发送API请求...');
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contractAddress: contractAddress,
        method: 'version',
        params: [],
        contractName: 'tokenomic-contract'
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ API调用成功！');
      console.log('📋 返回结果:', JSON.stringify(result.data, null, 2));
      
      if (result.data.result && Array.isArray(result.data.result)) {
        const versionArray = result.data.result;
        console.log(`📊 版本信息: ${versionArray.join('.')}`);
        console.log(`📋 详细结果: [${versionArray.join(', ')}]`);
      }
    } else {
      console.log('❌ API调用失败:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 等待几秒让服务器启动
setTimeout(() => {
  testTokenomicAPI();
}, 5000);
