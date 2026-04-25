# Live20 SDK for TypeScript

基于 koffi 的指纹识别 SDK，提供指纹采集、模板生成、数据库管理和指纹识别功能。

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 测试

```bash
npm test
```

## 快速开始

```typescript
import { createLive20SDK } from 'live20-sdk-ts';

async function main() {
    const sdk = createLive20SDK();

    const initialized = await sdk.initialize();
    if (!initialized) {
        console.error('初始化失败');
        return;
    }

    const deviceCount = sdk.getDeviceCount();
    console.log(`检测到 ${deviceCount} 个指纹设备`);

    if (deviceCount > 0) {
        sdk.openDevice(0);

        const template = sdk.acquireFingerprint();
        if (template) {
            console.log(`指纹采集成功，模板大小: ${template.length} 字节`);
        }

        sdk.closeDevice();
    }

    sdk.terminate();
}

main();
```

## API 文档

### 初始化

#### `createLive20SDK(dllName?: string): Live20SDK`
创建 SDK 实例。

#### `sdk.initialize(): Promise<boolean>`
初始化指纹识别库。

#### `sdk.terminate(): void`
释放指纹识别库资源。

### 设备操作

#### `sdk.getDeviceCount(): number`
获取指纹设备数量。

#### `sdk.openDevice(deviceIndex?: number): boolean`
打开指定索引的指纹设备。默认打开索引 0 的设备。

#### `sdk.closeDevice(): boolean`
关闭当前打开的设备。

### 指纹采集

#### `sdk.acquireFingerprint(): ZKFPFingerprintTemplate | null`
采集指纹并返回指纹模板。

#### `sdk.acquireFingerprintImage(bufferSize?: number): ZKFPImageData | null`
采集指纹图像。

### 数据库操作

#### `sdk.createDatabase(): boolean`
创建指纹数据库。

#### `sdk.closeDatabase(): boolean`
关闭指纹数据库。

#### `sdk.addFingerprint(fid: number, template: ZKFPFingerprintTemplate): boolean`
添加指纹模板到数据库。

#### `sdk.deleteFingerprint(fid: number): boolean`
从数据库删除指定 ID 的指纹。

#### `sdk.clearDatabase(): boolean`
清空数据库中的所有指纹。

#### `sdk.getFingerprintCount(): number`
获取数据库中的指纹数量。

### 指纹识别

#### `sdk.identifyFingerprint(template: ZKFPFingerprintTemplate): ZKFPIdentifyResult`
在数据库中识别指纹。

#### `sdk.verifyByID(fid: number, template: ZKFPFingerprintTemplate, threshold?: number): boolean`
根据 ID 验证指纹。

#### `sdk.verifyFingerprints(template1: ZKFPFingerprintTemplate, template2: ZKFPFingerprintTemplate, threshold?: number): boolean`
验证两个指纹模板是否匹配。

### 参数设置

#### `sdk.setSecurityLevel(level: number): boolean`
设置安全级别 (0-5)。

#### `sdk.setMatchThreshold(threshold: number): boolean`
设置匹配阈值。

### 模板操作

#### `sdk.mergeTemplates(temp1: ZKFPFingerprintTemplate, temp2: ZKFPFingerprintTemplate, temp3: ZKFPFingerprintTemplate): ZKFPFingerprintTemplate | null`
合并多个指纹模板。

#### `sdk.extractFromImage(filePath: string, dpi?: number): ZKFPFingerprintTemplate | null`
从指纹图像文件提取指纹模板。

### 设备参数

#### `sdk.setDeviceParam(paramCode: ZKFPDeviceParam, value: Uint8Array): boolean`
设置设备参数。

#### `sdk.getDeviceParam(paramCode: ZKFPDeviceParam, bufferSize?: number): Uint8Array | null`
获取设备参数。

#### `sdk.getCaptureParams(): ZKFPCapParams | null`
获取采集参数。

### 工具方法

#### `sdk.base64ToBlob(base64Str: string, bufferSize?: number): Uint8Array | null`
将 Base64 字符串转换为二进制数据。

#### `sdk.blobToBase64(data: Uint8Array, bufferSize?: number): string | null`
将二进制数据转换为 Base64 字符串。

## 类型定义

### ZKFPFingerprintTemplate
指纹模板，二进制数据 (`Uint8Array`)。

### ZKFPImageData
指纹图像数据。

### ZKFPIdentifyResult
指纹识别结果，包含匹配的指纹 ID 和分数。

### ZKFPCapParams
采集参数配置。

### ZKFPDeviceParam
设备参数类型枚举。

### ZKFPDBParamCode
数据库参数类型枚举。

### ZKFPErrorCode
错误代码枚举。

## DLL 文件说明

SDK 需要以下 DLL 文件：

| DLL 文件 | 位置 | 说明 |
|---------|------|------|
| libzkfp.dll | `src/dll/x64/` 或 `src/dll/x86/` | 主指纹识别库 |
| fppswsk12.dll | 与 libzkfp.dll 同一目录 | 许可证验证库 |

SDK 会根据系统架构自动选择 x64 或 x86 目录。

**注意**：如果使用默认的 `libzkfp.dll`，请确保 DLL 文件放在可被系统找到的路径中，或者使用 `demotest` 目录下经过验证的 DLL。

## 目录结构

```
live20-sdk-ts/
├── src/
│   ├── dll/
│   │   ├── x64/          # 64位 DLL 文件
│   │   └── x86/          # 32位 DLL 文件
│   ├── docs/             # SDK 头文件文档
│   ├── lib/
│   │   └── zkfp-loader.ts # DLL 加载和函数绑定
│   ├── types/
│   │   └── zkfp-types.ts  # 类型定义
│   └── index.ts          # SDK 主入口
├── dist/                 # 构建输出
├── test/                 # 测试文件
├── package.json
└── tsconfig.json
```

## 错误处理

所有方法在失败时会返回 `null`、`false` 或 0，请根据返回值进行错误处理。

```typescript
const template = sdk.acquireFingerprint();
if (!template) {
    console.error('指纹采集失败');
    return;
}
```

## 示例代码

### 基本指纹采集

```typescript
import { createLive20SDK } from 'live20-sdk-ts';

const sdk = createLive20SDK();
await sdk.initialize();
sdk.openDevice(0);

const template = sdk.acquireFingerprint();
if (template) {
    console.log('指纹采集成功');
}

sdk.closeDevice();
sdk.terminate();
```

### 指纹识别

```typescript
const template = sdk.acquireFingerprint();
const result = sdk.identifyFingerprint(template);

if (result && result.fid > 0) {
    console.log(`识别成功，FID: ${result.fid}, 分数: ${result.score}`);
} else {
    console.log('未识别到匹配的指纹');
}
```

### 指纹验证

```typescript
const template1 = sdk.acquireFingerprint();
const template2 = sdk.acquireFingerprint();

const isMatch = sdk.verifyFingerprints(template1, template2, 50);
console.log(isMatch ? '指纹匹配' : '指纹不匹配');
```
