// src/lib/zkfp-loader.ts
import koffi from "koffi";
import { join, dirname, basename } from "path";
import { accessSync, constants, readdirSync, openSync, readSync, closeSync } from "fs";
import { chdir } from "process";

// src/types/zkfp-types.ts
var MAX_TEMPLATE_SIZE = 2048;
var FP_THRESHOLD_CODE = 1;
var FP_MTHRESHOLD_CODE = 2;

// src/lib/zkfp-loader.ts
function getDllBitness(dllPath) {
  try {
    const buffer = Buffer.alloc(1024);
    const fd = openSync(dllPath, "r");
    const bytesRead = readSync(fd, buffer, 0, 1024, 0);
    closeSync(fd);
    if (bytesRead < 64) {
      console.warn(`[ZKFPLoader] DLL \u6587\u4EF6\u592A\u5C0F\uFF0C\u65E0\u6CD5\u68C0\u67E5\u4F4D\u6570: ${dllPath}`);
      return 0;
    }
    const peHeaderOffset = buffer.readUInt32LE(60);
    if (peHeaderOffset === 0 || peHeaderOffset + 4 >= buffer.length) {
      console.warn(`[ZKFPLoader] \u65E0\u6548\u7684 PE \u5934\u504F\u79FB: ${peHeaderOffset}`);
      return 0;
    }
    const machineType = buffer.readUInt16LE(peHeaderOffset + 4);
    if (machineType === 34404) return 64;
    if (machineType === 332) return 32;
    return 0;
  } catch (error) {
    console.warn(`[ZKFPLoader] \u68C0\u67E5 DLL \u4F4D\u6570\u5931\u8D25 ${dllPath}:`, error);
    return 0;
  }
}
var ZKFPLoader = class {
  constructor(dllName) {
    this.lib = null;
    this.isInitialized = false;
    this.deviceHandle = 0;
    this.dbCacheHandle = 0;
    this.dllPaths = [];
    this.dllPaths = this.resolveDllPaths(dllName);
  }
  /**
   * 解析 DLL 路径
   */
  resolveDllPaths(mainDllName) {
    const is64Bit = process.arch === "x64";
    console.log(`[ZKFPLoader] Node.js \u67B6\u6784: ${process.arch}`);
    const paths = [];
    if (mainDllName) {
      if (mainDllName === "libzkfp.dll") {
        const demoLibPath = join(process.cwd(), "demotest", "libzkfp.dll");
        if (this.fileExists(demoLibPath)) {
          const bitness = getDllBitness(demoLibPath);
          if (is64Bit && bitness === 64 || !is64Bit && bitness === 32) {
            console.log(`[ZKFPLoader] \u2705 \u4F7F\u7528 demotest \u76EE\u5F55\u4E0B\u7684 libzkfp.dll: ${demoLibPath} (${bitness}\u4F4D)`);
            paths.push(demoLibPath);
            return paths;
          }
        }
      }
      const dllDirs2 = [
        join(process.cwd(), "src", "dll", "x64"),
        join(process.cwd(), "src", "dll", "x86")
      ];
      for (const dllDir of dllDirs2) {
        const dllPath = join(dllDir, mainDllName);
        if (this.fileExists(dllPath)) {
          const bitness = getDllBitness(dllPath);
          if (bitness === 0 || is64Bit && bitness === 64 || !is64Bit && bitness === 32) {
            console.log(`[ZKFPLoader] \u2705 \u627E\u5230\u6587\u4EF6: ${dllPath} (${bitness}\u4F4D)`);
            paths.push(dllPath);
            break;
          }
        }
      }
      if (paths.length === 0) {
        console.log(`[ZKFPLoader] \u274C \u672A\u627E\u5230\u5339\u914D\u67B6\u6784\u7684 ${mainDllName}`);
      }
      return paths;
    }
    const dllDirs = [
      join(process.cwd(), "src", "dll", "x64"),
      join(process.cwd(), "src", "dll", "x86")
    ];
    let allDllFiles = [];
    for (const dllDir of dllDirs) {
      allDllFiles = [...allDllFiles, ...this.getAllDllFiles(dllDir)];
    }
    const dllInfo = allDllFiles.map((dll) => ({
      path: dll,
      bitness: getDllBitness(dll)
    }));
    const matchingDlls = dllInfo.filter((info) => is64Bit && info.bitness === 64 || !is64Bit && info.bitness === 32).map((info) => info.path);
    const otherDlls = dllInfo.filter((info) => !matchingDlls.includes(info.path)).map((info) => info.path);
    paths.push(...matchingDlls, ...otherDlls);
    console.log(`[ZKFPLoader] \u627E\u5230 ${paths.length} \u4E2A DLL \u6587\u4EF6...`);
    for (const dll of paths) {
      const bitness = getDllBitness(dll);
      console.log(`[ZKFPLoader] \u2705 \u6DFB\u52A0: ${dll} (${bitness}\u4F4D)`);
    }
    return paths;
  }
  /**
   * 检查文件是否存在
   */
  fileExists(path) {
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
  getAllDllFiles(dir) {
    const dllFiles = [];
    try {
      const files = readdirSync(dir);
      for (const file of files) {
        if (file.toLowerCase().endsWith(".dll")) {
          dllFiles.push(join(dir, file));
        }
      }
    } catch (err) {
      console.warn(`[ZKFPLoader] \u26A0\uFE0F \u65E0\u6CD5\u8BFB\u53D6\u76EE\u5F55 ${dir}:`, err);
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
        console.warn("\u672A\u627E\u5230\u4EFB\u4F55 DLL \u6587\u4EF6\uFF0C\u5C06\u5C1D\u8BD5\u4F7F\u7528\u7CFB\u7EDF\u8DEF\u5F84\u52A0\u8F7D");
      }
      const is64Bit = process.arch === "x64";
      console.log(`[ZKFPLoader] \u5C1D\u8BD5\u52A0\u8F7D ${this.dllPaths.length} \u4E2A DLL...`);
      for (const dllPath of this.dllPaths) {
        try {
          const bitness = getDllBitness(dllPath);
          if (is64Bit && bitness === 64 || !is64Bit && bitness === 32) {
            const dllDir = dirname(dllPath);
            const dllName = basename(dllPath);
            console.log(`[ZKFPLoader] \u5207\u6362\u5230 DLL \u76EE\u5F55: ${dllDir}`);
            chdir(dllDir);
            console.log(`[ZKFPLoader] \u5C1D\u8BD5\u52A0\u8F7D: ${dllName} (${bitness}\u4F4D)`);
            const lib = koffi.load(dllName);
            console.log(`[ZKFPLoader] \u2705 \u6210\u529F\u52A0\u8F7D: ${dllName} (${bitness}\u4F4D)`);
            if (!this.lib) {
              this.lib = lib;
            }
            chdir(originalCwd);
          } else {
            console.log(`[ZKFPLoader] \u26A0\uFE0F \u8DF3\u8FC7\u52A0\u8F7D: ${dllPath} (${bitness}\u4F4D\uFF0C\u4E0E\u7CFB\u7EDF\u67B6\u6784\u4E0D\u5339\u914D)`);
          }
        } catch (err) {
          console.warn(`[ZKFPLoader] \u26A0\uFE0F \u52A0\u8F7D\u5931\u8D25 ${dllPath}:`, err);
          chdir(originalCwd);
        }
      }
      if (!this.lib) {
        console.log("[ZKFPLoader] \u5C1D\u8BD5\u52A0\u8F7D\u9ED8\u8BA4\u540D\u79F0: zkfinger12.dll");
        try {
          chdir(join(process.cwd(), "src", "dll", is64Bit ? "x64" : "x86"));
          this.lib = koffi.load("zkfinger12.dll");
          chdir(originalCwd);
        } catch (err) {
          chdir(originalCwd);
          this.lib = koffi.load("zkfinger12.dll");
        }
      }
      console.log("[ZKFPLoader] DLL \u52A0\u8F7D\u5B8C\u6210\uFF0C\u5F00\u59CB\u7ED1\u5B9A\u51FD\u6570...");
      this.bindFunctions();
      console.log("[ZKFPLoader] \u8C03\u7528 ZKFPM_Init...");
      try {
        const result = this.lib.ZKFPM_Init();
        if (result === 0 /* OK */) {
          this.isInitialized = true;
          console.log("\u6307\u7EB9\u8BC6\u522B\u5E93\u521D\u59CB\u5316\u6210\u529F");
          return true;
        } else {
          console.warn(`[ZKFPLoader] \u521D\u59CB\u5316\u5931\u8D25\uFF0C\u9519\u8BEF\u7801: ${result}\uFF0C\u4F46\u7EE7\u7EED\u6267\u884C`);
          this.isInitialized = true;
          return true;
        }
      } catch (error) {
        console.warn("[ZKFPLoader] \u521D\u59CB\u5316\u8FC7\u7A0B\u4E2D\u53D1\u751F\u9519\u8BEF:", error, "\uFF0C\u4F46\u7EE7\u7EED\u6267\u884C");
        this.isInitialized = true;
        return true;
      }
    } catch (error) {
      console.error("\u6307\u7EB9\u8BC6\u522B\u5E93\u521D\u59CB\u5316\u5931\u8D25:", error);
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
      console.error("\u7ED1\u5B9A\u51FD\u6570\u5931\u8D25:", err);
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
    if (handle && handle !== null) {
      this.deviceHandle = Number(koffi.address(handle));
      return true;
    }
    return false;
  }
  /**
   * 关闭设备
   */
  closeDevice() {
    if (this.deviceHandle > 0) {
      const result = this.lib.ZKFPM_CloseDevice(this.deviceHandle);
      this.deviceHandle = 0;
      return result === 0 /* OK */;
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
   */
  acquireFingerprint() {
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
    if (result === 0 /* OK */) {
      const size = sizeBuffer.readUInt32LE(0);
      return {
        data: new Uint8Array(templateBuffer.slice(0, size)),
        size,
        quality: this.calculateTemplateQuality(templateBuffer, size)
      };
    }
    return null;
  }
  /**
   * 采集指纹图像
   */
  acquireFingerprintImage(bufferSize = 1024 * 1024) {
    this.ensureDeviceOpened();
    const imageBuffer = Buffer.alloc(bufferSize);
    const result = this.lib.ZKFPM_AcquireFingerprintImage(
      this.deviceHandle,
      imageBuffer,
      bufferSize
    );
    if (result === 0 /* OK */) {
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
  calculateTemplateQuality(_buffer, size) {
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
    if (handle && handle !== null) {
      this.dbCacheHandle = Number(koffi.address(handle));
      return true;
    }
    const createHandle = this.lib.ZKFPM_CreateDBCache();
    if (createHandle && createHandle !== null) {
      this.dbCacheHandle = Number(koffi.address(createHandle));
      return true;
    }
    return false;
  }
  /**
   * 关闭数据库缓存
   */
  closeDBCache() {
    if (this.dbCacheHandle > 0) {
      const result = this.lib.ZKFPM_CloseDBCache(this.dbCacheHandle);
      this.dbCacheHandle = 0;
      return result === 0 /* OK */;
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
    return {
      fid: fidBuffer.readUInt32LE(0),
      score: scoreBuffer.readUInt32LE(0),
      success: result === 0 /* OK */
    };
  }
  /**
   * 比对两个指纹模板（1:1）
   */
  matchTemplates(template1, template2) {
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
  verifyByID(fid, template) {
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
  genRegTemplate(temp1, temp2, temp3) {
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
    if (result === 0 /* OK */) {
      const size = sizeBuffer.readUInt32LE(0);
      return {
        data: new Uint8Array(regTemplate.slice(0, size)),
        size,
        quality: this.calculateTemplateQuality(regTemplate, size)
      };
    }
    return null;
  }
  /**
   * 从 BMP 图像提取指纹模板
   */
  extractFromImage(filePath, dpi = 500) {
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
        size,
        quality: this.calculateTemplateQuality(templateBuffer, size)
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
    if (imageData && imageData !== null) {
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
    if (this.dbCacheHandle > 0) {
      const ret = Boolean(this.closeDBCache());
      if (ret) {
        console.log("\u6570\u636E\u5E93\u5DF2\u5173\u95ED", ret);
      }
    }
    if (this.deviceHandle > 0) {
      const ret = Boolean(this.closeDevice());
      if (ret) {
        console.log("\u8BBE\u5907\u5DF2\u5173\u95ED", ret);
      }
    }
    console.log("\u6240\u6709\u8D44\u6E90\u5DF2\u6E05\u7406", this.isInitialized);
    if (this.isInitialized) {
      console.log("\u6307\u7EB9\u8BC6\u522B\u5E93\u5DF2\u521D\u59CB\u5316");
      const ret = Boolean(this.lib.ZKFPM_Terminate());
      if (ret) {
        console.log("\u6307\u7EB9\u8BC6\u522B\u5E93\u5DF2\u6E05\u7406", ret);
      }
      this.isInitialized = false;
      this.lib.ZKFPM_Terminate();
      this.isInitialized = false;
      console.log("\u6307\u7EB9\u8BC6\u522B\u5E93\u5DF2\u6E05\u7406");
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
    if (this.deviceHandle === 0) {
      throw new Error("\u8BBE\u5907\u672A\u6253\u5F00\uFF0C\u8BF7\u5148\u8C03\u7528 openDevice() \u65B9\u6CD5");
    }
  }
  /**
   * 确保数据库已创建
   */
  ensureDBCacheCreated() {
    this.ensureInitialized();
    if (this.dbCacheHandle === 0) {
      throw new Error("\u6570\u636E\u5E93\u672A\u521B\u5EFA\uFF0C\u8BF7\u5148\u8C03\u7528 createDBCache() \u65B9\u6CD5");
    }
  }
};
function createZKFPLoader(dllName) {
  return new ZKFPLoader(dllName);
}

// src/index.ts
var Live20SDK = class {
  constructor(dllName) {
    this.isInitialized = false;
    this.loader = createZKFPLoader(dllName);
  }
  /**
   * 初始化指纹识别库
   */
  async initialize() {
    try {
      this.isInitialized = this.loader.initialize();
      return this.isInitialized;
    } catch (error) {
      console.error("\u6307\u7EB9\u8BC6\u522B\u5E93\u521D\u59CB\u5316\u5931\u8D25:", error);
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
   */
  setDeviceParam(paramCode, value) {
    return this.loader.setDeviceParam(paramCode, value);
  }
  /**
   * 获取设备参数
   */
  getDeviceParam(paramCode, bufferSize) {
    return this.loader.getDeviceParam(paramCode, bufferSize);
  }
  /**
   * 采集指纹
   */
  acquireFingerprint() {
    this.ensureInitialized();
    return this.loader.acquireFingerprint();
  }
  /**
   * 采集指纹图像
   */
  acquireFingerprintImage(bufferSize) {
    this.ensureInitialized();
    return this.loader.acquireFingerprintImage(bufferSize);
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
   */
  addFingerprint(fid, template) {
    this.ensureInitialized();
    return this.loader.addTemplateToDB(fid, template);
  }
  /**
   * 从数据库删除指纹模板
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
   */
  setSecurityLevel(level) {
    this.ensureInitialized();
    return this.loader.setDBParameter(2 /* FP_MTHRESHOLD_CODE */, level);
  }
  /**
   * 设置匹配阈值
   */
  setMatchThreshold(threshold) {
    this.ensureInitialized();
    return this.loader.setDBParameter(1 /* FP_THRESHOLD_CODE */, threshold);
  }
  /**
   * 获取数据库参数
   */
  getDBParam(paramCode) {
    this.ensureInitialized();
    return this.loader.getDBParameter(paramCode);
  }
  /**
   * 识别指纹
   */
  identifyFingerprint(template) {
    this.ensureInitialized();
    return this.loader.identifyFingerprint(template);
  }
  /**
   * 验证两个指纹是否匹配
   */
  verifyFingerprints(template1, template2, threshold = 50) {
    this.ensureInitialized();
    const score = this.loader.matchTemplates(template1, template2);
    return score >= threshold;
  }
  /**
   * 按ID验证指纹
   */
  verifyByID(fid, template, threshold = 50) {
    this.ensureInitialized();
    const score = this.loader.verifyByID(fid, template);
    return score >= threshold;
  }
  /**
   * 合并指纹模板
   */
  mergeTemplates(temp1, temp2, temp3) {
    this.ensureInitialized();
    return this.loader.genRegTemplate(temp1, temp2, temp3);
  }
  /**
   * 从图像提取指纹
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
function createLive20SDK(dllName) {
  return new Live20SDK(dllName);
}
var index_default = createLive20SDK;
export {
  FP_MTHRESHOLD_CODE,
  FP_THRESHOLD_CODE,
  Live20SDK,
  MAX_TEMPLATE_SIZE,
  createLive20SDK,
  index_default as default
};
