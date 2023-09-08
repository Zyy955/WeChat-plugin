import fs from "fs"
import Yaml from "yaml"

/** 全局变量WeChat */
global.WeChat = {
    ws: {},
    group: {},
    config: {},
    BotCfg: {},
    Yz: {}
}

/** 加载Yz名称、版本 WeChat名称、版本 */
const Yz = JSON.parse(fs.readFileSync("./package.json", "utf-8"))
const Wx = JSON.parse(fs.readFileSync("./plugins/WeChat-plugin/package.json", "utf-8"))
WeChat.Yz = {
    name: Yz.name,
    version: Yz.version,
    Wx_name: Wx.name,
    Wx_version: Wx.version
}


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