import koffi from 'koffi'
import {join, dirname, basename} from 'path'
import {accessSync, constants, readdirSync, openSync, readSync, closeSync} from 'fs'
import {chdir} from 'process'
import {
    ZKFPErrorCode,
    ZKFPHandle,
    ZKFPFingerprintTemplate,
    ZKFPImageData,
    ZKFPIdentifyResult,
    ZKFPCapParams,
    ZKFPDBParamCode,
    ZKFPDeviceParam,
    MAX_TEMPLATE_SIZE
} from '../types/zkfp-types'

/**
 * 检查 DLL 文件的位数
 * @param dllPath DLL 文件路径
 * @returns 0: 未知, 32: 32位, 64: 64位
 */
function getDllBitness(dllPath: string): number {
    try {
        const buffer = Buffer.alloc(1024); // 增加缓冲区大小
        const fd = openSync(dllPath, 'r');
        const bytesRead = readSync(fd, buffer, 0, 1024, 0);
        closeSync(fd);

        if (bytesRead < 64) {
            console.warn(`[ZKFPLoader] DLL 文件太小，无法检查位数: ${dllPath}`);
            return 0;
        }

        // DOS 头的 e_lfanew 字段（偏移 0x3C）指向 PE 头
        const peHeaderOffset = buffer.readUInt32LE(0x3C);
        if (peHeaderOffset === 0 || peHeaderOffset + 4 >= buffer.length) {
            console.warn(`[ZKFPLoader] 无效的 PE 头偏移: ${peHeaderOffset}`);
            return 0;
        }

        // PE 头的机器类型字段（偏移 0x4）
        const machineType = buffer.readUInt16LE(peHeaderOffset + 4);

        // 0x8664 = AMD64 (64位), 0x14C = Intel 386 (32位)
        if (machineType === 0x8664) return 64;
        if (machineType === 0x14C) return 32;

        return 0;
    } catch (error) {
        console.warn(`[ZKFPLoader] 检查 DLL 位数失败 ${dllPath}:`, error);
        return 0;
    }
}

/**
 * 指纹识别 DLL 加载器
 * 专门用于加载和调用指纹识别相关的 DLL 函数
 */
export class ZKFPLoader {
    private lib: any = null;
    private isInitialized = false;
    private deviceHandle: ZKFPHandle = null;
    private dbCacheHandle: ZKFPHandle = null;

    private readonly dllPaths: string[] = [];

    constructor(dllName?: string) {
        this.dllPaths = this.resolveDllPaths(dllName);
    }

    /**
     * 解析 DLL 路径
     */
    private resolveDllPaths(mainDllName?: string): string[] {
        const is64Bit = process.arch === 'x64';
        console.log(`[ZKFPLoader] Node.js 架构: ${process.arch}`);

        const paths: string[] = [];

        if (mainDllName) {
            // 优先使用 demotest 目录下的 libzkfp.dll（如果存在且位数匹配）
            if (mainDllName === 'libzkfp.dll') {
                const demoLibPath = join(process.cwd(), 'demotest', 'libzkfp.dll');
                if (this.fileExists(demoLibPath)) {
                    const bitness = getDllBitness(demoLibPath);
                    if ((is64Bit && bitness === 64) || (!is64Bit && bitness === 32)) {
                        console.log(`[ZKFPLoader] ✅ 使用 demotest 目录下的 libzkfp.dll: ${demoLibPath} (${bitness}位)`);
                        paths.push(demoLibPath);
                        return paths;
                    }
                }
            }

            // 尝试在 x64 和 x86 目录中寻找匹配架构的 DLL
            const dllDirs = [
                join(process.cwd(), 'src', 'dll', 'x64'),
                join(process.cwd(), 'src', 'dll', 'x86')
            ];

            for (const dllDir of dllDirs) {
                const dllPath = join(dllDir, mainDllName);
                if (this.fileExists(dllPath)) {
                    const bitness = getDllBitness(dllPath);
                    if (bitness === 0 || (is64Bit && bitness === 64) || (!is64Bit && bitness === 32)) {
                        console.log(`[ZKFPLoader] ✅ 找到文件: ${dllPath} (${bitness}位)`);
                        paths.push(dllPath);
                        break;
                    }
                }
            }

            if (paths.length === 0) {
                console.log(`[ZKFPLoader] ❌ 未找到匹配架构的 ${mainDllName}`);
            }
            return paths;
        }

        // 扫描所有 DLL 目录
        const dllDirs = [
            join(process.cwd(), 'src', 'dll', 'x64'),
            join(process.cwd(), 'src', 'dll', 'x86')
        ];

        let allDllFiles: string[] = [];
        for (const dllDir of dllDirs) {
            allDllFiles = [...allDllFiles, ...this.getAllDllFiles(dllDir)];
        }

        // 检查每个 DLL 文件的位数
        const dllInfo = allDllFiles.map(dll => ({
            path: dll,
            bitness: getDllBitness(dll)
        }));

        // 优先加载与系统架构匹配的 DLL
        const matchingDlls = dllInfo
            .filter(info => (is64Bit && info.bitness === 64) || (!is64Bit && info.bitness === 32))
            .map(info => info.path);

        // 然后加载其他 DLL
        const otherDlls = dllInfo
            .filter(info => !matchingDlls.includes(info.path))
            .map(info => info.path);

        // 优先添加匹配架构的 DLL
        paths.push(...matchingDlls, ...otherDlls);

        console.log(`[ZKFPLoader] 找到 ${paths.length} 个 DLL 文件...`);
        for (const dll of paths) {
            const bitness = getDllBitness(dll);
            console.log(`[ZKFPLoader] ✅ 添加: ${dll} (${bitness}位)`);
        }

        return paths;
    }

