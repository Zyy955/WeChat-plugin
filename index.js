import "./model/loader.js"
import "./model/puppeteer.js"
import "./model/config.js"
import "./model/ws.js"
import fs from "fs"
import crypto from "crypto"
import _Yaml from "./model/yaml.js"
import { execSync } from "child_process"
import { update } from "../other/update.js"

/** 设置主人 */
let user = ""
let sign = {}

export class WeChat_ extends plugin {
    constructor() {
        super({
            name: "WeChat插件",
            priority: 10,
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
                    e.reply(await new_update.getLog(name))
                    return false
                }
            } else {
                if (this.e.msg.includes('强制'))
                    execSync('git reset --hard', { cwd: `${process.cwd()}/plugins/${name}/` })
                await new_update.runUpdate(name)
                if (new_update.isUp)
                    setTimeout(() => new_update.restart(), 2000)
            }
            return false
        }
    }
    async master(e) {
        let user_id = e.user_id
        if (e.at) {
            const cfg = new _Yaml("./config/config/other.yaml")
            /** 存在at检测触发用户是否为主人 */
            if (!e.isMaster) return e.reply(`只有主人才能命令我哦~\n(*/ω＼*)`)
            user_id = e.at
            /** 检测用户是否已经是主人 */
            if (cfg.value("masterQQ", user_id)) return e.reply([segment.at(user_id), "已经是主人了哦(〃'▽'〃)"])
            /** 添加主人 */
            return await e.reply(apps.master(e, user_id))
        } else {
            /** 检测用户是否已经是主人 */
            if (e.isMaster) return e.reply([segment.at(e.user_id), "已经是主人了哦(〃'▽'〃)"])
        }
        /** 生成验证码 */
        sign[user_id] = crypto.randomUUID()
        logger.mark(`设置主人验证码：${logger.green(sign[e.user_id])}`)
        await e.reply([segment.at(e.user_id), `请输入控制台的验证码`])
        /** 开始上下文 */
        return await this.setContext('SetAdmin')
    }

    async del_master(e) {
        if (!e.at) return e.reply("你都没有告诉我是谁！快@他吧！^_^")
        const cfg = new _Yaml("./config/config/other.yaml")
        if (!cfg.value("masterQQ", e.at)) {
            return e.reply("这个人不是主人啦(〃'▽'〃)", false, { at: true })
        }
        cfg.delVal("masterQQ", e.at)
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
            this.e.reply(apps.master(this.e))
        } else {
            return this.reply([segment.at(this.e.user_id), "验证码错误"])
        }
    } SetAdmin() {
        /** 结束上下文 */
        this.finish('SetAdmin')
        /** 判断验证码是否正确 */
        if (this.e.msg.trim() === sign[this.e.user_id]) {
            this.e.reply(apps.master(this.e))
        } else {
            return this.reply([segment.at(this.e.user_id), "验证码错误"])
        }
    }
}


let apps = {
    /** 设置主人 */
    master(e, user_id = null) {
        user_id = user_id || e.user_id
        const cfg = new _Yaml("./config/config/other.yaml")
        cfg.addVal("masterQQ", user_id)
        return [segment.at(user_id), "新主人好~(*/ω＼*)"]
    }
}


/** 加载一下插件到主体... */
// let ret = await Promise.allSettled([import('./model/Yunzai.js')])
// let apps = { Yunzai: ret[0].value[Object.keys(ret[0].value)[0]] }
// export { apps }