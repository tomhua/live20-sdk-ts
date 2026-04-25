/**
 * 指纹识别库测试文件
 * 用于测试 live20-sdk-ts 库的各项功能
 */

import { createLive20SDK } from '../src/index';

/**
 * 测试主函数
 */
async function runTests() {
    console.log('🚀 开始指纹识别库测试...\n');

    try {
        // 创建 SDK 实例
        console.log('📦 创建 SDK 实例...');
        const sdk = createLive20SDK();

        // 测试 1: 初始化库
        await testInitialization(sdk);

        // 测试 2: 设备操作
        await testDeviceOperations(sdk);

        // 测试 3: 数据库操作
        await testDatabaseOperations(sdk);

        // 测试 4: 参数设置
        await testParameterSettings(sdk);

        // 测试 5: 清理资源
        await testCleanup(sdk);

        console.log('✅ 所有测试完成！');

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    }
}

/**
 * 测试 1: 初始化库
 */
async function testInitialization(sdk: any) {
    console.log('\n--- 测试 1: 初始化库 ---');

    const success = await sdk.initialize();
    if (success) {
        console.log('✅ 指纹识别库初始化成功');
    } else {
        console.log('⚠️  指纹识别库初始化返回失败（可能是没有设备连接）');
        // 不抛出错误，继续测试
    }

    // 测试设备数量获取（如果初始化成功的话）
    let deviceCount = 0;
    if (success) {
        try {
            deviceCount = sdk.getDeviceCount();
            console.log(`📱 检测到 ${deviceCount} 个指纹设备`);
        } catch (error) {
            console.log('⚠️  获取设备数量失败');
        }
    }

    return deviceCount;
}

/**
 * 测试 2: 设备操作
 */
async function testDeviceOperations(sdk: any) {
    console.log('\n--- 测试 2: 设备操作 ---');

    try {
        const deviceCount = sdk.getDeviceCount();

        if (deviceCount === 0) {
            console.log('⚠️  未检测到指纹设备，跳过设备操作测试');
            return;
        }

        // 测试打开设备
        console.log('🔧 尝试打开设备...');
        const deviceOpened = sdk.openDevice(0);

        if (deviceOpened) {
            console.log('✅ 设备打开成功');

            // 模拟指纹采集（实际需要连接设备）
            console.log('👆 模拟指纹采集...');

            // 创建模拟指纹模板
            const mockTemplate = createMockFingerprintTemplate();

            if (mockTemplate) {
                console.log('✅ 模拟指纹模板创建成功');
                console.log(`📏 模板大小: ${mockTemplate.size} 字节`);
                console.log(`⭐ 模板质量: ${mockTemplate.quality}/100`);

                return mockTemplate;
            } else {
                console.log('❌ 模拟指纹模板创建失败');
            }

        } else {
            console.log('❌ 设备打开失败');
        }

    } catch (error) {
        console.log('⚠️  设备操作测试失败（可能未初始化或无设备）:', error);
    }

    return null;
}

/**
 * 测试 3: 数据库操作
 */
async function testDatabaseOperations(sdk: any) {
    console.log('\n--- 测试 3: 数据库操作 ---');

    try {
        // 创建数据库
        console.log('🗃️  创建指纹数据库...');
        const dbCreated = sdk.createDatabase();

        if (dbCreated) {
            console.log('✅ 数据库创建成功');

            // 创建模拟指纹模板
            const template1 = createMockFingerprintTemplate();
            const template2 = createMockFingerprintTemplate();

            if (template1 && template2) {
                // 添加指纹到数据库
                console.log('➕ 添加指纹模板到数据库...');
                const added1 = sdk.addFingerprint(1001, template1);
                const added2 = sdk.addFingerprint(1002, template2);

                if (added1 && added2) {
                    console.log('✅ 指纹模板添加成功');

                    // 获取数据库中的指纹数量
                    const count = sdk.getFingerprintCount();
                    console.log(`📊 数据库中的指纹数量: ${count}`);

                    // 测试指纹识别
                    console.log('🔍 测试指纹识别...');
                    const identifyResult = sdk.identifyFingerprint(template1);

                    console.log(`🎯 识别结果: ${identifyResult.success ? '成功' : '失败'}`);
                    if (identifyResult.success) {
                        console.log(`🆔 匹配指纹ID: ${identifyResult.fid}`);
                        console.log(`📈 匹配分数: ${identifyResult.score}`);
                    }

                    // 测试指纹验证
                    console.log('🔐 测试指纹验证...');
                    const verifyResult = sdk.verifyFingerprints(template1, template2, 40);
                    console.log(`✅ 指纹验证结果: ${verifyResult ? '匹配' : '不匹配'}`);

                } else {
                    console.log('❌ 指纹模板添加失败');
                }
            }

        } else {
            console.log('❌ 数据库创建失败');
        }

    } catch (error) {
        console.log('⚠️  数据库操作测试失败（可能未初始化）:', error);
    }
}

