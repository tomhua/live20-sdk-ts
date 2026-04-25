import {createLive20SDK} from '../src'

const CAPTURE_INTERVAL = 200

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

    const dbResult = live20SDK.createDatabase()
    if (!dbResult) {
        console.error('创建数据库失败')
        live20SDK.closeDevice()
        live20SDK.terminate()
        return
    }
    console.info('创建数据库成功')

    console.info('开始循环采集指纹（按 Ctrl+C 停止）...')

    let captureCount = 0
    const maxCaptures = 10

    const captureLoop = setInterval(async () => {
        captureCount++
        console.info(`--- 第 ${captureCount} 次采集 ---`)

        const imageData = live20SDK.acquireFingerprintImage()
        if (imageData && imageData.data.length > 0) {
            console.info(`采集到指纹图像: ${imageData.data.length} 字节, ${imageData.width}x${imageData.height}, ${imageData.dpi}`)
            // 处理采集到的指纹图像
            // 保存图像
            const template = live20SDK.blobToBase64(imageData.data)
            console.info(`指纹图像处理完成: ${template}`)
        } else {
            console.warn('未采集到指纹图像')
        }

        if (captureCount >= maxCaptures) {
            clearInterval(captureLoop)
            console.info('采集完成，停止采集')
            cleanup(live20SDK)
        }
    }, CAPTURE_INTERVAL)
}

function cleanup(live20SDK: ReturnType<typeof createLive20SDK>): void {
    console.info('开始清理资源...')
    live20SDK.closeDatabase()
    live20SDK.closeDevice()
    live20SDK.terminate()
    console.info('资源清理完成')
}

process.on('SIGINT', () => {
    console.info('收到中断信号，退出程序')
    process.exit(0)
})

initLive20SDK()