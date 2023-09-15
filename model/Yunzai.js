import fs from "fs"
import path from "path"
import { fileTypeFromBuffer } from "file-type"

export let Yunzai = {
    /** 构建Yunzai的message */
    async message(WeChat_data) {
        let atme = false
        let message = []
        let source = {}
        const msg = WeChat_data.message
        if (!msg) return false

        for (let i of msg) {
            const { type, data } = i
            switch (type) {
                case "text":
                    message.push({ type: "text", text: data.text })
                    break
                case "mention":
                    if (data.user_id === WeChat.BotCfg.user_id) atme = true
                    else message.push({ type: "at", text: "", qq: data.user_id })
                    break
                case "mention_all":
                    break
                case "image":
                    const image = await WeChat.get_file("url", data.file_id)
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
                    const res = JSON.parse(await redis.get(i.data.message_id) || { id: "", user_id: "" })
                    source = { message: res.id, rand: 0, seq: 0, time: 0, user_id: res.user_id }
                    break
                case "wx.emoji":
                    message.push({ type: "emoji", text: data.file_id })
                    break
                case "wx.link":
                    break
                case "wx.app":
                    break
            }
        }
        return { message, atme, source }
    },
    /** 消息转换为Yunzai格式 */
    async msg(data) {
        /** 存一份原始消息，用于引用消息 */
        await redis.set(data.message_id, JSON.stringify({ id: data.alt_message, user_id: data.user_id }), { EX: 1800 })
        let user_id = data.user_id
        const { group_id, detail_type, self, time } = data
        /** 构建Yunzai的message */
        let { message, atme, source } = await this.message(data)
        /** 获取用户名称 */
        let user_name
        if (detail_type === "private" || detail_type === "wx.get_private_poke") {
            user_name = (await WeChat.api.get_user_info(user_id))?.user_name || ""
        } else {
            user_name = (await WeChat.api.get_group_member_info(group_id, user_id))?.user_name || ""
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
            atBot: atme,
            adapter: "WeChat",
            uin: self.user_id,
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
            source: source,
            group_id: group_id,
            group_name: Bot.gl.get(group_id)?.group_name || "",
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
                    return await Yunzai.makeForwardMsg(forwardMsg, data)
                },
                getChatHistory: (seq, num) => {
                    return ["message", "test"]
                },
                sendMsg: async (reply) => {
                    return await Yunzai.reply(reply, data)
                },
            },
            group: {
                getChatHistory: (seq, num) => {
                    return ["message", "test"]
                },
                recallMsg: () => {
                    return
                },
                sendMsg: async (reply) => {
                    return await Yunzai.reply(reply, data)
                },
                makeForwardMsg: async (forwardMsg) => {
                    return await Yunzai.makeForwardMsg(forwardMsg, data)
                }
            },
            recall: () => {
                return
            },
            reply: async (reply) => {
                return await Yunzai.reply(reply, data)
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
        if (typeof i === "string") return { type: "text", data: { text: i.replace("<lora", "lora") } }
        switch (i.type) {
            /** 返回对象 组合发送 */
            case "at":
                return { type: "mention", data: { user_id: i.qq === 0 ? i.id : i.qq } }
            /** 返回对象 组合发送 */
            case "text":
                return { type: "text", data: { text: i.text.replace("<lora", "lora") } }
            /** 返回对象 组合发送 */
            case "emoji":
                return { type: "wx.emoji", data: { file_id: i.text } }
            /** 转发消息直接分片发送 */
            case "forward":
                await WeChat.api.send_message(detail_type, group_id || user_id, { type: "text", data: { text: i.text.replace("<lora", "lora") } })
                return
            /** 图片直接上传发送 */
            case "image":
                const image_msg = await this.get_file_id(i)
                await WeChat.api.send_message(detail_type, group_id || user_id, image_msg)
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

        /** 特殊格式？... */
        if (i.file?.type === "Buffer") {
            file = `base64://${Buffer.from(i.file.data).toString('base64')}`
        }
        /** 将二进制的base64转字符串 防止报错 */
        else if (i.file instanceof Uint8Array) {
            file = `base64://${Buffer.from(i.file).toString('base64')}`
        }
        /** 天知道从哪里蹦出来的... */
        else if (i.file instanceof fs.ReadStream) {
            file = `./${i.file.path}`
        }
        /** 去掉本地图片的前缀 */
        else if (typeof i.file === "string") {
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
            name = file.match(/\/([^/]+)$/)?.[1] || `${Date.now()}.png`
        }
        /** 留个容错防止炸了 */
        else {
            return { type: "text", data: { text: "未知格式...请寻找作者适配..." } }
        }

        /** 上传文件 获取文件id */
        let file_id
        /** 如果获取为空 则进行重试 最多3次 */
        for (let retries = 0; retries < 3; retries++) {
            file_id = (await WeChat.api.upload_file(type, name, file))?.file_id
            if (file_id) break
            else logger.error(`第${retries + 1}次上传文件失败，正在重试...`)
        }

        /** 处理文件id为空 */
        if (!file_id) return { type: "text", data: { text: "图片上传失败..." } }

        /** 特殊处理表情包 */
        if (/.gif$/.test(name)) {
            return { type: "wx.emoji", data: { file_id: file_id } }
        } else {
            return { type: "image", data: { file_id: file_id } }
        }
    },
    makeForwardMsg: async (forwardMsg, data = {}) => {
        const messages = {}
        const newmsg = []

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
                if (data.alt_message && /^#.*日志$/.test(data.alt_message)) {
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
    },
    reply: async (reply, data = {}) => {
        const { group_id, detail_type, user_id } = data
        /** 转换格式 */
        let msg = []
        /** 转发消息 */
        if (reply?.data?.type === "test") {
            for (let i of reply.msg) {
                await new Promise((resolve) => setTimeout(resolve, 500))
                switch (i.type) {
                    case "forward":
                        await WeChat.api.send_message(detail_type, group_id || user_id, { type: "text", data: { text: i.text.replace("<lora", "lora") } })
                        break
                    case "image":
                        const image_msg = await Yunzai.get_file_id(i)
                        await WeChat.api.send_message(detail_type, group_id || user_id, image_msg)
                        break
                    default:
                        break
                }
            }
        } else {
            /** 纯文本 */
            if (typeof reply === "string") {
                msg = { type: "text", data: { text: reply.replace("<lora", "lora") } }
            }
            /** base64二进制 */
            else if (reply instanceof Uint8Array) {
                msg = await Yunzai.get_file_id({ type: "image", file: reply })
            }
            /** 对象 */
            else if (typeof reply === "object") {
                /** 判断是否可迭代 */
                if (reply !== null && typeof reply[Symbol.iterator] === 'function') {
                    for (let i of reply) {
                        const msg_ = await Yunzai.type_msg(detail_type, group_id, user_id, i)
                        if (msg_) msg.push(msg_)
                    }
                } else {
                    msg = await Yunzai.get_file_id(reply)
                }
            }
            /** at可以跟文本一起发 */
            if (!msg || msg.length == 0) return
            if (Array.isArray(msg) && !msg[1]) msg = msg[0]
            return await WeChat.api.send_message(detail_type, group_id || user_id, msg)
        }
    }
}