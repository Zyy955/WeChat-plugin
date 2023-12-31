import fs from "fs"
import Yaml from "yaml"

const _path = process.cwd() + "/plugins/WeChat-plugin/config.yaml"

/** 生成默认配置文件 */
if (!fs.existsSync(_path)) {
    fs.writeFileSync(_path, `# 端口\nport: 2955\n# 路径\npath: "/ComWeChat"\n# 是否自动同意加好友 1-同意 0-不处理\nautoFriend: 1\n# 自定义椰奶状态名称\nname: "PC-HOOK-微信Bot"`, 'utf8')
}

/** 兼容旧配置 */
let old_cfg = fs.readFileSync(_path, "utf8")
if (!old_cfg.match(RegExp("name:"))) {
    old_cfg = old_cfg + `\n# 自定义椰奶状态名称\nname: "PC-HOOK-微信Bot"`
    fs.writeFileSync(_path, old_cfg, "utf8")
}

/** 保存基本配置、插件版本、插件名称 */
const cfg = Yaml.parse(fs.readFileSync(_path, "utf8"))
const wx = JSON.parse(fs.readFileSync("./plugins/WeChat-plugin/package.json", "utf-8"))
WeChat.cfg = { ...WeChat, cfg: cfg, ver: wx.version, name: wx.name, _path: _path, bot: wx.CWeChatRobot }
