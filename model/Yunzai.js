import fs from "fs"
import path from "path"
import Yaml from "yaml"
import lodash from "lodash"
import crypto from "crypto"
import { execSync } from "child_process"
import { fileTypeFromBuffer } from "file-type"
import { update } from "../../other/update.js"
import cfg from "../../../lib/config/config.js"
import common from "../../../lib/common/common.js"
import PluginsLoader from "../../../lib/plugins/loader.js"


/** 设置主人 */
let user = ""
let sign = {}

/** 喵云崽、喵崽 */
const zai_name = JSON.parse(fs.readFileSync('./package.json', 'utf-8')).name

/** 全局变量WeChat */
global.WeChat = { ws: {}, group: {}, config: {}, BotCfg: {} }

/** 生成默认配置文件 */
let _path = process.cwd() + "/plugins/WeChat-plugin/config.yaml"
if (!fs.existsSync(_path)) {
    fs.writeFileSync(_path, `# 端口\nport: 2955\n# 路径\npath: "/ComWeChat"\n# 是否自动同意加好友 1-同意 0-不处理\nautoFriend: 1`, 'utf8')
}

/** 兼容旧配置 */
let old_cfg = fs.readFileSync(_path, "utf8")
if (!old_cfg.match(RegExp("autoFriend:"))) {
    old_cfg = old_cfg + "\n# 是否自动同意加好友 1-同意 0-不处理\nautoFriend: 1"
    fs.writeFileSync(_path, old_cfg, "utf8")
}

/** 加载配置文件到全局变量中 */
WeChat.config = Yaml.parse(fs.readFileSync(_path, "utf8"))

