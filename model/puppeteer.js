import lodash from 'lodash'
import Puppeteer from '../../../renderers/puppeteer/lib/puppeteer.js'
import { Data } from "../../../plugins/miao-plugin/components/index.js"

/** 修改一些插件的渲染精度 */
let _plugins = {
    "xiaoyao-cvs-plugin": { tplFile: "sr", quality: 50 }
}

/** 劫持原方法 */
Puppeteer.prototype.screenshot = async function (name, data = {}) {
    if (!await this.browserInit()) {
        return false
    }
    const pageHeight = data.multiPageHeight || 4000

    let savePath = this.dealTpl(name, data)
    if (!savePath) return false

    let buff = ''
    let start = Date.now()

    let ret = []
    this.shoting.push(name)

    try {
        const page = await this.browser.newPage()
        let pageGotoParams = lodash.extend({ timeout: 120000 }, data.pageGotoParams || {})
        await page.goto(`file://${process.cwd()}${lodash.trim(savePath, '.')}`, pageGotoParams)
        let body = await page.$('#container') || await page.$('body')

        // 计算页面高度
        const boundingBox = await body.boundingBox()
        // 分页数
        let num = 1

        let randData = {
            type: data.imgType || 'jpeg',
            omitBackground: data.omitBackground || false,
            quality: data.quality || 90,
            path: data.path || ''
        }

        if (data.multiPage) {
            randData.type = 'jpeg'
            num = Math.round(boundingBox.height / pageHeight) || 1
        }

        if (data.imgType === 'png') {
            delete randData.quality
        }


        /** 
         * **************************************
         * ***** 检测是否是符合修改的渲染图片 *****
         * **************************************
         */
        if (_plugins.hasOwnProperty(data._plugin)) {
            const config = _plugins[data._plugin]
            if (new RegExp(config.tplFile, "gi")) {
                randData.type = 'jpeg'
                randData.quality = config.quality
            }
        }

        if (!data.multiPage) {
            buff = await body.screenshot(randData)
            /** 计算图片大小 */
            const kb = (buff.length / 1024).toFixed(2) + 'kb'
            logger.mark(`[图片生成][${name}][${this.renderNum}次] ${kb} ${logger.green(`${Date.now() - start}ms`)}`)
            this.renderNum++
            ret.push(buff)
        } else {
            // 分片截图
            if (num > 1) {
                await page.setViewport({
                    width: boundingBox.width,
                    height: pageHeight + 100
                })
            }
            for (let i = 1; i <= num; i++) {
                if (i !== 1 && i === num) {
                    await page.setViewport({
                        width: boundingBox.width,
                        height: parseInt(boundingBox.height) - pageHeight * (num - 1)
                    })
                }
                if (i !== 1 && i <= num) {
                    await page.evaluate(pageHeight => window.scrollBy(0, pageHeight), pageHeight)
                }
                if (num === 1) {
                    buff = await body.screenshot(randData)
                } else {
                    buff = await page.screenshot(randData)
                }
                if (num > 2) await Data.sleep(200)
                this.renderNum++

                /** 计算图片大小 */
                const kb = (buff.length / 1024).toFixed(2) + 'kb'
                logger.mark(`[图片生成][${name}][${i}/${num}] ${kb}`)
                ret.push(buff)
            }
            if (num > 1) {
                logger.mark(`[图片生成][${name}] 处理完成`)
            }
        }
        page.close().catch((err) => logger.error(err))

    } catch (error) {
        logger.error(`图片生成失败:${name}:${error}`)
        /** 关闭浏览器 */
        if (this.browser) {
            await this.browser.close().catch((err) => logger.error(err))
        }
        this.browser = false
        ret = []
        return false
    }

    this.shoting.pop()

    if (ret.length === 0 || !ret[0]) {
        logger.error(`图片生成为空:${name}`)
        return false
    }

    this.restart()

    return data.multiPage ? ret : ret[0]
}