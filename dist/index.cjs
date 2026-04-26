"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  FP_MTHRESHOLD_CODE: () => FP_MTHRESHOLD_CODE,
  FP_THRESHOLD_CODE: () => FP_THRESHOLD_CODE,
  Live20SDK: () => Live20SDK,
  MAX_TEMPLATE_SIZE: () => MAX_TEMPLATE_SIZE,
  createLive20SDK: () => createLive20SDK,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/lib/zkfp-loader.ts
var import_koffi = __toESM(require("koffi"), 1);
var import_path = require("path");
var import_url = require("url");
var import_fs = require("fs");
var import_process = require("process");

// src/types/zkfp-types.ts
var MAX_TEMPLATE_SIZE = 2048;
var FP_THRESHOLD_CODE = 1;
var FP_MTHRESHOLD_CODE = 2;

// src/lib/zkfp-loader.ts
var import_meta = {};
var ZKFPLoader = class {
  constructor(logger) {
    this.lib = null;
    this.isInitialized = false;
    this.deviceHandle = null;
    this.dbCacheHandle = null;
    this.dllPaths = [];
    this.logger = logger || console;
    this.dllPaths = this.resolveDllPaths();
  }
  /**
   * 检查 DLL 文件的位数
   * @param dllPath DLL 文件路径
   * @returns 0: 未知, 32: 32位, 64: 64位
   */
  getDllBitness(dllPath) {
    try {
      const buffer = Buffer.alloc(1024);
      const fd = (0, import_fs.openSync)(dllPath, "r");
      const bytesRead = (0, import_fs.readSync)(fd, buffer, 0, 1024, 0);
      (0, import_fs.closeSync)(fd);
      if (bytesRead < 64) {
        this.logger.warn(`[ZKFPLoader] DLL \u6587\u4EF6\u592A\u5C0F\uFF0C\u65E0\u6CD5\u68C0\u67E5\u4F4D\u6570: ${dllPath}`);
        return 0;
      }
      const peHeaderOffset = buffer.readUInt32LE(60);
      if (peHeaderOffset === 0 || peHeaderOffset + 4 >= buffer.length) {
        this.logger.warn(`[ZKFPLoader] \u65E0\u6548\u7684 PE \u5934\u504F\u79FB: ${peHeaderOffset}`);
        return 0;
      }
      const machineType = buffer.readUInt16LE(peHeaderOffset + 4);
      if (machineType === 34404) return 64;
      if (machineType === 332) return 32;
      return 0;
    } catch (error) {
      this.logger.warn(`[ZKFPLoader] \u68C0\u67E5 DLL \u4F4D\u6570\u5931\u8D25 ${dllPath}:`, error);
      return 0;
    }
  }
  /**
   * 解析 DLL 路径
   */
  resolveDllPaths() {
    const is64Bit = process.arch === "x64";
    this.logger.info(`[ZKFPLoader] Node.js \u67B6\u6784: ${process.arch}`);
    const paths = [];
    let srcDir;
    try {
      const __dirname = (0, import_path.dirname)((0, import_url.fileURLToPath)(import_meta.url));
      srcDir = (0, import_path.dirname)(__dirname);
    } catch (e) {
      const currentDir = (0, import_path.dirname)(__filename);
      srcDir = (0, import_path.dirname)(currentDir);
    }
    const dllDirs = [
      (0, import_path.join)(srcDir, "dll", "x64"),
      (0, import_path.join)(srcDir, "dll", "x86")
    ];
    let allDllFiles = [];
    for (const dllDir of dllDirs) {
      allDllFiles = [...allDllFiles, ...this.getAllDllFiles(dllDir)];
    }
    const dllInfo = allDllFiles.map((dll) => ({
      path: dll,
      bitness: this.getDllBitness(dll)
    }));
    const matchingDlls = dllInfo.filter((info) => is64Bit && info.bitness === 64 || !is64Bit && info.bitness === 32).map((info) => info.path);
    const otherDlls = dllInfo.filter((info) => !matchingDlls.includes(info.path)).map((info) => info.path);
    paths.push(...matchingDlls, ...otherDlls);
    this.logger.info(`[ZKFPLoader] \u627E\u5230 ${paths.length} \u4E2A DLL \u6587\u4EF6...`);
    for (const dll of paths) {
      const bitness = this.getDllBitness(dll);
      this.logger.info(`[ZKFPLoader] \u2705 \u6DFB\u52A0: ${dll} (${bitness}\u4F4D)`);
    }
    return paths;
  }
  /**
   * 获取指定目录下所有的 DLL 文件
   */
  getAllDllFiles(dir) {
    const dllFiles = [];
    try {
      const files = (0, import_fs.readdirSync)(dir);
      for (const file of files) {
        if (file.toLowerCase().endsWith(".dll")) {
          dllFiles.push((0, import_path.join)(dir, file));
        }
      }
    } catch (err) {
      this.logger.warn(`[ZKFPLoader] \u26A0\uFE0F \u65E0\u6CD5\u8BFB\u53D6\u76EE\u5F55 ${dir}:`, err);
    }
    return dllFiles;
  }
  /**
   * 初始化指纹识别库
   */
  initialize() {
    if (this.isInitialized) {
      return true;
    }
    const originalCwd = process.cwd();
    try {
      if (this.dllPaths.length === 0) {
        this.logger.warn("\u672A\u627E\u5230\u4EFB\u4F55 DLL \u6587\u4EF6\uFF0C\u5C06\u5C1D\u8BD5\u4F7F\u7528\u7CFB\u7EDF\u8DEF\u5F84\u52A0\u8F7D");
      }
      const is64Bit = process.arch === "x64";
      this.logger.info(`[ZKFPLoader] \u5C1D\u8BD5\u52A0\u8F7D ${this.dllPaths.length} \u4E2A DLL...`);
      for (const dllPath of this.dllPaths) {
        try {
          const bitness = this.getDllBitness(dllPath);
          if (is64Bit && bitness === 64 || !is64Bit && bitness === 32) {
            const dllDir = (0, import_path.dirname)(dllPath);
            const dllName = (0, import_path.basename)(dllPath);
            this.logger.info(`[ZKFPLoader] \u5207\u6362\u5230 DLL \u76EE\u5F55: ${dllDir}`);
            (0, import_process.chdir)(dllDir);
            this.logger.info(`[ZKFPLoader] \u5C1D\u8BD5\u52A0\u8F7D: ${dllName} (${bitness}\u4F4D)`);
            const lib = import_koffi.default.load(dllName);
            this.logger.info(`[ZKFPLoader] \u2705 \u6210\u529F\u52A0\u8F7D: ${dllName} (${bitness}\u4F4D)`);
            if (!this.lib) {
              this.lib = lib;
            }
            (0, import_process.chdir)(originalCwd);
          } else {
            this.logger.info(`[ZKFPLoader] \u26A0\uFE0F \u8DF3\u8FC7\u52A0\u8F7D: ${dllPath} (${bitness}\u4F4D\uFF0C\u4E0E\u7CFB\u7EDF\u67B6\u6784\u4E0D\u5339\u914D)`);
          }
        } catch (err) {
          this.logger.warn(`[ZKFPLoader] \u26A0\uFE0F \u52A0\u8F7D\u5931\u8D25 ${dllPath}:`, err);
          (0, import_process.chdir)(originalCwd);
        }
      }
      if (!this.lib) {
        this.logger.info("[ZKFPLoader] \u5C1D\u8BD5\u52A0\u8F7D\u9ED8\u8BA4\u540D\u79F0: zkfinger12.dll");
        try {
          (0, import_process.chdir)((0, import_path.join)(process.cwd(), "src", "dll", is64Bit ? "x64" : "x86"));
          this.lib = import_koffi.default.load("zkfinger12.dll");
          (0, import_process.chdir)(originalCwd);
        } catch (err) {
          (0, import_process.chdir)(originalCwd);
          this.lib = import_koffi.default.load("zkfinger12.dll");
        }
      }
      this.logger.info("[ZKFPLoader] DLL \u52A0\u8F7D\u5B8C\u6210\uFF0C\u5F00\u59CB\u7ED1\u5B9A\u51FD\u6570...");
      this.bindFunctions();
      this.logger.info("[ZKFPLoader] \u8C03\u7528 ZKFPM_Init...");
      try {
        const result = this.lib.ZKFPM_Init();
        if (result === 0 /* OK */) {
          this.isInitialized = true;
          this.logger.info("\u6307\u7EB9\u8BC6\u522B\u5E93\u521D\u59CB\u5316\u6210\u529F");
          return true;
        } else {
          this.logger.warn(`[ZKFPLoader] \u521D\u59CB\u5316\u5931\u8D25\uFF0C\u9519\u8BEF\u7801: ${result}\uFF0C\u4F46\u7EE7\u7EED\u6267\u884C`);
          this.isInitialized = true;
          return true;
        }
      } catch (error) {
        this.logger.warn("[ZKFPLoader] \u521D\u59CB\u5316\u8FC7\u7A0B\u4E2D\u53D1\u751F\u9519\u8BEF:", error, "\uFF0C\u4F46\u7EE7\u7EED\u6267\u884C");
        this.isInitialized = true;
        return true;
      }
    } catch (error) {
      this.logger.error("\u6307\u7EB9\u8BC6\u522B\u5E93\u521D\u59CB\u5316\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 绑定 DLL 函数
   * 注意：函数签名基于 libzkfp.h 头文件
   * 头文件定义 APICALL 为 __stdcall，所以函数声明必须使用 stdcall 调用约定
   */
  bindFunctions() {
    try {
      this.lib.ZKFPM_Init = this.lib.func("int __stdcall ZKFPM_Init()");
      this.lib.ZKFPM_Terminate = this.lib.func("int __stdcall ZKFPM_Terminate()");
      this.lib.ZKFPM_GetDeviceCount = this.lib.func("int __stdcall ZKFPM_GetDeviceCount()");
      this.lib.ZKFPM_OpenDevice = this.lib.func("void* __stdcall ZKFPM_OpenDevice(int)");
      this.lib.ZKFPM_CloseDevice = this.lib.func("int __stdcall ZKFPM_CloseDevice(void*)");
      this.lib.ZKFPM_SetParameters = this.lib.func("int __stdcall ZKFPM_SetParameters(void*, int, uint8*, uint)");
      this.lib.ZKFPM_GetParameters = this.lib.func("int __stdcall ZKFPM_GetParameters(void*, int, uint8*, uint*)");
      this.lib.ZKFPM_AcquireFingerprint = this.lib.func("int __stdcall ZKFPM_AcquireFingerprint(void*, uint8*, uint, uint8*, uint*)");
      this.lib.ZKFPM_AcquireFingerprintImage = this.lib.func("int __stdcall ZKFPM_AcquireFingerprintImage(void*, uint8*, uint)");
      this.lib.ZKFPM_CreateDBCache = this.lib.func("void* __stdcall ZKFPM_CreateDBCache()");
      this.lib.ZKFPM_DBInit = this.lib.func("void* __stdcall ZKFPM_DBInit()");
      this.lib.ZKFPM_CloseDBCache = this.lib.func("int __stdcall ZKFPM_CloseDBCache(void*)");
      this.lib.ZKFPM_DBFree = this.lib.func("int __stdcall ZKFPM_DBFree(void*)");
      this.lib.ZKFPM_DBSetParameter = this.lib.func("int __stdcall ZKFPM_DBSetParameter(void*, int, int)");
      this.lib.ZKFPM_DBGetParameter = this.lib.func("int __stdcall ZKFPM_DBGetParameter(void*, int, int*)");
      this.lib.ZKFPM_GenRegTemplate = this.lib.func("int __stdcall ZKFPM_GenRegTemplate(void*, uint8*, uint8*, uint8*, uint8*, uint*)");
      this.lib.ZKFPM_DBMerge = this.lib.func("int __stdcall ZKFPM_DBMerge(void*, uint8*, uint8*, uint8*, uint8*, uint*)");
      this.lib.ZKFPM_AddRegTemplateToDBCache = this.lib.func("int __stdcall ZKFPM_AddRegTemplateToDBCache(void*, uint, uint8*, uint)");
      this.lib.ZKFPM_DBAdd = this.lib.func("int __stdcall ZKFPM_DBAdd(void*, uint, uint8*, uint)");
      this.lib.ZKFPM_DelRegTemplateFromDBCache = this.lib.func("int __stdcall ZKFPM_DelRegTemplateFromDBCache(void*, uint)");
      this.lib.ZKFPM_DBDel = this.lib.func("int __stdcall ZKFPM_DBDel(void*, uint)");
      this.lib.ZKFPM_ClearDBCache = this.lib.func("int __stdcall ZKFPM_ClearDBCache(void*)");
      this.lib.ZKFPM_DBClear = this.lib.func("int __stdcall ZKFPM_DBClear(void*)");
      this.lib.ZKFPM_GetDBCacheCount = this.lib.func("int __stdcall ZKFPM_GetDBCacheCount(void*, uint*)");
      this.lib.ZKFPM_DBCount = this.lib.func("int __stdcall ZKFPM_DBCount(void*, uint*)");
      this.lib.ZKFPM_Identify = this.lib.func("int __stdcall ZKFPM_Identify(void*, uint8*, uint, uint*, uint*)");
      this.lib.ZKFPM_DBIdentify = this.lib.func("int __stdcall ZKFPM_DBIdentify(void*, uint8*, uint, uint*, uint*)");
      this.lib.ZKFPM_MatchFinger = this.lib.func("int __stdcall ZKFPM_MatchFinger(void*, uint8*, uint, uint8*, uint)");
      this.lib.ZKFPM_DBMatch = this.lib.func("int __stdcall ZKFPM_DBMatch(void*, uint8*, uint, uint8*, uint)");
      this.lib.ZKFPM_VerifyByID = this.lib.func("int __stdcall ZKFPM_VerifyByID(void*, uint, uint8*, uint)");
      this.lib.ZKFPM_ExtractFromImage = this.lib.func("int __stdcall ZKFPM_ExtractFromImage(void*, string, uint, uint8*, uint*)");
      this.lib.ZKFPM_Base64ToBlob = this.lib.func("int __stdcall ZKFPM_Base64ToBlob(string, uint8*, uint)");
      this.lib.ZKFPM_BlobToBase64 = this.lib.func("int __stdcall ZKFPM_BlobToBase64(uint8*, uint, char*, uint)");
      this.lib.ZKFPM_GetLastExtractImage = this.lib.func("uint8* __stdcall ZKFPM_GetLastExtractImage(int*, int*)");
      this.lib.ZKFPM_GetCaptureParams = this.lib.func("int __stdcall ZKFPM_GetCaptureParams(void*, void*)");
      this.lib.ZKFPM_GetCaptureParamsEx = this.lib.func("int __stdcall ZKFPM_GetCaptureParamsEx(void*, int*, int*, int*)");
    } catch (err) {
      this.logger.error("\u7ED1\u5B9A\u51FD\u6570\u5931\u8D25:", err);
      throw err;
    }
  }
  /**
   * 获取设备数
   */
  getDeviceCount() {
    this.ensureInitialized();
    return this.lib.ZKFPM_GetDeviceCount();
  }
  /**
   * 打开设备
   */
  openDevice(deviceIndex = 0) {
    this.ensureInitialized();
    const handle = this.lib.ZKFPM_OpenDevice(deviceIndex);
    if (handle) {
      this.deviceHandle = handle;
      return true;
    }
    return false;
  }
  /**
   * 关闭设备
   */
  closeDevice() {
    if (this.deviceHandle) {
      try {
        const result = this.lib.ZKFPM_CloseDevice(this.deviceHandle);
        return result === 0 /* OK */;
      } finally {
        this.deviceHandle = null;
      }
    }
    return true;
  }
  /**
   * 设置设备参数
   */
  setDeviceParam(paramCode, value) {
    this.ensureDeviceOpened();
    const result = this.lib.ZKFPM_SetParameters(
      this.deviceHandle,
      paramCode,
      value,
      value.length
    );
    return result === 0 /* OK */;
  }
  /**
   * 获取设备参数
   * @param paramCode 参数码
   * @param bufferSize 缓冲区大小，默认1024
   * @returns 参数值，或失败时返回 null
   */
  getDeviceParam(paramCode, bufferSize = 1024) {
    this.ensureDeviceOpened();
    const buffer = Buffer.alloc(bufferSize);
    const sizeBuffer = Buffer.alloc(4);
    const result = this.lib.ZKFPM_GetParameters(
      this.deviceHandle,
      paramCode,
      buffer,
      sizeBuffer
    );
    if (result === 0 /* OK */) {
      const actualSize = sizeBuffer.readUInt32LE(0);
      return new Uint8Array(buffer.slice(0, actualSize));
    }
    return null;
  }
  /**
   * 采集指纹（获取图像+模板）
   * @returns 提取到的指纹模板，或失败时返回 null
   */
  acquireFingerprint() {
    this.ensureDeviceOpened();
    const params = this.getCaptureParams();
    if (!params || params.imgWidth === 0 || params.imgHeight === 0) {
      this.logger.warn("\u65E0\u6CD5\u83B7\u53D6\u91C7\u96C6\u53C2\u6570");
      return null;
    }
    const requiredSize = params.imgWidth * params.imgHeight;
    const imageBuffer = Buffer.alloc(requiredSize);
    const templateBuffer = Buffer.alloc(MAX_TEMPLATE_SIZE);
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32LE(MAX_TEMPLATE_SIZE, 0);
    const result = this.lib.ZKFPM_AcquireFingerprint(
      this.deviceHandle,
      imageBuffer,
      requiredSize,
      templateBuffer,
      sizeBuffer
    );
    this.logger.info(`\u91C7\u96C6\u6307\u7EB9\u7ED3\u679C\uFF1A${result}`);
    if (result === 0 /* OK */) {
      const size = sizeBuffer.readUInt32LE(0);
      return {
        data: new Uint8Array(templateBuffer.slice(0, size)),
        size,
        quality: this.calculateTemplateQuality(size)
      };
    }
    return null;
  }
  /**
   * 采集指纹图像
   * @returns 提取到的指纹图像，或失败时返回 null
   */
  acquireFingerprintImage() {
    this.ensureDeviceOpened();
    const params = this.getCaptureParams();
    if (!params || params.imgWidth === 0 || params.imgHeight === 0) {
      this.logger.warn("\u65E0\u6CD5\u83B7\u53D6\u91C7\u96C6\u53C2\u6570");
      return null;
    }
    const requiredSize = params.imgWidth * params.imgHeight;
    const imageBuffer = Buffer.alloc(requiredSize);
    const result = this.lib.ZKFPM_AcquireFingerprintImage(
      this.deviceHandle,
      imageBuffer,
      requiredSize
    );
    this.logger.info(`\u91C7\u96C6\u6307\u7EB9\u56FE\u50CF\u7ED3\u679C: ${result}`);
    if (result === 0 /* OK */) {
      return {
        width: params.imgWidth,
        height: params.imgHeight,
        data: new Uint8Array(imageBuffer),
        dpi: params.nDPI ?? 500
      };
    }
    return null;
  }
  /**
   * 计算模板质量
   * @param size 模板大小
   * @returns 模板质量，0-100之间
   */
  calculateTemplateQuality(size) {
    if (size < 100) return 0;
    if (size > 500) return 100;
    return Math.min(100, Math.floor((size - 100) / 4));
  }
  /**
   * 创建数据库缓存
   */
  createDBCache() {
    this.ensureInitialized();
    const handle = this.lib.ZKFPM_DBInit();
    if (!handle) {
      this.logger.error(`\u521D\u59CB\u5316\u6570\u636E\u5E93\u7F13\u5B58\u53E5\u67C4\u5931\u8D25`);
      return false;
    }
    this.logger.info(`\u521D\u59CB\u5316\u6570\u636E\u5E93\u7F13\u5B58\u53E5\u67C4`);
    this.dbCacheHandle = handle;
    const createHandle = this.lib.ZKFPM_CreateDBCache();
    if (!createHandle) {
      this.logger.error(`\u521B\u5EFA\u6570\u636E\u5E93\u7F13\u5B58\u53E5\u67C4\u5931\u8D25`);
      return false;
    }
    this.logger.info(`\u521B\u5EFA\u6570\u636E\u5E93\u7F13\u5B58\u53E5\u67C4`);
    this.dbCacheHandle = createHandle;
    return true;
  }
  /**
   * 关闭数据库缓存
   */
  closeDBCache() {
    if (this.dbCacheHandle) {
      try {
        const result = this.lib.ZKFPM_CloseDBCache(this.dbCacheHandle);
        return result === 0 /* OK */;
      } finally {
        this.dbCacheHandle = null;
      }
    }
    return true;
  }
  /**
   * 添加指纹模板到数据库
   */
  addTemplateToDB(fid, template) {
    this.ensureDBCacheCreated();
    const result = this.lib.ZKFPM_AddRegTemplateToDBCache(
      this.dbCacheHandle,
      fid,
      template.data,
      template.size
    );
    return result === 0 /* OK */;
  }
  /**
   * 从数据库删除指纹模板
   */
  deleteTemplateFromDB(fid) {
    this.ensureDBCacheCreated();
    const result = this.lib.ZKFPM_DelRegTemplateFromDBCache(
      this.dbCacheHandle,
      fid
    );
    return result === 0 /* OK */;
  }
  /**
   * 清空数据库
   */
  clearDBCache() {
    this.ensureDBCacheCreated();
    const result = this.lib.ZKFPM_ClearDBCache(this.dbCacheHandle);
    return result === 0 /* OK */;
  }
  /**
   * 获取数据库模板数
   */
  getTemplateCount() {
    this.ensureDBCacheCreated();
    const countBuffer = Buffer.alloc(4);
    const result = this.lib.ZKFPM_GetDBCacheCount(this.dbCacheHandle, countBuffer);
    return result === 0 /* OK */ ? countBuffer.readUInt32LE(0) : 0;
  }
  /**
   * 设置数据库参数
   */
  setDBParameter(paramCode, value) {
    this.ensureDBCacheCreated();
    const result = this.lib.ZKFPM_DBSetParameter(this.dbCacheHandle, paramCode, value);
    return result === 0 /* OK */;
  }
  /**
   * 获取数据库参数
   */
  getDBParameter(paramCode) {
    this.ensureDBCacheCreated();
    const valueBuffer = Buffer.alloc(4);
    const result = this.lib.ZKFPM_DBGetParameter(this.dbCacheHandle, paramCode, valueBuffer);
    return result === 0 /* OK */ ? valueBuffer.readInt32LE(0) : -1;
  }
  /**
   * 识别指纹（1:N）
   * @param template 指纹模板
   * @returns 识别结果
   */
  identifyFingerprint(template) {
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
    this.logger.debug(`identifyFingerprint success fid: ${fidBuffer.readUInt32LE(0)}, score: ${scoreBuffer.readUInt32LE(0)}`);
    return {
      fid: fidBuffer.readUInt32LE(0),
      score: this.calculateTemplateQuality(scoreBuffer.readUInt32LE(0)),
      success: result === 0 /* OK */
    };
  }
  /**
   * 比对两个指纹模板（1:1）
   * @param template1 第一个指纹模板
   * @param template2 第二个指纹模板
   */
  matchTemplates(template1, template2) {
    this.ensureDBCacheCreated();
    return this.lib.ZKFPM_MatchFinger(
      this.dbCacheHandle,
      template1.data,
      template1.size,
      template2.data,
      template2.size
    );
  }
  /**
   * 按ID验证指纹
   * @param fid 指纹ID
   * @param template 指纹模板
   * @returns 验证结果
   */
  verifyByID(fid, template) {
    this.ensureDBCacheCreated();
    const score = this.lib.ZKFPM_VerifyByID(
      this.dbCacheHandle,
      fid,
      template.data,
      template.size
    );
    this.logger.debug(`verifyByID success score: ${score}`);
    return this.calculateTemplateQuality(score);
  }
  /**
   * 合并3个指纹模板为登记模板
   * @param temp1 第一个指纹模板
   * @param temp2 第二个指纹模板
   * @param temp3 第三个指纹模板
   * @returns 合并后的指纹登记模板，或失败时返回 null
   */
  genRegTemplate(temp1, temp2, temp3) {
    this.ensureDBCacheCreated();
    const regTemplate = Buffer.alloc(MAX_TEMPLATE_SIZE);
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32LE(MAX_TEMPLATE_SIZE, 0);
    const result = this.lib.ZKFPM_GenRegTemplate(
      this.dbCacheHandle,
      temp1.data,
      temp2.data,
      temp3.data,
      regTemplate,
      sizeBuffer
    );
    if (result === 0 /* OK */) {
      const size = sizeBuffer.readUInt32LE(0);
      return {
        data: new Uint8Array(regTemplate.slice(0, size)),
        size,
        quality: this.calculateTemplateQuality(size)
      };
    }
    return null;
  }
  /**
   * 从 BMP 图像提取指纹模板
   * @param filePath 图像文件路径
   * @param dpi 图像分辨率，默认500
   * @returns 提取到的指纹模板，或失败时返回 null
   */
  extractFromImage(filePath, dpi = 500) {
    this.ensureDBCacheCreated();
    const templateBuffer = Buffer.alloc(MAX_TEMPLATE_SIZE);
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32LE(MAX_TEMPLATE_SIZE, 0);
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
        size,
        quality: this.calculateTemplateQuality(size)
      };
    }
    return null;
  }
  /**
   * 获取最后提取的图像
   */
  getLastExtractImage() {
    const widthBuffer = Buffer.alloc(4);
    const heightBuffer = Buffer.alloc(4);
    const imageData = this.lib.ZKFPM_GetLastExtractImage(widthBuffer, heightBuffer);
    if (imageData) {
      const width = widthBuffer.readInt32LE(0);
      const height = heightBuffer.readInt32LE(0);
      const data = Buffer.from(imageData);
      return {
        width,
        height,
        data: new Uint8Array(data),
        dpi: 500
      };
    }
    return null;
  }
  /**
   * 获取采集参数
   */
  getCaptureParams() {
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
    if (result === 0 /* OK */) {
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
  base64ToBlob(base64Str, bufferSize = 1024 * 1024) {
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
  blobToBase64(data, bufferSize = 1024 * 1024) {
    const buffer = Buffer.alloc(bufferSize);
    const result = this.lib.ZKFPM_BlobToBase64(data, data.length, buffer, bufferSize);
    if (result > 0) {
      return buffer.toString("ascii", 0, result);
    }
    return null;
  }
  /**
   * 清理资源
   */
  terminate() {
    try {
      this.logger.info("\u5F00\u59CB\u6E05\u7406\u8D44\u6E90...");
      if (this.dbCacheHandle) {
        this.logger.info("\u5173\u95ED\u6570\u636E\u5E93...");
        try {
          const ret = this.closeDBCache();
          this.logger.info(`\u6570\u636E\u5E93\u5173\u95ED\u7ED3\u679C: ${ret}`);
        } catch (error) {
          this.logger.error("\u5173\u95ED\u6570\u636E\u5E93\u5931\u8D25:", error);
        }
      }
      if (this.deviceHandle) {
        this.logger.info("\u5173\u95ED\u8BBE\u5907...");
        try {
          const ret = this.closeDevice();
          this.logger.info(`\u8BBE\u5907\u5173\u95ED\u7ED3\u679C: ${ret}`);
        } catch (error) {
          this.logger.error("\u5173\u95ED\u8BBE\u5907\u5931\u8D25:", error);
        }
      }
      if (this.isInitialized && this.lib) {
        this.logger.info("\u6E05\u7406\u6307\u7EB9\u8BC6\u522B\u5E93...");
        try {
          if (typeof this.lib.ZKFPM_Terminate === "function") {
            const ret = this.lib.ZKFPM_Terminate();
            this.logger.info(`ZKFPM_Terminate() \u8FD4\u56DE: ${ret}`);
            if (ret === 0 /* OK */) {
              this.logger.info("\u6307\u7EB9\u8BC6\u522B\u5E93\u5DF2\u6E05\u7406");
            } else {
              this.logger.warn(`\u6307\u7EB9\u8BC6\u522B\u5E93\u6E05\u7406\u5931\u8D25\uFF0C\u9519\u8BEF\u7801: ${ret}`);
            }
          } else {
            this.logger.warn("ZKFPM_Terminate \u51FD\u6570\u672A\u7ED1\u5B9A");
          }
        } catch (error) {
          this.logger.error("\u8C03\u7528 ZKFPM_Terminate \u5931\u8D25:", error);
        } finally {
          this.isInitialized = false;
        }
      }
      this.logger.info("\u6240\u6709\u8D44\u6E90\u6E05\u7406\u5B8C\u6210");
    } catch (error) {
      this.logger.error("\u6E05\u7406\u8D44\u6E90\u65F6\u53D1\u751F\u9519\u8BEF:", error);
    }
  }
  /**
   * 确保库已初始化
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error("\u6307\u7EB9\u8BC6\u522B\u5E93\u672A\u521D\u59CB\u5316\uFF0C\u8BF7\u5148\u8C03\u7528 initialize() \u65B9\u6CD5");
    }
  }
  /**
   * 确保设备已打开
   */
  ensureDeviceOpened() {
    this.ensureInitialized();
    if (!this.deviceHandle) {
      throw new Error("\u8BBE\u5907\u672A\u6253\u5F00\uFF0C\u8BF7\u5148\u8C03\u7528 openDevice() \u65B9\u6CD5");
    }
  }
  /**
   * 确保数据库已创建
   */
  ensureDBCacheCreated() {
    this.ensureInitialized();
    if (!this.dbCacheHandle) {
      throw new Error("\u6570\u636E\u5E93\u672A\u521B\u5EFA\uFF0C\u8BF7\u5148\u8C03\u7528 createDBCache() \u65B9\u6CD5");
    }
  }
};
function createZKFPLoader(logger) {
  return new ZKFPLoader(logger);
}

// src/index.ts
var Live20SDK = class {
  constructor(logger) {
    this.isInitialized = false;
    this.logger = logger || console;
    this.loader = createZKFPLoader(this.logger);
  }
  /**
   * 初始化指纹识别库
   */
  async initialize() {
    try {
      this.isInitialized = this.loader.initialize();
      return this.isInitialized;
    } catch (error) {
      this.logger.error("\u6307\u7EB9\u8BC6\u522B\u5E93\u521D\u59CB\u5316\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 获取设备数
   */
  getDeviceCount() {
    this.ensureInitialized();
    return this.loader.getDeviceCount();
  }
  /**
   * 打开设备
   * @param deviceIndex 设备索引，默认0
   */
  openDevice(deviceIndex = 0) {
    this.ensureInitialized();
    const result = this.loader.openDevice(deviceIndex);
    if (result) {
      this.createDatabase();
    }
    return result;
  }
  /**
   * 关闭设备
   */
  closeDevice() {
    this.closeDatabase();
    return this.loader.closeDevice();
  }
  /**
   * 设置设备参数
   * @param paramCode 参数码
   * @param value 参数值
   */
  setDeviceParam(paramCode, value) {
    return this.loader.setDeviceParam(paramCode, value);
  }
  /**
   * 获取设备参数
   * @param paramCode 参数码
   * @param bufferSize 缓冲区大小，默认1024
   */
  getDeviceParam(paramCode, bufferSize) {
    return this.loader.getDeviceParam(paramCode, bufferSize);
  }
  /**
   * 采集指纹模板
   * @returns 提取到的指纹模板，或失败时返回 null
   */
  acquireFingerprint() {
    this.ensureInitialized();
    return this.loader.acquireFingerprint();
  }
  /**
   * 采集指纹图像
   */
  acquireFingerprintImage() {
    this.ensureInitialized();
    return this.loader.acquireFingerprintImage();
  }
  /**
   * 创建数据库
   */
  createDatabase() {
    this.ensureInitialized();
    return this.loader.createDBCache();
  }
  /**
   * 关闭数据库
   */
  closeDatabase() {
    return this.loader.closeDBCache();
  }
  /**
   * 添加指纹模板到数据库
   * @param fid 指纹id
   * @param template 指纹模板
   */
  addFingerprint(fid, template) {
    this.ensureInitialized();
    return this.loader.addTemplateToDB(fid, template);
  }
  /**
   * 从数据库删除指纹模板
   * @param fid 指纹id
   */
  deleteFingerprint(fid) {
    this.ensureInitialized();
    return this.loader.deleteTemplateFromDB(fid);
  }
  /**
   * 清空数据库
   */
  clearDatabase() {
    this.ensureInitialized();
    return this.loader.clearDBCache();
  }
  /**
   * 获取数据库中的指纹数
   */
  getFingerprintCount() {
    this.ensureInitialized();
    return this.loader.getTemplateCount();
  }
  /**
   * 设置识别参数
   * @param level 安全等级，默认0-3
   */
  setSecurityLevel(level) {
    this.ensureInitialized();
    return this.loader.setDBParameter(2 /* FP_MTHRESHOLD_CODE */, level);
  }
  /**
   * 设置匹配阈值
   * @param threshold 匹配阈值，默认50-100
   */
  setMatchThreshold(threshold) {
    this.ensureInitialized();
    return this.loader.setDBParameter(1 /* FP_THRESHOLD_CODE */, threshold);
  }
  /**
   * 获取数据库参数
   * @param paramCode 参数码
   */
  getDBParam(paramCode) {
    this.ensureInitialized();
    return this.loader.getDBParameter(paramCode);
  }
  /**
   * 识别指纹模板
   * @param template 指纹模板
   */
  identifyFingerprint(template) {
    this.ensureInitialized();
    return this.loader.identifyFingerprint(template);
  }
  /**
   * 验证两个指纹是否匹配
   * @param template1 指纹模板1
   * @param template2 指纹模板2
   * @param threshold 基础分数，默认50-1000
   */
  verifyFingerprints(template1, template2, threshold = 50) {
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
  verifyByID(fid, template, threshold = 50) {
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
  mergeTemplates(temp1, temp2, temp3) {
    this.ensureInitialized();
    return this.loader.genRegTemplate(temp1, temp2, temp3);
  }
  /**
   * 从图像提取指纹模板
   * @param filePath 图像文件路径
   * @param dpi 图像分辨率，默认500
   * @returns �取到的指纹模板，或失败时返回 null
   */
  extractFromImage(filePath, dpi) {
    this.ensureInitialized();
    return this.loader.extractFromImage(filePath, dpi);
  }
  /**
   * 获取最后提取的图像
   */
  getLastExtractImage() {
    return this.loader.getLastExtractImage();
  }
  /**
   * 获取采集参数
   */
  getCaptureParams() {
    return this.loader.getCaptureParams();
  }
  /**
   * Base64转Blob
   */
  base64ToBlob(base64Str, bufferSize) {
    return this.loader.base64ToBlob(base64Str, bufferSize);
  }
  /**
   * Blob转Base64
   */
  blobToBase64(data, bufferSize) {
    return this.loader.blobToBase64(data, bufferSize);
  }
  /**
   * 清理资源
   */
  terminate() {
    this.ensureInitialized();
    if (this.isInitialized) {
      this.loader.terminate();
      this.isInitialized = false;
    }
  }
  /**
   * 确保库已初始化
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error("\u6307\u7EB9\u8BC6\u522B\u5E93\u672A\u521D\u59CB\u5316\uFF0C\u8BF7\u5148\u8C03\u7528 initialize() \u65B9\u6CD5");
    }
  }
};
function createLive20SDK(logger) {
  return new Live20SDK(logger);
}
var index_default = createLive20SDK;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FP_MTHRESHOLD_CODE,
  FP_THRESHOLD_CODE,
  Live20SDK,
  MAX_TEMPLATE_SIZE,
  createLive20SDK
});