export class WeChat_ extends plugin {
    constructor() {
        super({
            name: "WeChat插件",
            priority: 1,
            rule: [
                {
                    reg: /^#(微信|WeChat)(插件)?(强制)?更新$/gi,
                    fnc: "update",
                    permission: "master"
                },
                {
                    reg: /^#微信更新日志$/gi,
                    fnc: 'update_log',
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
        new_update.reply = this.reply
        const name = "WeChat-plugin"
        if (new_update.getPlugin(name)) {
            if (this.e.msg.includes('强制'))
                execSync('git reset --hard', { cwd: `${process.cwd()}/plugins/${name}/` })
            await new_update.runUpdate(name)
            if (new_update.isUp)
                setTimeout(() => new_update.restart(), 2000)
        }
        return true
    }

    async update_log(e) {
        let new_update = new update()
        new_update.e = e
        new_update.reply = this.reply
        const name = "WeChat-plugin"
        if (new_update.getPlugin(name)) {
            this.e.reply(await new_update.getLog(name))
        }
        return
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
            this.e.reply(Yunzai.add(this.e))
        } else {
            return this.reply([segment.at(this.e.user_id), "验证码错误"])
        }
    }
}


export let Yunzai = {
    /** 构建Yunzai的message */
    async message(WeChat_data) {
        let atme = false
        let message = []
        let raw_message = ""
        const msg = WeChat_data.message
        if (!msg) return false

        for (let i of msg) {
            const { type, data } = i
            switch (type) {
                case "text":
                    raw_message += data.text
                    message.push({ type: "text", text: data.text })
                    break
                case "mention":
                    if (data.user_id === WeChat.BotCfg.user_id) {
                        atme = true
                        raw_message += `@${WeChat.BotCfg.user_name}`
                    } else {
                        raw_message += `@${data.user_id}`
                        message.push({ type: "at", text: "", qq: data.user_id })
                    }
                    break
                case "mention_all":
                    break
                case "image":
                    const image = await WeChat.get_file("url", data.file_id)
                    raw_message += `{image:${image.name}}`
                    message.push({ type: "image", name: image.name, url: image.url })
                    break
                case "voice":
                    break
                case "audio":
                    break
                case "video":
                    break
                case "file":
                    break
                case "location":
                    break
                case "reply":
                    break
                case "wx.emoji":
                    raw_message += `{emoji:${data.file_id}}`
                    message.push({ type: "emoji", text: data.file_id })
                    break
                case "wx.link":
                    break
                case "wx.app":
                    break
            }
        }
        return { message, raw_message, atme }
    },
    /** 消息转换为Yunzai格式 */
    async msg(data) {
        let user_id = data.user_id
        const { group_id, detail_type, self, time } = data
        /** 构建Yunzai的message */
        let { message, raw_message, atme } = await this.message(data)
        /** 获取用户名称 */
        let user_name
        if (detail_type === "private" || detail_type === "wx.get_private_poke") {
            user_name = (await WeChat.get_user_info(user_id))?.user_name || ""
        } else {
            user_name = (await WeChat.get_group_member_info(group_id, user_id))?.user_name || ""
        }

        let member = {
            info: {
                group_id: group_id,
                user_id: user_id,
                nickname: user_name,
                last_sent_time: time,
            },
            group_id: group_id,
        }

        let e = {
            post_type: "message",
            message_id: data.message_id,
            user_id: user_id,
            time,
            raw_message: data.alt_message,
            message_type: detail_type,
            sub_type: (detail_type === "private" || detail_type === "wx.get_private_poke") ? "friend" : "normal",
            sender: {
                user_id: user_id,
                nickname: user_name,
                card: user_name,
                role: "member",
            },
            group_id: group_id,
            group_name: WeChat.group[group_id],
            self_id: self.user_id,
            font: "宋体",
            seq: data.message_id,
            atme: atme,
            member,
            friend: {
                recallMsg: () => {
                    return
                },
                makeForwardMsg: async (forwardMsg) => {
                    return await e.group.makeForwardMsg(forwardMsg)
                },
                getChatHistory: (seq, num) => {
                    return ["message", "test"]
                }
            },
            group: {
                getChatHistory: (seq, num) => {
                    return ["message", "test"]
                },
                recallMsg: () => {
                    return
                },
                sendMsg: async (reply) => {
                    return await e.reply(reply)
                },
                makeForwardMsg: async (forwardMsg) => {
                    const messages = {}
                    const newmsg = []
                    const content = data.alt_message

                    /** 针对无限套娃的转发进行处理 */
                    for (const i_msg of forwardMsg) {
                        /** message -> 对象 -> data.type=test ->套娃转发 */
                        const formsg = i_msg?.message
                        if (formsg && typeof formsg === "object") {
                            /** 套娃转发 */
                            if (formsg?.data?.type === "test") {
                                newmsg.push(...formsg.msg)
                            } else if (Array.isArray(formsg)) {
                                for (const arr of formsg) {
                                    if (typeof arr === "string") newmsg.push({ type: "forward", text: arr })
                                    else newmsg.push(arr)
                                }
                            } else {
                                /** 普通对象 */
                                newmsg.push(formsg)
                            }
                        } else {
                            /** 日志特殊处理 */
                            if (/^#.*日志$/.test(content)) {
                                let splitMsg
                                for (const i of forwardMsg) {
                                    splitMsg = i.message.split("\n[").map(element => {
                                        if (element.length > 100)
                                            element = element.substring(0, 100) + "日志过长..."
                                        return { type: "forward", text: `[${element.trim()}\n` }
                                    })
                                }
                                newmsg.push(...splitMsg.slice(0, 50))
                            } else {
                                /** 正常文本 */
                                newmsg.push({ type: "forward", text: formsg })
                            }
                        }
                    }
                    /** 对一些重复元素进行去重 */
                    messages.msg = Array.from(new Set(newmsg.map(JSON.stringify))).map(JSON.parse)
                    messages.data = { type: "test", text: "forward" }
                    return messages
                }
            },
            recall: () => {
                return
            },
            reply: async (reply) => {
                /** 转换格式 */
                let msg = []
                /** 转发消息 */
                if (reply?.data?.type === "test") {
                    for (let i of reply.msg) {
                        switch (i.type) {
                            case "forward":
                                await WeChat.send_message(detail_type, group_id || user_id, { type: "text", data: { text: i.text } })
                                break
                            case "image":
                                const image_msg = await this.get_file_id(i)
                                await WeChat.send_message(detail_type, group_id || user_id, image_msg)
                                break
                            default:
                                break
                        }
                    }
                } else {
                    /** 纯文本 */
                    if (typeof reply === "string") {
                        msg = { type: "text", data: { text: reply } }
                    }
                    /** base64二进制 */
                    else if (reply instanceof Uint8Array) {
                        msg = await this.get_file_id({ type: "image", file: reply })
                    }
                    /** 对象 */
                    else if (typeof reply === "object") {
                        /** 判断是否可迭代 */
                        if (reply !== null && typeof reply[Symbol.iterator] === 'function') {
                            for (let i of reply) {
                                const msg_ = await this.type_msg(detail_type, group_id, user_id, i)
                                if (msg_) msg.push(msg_)
                            }
                        } else {
                            msg = await this.get_file_id(reply)
                        }
                    }
                    /** at可以跟文本一起发 */
                    if (!msg || msg.length == 0) return
                    if (Array.isArray(msg) && !msg[1]) msg = msg[0]
                    return await WeChat.send_message(detail_type, group_id || user_id, msg)
                }
            },
            toString: () => {
                return data.alt_message
            }
        }
        /** 兼容message不存在的情况 */
        if (message) e.message = [...message]
        /** 私聊拍一拍 */
        if (data.detail_type === "wx.get_private_poke") {
            e.action = "戳了戳"
            e.sub_type = "poke"
            e.post_type = "notice"
            e.notice_type = "private"
            e.user_id = data.from_user_id
            e.target_id = data.user_id
            e.operator_id = data.from_user_id
            user_id = data.from_user_id
        }
        /** 群聊拍一拍 */
        if (data.detail_type === "wx.get_group_poke") {
            e.action = "戳了戳"
            e.sub_type = "poke"
            e.post_type = "notice"
            e.notice_type = "group"
            e.target_id = data.user_id
            e.operator_id = data.from_user_id
        }

        return e
    },
    /** 转换格式为WeChat能使用的 */
    async type_msg(detail_type, group_id, user_id, i) {
        if (typeof i === "string") return { type: "text", data: { text: i } }
        switch (i.type) {
            /** 返回对象 组合发送 */
            case "at":
                return { type: "mention", data: { user_id: i.qq === 0 ? i.id : i.qq } }
            /** 返回对象 组合发送 */
            case "text":
                return { type: "text", data: { text: i.text } }
            /** 返回对象 组合发送 */
            case "emoji":
                return { type: "wx.emoji", data: { file_id: i.text } }
            /** 转发消息直接分片发送 */
            case "forward":
                await WeChat.send_message(detail_type, group_id || user_id, { type: "text", data: { text: i.text } })
                return
            /** 图片直接上传发送 */
            case "image":
                const image_msg = await this.get_file_id(i)
                await WeChat.send_message(detail_type, group_id || user_id, image_msg)
                return
            default:
                return
        }
    },
    /** 上传图片获取图片id */
    async get_file_id(i) {
        let name
        let type = "data"
        let file = i.file

        /** 将二进制的base64转字符串 防止报错 */
        if (i.file instanceof Uint8Array) {
            file = `base64://${Buffer.from(i.file).toString('base64')}`
        } else {
            file = i.file.replace(/^file:(\/\/\/|\/\/)/, "") || i.url
        }
        /** base64 */
        if (/^base64:\/\//.test(file)) {
            file = file.replace(/^base64:\/\//, "")
            name = `${Date.now()}.${(await fileTypeFromBuffer(Buffer.from(file, "base64"))).ext}`
        }
        /** 本地文件 */
        else if (fs.existsSync(file)) {
            name = path.basename(file)
            file = fs.readFileSync(file).toString("base64")
        }
        /** url图片 */
        else if (/^http(s)?:\/\//.test(file)) {
            type = "url"
            name = file.match(/\/([^/]+)$/)[1]
        } else {
            // 未知...
        }

        /** 上传文件 获取文件id 获取为空我也不知道为啥... */
        const file_id = (await WeChat.upload_file(type, name, file))?.file_id || ""
        /** 特殊处理表情包 */
        if (/.gif$/.test(name)) {
            return { type: "wx.emoji", data: { file_id: file_id } }
        } else {
            return { type: "image", data: { file_id: file_id } }
        }
    },
    /** 设置主人 */
    add(e) {
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
    },
    /**
 * 处理消息，加入自定义字段
 * @param e.msg 文本消息，多行会自动拼接
 * @param e.img 图片消息数组
 * @param e.atBot 是否at机器人
 * @param e.at 是否at，多个at 以最后的为准
 * @param e.file 接受到的文件
 * @param e.isPrivate 是否私聊
 * @param e.isGroup 是否群聊
 * @param e.isMaster 是否管理员
 * @param e.logText 日志用户字符串
 * @param e.logFnc  日志方法字符串

 * 频道
 * @param e.isGuild 是否频道
 * @param e.at 支持频道 tiny_id
 * @param e.atBot 支持频道

 */
    dealMsg(e) {
        if (e.message) {
            for (let val of e.message) {
                switch (val.type) {
                    case 'text':
                        e.msg = (e.msg || '') + (val.text || '').replace(/^\s*[＃井#]+\s*/, '#').replace(/^\s*[\\*※＊]+\s*/, '*').trim()
                        break
                    case 'image':
                        if (!e.img) {
                            e.img = []
                        }
                        e.img.push(val.url)
                        break
                    case 'at':
                        if (val.qq == e.bot.uin || val.qq == WeChat.BotCfg.user_id) {
                            e.atBot = true
                        } else if (val.id == e.bot.tiny_id || val.id == WeChat.BotCfg.user_id) {
                            e.atBot = true
                            /** 多个at 以最后的为准 */
                        } else if (val.id) {
                            e.at = val.id
                        } else {
                            e.at = val.qq
                        }
                        break
                    case 'file':
                        e.file = { name: val.name, fid: val.fid }
                        break
                }
            }
        }

        e.logText = ''

        if (e.message_type === 'private' || e.notice_type === 'friend') {
            e.isPrivate = true

            if (e.sender) {
                e.sender.card = e.sender.nickname
            } else {
                e.sender = {
                    card: e.friend?.nickname,
                    nickname: e.friend?.nickname
                }
            }

            e.logText = `[私聊][${e.sender.nickname}(${e.user_id})]`
        }

        if (e.message_type === 'group' || e.notice_type === 'group') {
            e.isGroup = true
            if (e.sender) {
                e.sender.card = e.sender.card || e.sender.nickname
            } else if (e.member) {
                e.sender = {
                    card: e.member.card || e.member.nickname
                }
            } else if (e.nickname) {
                e.sender = {
                    card: e.nickname,
                    nickname: e.nickname
                }
            } else {
                e.sender = {
                    card: '',
                    nickname: ''
                }
            }

            if (!e.group_name) e.group_name = e.group?.name

            e.logText = `[${e.group_name}(${e.sender.card})]`
        } else if (e.detail_type === 'guild') {
            e.isGuild = true
        }

        if (e.user_id && cfg.masterQQ.includes(Number(e.user_id) || e.user_id)) {
            e.isMaster = true
        }

        /** 只关注主动at msg处理 */
        if (e.msg && e.isGroup) {
            let groupCfg = cfg.getGroup(e.group_id)
            let alias = groupCfg.botAlias
            if (!Array.isArray(alias)) {
                alias = [alias]
            }
            for (let name of alias) {
                if (e.msg.startsWith(name)) {
                    e.msg = lodash.trimStart(e.msg, name).trim()
                    e.hasAlias = true
                    break
                }
            }
        }
    },
    /** 处理回复,捕获发送失败异常 */
    reply(e) {
        if (e.reply) {
            e.replyNew = e.reply

            /**
             * @param msg 发送的消息
             * @param quote 是否引用回复
             * @param data.recallMsg 群聊是否撤回消息，0-120秒，0不撤回
             * @param data.at 是否at用户
             */
            e.reply = async (msg = '', quote = false, data = {}) => {
                if (!msg) return false

                /** 禁言中 */
                if (e.isGroup && e?.group?.mute_left > 0) return false

                let { recallMsg = 0, at = '' } = data

                if (at && e.isGroup) {
                    let text = ''
                    if (e?.sender?.card) {
                        text = lodash.truncate(e.sender.card, { length: 10 })
                    }
                    if (at === true) {
                        if (typeof e.user_id === "number")
                            at = Number(e.user_id) || e.user_id
                        else at = e.user_id.trim()
                    } else if (!isNaN(at)) {
                        if (e.isGuild) {
                            text = e.sender?.nickname
                        } else {
                            let info = e.group.pickMember(at).info
                            text = info?.card ?? info?.nickname
                        }
                        text = lodash.truncate(text, { length: 10 })
                    }

                    if (Array.isArray(msg)) {
                        msg = [segment.at(at, text), ...msg]
                    } else {
                        msg = [segment.at(at, text), msg]
                    }
                }

                let msgRes
                try {
                    msgRes = await e.replyNew(msg, quote)
                } catch (err) {
                    if (typeof msg != 'string') {
                        if (msg.type == 'image' && Buffer.isBuffer(msg?.file)) msg.file = {}
                        msg = lodash.truncate(JSON.stringify(msg), { length: 300 })
                    }
                    logger.error(`发送消息错误:${msg}`)
                    logger.error(err)
                }

                // 频道一下是不是频道
                if (!e.isGuild && recallMsg > 0 && msgRes?.message_id) {
                    if (e.isGroup) {
                        setTimeout(() => e.group.recallMsg(msgRes.message_id), recallMsg * 1000)
                    } else if (e.friend) {
                        setTimeout(() => e.friend.recallMsg(msgRes.message_id), recallMsg * 1000)
                    }
                }

                this.count(e, msg)
                return msgRes
            }
        } else {
            e.reply = async (msg = '', quote = false, data = {}) => {
                if (!msg) return false
                this.count(e, msg)
                if (e.group_id) {
                    return await e.group.sendMsg(msg).catch((err) => {
                        logger.warn(err)
                    })
                } else {
                    let friend = e.bot.fl.get(e.user_id)
                    if (!friend) return
                    return await e.bot.pickUser(e.user_id).sendMsg(msg).catch((err) => {
                        logger.warn(err)
                    })
                }
            }
        }

    },
    /** 判断黑白名单 */
    checkBlack(e) {
        let other = cfg.getOther()
        let notice = cfg.getNotice()

        if (e.test) return true

        /** 黑名单qq */
        if (other.blackQQ && other.blackQQ.includes(Number(e.user_id) || e.user_id)) {
            return false
        }

        if (e.group_id) {
            /** 白名单群 */
            if (Array.isArray(other.whiteGroup) && other.whiteGroup.length > 0) {
                return other.whiteGroup.includes(Number(e.group_id) || e.group_id)
            }
            /** 黑名单群 */
            if (Array.isArray(other.blackGroup) && other.blackGroup.length > 0) {
                return !other.blackGroup.includes(Number(e.group_id) || e.group_id)
            }
        }

        return true
    },
    /** 新转发消息 */
    async makeForwardMsg(e, msg = [], dec = '', msgsscr = false) {

        if (!Array.isArray(msg)) msg = [msg]

        let name = msgsscr ? e.sender.card || e.user_id : Bot.nickname
        let id = msgsscr ? e.user_id : Bot.uin

        if (e.isGroup) {
            let info = await e.bot.getGroupMemberInfo(e.group_id, id)
            name = info.card || info.nickname
        }

        let userInfo = {
            user_id: id,
            nickname: name
        }

        let forwardMsg = []
        for (const message of msg) {
            if (!message) continue
            forwardMsg.push({
                ...userInfo,
                message: message
            })
        }


        /** 制作转发内容 */
        if (e?.group?.makeForwardMsg) {
            forwardMsg = await e.group.makeForwardMsg(forwardMsg)
        } else if (e?.friend?.makeForwardMsg) {
            forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
        } else {
            return msg.join('\n')
        }

        if (dec) {
            /** 处理描述 */
            if (typeof (forwardMsg.data) === 'object') {
                let detail = forwardMsg.data?.meta?.detail
                if (detail) {
                    detail.news = [{ text: dec }]
                }
            } else {
                forwardMsg.data = forwardMsg.data
                    .replace(/\n/g, '')
                    .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
                    .replace(/___+/, `<title color="#777777" size="26">${dec}</title>`)
            }
        }

        return forwardMsg
    },
    /** 喵云崽 处理消息，加入自定义字段 */
    dealMsg_v3(e) {
        if (e.message) {
            for (let val of e.message) {
                switch (val.type) {
                    case 'text':
                        /** 中文#转为英文 */
                        val.text = val.text.replace(/＃|井/g, '#').trim()
                        if (/星铁|崩坏星穹铁道|铁道|星轨|星穹铁道|\/common\//.test(val.text)) {
                            e.isSr = true
                        }
                        if (e.msg) {
                            e.msg += val.text
                        } else {
                            e.msg = val.text.trim()
                        }
                        break
                    case 'image':
                        if (!e.img) {
                            e.img = []
                        }
                        e.img.push(val.url)
                        break
                    case 'at':
                        if (val.qq == Bot.uin) {
                            e.atBot = true
                        } else {
                            /** 多个at 以最后的为准 */
                            e.at = val.qq
                        }
                        break
                    case 'file':
                        e.file = { name: val.name, fid: val.fid }
                        break
                }
            }
        }

        e.logText = ''

        if (e.message_type == 'private' || e.notice_type == 'friend') {
            e.isPrivate = true

            if (e.sender) {
                e.sender.card = e.sender.nickname
            } else {
                e.sender = {
                    card: e.friend?.nickname,
                    nickname: e.friend?.nickname
                }
            }

            e.logText = `[私聊][${e.sender.nickname}(${e.user_id})]`
        }

        if (e.message_type == 'group' || e.notice_type == 'group') {
            e.isGroup = true
            if (e.sender) {
                e.sender.card = e.sender.card || e.sender.nickname
            } else if (e.member) {
                e.sender = {
                    card: e.member.card || e.member.nickname
                }
            } else if (e.nickname) {
                e.sender = {
                    card: e.nickname,
                    nickname: e.nickname
                }
            } else {
                e.sender = {
                    card: '',
                    nickname: ''
                }
            }

            if (!e.group_name) e.group_name = e.group?.name

            e.logText = `[${e.group_name}(${e.sender.card})]`
        }

        if (e.user_id && cfg.masterQQ.includes(Number(e.user_id) || e.user_id)) {
            e.isMaster = true
        }

        /** 只关注主动at msg处理 */
        if (e.msg && e.isGroup) {
            let groupCfg = cfg.getGroup(e.group_id)
            let alias = groupCfg.botAlias
            if (!Array.isArray(alias)) {
                alias = [alias]
            }
            for (let name of alias) {
                if (e.msg.startsWith(name)) {
                    e.msg = lodash.trimStart(e.msg, name).trim()
                    e.hasAlias = true
                    break
                }
            }
        }
    },
    /** 喵云崽 处理回复,捕获发送失败异常 */
    reply_v3(e) {
        if (e.reply) {
            e.replyNew = e.reply

            /**
             * @param msg 发送的消息
             * @param quote 是否引用回复
             * @param data.recallMsg 群聊是否撤回消息，0-120秒，0不撤回
             * @param data.at 是否at用户
             */
            e.reply = async (msg = '', quote = false, data = {}) => {
                if (!msg) return false

                /** 禁言中 */
                if (e.isGroup && e?.group?.mute_left > 0) return false

                let { recallMsg = 0, at = '' } = data

                if (at && e.isGroup) {
                    let text = ''
                    if (e?.sender?.card) {
                        text = lodash.truncate(e.sender.card, { length: 10 })
                    }
                    if (at === true) {
                        at = Number(e.user_id) || e.user_id
                    } else if (!isNaN(at)) {
                        let info = e.group.pickMember(at).info
                        text = info?.card ?? info?.nickname
                        text = lodash.truncate(text, { length: 10 })
                    }

                    if (Array.isArray(msg)) {
                        msg = [segment.at(at, text), ...msg]
                    } else {
                        msg = [segment.at(at, text), msg]
                    }
                }

                let msgRes
                try {
                    msgRes = await e.replyNew(this.checkStr(msg), quote)
                } catch (err) {
                    if (typeof msg != 'string') {
                        if (msg.type == 'image' && Buffer.isBuffer(msg?.file)) msg.file = {}
                        msg = lodash.truncate(JSON.stringify(msg), { length: 300 })
                    }
                    logger.error(`发送消息错误:${msg}`)
                    logger.error(err)
                }

                if (recallMsg > 0 && msgRes?.message_id) {
                    if (e.isGroup) {
                        setTimeout(() => e.group.recallMsg(msgRes.message_id), recallMsg * 1000)
                    } else if (e.friend) {
                        setTimeout(() => e.friend.recallMsg(msgRes.message_id), recallMsg * 1000)
                    }
                }

                this.count(e, msg)
                return msgRes
            }
        } else {
            e.reply = async (msg = '', quote = false, data = {}) => {
                if (!msg) return false
                this.count(e, msg)
                if (e.group_id) {
                    return await e.group.sendMsg(msg).catch((err) => {
                        logger.warn(err)
                    })
                } else {
                    let friend = Bot.fl.get(e.user_id)
                    if (!friend) return
                    return await Bot.pickUser(e.user_id).sendMsg(msg).catch((err) => {
                        logger.warn(err)
                    })
                }
            }
        }
    },
    /** 喵云崽 判断黑白名单 */
    checkBlack_v3(e) {
        let other = cfg.getOther()

        if (e.test) return true

        /** 黑名单qq */
        if (other.blackQQ && other.blackQQ.includes(Number(e.user_id) || e.user_id)) {
            return false
        }

        if (e.group_id) {
            /** 白名单群 */
            if (Array.isArray(other.whiteGroup) && other.whiteGroup.length > 0) {
                return other.whiteGroup.includes(Number(e.group_id) || e.user_id)
            }
            /** 黑名单群 */
            if (Array.isArray(other.blackGroup) && other.blackGroup.length > 0) {
                return !other.blackGroup.includes(Number(e.group_id) || e.user_id)
            }
        }

        return true
    }
}


if (zai_name === "miao-yunzai") {
    /** 劫持回复方法 */
    PluginsLoader.reply = Yunzai.reply
    /** 劫持处理消息 */
    PluginsLoader.dealMsg = Yunzai.dealMsg
    /** 劫持黑白名单 */
    PluginsLoader.checkBlack = Yunzai.checkBlack
} else {
    /** 劫持回复方法 */
    PluginsLoader.reply = Yunzai.reply_v3
    /** 劫持处理消息 */
    PluginsLoader.dealMsg = Yunzai.dealMsg_v3
    /** 劫持黑白名单 */
    PluginsLoader.checkBlack = Yunzai.checkBlack_v3
}

/** 根据传入的group_id长度决定使用原方法还是自定义方法 */
Bot.WeChat_Info = Bot.getGroupMemberInfo
Bot.getGroupMemberInfo = async (group_id, id) => {
    if (group_id.toString().length > 10) {
        return {
            group_id: group_id,
            user_id: id,
            nickname: "WeChat-Bot",
            card: "",
            sex: "female",
            age: 6,
            join_time: "",
            last_sent_time: "",
            level: 1,
            role: "member",
            title: "",
            title_expire_time: "",
            shutup_time: 0,
            update_time: "",
            area: "南极洲",
            rank: "潜水",
        }
    } else {
        return Bot.WeChat_Info(group_id, id)
    }
}

/** 对喵云崽的转发进行劫持修改，兼容最新的icqq转发 */
if (zai_name !== "miao-yunzai") {
    /**
     * 制作转发消息
     * @param e 消息事件
     * @param msg 消息数组
     * @param dec 转发描述
     * @param msgsscr 转发信息是否伪装
     */
    /** common转发 */
    common.makeForwardMsg = async function (e, msg = [], dec = '', msgsscr = false) {
        return await Yunzai.makeForwardMsg(e, msg, dec, msgsscr)
    }
    /** 日志 */
    const sendLog = (await import("../../other/sendLog.js")).sendLog
    sendLog.prototype.makeForwardMsg = async function (title, msg) {
        return await Yunzai.makeForwardMsg(this.e, [title, msg], title, false)
    }

    /** 更新日志 */
    update.prototype.makeForwardMsg = async function (title, msg = [], dec = '', msgsscr = false) {
        return await Yunzai.makeForwardMsg(this.e, [title, msg], title, msgsscr)
    }

    /** 表情列表 */
    const add = (await import("../../system/add.js")).add
    add.prototype.makeForwardMsg = async function (qq, title, msg, end = '') {
        return await Yunzai.makeForwardMsg(this.e, [title, msg], title, false)
    }

    /** 角色别名 */
    const abbrSet = (await import("../../genshin/apps/abbrSet.js")).abbrSet
    abbrSet.prototype.abbrList = async function () {
        let gsCfg = (await import("../../genshin/model/gsCfg.js")).default
        let role = gsCfg.getRole(this.e.msg, '#|别名|昵称')

        if (!role) return false

        let name = gsCfg.getdefSet('role', 'name')[role.roleId]
        let nameUser = gsCfg.getConfig('role', 'name')[role.name] ?? []

        let list = lodash.uniq([...name, ...nameUser])

        let msg = []
        for (let i in list) {
            let num = Number(i) + 1
            msg.push(`${num}.${list[i]}\n`)
        }

        let title = `${role.name}别名，${list.length}个`
        msg = await Yunzai.makeForwardMsg(this.e, msg, title, false)

        await this.e.reply(msg)
    }
}