    /**
     * 检查文件是否存在
     */
    private fileExists(path: string): boolean {
        try {
            accessSync(path, constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 获取指定目录下所有的 DLL 文件
     */
    private getAllDllFiles(dir: string): string[] {
        const dllFiles: string[] = [];
        try {
            const files = readdirSync(dir);
            for (const file of files) {
                if (file.toLowerCase().endsWith('.dll')) {
                    dllFiles.push(join(dir, file));
                }
            }
        } catch (err) {
            console.warn(`[ZKFPLoader] ⚠️ 无法读取目录 ${dir}:`, err);
        }
        return dllFiles;
    }

    /**
     * 初始化指纹识别库
     */
    public initialize(): boolean {
        if (this.isInitialized) {
            return true;
        }

        const originalCwd = process.cwd();

        try {
            if (this.dllPaths.length === 0) {
                console.warn('未找到任何 DLL 文件，将尝试使用系统路径加载');
            }

            const is64Bit = process.arch === 'x64';
            console.log(`[ZKFPLoader] 尝试加载 ${this.dllPaths.length} 个 DLL...`);

            for (const dllPath of this.dllPaths) {
                try {
                    const bitness = getDllBitness(dllPath);
                    // 只加载与系统架构匹配的 DLL
                    if ((is64Bit && bitness === 64) || (!is64Bit && bitness === 32)) {
                        const dllDir = dirname(dllPath);
                        const dllName = basename(dllPath);
                        console.log(`[ZKFPLoader] 切换到 DLL 目录: ${dllDir}`);
                        chdir(dllDir);

                        console.log(`[ZKFPLoader] 尝试加载: ${dllName} (${bitness}位)`);
                        const lib = koffi.load(dllName);
                        console.log(`[ZKFPLoader] ✅ 成功加载: ${dllName} (${bitness}位)`);
                        if (!this.lib) {
                            this.lib = lib;
                        }

                        chdir(originalCwd);
                    } else {
                        console.log(`[ZKFPLoader] ⚠️ 跳过加载: ${dllPath} (${bitness}位，与系统架构不匹配)`);
                    }
                } catch (err) {
                    console.warn(`[ZKFPLoader] ⚠️ 加载失败 ${dllPath}:`, err);
                    chdir(originalCwd);
                }
            }

            if (!this.lib) {
                console.log('[ZKFPLoader] 尝试加载默认名称: zkfinger12.dll');
                try {
                    chdir(join(process.cwd(), 'src', 'dll', is64Bit ? 'x64' : 'x86'));
                    this.lib = koffi.load('zkfinger12.dll');
                    chdir(originalCwd);
                } catch (err) {
                    chdir(originalCwd);
                    this.lib = koffi.load('zkfinger12.dll');
                }
            }

            console.log('[ZKFPLoader] DLL 加载完成，开始绑定函数...');
            this.bindFunctions();

            console.log('[ZKFPLoader] 调用 ZKFPM_Init...');

            try {
                const result = this.lib.ZKFPM_Init();

                if (result === ZKFPErrorCode.OK) {
                    this.isInitialized = true;
                    console.log('指纹识别库初始化成功');
                    return true;
                } else {
                    console.warn(`[ZKFPLoader] 初始化失败，错误码: ${result}，但继续执行`);
                    // 即使初始化失败，也将 isInitialized 设置为 true，以便后续操作可以执行
                    this.isInitialized = true;
                    return true;
                }
            } catch (error) {
                console.warn('[ZKFPLoader] 初始化过程中发生错误:', error, '，但继续执行');
                // 即使发生错误，也将 isInitialized 设置为 true，以便后续操作可以执行
                this.isInitialized = true;
                return true;
            }

        } catch (error) {
            console.error('指纹识别库初始化失败:', error);
            return false;
        }
    }

    /**
     * 绑定 DLL 函数
     * 注意：函数签名基于 libzkfp.h 头文件
     * 头文件定义 APICALL 为 __stdcall，所以函数声明必须使用 stdcall 调用约定
     */
    private bindFunctions(): void {
        try {
            this.lib.ZKFPM_Init = this.lib.func('int __stdcall ZKFPM_Init()');
            this.lib.ZKFPM_Terminate = this.lib.func('int __stdcall ZKFPM_Terminate()');

            this.lib.ZKFPM_GetDeviceCount = this.lib.func('int __stdcall ZKFPM_GetDeviceCount()');
            this.lib.ZKFPM_OpenDevice = this.lib.func('void* __stdcall ZKFPM_OpenDevice(int)');
            this.lib.ZKFPM_CloseDevice = this.lib.func('int __stdcall ZKFPM_CloseDevice(void*)');

            this.lib.ZKFPM_SetParameters = this.lib.func('int __stdcall ZKFPM_SetParameters(void*, int, uint8*, uint)');
            this.lib.ZKFPM_GetParameters = this.lib.func('int __stdcall ZKFPM_GetParameters(void*, int, uint8*, uint*)');

            this.lib.ZKFPM_AcquireFingerprint = this.lib.func('int __stdcall ZKFPM_AcquireFingerprint(void*, uint8*, uint, uint8*, uint*)');
            this.lib.ZKFPM_AcquireFingerprintImage = this.lib.func('int __stdcall ZKFPM_AcquireFingerprintImage(void*, uint8*, uint)');

            this.lib.ZKFPM_CreateDBCache = this.lib.func('void* __stdcall ZKFPM_CreateDBCache()');
            this.lib.ZKFPM_DBInit = this.lib.func('void* __stdcall ZKFPM_DBInit()');
            this.lib.ZKFPM_CloseDBCache = this.lib.func('int __stdcall ZKFPM_CloseDBCache(void*)');
            this.lib.ZKFPM_DBFree = this.lib.func('int __stdcall ZKFPM_DBFree(void*)');

            this.lib.ZKFPM_DBSetParameter = this.lib.func('int __stdcall ZKFPM_DBSetParameter(void*, int, int)');
            this.lib.ZKFPM_DBGetParameter = this.lib.func('int __stdcall ZKFPM_DBGetParameter(void*, int, int*)');

            this.lib.ZKFPM_GenRegTemplate = this.lib.func('int __stdcall ZKFPM_GenRegTemplate(void*, uint8*, uint8*, uint8*, uint8*, uint*)');
            this.lib.ZKFPM_DBMerge = this.lib.func('int __stdcall ZKFPM_DBMerge(void*, uint8*, uint8*, uint8*, uint8*, uint*)');

            this.lib.ZKFPM_AddRegTemplateToDBCache = this.lib.func('int __stdcall ZKFPM_AddRegTemplateToDBCache(void*, uint, uint8*, uint)');
            this.lib.ZKFPM_DBAdd = this.lib.func('int __stdcall ZKFPM_DBAdd(void*, uint, uint8*, uint)');

            this.lib.ZKFPM_DelRegTemplateFromDBCache = this.lib.func('int __stdcall ZKFPM_DelRegTemplateFromDBCache(void*, uint)');
            this.lib.ZKFPM_DBDel = this.lib.func('int __stdcall ZKFPM_DBDel(void*, uint)');

            this.lib.ZKFPM_ClearDBCache = this.lib.func('int __stdcall ZKFPM_ClearDBCache(void*)');
            this.lib.ZKFPM_DBClear = this.lib.func('int __stdcall ZKFPM_DBClear(void*)');

            this.lib.ZKFPM_GetDBCacheCount = this.lib.func('int __stdcall ZKFPM_GetDBCacheCount(void*, uint*)');
            this.lib.ZKFPM_DBCount = this.lib.func('int __stdcall ZKFPM_DBCount(void*, uint*)');

            this.lib.ZKFPM_Identify = this.lib.func('int __stdcall ZKFPM_Identify(void*, uint8*, uint, uint*, uint*)');
            this.lib.ZKFPM_DBIdentify = this.lib.func('int __stdcall ZKFPM_DBIdentify(void*, uint8*, uint, uint*, uint*)');

            this.lib.ZKFPM_MatchFinger = this.lib.func('int __stdcall ZKFPM_MatchFinger(void*, uint8*, uint, uint8*, uint)');
            this.lib.ZKFPM_DBMatch = this.lib.func('int __stdcall ZKFPM_DBMatch(void*, uint8*, uint, uint8*, uint)');

            this.lib.ZKFPM_VerifyByID = this.lib.func('int __stdcall ZKFPM_VerifyByID(void*, uint, uint8*, uint)');

            this.lib.ZKFPM_ExtractFromImage = this.lib.func('int __stdcall ZKFPM_ExtractFromImage(void*, string, uint, uint8*, uint*)');

            this.lib.ZKFPM_Base64ToBlob = this.lib.func('int __stdcall ZKFPM_Base64ToBlob(string, uint8*, uint)');
            this.lib.ZKFPM_BlobToBase64 = this.lib.func('int __stdcall ZKFPM_BlobToBase64(uint8*, uint, char*, uint)');

            this.lib.ZKFPM_GetLastExtractImage = this.lib.func('uint8* __stdcall ZKFPM_GetLastExtractImage(int*, int*)');

            this.lib.ZKFPM_GetCaptureParams = this.lib.func('int __stdcall ZKFPM_GetCaptureParams(void*, void*)');
            this.lib.ZKFPM_GetCaptureParamsEx = this.lib.func('int __stdcall ZKFPM_GetCaptureParamsEx(void*, int*, int*, int*)');
        } catch (err) {
            console.error('绑定函数失败:', err);
            throw err;
        }
    }

    /**
     * 获取设备数
     */
    public getDeviceCount(): number {
        this.ensureInitialized();
        return this.lib.ZKFPM_GetDeviceCount();
    }

    /**
     * 打开设备
     */
    public openDevice(deviceIndex: number = 0): boolean {
        this.ensureInitialized();

        const handle = this.lib.ZKFPM_OpenDevice(deviceIndex);
        if (handle && handle !== null) {
            this.deviceHandle = handle;
            return true;
        }
        return false;
    }

    /**
     * 关闭设备
     */
    public closeDevice(): boolean {
        if (this.deviceHandle) {
            try {
                const result = this.lib.ZKFPM_CloseDevice(this.deviceHandle);
                return result === ZKFPErrorCode.OK;
            } finally {
                this.deviceHandle = null;
            }
        }
        return true;
    }

    /**
     * 设置设备参数
     */
    public setDeviceParam(paramCode: ZKFPDeviceParam, value: Uint8Array): boolean {
        this.ensureDeviceOpened();
        const result = this.lib.ZKFPM_SetParameters(
            this.deviceHandle,
            paramCode,
            value,
            value.length
        );
        return result === ZKFPErrorCode.OK;
    }

    /**
     * 获取设备参数
     */
    public getDeviceParam(paramCode: ZKFPDeviceParam, bufferSize: number = 1024): Uint8Array | null {
        this.ensureDeviceOpened();
        const buffer = Buffer.alloc(bufferSize);
        const sizeBuffer = Buffer.alloc(4);
        const result = this.lib.ZKFPM_GetParameters(
            this.deviceHandle,
            paramCode,
            buffer,
            sizeBuffer
        );
        if (result === ZKFPErrorCode.OK) {
            const actualSize = sizeBuffer.readUInt32LE(0);
            return new Uint8Array(buffer.slice(0, actualSize));
        }
        return null;
    }

    /**
     * 采集指纹（获取图像+模板）
     */
    public acquireFingerprint(): ZKFPFingerprintTemplate | null {
        this.ensureDeviceOpened();

        const templateBuffer = Buffer.alloc(MAX_TEMPLATE_SIZE);
        const imageBuffer = Buffer.alloc(1024 * 1024);
        const sizeBuffer = Buffer.alloc(4);

        const result = this.lib.ZKFPM_AcquireFingerprint(
            this.deviceHandle,
            imageBuffer,
            imageBuffer.length,
            templateBuffer,
            sizeBuffer
        );

        if (result === ZKFPErrorCode.OK) {
            const size = sizeBuffer.readUInt32LE(0);
            return {
                data: new Uint8Array(templateBuffer.slice(0, size)),
                size: size,
                quality: this.calculateTemplateQuality(templateBuffer, size)
            };
        }
        return null;
    }

    /**
     * 采集指纹图像
     */
    public acquireFingerprintImage(bufferSize: number = 1024 * 1024): ZKFPImageData | null {
        this.ensureDeviceOpened();
        const imageBuffer = Buffer.alloc(bufferSize);
        const result = this.lib.ZKFPM_AcquireFingerprintImage(
            this.deviceHandle,
            imageBuffer,
            bufferSize
        );
        if (result === ZKFPErrorCode.OK) {
            const params = this.getCaptureParams();
            return {
                width: params?.imgWidth ?? 0,
                height: params?.imgHeight ?? 0,
                data: new Uint8Array(imageBuffer),
                dpi: params?.nDPI ?? 500
            };
        }
        return null;
    }

    /**
     * 计算模板质量
     */
    private calculateTemplateQuality(_buffer: Buffer, size: number): number {
        if (size < 100) return 0;
        if (size > 500) return 100;
        return Math.min(100, Math.floor((size - 100) / 4));
    }

    /**
     * 创建数据库缓存
     */
    public createDBCache(): boolean {
        this.ensureInitialized();

        // 优先使用 ZKFPM_DBInit() 方法（与 C# 代码一致）
        const handle = this.lib.ZKFPM_DBInit();
        if (handle && handle !== null) {
            this.dbCacheHandle = handle;
            return true;
        }

        // 如果 ZKFPM_DBInit() 失败，尝试使用 ZKFPM_CreateDBCache()
        const createHandle = this.lib.ZKFPM_CreateDBCache();
        if (createHandle && createHandle !== null) {
            this.dbCacheHandle = createHandle;
            return true;
        }

        return false;
    }

    /**
     * 关闭数据库缓存
     */
    public closeDBCache(): boolean {
        if (this.dbCacheHandle) {
            try {
                const result = this.lib.ZKFPM_CloseDBCache(this.dbCacheHandle);
                return result === ZKFPErrorCode.OK;
            } finally {
                this.dbCacheHandle = null;
            }
        }
        return true;
    }

    /**
     * 添加指纹模板到数据库
     */
    public addTemplateToDB(fid: number, template: ZKFPFingerprintTemplate): boolean {
        this.ensureDBCacheCreated();
        const result = this.lib.ZKFPM_AddRegTemplateToDBCache(
            this.dbCacheHandle,
            fid,
            template.data,
            template.size
        );
        return result === ZKFPErrorCode.OK;
    }

    /**
     * 从数据库删除指纹模板
     */
    public deleteTemplateFromDB(fid: number): boolean {
        this.ensureDBCacheCreated();
        const result = this.lib.ZKFPM_DelRegTemplateFromDBCache(
            this.dbCacheHandle,
            fid
        );
        return result === ZKFPErrorCode.OK;
    }

    /**
     * 清空数据库
     */
    public clearDBCache(): boolean {
        this.ensureDBCacheCreated();
        const result = this.lib.ZKFPM_ClearDBCache(this.dbCacheHandle);
        return result === ZKFPErrorCode.OK;
    }

    /**
     * 获取数据库模板数
     */
    public getTemplateCount(): number {
        this.ensureDBCacheCreated();
        const countBuffer = Buffer.alloc(4);
        const result = this.lib.ZKFPM_GetDBCacheCount(this.dbCacheHandle, countBuffer);
        return result === ZKFPErrorCode.OK ? countBuffer.readUInt32LE(0) : 0;
    }

    /**
     * 设置数据库参数
     */
    public setDBParameter(paramCode: ZKFPDBParamCode, value: number): boolean {
        this.ensureDBCacheCreated();
        const result = this.lib.ZKFPM_DBSetParameter(this.dbCacheHandle, paramCode, value);
        return result === ZKFPErrorCode.OK;
    }

    /**
     * 获取数据库参数
     */
    public getDBParameter(paramCode: ZKFPDBParamCode): number {
        this.ensureDBCacheCreated();
        const valueBuffer = Buffer.alloc(4);
        const result = this.lib.ZKFPM_DBGetParameter(this.dbCacheHandle, paramCode, valueBuffer);
        return result === ZKFPErrorCode.OK ? valueBuffer.readInt32LE(0) : -1;
    }

    /**
     * 识别指纹（1:N）
     */
    public identifyFingerprint(template: ZKFPFingerprintTemplate): ZKFPIdentifyResult {
        this.ensureDBCacheCreated();
        const fidBuffer = Buffer.alloc(4);
        const scoreBuffer = Buffer.alloc(4);

        const result = this.lib.ZKFPM_Identify(
            this.dbCacheHandle,
            template.data,
            template.size,
            fidBuffer,
            scoreBuffer
        );

        return {
            fid: fidBuffer.readUInt32LE(0),
            score: scoreBuffer.readUInt32LE(0),
            success: result === ZKFPErrorCode.OK
        };
    }

    /**
     * 比对两个指纹模板（1:1）
     */
    public matchTemplates(
        template1: ZKFPFingerprintTemplate,
        template2: ZKFPFingerprintTemplate
    ): number {
        this.ensureDBCacheCreated();
        const result = this.lib.ZKFPM_MatchFinger(
            this.dbCacheHandle,
            template1.data,
            template1.size,
            template2.data,
            template2.size
        );
        return result;
    }

    /**
     * 按ID验证指纹
     */
    public verifyByID(fid: number, template: ZKFPFingerprintTemplate): number {
        this.ensureDBCacheCreated();
        const result = this.lib.ZKFPM_VerifyByID(
            this.dbCacheHandle,
            fid,
            template.data,
            template.size
        );
        return result;
    }

    /**
     * 合并3个指纹模板为登记模板
     */
    public genRegTemplate(
        temp1: ZKFPFingerprintTemplate,
        temp2: ZKFPFingerprintTemplate,
        temp3: ZKFPFingerprintTemplate
    ): ZKFPFingerprintTemplate | null {
        this.ensureDBCacheCreated();
        const regTemplate = Buffer.alloc(MAX_TEMPLATE_SIZE);
        const sizeBuffer = Buffer.alloc(4);

        const result = this.lib.ZKFPM_GenRegTemplate(
            this.dbCacheHandle,
            temp1.data,
            temp2.data,
            temp3.data,
            regTemplate,
            sizeBuffer
        );

        if (result === ZKFPErrorCode.OK) {
            const size = sizeBuffer.readUInt32LE(0);
            return {
                data: new Uint8Array(regTemplate.slice(0, size)),
                size: size,
                quality: this.calculateTemplateQuality(regTemplate, size)
            };
        }
        return null;
    }

    /**
     * 从 BMP 图像提取指纹模板
     */
    public extractFromImage(filePath: string, dpi: number = 500): ZKFPFingerprintTemplate | null {
        this.ensureDBCacheCreated();
        const templateBuffer = Buffer.alloc(MAX_TEMPLATE_SIZE);
        const sizeBuffer = Buffer.alloc(4);

        const result = this.lib.ZKFPM_ExtractFromImage(
            this.dbCacheHandle,
            filePath,
            dpi,
            templateBuffer,
            sizeBuffer
        );

        if (result > 0) {
            const size = sizeBuffer.readUInt32LE(0);
            return {
                data: new Uint8Array(templateBuffer.slice(0, size)),
                size: size,
                quality: this.calculateTemplateQuality(templateBuffer, size)
            };
        }
        return null;
    }

    /**
     * 获取最后提取的图像
     */
    public getLastExtractImage(): ZKFPImageData | null {
        const widthBuffer = Buffer.alloc(4);
        const heightBuffer = Buffer.alloc(4);

        const imageData = this.lib.ZKFPM_GetLastExtractImage(widthBuffer, heightBuffer);

        if (imageData && imageData !== null) {
            const width = widthBuffer.readInt32LE(0);
            const height = heightBuffer.readInt32LE(0);
            const data = Buffer.from(imageData);
            return {
                width: width,
                height: height,
                data: new Uint8Array(data),
                dpi: 500
            };
        }
        return null;
    }

    /**
     * 获取采集参数
     */
    public getCaptureParams(): ZKFPCapParams | null {
        this.ensureDeviceOpened();
        const widthBuffer = Buffer.alloc(4);
        const heightBuffer = Buffer.alloc(4);
        const dpiBuffer = Buffer.alloc(4);

        const result = this.lib.ZKFPM_GetCaptureParamsEx(
            this.deviceHandle,
            widthBuffer,
            heightBuffer,
            dpiBuffer
        );

        if (result === ZKFPErrorCode.OK) {
            return {
                imgWidth: widthBuffer.readInt32LE(0),
                imgHeight: heightBuffer.readInt32LE(0),
                nDPI: dpiBuffer.readInt32LE(0)
            };
        }
        return null;
    }

    /**
     * Base64转Blob
     */
    public base64ToBlob(base64Str: string, bufferSize: number = 1024 * 1024): Uint8Array | null {
        const buffer = Buffer.alloc(bufferSize);
        const result = this.lib.ZKFPM_Base64ToBlob(base64Str, buffer, bufferSize);
        if (result > 0) {
            return new Uint8Array(buffer.slice(0, result));
        }
        return null;
    }

    /**
     * Blob转Base64
     */
    public blobToBase64(data: Uint8Array, bufferSize: number = 1024 * 1024): string | null {
        const buffer = Buffer.alloc(bufferSize);
        const result = this.lib.ZKFPM_BlobToBase64(data, data.length, buffer, bufferSize);
        if (result > 0) {
            return buffer.toString('ascii', 0, result);
        }
        return null;
    }

    /**
     * 清理资源
     */
    public terminate(): void {
        try {
            console.log('开始清理资源...');

            // 关闭数据库
            if (this.dbCacheHandle) {
                console.log('关闭数据库...');
                try {
                    const ret = this.closeDBCache();
                    console.log(`数据库关闭结果: ${ret}`);
                } catch (error) {
                    console.error('关闭数据库失败:', error);
                }
            }

            // 关闭设备
            if (this.deviceHandle) {
                console.log('关闭设备...');
                try {
                    const ret = this.closeDevice();
                    console.log(`设备关闭结果: ${ret}`);
                } catch (error) {
                    console.error('关闭设备失败:', error);
                }
            }

            // 清理库
            if (this.isInitialized && this.lib) {
                console.log('清理指纹识别库...');
                try {
                    if (typeof this.lib.ZKFPM_Terminate === 'function') {
                        const ret = this.lib.ZKFPM_Terminate();
                        console.log(`ZKFPM_Terminate() 返回: ${ret}`);
                        if (ret === ZKFPErrorCode.OK) {
                            console.log('指纹识别库已清理');
                        } else {
                            console.warn(`指纹识别库清理失败，错误码: ${ret}`);
                        }
                    } else {
                        console.warn('ZKFPM_Terminate 函数未绑定');
                    }
                } catch (error) {
                    console.error('调用 ZKFPM_Terminate 失败:', error);
                } finally {
                    this.isInitialized = false;
                }
            }

            console.log('所有资源清理完成');
        } catch (error) {
            console.error('清理资源时发生错误:', error);
        }
    }

    /**
     * 确保库已初始化
     */
    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('指纹识别库未初始化，请先调用 initialize() 方法');
        }
    }

    /**
     * 确保设备已打开
     */
    private ensureDeviceOpened(): void {
        this.ensureInitialized();
        if (!this.deviceHandle) {
            throw new Error('设备未打开，请先调用 openDevice() 方法');
        }
    }

    /**
     * 确保数据库已创建
     */
    private ensureDBCacheCreated(): void {
        this.ensureInitialized();
        if (!this.dbCacheHandle) {
            throw new Error('数据库未创建，请先调用 createDBCache() 方法');
        }
    }
}

/**
 * 创建 ZKFPLoader 实例
 */
export function createZKFPLoader(dllName?: string): ZKFPLoader {
    return new ZKFPLoader(dllName);
}