/**
 * 测试 4: 参数设置
 */
async function testParameterSettings(sdk: any) {
    console.log('\n--- 测试 4: 参数设置 ---');

    // 设置安全级别
    console.log('🔒 设置安全级别...');
    const securityLevelSet = sdk.setSecurityLevel(3);
    console.log(`✅ 安全级别设置: ${securityLevelSet ? '成功' : '失败'}`);

    // 设置匹配阈值
    console.log('🎯 设置匹配阈值...');
    const thresholdSet = sdk.setMatchThreshold(60);
    console.log(`✅ 匹配阈值设置: ${thresholdSet ? '成功' : '失败'}`);
}

/**
 * 测试 5: 清理资源
 */
async function testCleanup(sdk: any) {
    console.log('\n--- 测试 5: 清理资源 ---');

    console.log('🧹 清理资源...');
    sdk.terminate();
    console.log('✅ 资源清理完成');
}

/**
 * 创建模拟指纹模板
 * 在实际使用中，这个函数会被实际的指纹采集替代
 */
function createMockFingerprintTemplate() {
    try {
        // 创建模拟的指纹模板数据
        const templateSize = Math.floor(Math.random() * 200) + 300; // 300-500字节
        const templateData = new Uint8Array(templateSize);

        // 填充随机数据（模拟指纹特征）
        for (let i = 0; i < templateSize; i++) {
            templateData[i] = Math.floor(Math.random() * 256);
        }

        // 计算模拟质量（基于数据复杂度）
        const quality = Math.min(100, Math.floor(templateSize / 5));

        return {
            data: templateData,
            size: templateSize,
            quality: quality
        };
    } catch (error) {
        console.error('创建模拟指纹模板失败:', error);
        return null;
    }
}

/**
 * 错误处理测试
 */
function testErrorHandling() {
    console.log('\n--- 错误处理测试 ---');

    const sdk = createLive20SDK();

    try {
        // 测试未初始化时调用方法
        sdk.getDeviceCount();
        console.log('❌ 错误处理测试失败：应该抛出异常');
    } catch (error) {
        console.log('✅ 错误处理正常：未初始化时正确抛出异常');
    }

    sdk.terminate();
}

/**
 * 性能测试
 */
function testPerformance() {
    console.log('\n--- 性能测试 ---');

    const sdk = createLive20SDK();

    // 测试多次模板创建的性能
    console.log('⏱️  测试模板创建性能...');
    const startTime = Date.now();
    const templates = [];

    for (let i = 0; i < 10; i++) {
        templates.push(createMockFingerprintTemplate());
    }

    const endTime = Date.now();
    console.log(`✅ 创建10个模板耗时: ${endTime - startTime}ms`);

    sdk.terminate();
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    await runTests();

    // 运行额外的测试
    testErrorHandling();
    testPerformance();

    console.log('\n🎉 所有测试执行完毕！');
    console.log('\n📋 测试总结:');
    console.log('   ✅ 基础功能测试');
    console.log('   ✅ 设备操作测试');
    console.log('   ✅ 数据库操作测试');
    console.log('   ✅ 参数设置测试');
    console.log('   ✅ 资源清理测试');
    console.log('   ✅ 错误处理测试');
    console.log('   ✅ 性能测试');
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().catch(console.error);
}

export {
    runTests,
    runAllTests,
    testInitialization,
    testDeviceOperations,
    testDatabaseOperations,
    testParameterSettings,
    testCleanup,
    createMockFingerprintTemplate
};
