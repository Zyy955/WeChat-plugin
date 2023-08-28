import { randomUUID } from "crypto"
import { WebSocketServer } from 'ws'
import { Yunzai } from "./model/Yunzai.js"
import PluginsLoader from "../../lib/plugins/loader.js"

const { port, path } = WeChat.config
const Bot_name = "[WeChatBot] "
const server = new WebSocketServer({ port: port, path: path })
logger.mark(logger.green(`${Bot_name}ws服务器已启动：ws://localhost:${port}${path}`))

/** 当前连接状态 */
let isConnected = false

let WeChatBot = {
    /** 获取支持的动作列表 */
    async get_supported_actions() {
        const params = {}
        return await this.SendApi(params, "get_supported_actions")
    },
    /** 获取运行状态 */
    async get_status() {
        const params = {}
        return await this.SendApi(params, "get_status")
    },
    /** 获取版本信息 */
    async get_version() {
        const params = {}
        return await this.SendApi(params, "get_version")
    },

    /** 获取机器人自身信息 */
    async get_self_info() {
        const params = {}
        return await this.SendApi(params, "get_self_info")
    },
    /** 获取好友信息 */
    async get_user_info(user_id) {
        const params = { user_id: user_id }
        return await this.SendApi(params, "get_user_info")
    },
    /** 获取好友列表 */
    async get_friend_list() {
        const params = {}
        return await this.SendApi(params, "get_friend_list")
    },

    /** 获取群信息 */
    async get_group_info(group_id) {
        const params = { group_id: group_id }
        return await this.SendApi(params, "get_group_info")
    },
    /** 获取群列表 */
    async get_group_list() {
        const params = {}
        return await this.SendApi(params, "get_group_list")
    },
    /** 获取群成员信息 */
    async get_group_member_info(group_id, user_id) {
        const params = { group_id: group_id, user_id: user_id }
        return await this.SendApi(params, "get_group_member_info")
    },
    /** 获取群成员列表 */
    async get_group_member_list(group_id) {
        const params = { group_id: group_id }
        return await this.SendApi(params, "get_group_member_list")
    },
    /** 设置群名称 */
    async set_group_name(group_id, group_name) {
        const params = { group_id: group_id, group_name: group_name }
        return await this.SendApi(params, "set_group_name")
    },
    /** 上传文件 */
    async upload_file(type, name, file) {
        const params = { type: type, name: name, [type]: file }
        return await this.SendApi(params, "upload_file")
    },
    /** 获取文件 */
    async get_file(type, file_id) {
        const params = { type: type, file_id: file_id }
        return await this.SendApi(params, "get_file")
    },
    /** 通过好友请求 */
    async accept_friend(v3, v4) {
        const params = { v3: v3, v4: v4 }
        return await this.SendApi(params, "wx.accept_friend")
    },
    /** 获取微信版本 */
    async get_wechat_version() {
        const params = {}
        return await this.SendApi(params, "wx.get_wechat_version")
    },
    /** 设置微信版本号 */
    async set_wechat_version(version) {
        const params = { version: version }
        return await this.SendApi(params, "wx.set_wechat_version")
    },
    /** 删除好友 */
    async delete_friend(user_id) {
        const params = { user_id: user_id }
        return await this.SendApi(params, "wx.delete_friend")
    },
    /** 设置群昵称 */
    async set_group_nickname(group_id, nickname) {
        const params = { group_id: group_id, nickname: nickname }
        return await this.SendApi(params, "wx.set_group_nickname")
    },
    /** 发送消息 */
    async send_message(type, id, message) {
        let msg_type = type === "private" ? "user_id" : "group_id"
        /** 特殊处理拍一拍 */
        let send_type = (type === "wx.get_group_poke") ? "group" : ((type === "wx.get_private_poke") ? "private" : type)
        const params = { detail_type: send_type, [msg_type]: id, message: message }
        logger.info(`${Bot_name}发送${send_type === "private" ? "好友消息" : "群消息"}：[${id}] ${JSON.stringify(message)}`)
        return await this.SendApi(params, "send_message")
    },
    /** 发送请求事件 */
    async SendApi(params, action) {
        WeChat.ws.send(JSON.stringify({ echo: randomUUID(), action: action, params: params }))
        const { data } = await (new Promise((resolve) => { WeChat.ws.once('message', (res) => { resolve(JSON.parse(res)) }) }))
        return data
    },

}

WeChat = { ...WeChat, ...WeChatBot }

