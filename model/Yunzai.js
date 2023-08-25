import fs from "fs"
import path from "path"
import Yaml from "yaml"
import lodash from 'lodash'
import crypto from 'crypto'
import { fileTypeFromBuffer } from "file-type"
import { update } from "../../other/update.js"
import PluginsLoader from "../../../lib/plugins/loader.js"

/** 设置主人 */
let user = ""
let sign = {}

/** 全局变量WeChat */
global.WeChat = { ws: {}, group: {}, config: {} }

/** 生成默认配置文件 */
let _path = process.cwd() + "/plugins/WeChat-plugin/config.yaml"
if (!fs.existsSync(_path)) {
    fs.writeFileSync(_path, ``, 'utf8')
}
/** 加载配置文件到全局变量中 */
WeChat.config = Yaml.parse(fs.readFileSync(_path, 'utf8'))

export class QQGuildBot extends plugin {
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
        let message_zai = []
        const { self, message } = WeChat_data

        for (let i of message) {
            const { type, data } = i
            switch (type) {
                case "text":
                    message_zai.push({ type: "text", text: data.text })
                    break
                case "mention":
                    let qq = data.user_id
                    if (data.user_id === self.user_id) qq = Bot.uin
                    else message_zai.push({ type: "at", text: "", qq: qq })
                    break
                case "mention_all":
                    break
                case "image":
                    const image = await WeChat.get_file("url", data.file_id)
                    message_zai.push({ type: "image", name: image.name, url: image.url })
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
                    message_zai.push({ type: "emoji", text: data.file_id })
                    break
                case "wx.link":
                    break
                case "wx.app":
                    break
            }
        }
        return message_zai
    },
    /** 消息转换为Yunzai格式 */
    async msg(data) {
        const { group_id, detail_type, self, user_id } = data
        let time = parseInt(Date.parse(data.time) / 1000)
        /** 构建Yunzai的message */
        let message = await this.message(data)

        /** 判断消息中是否@了机器人 */
        // const atBot = msg.mentions?.find(mention => mention.bot) || false`   
        const user_name = (await WeChat.get_group_member_info(group_id, user_id))?.user_name || ""

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
            message: [...message],
            post_type: "message",
            message_id: data.message_id,
            user_id: user_id,
            time,
            message_type: detail_type,
            sub_type: detail_type === "group" ? "normal" : "friend",
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
            atme: "",
            member,
            friend: {
                recallMsg: () => {
                    return
                },
                makeForwardMsg: async (forwardMsg) => {
                    return await e.group.makeForwardMsg(forwardMsg)
                }
            },
            group: {
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
                            at = Number(e.user_id)
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
    }
}



/** 劫持回复方法 */
PluginsLoader.reply = Yunzai.reply

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