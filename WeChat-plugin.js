import "./model/config.js"
import "./model/loader.js"
import "./model/puppeteer.js"
import "./model/ws.js"
import crypto from "crypto"
import { execSync } from "child_process"
import { update } from "../other/update.js"

/** 设置主人 */
let user = ""
let sign = {}

export class WeChat_ extends plugin {
    constructor() {
        super({
            name: "WeChat插件",
            priority: 1,
            rule: [
                {
                    reg: /^#(微信|WeChat)(插件)?(强制)?更新(日志)?$/gi,
                    fnc: "update",
                    permission: "master"
                },
                {
                    reg: /^#设置主人$/,
                    fnc: 'master'
                }
            ]
        })
    }
    async update(e) {
        let new_update = new update()
        new_update.e = e
        const name = "WeChat-plugin"
        if (new_update.getPlugin(name)) {
            if (e.msg.includes("更新日志")) {
                if (new_update.getPlugin(name)) {
                    return e.reply(await new_update.getLog(name))
                }
            } else {
                if (this.e.msg.includes('强制'))
                    execSync('git reset --hard', { cwd: `${process.cwd()}/plugins/${name}/` })
                await new_update.runUpdate(name)
                if (new_update.isUp)
                    setTimeout(() => new_update.restart(), 2000)
            }
            return
        }
    }

    async master(e) {
        /** 对用户id进行默认赋值 */
        user = e.user_id
        let cfg = fs.readFileSync("./config/config/other.yaml", "utf8")
        if (e.at) {
            /** 存在at检测触发用户是否为主人 */
            if (!e.isMaster) return e.reply(`只有主人才能命令我哦~\n(*/ω＼*)`)
            /** 检测被at的用户是否已经是主人 */
            if (cfg.match(RegExp(`- "?${e.at}"?`)))
                return e.reply([segment.at(e.at), "已经是主人了哦(〃'▽'〃)"])
            user = e.at
            e.reply(Yunzai.add(e))
        } else {
            /** 检测用户是否已经是主人 */
            if (e.isMaster) return e.reply([segment.at(e.user_id), "已经是主人了哦(〃'▽'〃)"])
            /** 生成验证码 */
            sign[e.user_id] = crypto.randomUUID()
            logger.mark(`设置主人验证码：${logger.green(sign[e.user_id])}`)
            /** 开始上下文 */
            this.setContext('SetAdmin')
            e.reply([segment.at(e.user_id), `请输入控制台的验证码`])
        }
    }

    SetAdmin() {
        /** 结束上下文 */
        this.finish('SetAdmin')
        /** 判断验证码是否正确 */
        if (this.e.msg.trim() === sign[this.e.user_id]) {
            this.e.reply(add(this.e))
        } else {
            return this.reply([segment.at(this.e.user_id), "验证码错误"])
        }
    }
}


/** 设置主人 */
function add(e) {
    let cfg = fs.readFileSync("./config/config/other.yaml", "utf8")
    /** 使用正则表达式确认是TRSS还是Miao */
    if (cfg.match(RegExp("master:"))) {
        cfg = cfg.replace(RegExp("masterQQ:"), `masterQQ:\n  - "${user}"`)
        const value = `master:\n  - "${e.self_id}:${user}"`
        cfg = cfg.replace(RegExp("master:"), value)
    } else {
        cfg = cfg.replace(RegExp("masterQQ:"), `masterQQ:\n  - ${user}`)
    }
    fs.writeFileSync("./config/config/other.yaml", cfg, "utf8")
    return [segment.at(user), "新主人好~(*/ω＼*)"]
}


/** 加载一下插件到主体... */
// let ret = await Promise.allSettled([import('./model/Yunzai.js')])
// let apps = { Yunzai: ret[0].value[Object.keys(ret[0].value)[0]] }
// export { apps }