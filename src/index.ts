import { createZKFPLoader, ZKFPLoader } from './lib/zkfp-loader'
import {
    ZKFPErrorCode,
    ZKFPFingerprintTemplate,
    ZKFPImageData,
    ZKFPIdentifyResult,
    ZKFPCapParams,
    ZKFPDBParamCode,
    ZKFPDeviceParam,
    MAX_TEMPLATE_SIZE,
    FP_THRESHOLD_CODE,
    FP_MTHRESHOLD_CODE, Logger
} from './types/zkfp-types'

/**
 * 指纹识别 SDK 主类
 */
export class Live20SDK {
    private loader: ZKFPLoader;
    private isInitialized = false;
    private readonly logger: Logger;

    constructor(logger?: Logger) {
        this.logger = logger || console;
        this.loader = createZKFPLoader(this.logger);
    }

    /**
     * 初始化指纹识别库
     */
    public async initialize(): Promise<boolean> {
        try {
            this.isInitialized = this.loader.initialize();
            return this.isInitialized;
        } catch (error) {
            this.logger.error('指纹识别库初始化失败:', error);
            return false;
        }
    }

    /**
     * 获取设备数
     */
    public getDeviceCount(): number {
        this.ensureInitialized();
        return this.loader.getDeviceCount();
    }

    /**
     * 打开设备
     * @param deviceIndex 设备索引，默认0
     */
    public openDevice(deviceIndex: number = 0): boolean {
        this.ensureInitialized();
        const result = this.loader.openDevice(deviceIndex);
        if (result) {
            // 打开设备后创建数据库
            this.createDatabase();
        }
        return result;
    }

    /**
     * 关闭设备
     */
    public closeDevice(): boolean {
        // 关闭设备前关闭数据库
        this.closeDatabase();
        return this.loader.closeDevice();
    }

    /**
     * 设置设备参数
     * @param paramCode 参数码
     * @param value 参数值
     */
    public setDeviceParam(paramCode: ZKFPDeviceParam, value: Uint8Array): boolean {
        return this.loader.setDeviceParam(paramCode, value);
    }

    /**
     * 获取设备参数
     * @param paramCode 参数码
     * @param bufferSize 缓冲区大小，默认1024
     */
    public getDeviceParam(paramCode: ZKFPDeviceParam, bufferSize?: number): Uint8Array | null {
        return this.loader.getDeviceParam(paramCode, bufferSize);
    }

    /**
     * 采集指纹模板
     * @returns 提取到的指纹模板，或失败时返回 null
     */
    public acquireFingerprint(): ZKFPFingerprintTemplate | null {
        this.ensureInitialized();
        return this.loader.acquireFingerprint();
    }

    /**
     * 采集指纹图像
     */
    public acquireFingerprintImage(): ZKFPImageData | null {
        this.ensureInitialized();
        return this.loader.acquireFingerprintImage();
    }

    /**
     * 创建数据库
     */
    public createDatabase(): boolean {
        this.ensureInitialized();
        return this.loader.createDBCache();
    }

    /**
     * 关闭数据库
     */
    public closeDatabase(): boolean {
        return this.loader.closeDBCache();
    }

    /**
     * 添加指纹模板到数据库
     * @param fid 指纹id
     * @param template 指纹模板
     */
    public addFingerprint(fid: number, template: ZKFPFingerprintTemplate): boolean {
        this.ensureInitialized();
        return this.loader.addTemplateToDB(fid, template);
    }

    /**
     * 从数据库删除指纹模板
     * @param fid 指纹id
     */
    public deleteFingerprint(fid: number): boolean {
        this.ensureInitialized();
        return this.loader.deleteTemplateFromDB(fid);
    }

    /**
     * 清空数据库
     */
    public clearDatabase(): boolean {
        this.ensureInitialized();
        return this.loader.clearDBCache();
    }

    /**
     * 获取数据库中的指纹数
     */
    public getFingerprintCount(): number {
        this.ensureInitialized();
        return this.loader.getTemplateCount();
    }

    /**
     * 设置识别参数
     * @param level 安全等级，默认0-3
     */
    public setSecurityLevel(level: number): boolean {
        this.ensureInitialized();
        return this.loader.setDBParameter(ZKFPDBParamCode.FP_MTHRESHOLD_CODE, level);
    }

