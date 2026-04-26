import {createLive20SDK, ZKFPFingerprintTemplate} from '../src'

const CAPTURE_INTERVAL = 1000

async function initLive20SDK(): Promise<void> {
    const live20SDK = createLive20SDK(console)

    console.info('开始初始化指纹识别 SDK...')

    const init = live20SDK.initialize()
    if (!init) {
        console.error('指纹识别库初始化失败')
        return
    }
    console.info('指纹识别库初始化成功')

    const deviceCount = live20SDK.getDeviceCount()
    if (deviceCount === 0) {
        console.error('指纹识别库未检测到设备')
        live20SDK.terminate()
        return
    }
    console.info(`指纹识别库检测到 ${deviceCount} 个设备`)

    const openResult = live20SDK.openDevice(0)
    if (!openResult) {
        console.error('设备打开失败')
        live20SDK.terminate()
        return
    }
    console.info('设备打开成功')
    console.info('开始循环采集指纹（按 Ctrl+C 停止）...')

    let captureCount = 0
    const maxCaptures = 5
    // 特征数据
    const fingerprintData = new Map<number, ZKFPFingerprintTemplate>()

    const captureLoop = setInterval(async () => {
        captureCount++
        console.info(`--- 第 ${captureCount} 次采集 ---`)

        const template = live20SDK.acquireFingerprint()
        // 指纹模板
        if (template && template.data.length > 0) {
            // 指纹特征数据
            const templateData64 = live20SDK.blobToBase64(template.data)
            console.info(`手指ID: ${captureCount} 指纹特征数据: ${templateData64}, 质量: ${template.quality}`)
            // 保存指纹特征数据
            const addResult = live20SDK.addFingerprint(captureCount, template)
            if (addResult) {
                console.info(`指纹特征数据保存成功，指纹ID: ${addResult}`)
                // 保存指纹特征数据
                fingerprintData.set(captureCount, template)
            } else {
                console.error('指纹特征数据保存失败')
            }
        } else {
            console.warn('未采集到指纹特征数据')
        }

        if (captureCount >= maxCaptures) {
            clearInterval(captureLoop)
            console.info('采集完成，停止采集')
            const fingerprintCount = live20SDK.getFingerprintCount()
            console.info(`当前数据库中指纹数量: ${fingerprintCount}`)
            // 识别指纹
            const fids: number[] = []
            fingerprintData.forEach((template, fid) => {
                const identifyResult = live20SDK.verifyByID(fid, template)
                console.info(`指纹ID: ${fid} 识别结果: ${identifyResult}`)
                fids.push(fid)
            })
            if (fids.length < 2) {
                console.warn('未采集到两个指纹特征数据')
            } else {
                // 获取两个指纹特征数据
                const template1 = fingerprintData.get(fids[0] || 0)
                const template2 = fingerprintData.get(fids[1] || 0)
                if (template1 && template2) {
                    const verifyResult = live20SDK.verifyFingerprints(template1, template2)
                    console.info(`指纹1: ${fids[0]} 指纹2: ${fids[1]} 比对结果: ${verifyResult}`)
                } else {
                    console.warn('未采集到两个指纹特征数据')
                }
            }

            cleanup(live20SDK)
        }
    }, CAPTURE_INTERVAL)

}

function cleanup(live20SDK: ReturnType<typeof createLive20SDK>): void {
    console.info('开始清理资源...')
    live20SDK.closeDevice()
    live20SDK.terminate()
    console.info('资源清理完成')
}

process.on('SIGINT', () => {
    console.info('收到中断信号，退出程序')
    process.exit(0)
})

initLive20SDK()