/** 监听连接事件 */
server.on('connection', (ws) => {
    WeChat.ws = ws
    ws.on('message', async (data) => {
        const parse = JSON.parse(data)
        const { detail_type, interval, group_id, user_id, message, version } = parse
        if (!detail_type) return
        /** 做做样子罢了... */
        switch (detail_type) {
            /** 连接 */
            case "connect":
                isConnected = true
                logger.info(Bot_name + "开始连接客户端：" + JSON.stringify(version))
                ws.send(JSON.stringify({ detail_type: 'status_update', status_update: {} }))
                break
            /** 心跳 */
            case "heartbeat":
                logger.debug(Bot_name + "心跳校验：" + JSON.stringify(interval))
                ws.send(JSON.stringify({ detail_type: 'heartbeat', interval: interval }))
                break
            /** 状态更新 */
            case "status_update":
                logger.info(Bot_name + "状态更新：ComWechat已连接")
                /** 加载机器人自身id到全局变量中 */
                WeChat.BotCfg = await WeChat.get_self_info()
                /** 获取群聊列表啦~ */
                const group_list = await WeChat.get_group_list()
                for (let i of group_list) { WeChat.group[i.group_id] = i.group_name }
                break
            /** 群消息 */
            case "group":
                logger.info(Bot_name + `群消息：[${group_id}，${user_id}]` + JSON.stringify(message))
                /** 转换消息 交由云崽处理 */
                PluginsLoader.deal(await Yunzai.msg(parse))
                break
            /** 好友消息 */
            case "private":
                logger.info(Bot_name + `好友消息：[${user_id}]` + JSON.stringify(message))
                /** 转换消息 交由云崽处理 */
                PluginsLoader.deal(await Yunzai.msg(parse))
                break
            /** 好友申请 */
            case "wx.friend_request":
                logger.info(Bot_name + "好友申请：" + `用户 ${user_id} 请求添加好友 请求理由：${parse.content}`)
                /** 通过好友申请 */
                if (WeChat.config.autoFriend == 1) {
                    WeChat.accept_friend(parse.v3, parse.v4)
                    logger.info(Bot_name + `已通过用户 ${user_id} 的好友申请`)
                }
                break
            /** 好友撤回消息 */
            case "private_message_delete":
                logger.info(Bot_name + "撤回消息：" + JSON.stringify(parse))
                break
            /** 群聊撤回消息 */
            case "group_message_delete":
                logger.info(Bot_name + "撤回消息：" + JSON.stringify(parse))
                break
            /** 好友接接收文件 */
            case "wx.get_private_file":
                logger.info(Bot_name + "收到文件：" + JSON.stringify(parse))
                break
            /** 群聊接收文件 */
            case "wx.get_private_file":
                logger.info(Bot_name + "收到文件：" + JSON.stringify(parse))
                break
            /** 好友收到红包 */
            case "wx.get_private_redbag":
                logger.info(Bot_name + "收到红包：" + JSON.stringify(parse))
                break
            /** 群聊收到红包 */
            case "wx.get_group_redbag":
                logger.info(Bot_name + "收到红包：" + JSON.stringify(parse))
                break
            /** 好友拍一拍 */
            case "wx.get_private_poke":
                logger.info(Bot_name + `好友消息：${parse.from_user_id} 拍了拍 ${user_id}`)
                /** 转换消息 交由云崽处理 */
                PluginsLoader.deal(await Yunzai.msg(parse))
                break
            /** 群聊拍一拍 */
            case "wx.get_group_poke":
                logger.info(Bot_name + `群消息：${parse.from_user_id} 拍了拍 ${user_id}`)
                /** 转换消息 交由云崽处理 */
                PluginsLoader.deal(await Yunzai.msg(parse))
                break
            /** 好友收到名片 */
            case "wx.get_private_card":
                logger.info(Bot_name + "收到名片：" + JSON.stringify(parse))
                break
            /** 群聊收到名片 */
            case "wx.get_group_card":
                logger.info(Bot_name + "收到名片：" + JSON.stringify(parse))
                break
            default:
                logger.info(Bot_name + "未知事件：" + JSON.stringify(parse))
                break
        }
    })

    // 监听关闭事件
    ws.on('close', () => {
        logger.error(Bot_name, "通知消息：连接已关闭")
        isConnected = false
    })
})

/** 加载一下插件到主体... */
let ret = await Promise.allSettled([import('./model/Yunzai.js')])
let apps = { Yunzai: ret[0].value[Object.keys(ret[0].value)[0]] }
export { apps }