    /**
     * 设置匹配阈值
     * @param threshold 匹配阈值，默认50-100
     */
    public setMatchThreshold(threshold: number): boolean {
        this.ensureInitialized();
        return this.loader.setDBParameter(ZKFPDBParamCode.FP_THRESHOLD_CODE, threshold);
    }

    /**
     * 获取数据库参数
     * @param paramCode 参数码
     */
    public getDBParam(paramCode: ZKFPDBParamCode): number {
        this.ensureInitialized();
        return this.loader.getDBParameter(paramCode);
    }

    /**
     * 识别指纹模板
     * @param template 指纹模板
     */
    public identifyFingerprint(template: ZKFPFingerprintTemplate): ZKFPIdentifyResult {
        this.ensureInitialized();
        return this.loader.identifyFingerprint(template);
    }

    /**
     * 验证两个指纹是否匹配
     * @param template1 指纹模板1
     * @param template2 指纹模板2
     * @param threshold 基础分数，默认50-1000
     */
    public verifyFingerprints(
        template1: ZKFPFingerprintTemplate,
        template2: ZKFPFingerprintTemplate,
        threshold: number = 50
    ): boolean {
        this.ensureInitialized();
        const score = this.loader.matchTemplates(template1, template2);
        return score >= threshold;
    }

    /**
     * 按ID验证指纹模板
     * @param fid 指纹id
     * @param template 指纹模板
     * @param threshold 基础分数，默认50-100
     */
    public verifyByID(fid: number, template: ZKFPFingerprintTemplate, threshold: number = 50): boolean {
        this.ensureInitialized();
        const score = this.loader.verifyByID(fid, template);
        return score >= threshold;
    }

    /**
     * 合并指纹模板
     * @param temp1 指纹模板1
     * @param temp2 指纹模板2
     * @param temp3 指纹模板3
     */
    public mergeTemplates(
        temp1: ZKFPFingerprintTemplate,
        temp2: ZKFPFingerprintTemplate,
        temp3: ZKFPFingerprintTemplate
    ): ZKFPFingerprintTemplate | null {
        this.ensureInitialized();
        return this.loader.genRegTemplate(temp1, temp2, temp3);
    }

    /**
     * 从图像提取指纹模板
     * @param filePath 图像文件路径
     * @param dpi 图像分辨率，默认500
     * @returns �取到的指纹模板，或失败时返回 null
     */
    public extractFromImage(filePath: string, dpi?: number): ZKFPFingerprintTemplate | null {
        this.ensureInitialized();
        return this.loader.extractFromImage(filePath, dpi);
    }

    /**
     * 获取最后提取的图像
     */
    public getLastExtractImage(): ZKFPImageData | null {
        return this.loader.getLastExtractImage();
    }

    /**
     * 获取采集参数
     */
    public getCaptureParams(): ZKFPCapParams | null {
        return this.loader.getCaptureParams();
    }

    /**
     * Base64转Blob
     */
    public base64ToBlob(base64Str: string, bufferSize?: number): Uint8Array | null {
        return this.loader.base64ToBlob(base64Str, bufferSize);
    }

    /**
     * Blob转Base64
     */
    public blobToBase64(data: Uint8Array, bufferSize?: number): string | null {
        return this.loader.blobToBase64(data, bufferSize);
    }

    /**
     * 清理资源
     */
    public terminate(): void {
        this.ensureInitialized();
        if (this.isInitialized) {
            this.loader.terminate();
            this.isInitialized = false;
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
}

/**
 * 创建指纹识别 SDK 实例
 */
export function createLive20SDK(logger?: Logger): Live20SDK {
    return new Live20SDK(logger);
}

/**
 * 导出类型定义
 */
export type {
    ZKFPErrorCode,
    ZKFPFingerprintTemplate,
    ZKFPImageData,
    ZKFPIdentifyResult,
    ZKFPCapParams,
    ZKFPDBParamCode,
    ZKFPDeviceParam
}

export {
    MAX_TEMPLATE_SIZE,
    FP_THRESHOLD_CODE,
    FP_MTHRESHOLD_CODE
}

export default createLive20SDK;
