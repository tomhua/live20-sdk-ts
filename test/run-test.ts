/**
 * 指纹识别库测试运行脚本
 * 用于执行测试文件
 */

import { runAllTests } from './test';

/**
 * 主函数
 */
async function main() {
    console.log('🧪 指纹识别库测试运行器\n');

    try {
        await runAllTests();
        console.log('\n🎊 测试运行完成！');
        process.exit(0);
    } catch (error) {
        console.error('\n💥 测试运行失败:', error);
        process.exit(1);
    }
}

// 运行测试
main();
