import { defineConfig } from 'tsup';

export default defineConfig({
    // 入口文件
    entry: ['src/index.ts'],
    // 打包格式：CJS(CommonJS) + ESM(ES Module)
    format: ['cjs', 'esm'],
    // 生成类型声明文件 .d.ts
    dts: true,
    // 清理之前的打包产物
    clean: true,
    // 压缩代码
    minify: false,
    // 打包后保留源码映射
    sourcemap: false
});
