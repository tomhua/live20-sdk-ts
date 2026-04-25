/**
 * 指纹模板数据结构
 * 包含指纹特征数据、大小和质量信息
 */
interface ZKFPFingerprintTemplate {
    /** 指纹特征数据 */
    data: Uint8Array;
    /** 模板数据大小（字节） */
    size: number;
    /** 模板质量（0-100），数值越高表示质量越好 */
    quality: number;
}
/**
 * 指纹图像数据结构
 * 包含采集到的指纹图像信息
 */
interface ZKFPImageData {
    /** 图像宽度（像素） */
    width: number;
    /** 图像高度（像素） */
    height: number;
    /** 图像数据 */
    data: Uint8Array;
    /** 图像DPI（通常为500） */
    dpi: number;
}
/**
 * 采集参数结构
 * 定义指纹采集设备的参数
 */
interface ZKFPCapParams {
    /** 采集图像宽度（像素） */
    imgWidth: number;
    /** 采集图像高度（像素） */
    imgHeight: number;
    /** 采集图像DPI（通常为500） */
    nDPI: number;
}
/**
 * 指纹识别结果结构
 * 用于1:N识别操作的结果返回
 */
interface ZKFPIdentifyResult {
    /** 匹配到的指纹ID */
    fid: number;
    /** 匹配分数（分数越高表示匹配度越高） */
    score: number;
    /** 是否识别成功 */
    success: boolean;
}
interface Logger {
    debug(...args: any[]): void;
    info(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
}
/**
 * 指纹识别错误码枚举
 * 定义了SDK操作可能返回的各种错误状态
 *
 * @example
 * ```typescript
 * if (result === ZKFPErrorCode.OK) {
 *   console.log('操作成功');
 * }
 * ```
 */
declare enum ZKFPErrorCode {
    /** 操作成功 */
    OK = 0,
    /** 已经初始化 */
    ALREADY_INIT = 1,
    /** 初始化算法库失败 */
    INITLIB = -1,
    /** 初始化采集库失败 */
    INIT = -2,
    /** 无设备连接 */
    NO_DEVICE = -3,
    /** 接口暂不支持 */
    NOT_SUPPORT = -4,
    /** 无效参数 */
    INVALID_PARAM = -5,
    /** 打开设备失败 */
    OPEN = -6,
    /** 无效句柄 */
    INVALID_HANDLE = -7,
    /** 取像失败 */
    CAPTURE = -8,
    /** 提取指纹模板失败 */
    EXTRACT_FP = -9,
    /** 中断 */
    ABSORT = -10,
    /** 内存不足 */
    MEMORY_NOT_ENOUGH = -11,
    /** 当前正在采集 */
    BUSY = -12,
    /** 添加指纹模板失败 */
    ADD_FINGER = -13,
    /** 删除指纹失败 */
    DEL_FINGER = -14,
    /** 操作失败 */
    FAIL = -17,
    /** 取消采集 */
    CANCEL = -18,
    /** 比对指纹失败 */
    VERIFY_FP = -20,
    /** 合并登记指纹模板失败 */
    MERGE = -22,
    /** 设备未打开 */
    NOT_OPENED = -23,
    /** 未初始化 */
    NOT_INIT = -24,
    /** 设备已打开 */
    ALREADY_OPENED = -25,
    /** 文件打开失败 */
    LOADIMAGE = -26,
    /** 处理图像失败 */
    ANALYSE_IMG = -27,
    /** 超时 */
    TIMEOUT = -28
}
/**
 * 数据库参数代码枚举
 * 用于设置和获取指纹数据库的操作参数
 *
 * @see ZKFPDBParamCode.FP_THRESHOLD_CODE - 指纹1:1阈值
 * @see ZKFPDBParamCode.FP_MTHRESHOLD_CODE - 指纹1:N阈值
 */
declare enum ZKFPDBParamCode {
    /** 指纹1:1比对阈值（用于verifyFingerprints） */
    FP_THRESHOLD_CODE = 1,
    /** 指纹1:N识别阈值（用于identifyFingerprint） */
    FP_MTHRESHOLD_CODE = 2
}
/**
 * 设备参数代码枚举
 * 用于设置和获取指纹采集设备的参数
 */
declare enum ZKFPDeviceParam {
    /** 亮度参数 */
    BRIGHTNESS = 1,
    /** 对比度参数 */
    CONTRAST = 2,
    /** 增益参数 */
    GAIN = 3
}
/**
 * 指纹模板最大长度（字节）
 * 定义指纹模板数据的最大存储空间
 */
declare const MAX_TEMPLATE_SIZE = 2048;
/**
 * 指纹1:1比对阈值参数代码
 * 与 ZKFPDBParamCode.FP_THRESHOLD_CODE 相同
 */
declare const FP_THRESHOLD_CODE = 1;
/**
 * 指纹1:N识别阈值参数代码
 * 与 ZKFPDBParamCode.FP_MTHRESHOLD_CODE 相同
 */
declare const FP_MTHRESHOLD_CODE = 2;

/**
 * 指纹识别 SDK 主类
 */
declare class Live20SDK {
    private loader;
    private isInitialized;
    private logger;
    constructor(dllName?: string, logger?: Logger);
    /**
     * 初始化指纹识别库
     */
    initialize(): Promise<boolean>;
    /**
     * 获取设备数
     */
    getDeviceCount(): number;
    /**
     * 打开设备
     */
    openDevice(deviceIndex?: number): boolean;
    /**
     * 关闭设备
     */
    closeDevice(): boolean;
    /**
     * 设置设备参数
     */
    setDeviceParam(paramCode: ZKFPDeviceParam, value: Uint8Array): boolean;
    /**
     * 获取设备参数
     */
    getDeviceParam(paramCode: ZKFPDeviceParam, bufferSize?: number): Uint8Array | null;
    /**
     * 采集指纹
     */
    acquireFingerprint(): ZKFPFingerprintTemplate | null;
    /**
     * 采集指纹图像
     */
    acquireFingerprintImage(bufferSize?: number): ZKFPImageData | null;
    /**
     * 创建数据库
     */
    createDatabase(): boolean;
    /**
     * 关闭数据库
     */
    closeDatabase(): boolean;
    /**
     * 添加指纹模板到数据库
     */
    addFingerprint(fid: number, template: ZKFPFingerprintTemplate): boolean;
    /**
     * 从数据库删除指纹模板
     */
    deleteFingerprint(fid: number): boolean;
    /**
     * 清空数据库
     */
    clearDatabase(): boolean;
    /**
     * 获取数据库中的指纹数
     */
    getFingerprintCount(): number;
    /**
     * 设置识别参数
     */
    setSecurityLevel(level: number): boolean;
    /**
     * 设置匹配阈值
     */
    setMatchThreshold(threshold: number): boolean;
    /**
     * 获取数据库参数
     */
    getDBParam(paramCode: ZKFPDBParamCode): number;
    /**
     * 识别指纹
     */
    identifyFingerprint(template: ZKFPFingerprintTemplate): ZKFPIdentifyResult;
    /**
     * 验证两个指纹是否匹配
     */
    verifyFingerprints(template1: ZKFPFingerprintTemplate, template2: ZKFPFingerprintTemplate, threshold?: number): boolean;
    /**
     * 按ID验证指纹
     */
    verifyByID(fid: number, template: ZKFPFingerprintTemplate, threshold?: number): boolean;
    /**
     * 合并指纹模板
     */
    mergeTemplates(temp1: ZKFPFingerprintTemplate, temp2: ZKFPFingerprintTemplate, temp3: ZKFPFingerprintTemplate): ZKFPFingerprintTemplate | null;
    /**
     * 从图像提取指纹
     */
    extractFromImage(filePath: string, dpi?: number): ZKFPFingerprintTemplate | null;
    /**
     * 获取最后提取的图像
     */
    getLastExtractImage(): ZKFPImageData | null;
    /**
     * 获取采集参数
     */
    getCaptureParams(): ZKFPCapParams | null;
    /**
     * Base64转Blob
     */
    base64ToBlob(base64Str: string, bufferSize?: number): Uint8Array | null;
    /**
     * Blob转Base64
     */
    blobToBase64(data: Uint8Array, bufferSize?: number): string | null;
    /**
     * 清理资源
     */
    terminate(): void;
    /**
     * 确保库已初始化
     */
    private ensureInitialized;
}
/**
 * 创建指纹识别 SDK 实例
 */
declare function createLive20SDK(dllName?: string): Live20SDK;

export { FP_MTHRESHOLD_CODE, FP_THRESHOLD_CODE, Live20SDK, MAX_TEMPLATE_SIZE, type ZKFPCapParams, ZKFPDBParamCode, ZKFPDeviceParam, ZKFPErrorCode, type ZKFPFingerprintTemplate, type ZKFPIdentifyResult, type ZKFPImageData, createLive20SDK, createLive20SDK as default };
