import "./model/loader.js"
import "./model/puppeteer.js"
import "./model/config.js"
import "./model/ws.js"
import fs from "fs"
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
                },
                {
                    reg: /^#(删除|取消)主人$/,
                    fnc: "del_master",
                    permission: "master"
                },
                {
                    reg: /^#微信修改名称.+/,
                    fnc: 'Bot_name',
                    permission: "master"
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

    async del_master(e) {
        const file = "./config/config/other.yaml"
        if (!e.at) return e.reply("你都没有告诉我是谁！快@他吧！^_^")
        let cfg = fs.readFileSync(file, "utf8")
        if (!cfg.match(RegExp(`- "?${e.at}"?`)))
            return e.reply("这个人不是主人啦(〃'▽'〃)", false, { at: true })
        cfg = cfg.replace(RegExp(`\\n  - "?${e.at}"?`), "")
        fs.writeFileSync(file, cfg, "utf8")
        e.reply([segment.at(e.at), "拜拜~"])
    }

    async Bot_name(e) {
        const msg = e.msg.replace("#微信修改名称", "").trim()
        const _path = WeChat.cfg._path
        let cfg = fs.readFileSync(_path, "utf8")
        cfg = cfg.replace(RegExp("name:.*"), `name: ${msg}`)
        fs.writeFileSync(_path, cfg, "utf8")
        Bot[WeChat?.BotCfg?.user_id].nickname = msg
        e.reply(`修改成功，新名称为：${msg}`, false, { at: true })
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
    let match
    let text
    let cfg = fs.readFileSync("./config/config/other.yaml", "utf8")
    /** 使用正则表达式确认是TRSS还是Miao */
    if (cfg.match(RegExp("master:"))) {
        cfg = cfg.replace(RegExp("masterQQ:"), `masterQQ:\n  - "${user}"`)
        const value = `master:\n  - "${e.self_id}:${user}"`
        cfg = cfg.replace(RegExp("master:"), value)
    } else {
        const regexp = /masterQQ([\s\S]*?)disableGuildMsg/g
        while ((match = regexp.exec(cfg)) !== null) { text = match[0] }
        const msg = `\n  - ${user}\n# 禁用频道功能 true: 不接受频道消息，flase：接受频道消息\ndisableGuildMsg`
        text = `${text.replace(/((\n#[\s\S]*|\n{1,3})|\n{1,3})?disableGuildMsg/g, "")}${msg}`
        cfg = cfg.replace(RegExp("masterQQ[\\s\\S]*disableGuildMsg"), text)
    }
    fs.writeFileSync("./config/config/other.yaml", cfg, "utf8")
    return [segment.at(user), "新主人好~(*/ω＼*)"]
}


/** 加载一下插件到主体... */
// let ret = await Promise.allSettled([import('./model/Yunzai.js')])
// let apps = { Yunzai: ret[0].value[Object.keys(ret[0].value)[0]] }
// export { apps }