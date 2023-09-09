import lodash from "lodash"
import cfg from "../../../lib/config/config.js"
import common from "../../../lib/common/common.js"
import PluginsLoader from "../../../lib/plugins/loader.js"

let _loader = {
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
                        if (val.qq == e.bot.uin || val.qq == e.uin) {
                            e.atBot = true
                        } else if (val.id == e.bot.tiny_id || val.id == e.uin) {
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
    /** 喵云崽 处理消息，加入自定义字段 */
    Yz_dealMsg(e) {
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
                        if (val.qq == Bot.uin || val.qq == e.uin) {
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
    Yz_reply(e) {
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
    Yz_checkBlack(e) {
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
    },
    /** 新转发消息 */
    async makeForwardMsg(e, msg = [], dec = '', msgsscr = false) {

        if (!Array.isArray(msg)) msg = [msg]

        let name = msgsscr ? e.sender.card || e.user_id : Bot.nickname
        let id = msgsscr ? e.user_id : Bot.uin

        if (e.isGroup) {
            try {
                let info = await e.bot.getGroupMemberInfo(e.group_id, id)
                name = info.card || info.nickname
            } catch (err) {
                logger.error(err.message)
            }
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
    }
}

/** 劫持修改主体一些基础处理方法 */
if (WeChat.Yz.name === "Miao-Yunzai") {
    /** 劫持回复方法 */
    PluginsLoader.reply = _loader.reply
    /** 劫持处理消息 */
    PluginsLoader.dealMsg = _loader.dealMsg
    /** 劫持黑白名单 */
    PluginsLoader.checkBlack = _loader.checkBlack
    /** 本体转发 */
    common.makeForwardMsg = async function (e, msg = [], dec = '', msgsscr = false) {
        return await _loader.makeForwardMsg(e, msg, dec, msgsscr)
    }
}
/** 对喵云崽的转发进行劫持修改，兼容最新的icqq转发 */
else {
    /** 劫持回复方法 */
    PluginsLoader.reply = _loader.Yz_reply
    /** 劫持处理消息 */
    PluginsLoader.dealMsg = _loader.Yz_dealMsg
    /** 劫持黑白名单 */
    PluginsLoader.checkBlack = _loader.Yz_checkBlack

    /** 本体转发 */
    common.makeForwardMsg = async function (e, msg = [], dec = '', msgsscr = false) {
        return await _loader.makeForwardMsg(e, msg, dec, msgsscr)
    }
    /** 日志 */
    const sendLog = (await import("../../other/sendLog.js")).sendLog
    sendLog.prototype.makeForwardMsg = async function (title, msg) {
        return await _loader.makeForwardMsg(this.e, [title, msg], title, false)
    }

    /** 更新日志 */
    const update = (await import("../../other/update.js")).update
    update.prototype.makeForwardMsg = async function (title, msg = [], dec = '', msgsscr = false) {
        return await _loader.makeForwardMsg(this.e, [title, msg], title, msgsscr)
    }

    /** 表情列表 */
    const add = (await import("../../system/add.js")).add
    add.prototype.makeForwardMsg = async function (qq, title, msg, end = '') {
        return await _loader.makeForwardMsg(this.e, [title, msg], title, false)
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
        msg = await _loader.makeForwardMsg(this.e, msg, title, false)

        await this.e.reply(msg)
    }
}