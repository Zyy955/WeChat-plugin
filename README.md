QQ交流群~欢迎加入：`884587317`

- 如果您对这个项目感到满意并认为它对你有所帮助，请给我一个`Star`！

- 您的认可是我持续更新的动力~非常感谢您的支持！

微信应用端只支持在`Windows`环境运行，`Yunzai-Bot`没有要求

![Visitor Count](https://profile-counter.glitch.me/Zyy955-WeChat-plugin/count.svg)

咕咕咕~：
- [√] 基础消息收发
- [√] 消息转发 
- [√] 好友消息
- [√] 好友申请
- [√] 拍一拍
- [√] 支持喵喵维护版`云崽` => `喵云崽`
  - [√] 劫持`喵云崽`本体所有转发消息，使所有转发消息可正常发送

# 使用必读

插件是根据`Miao-Yunzai`进行开发，兼容`喵喵`维护的`Yunzai-Bot`。

由于`Yunzai-Bot`结构不一致，许多地方并未进行适配，出现bug是正常现象，有问题请反馈，我尽量解决~

应用端和云崽都可以单独启动，并没有必须先启动谁的说法

应用端显示`远程计算机拒绝访问`是因为云崽这边没有启动或者没有安装插件。

应用端的作用是收发消息，但是并不处理消息。

云崽的作用是将应用端发送过来的消息进行处理，并进行对应的回复，二者属于依赖关系，本插件的作用是起一个桥梁作用。


#### 可选安装

在`Yunzai`根目录执行，可更改启动命令为`node apps`来跳过登录QQ直接使用微信机器人，不影响原先的`node app`
```
curl -o "./apps.js" "https://gitee.com/Zyy955/Yunzai-Bot-plugin/raw/main/apps.js"
```

## 1.安装插件

在`Yunzai-Bot`根目录执行，任选其一

Gitee：
```
git clone --depth 1 https://gitee.com/Zyy955/WeChat-plugin ./plugins/WeChat-plugin && pnpm install -P
```

Github：
```
git clone --depth 1 https://github.com/Zyy955/WeChat-plugin ./plugins/WeChat-plugin && pnpm install -P
```

安装好插件，可以进行启动云崽，你也可以在应用端配置完毕后启动云崽。

## 2.应用端安装

#### 2.1 下载微信
仅支持`3.7.0.30`版本

如果担心和电脑现有的高版本冲突可在下载安装包之后`直接解压exe安装包`，运行`WeChat.exe`即可

```
https://ghproxy.com/https://github.com/tom-snow/wechat-windows-versions/releases/download/v3.7.0.30/WeChatSetup-3.7.0.30.exe
```

#### 2.2 下载禁用更新补丁

下载后启动禁用即可

```
https://cup.lanzoui.com/pcwxnoupdate
```

#### 2.3 下载微信机器人应用端
```
https://ghproxy.com/https://github.com/JustUndertaker/ComWeChatBotClient/releases/download/v0.0.8/ComWeChat-Client-v0.0.8.zip
```
#### 2.4 配置机器人应用端

请严格按照我所给出的配置进行修改！

解压`ComWeChat-Client-v0.0.8.zip`

使用记事本打开`.env`文件，需要修改两个配置
```
websocekt_type = "Unable"
修改为
websocekt_type = "Backward"


websocket_url = ["ws://127.0.0.1:8080/onebot/v12/ws/"]
修改为
websocket_url = ["ws://localhost:2955/ComWeChat"]

可选：
如果经常发生连接已关闭，请增加缓冲区大小
# 反向 WebSocket 的缓冲区大小，单位(Mb)
websocket_buffer_size = 4

```
修改完成保存


#### 2.5 运行`install.bat`

注：如运行`install.bat`报错，如下：
![报错](https://user-images.githubusercontent.com/74231782/230714709-95faea89-ac18-44fb-a704-fb114c675800.png)

请安装[vc_redist.x86](https://download.microsoft.com/download/6/D/F/6DF3FF94-F7F9-4F0B-838C-A328D1A7D0EE/vc_redist.x86.exe)

#### 2.6 启动应用端

运行`ComWeChat-Client-v0.0.8.exe`随后登录你的微信小号即可

## 更新插件
```
#微信插件更新
#微信插件强制更新
#微信更新日志
```

## 设置主人

- 使用方法
  - 方法1：发送`#设置主人`，随后复制发送控制台的验证码即可成为主人
  - 方法2：发送`#设置主人@用户`，需要你是主人的情况下，指定此用户成为主人

#### 好友申请

默认自动通过好友申请，如果关闭请前往配置修改`plugins/WeChat-plugin/config.yaml`

## 爱发电

![爱发电](https://cdn.jsdelivr.net/gh/Zyy955/imgs/img/202308271209508.jpeg)


## 鸣谢

| 名称 | 作者 | GitHub | Gitee | 备注  | 
|------| ---- | ------ | ----- | ----- | 
| ComWeChatBotClient | [@那个小白白白](https://github.com/JustUndertaker) | [☞GitHub](https://github.com/JustUndertaker/ComWeChatBotClient) | ----- | 微信机器人应用端 |
| Yunzai-Bot | [@Le-niao](https://gitee.com/Le-niao) | [☞GitHub](https://github.com/Le-niao/Yunzai-Bot) | [☞Gitee](https://gitee.com/Le-niao/Yunzai-Bot) | 原版 Yunzai |
| Yunzai-Bot | [@Le-niao](https://gitee.com/Le-niao) | [☞GitHub](https://github.com/Le-niao/Yunzai-Bot) | [☞Gitee](https://gitee.com/Le-niao/Yunzai-Bot) | 原版 Yunzai |
| Yunzai-Bot | [@喵喵](https://gitee.com/yoimiya-kokomi) | [☞GitHub](https://github.com/yoimiya-kokomi/Yunzai-Bot) | [☞Gitee](https://gitee.com/yoimiya-kokomi/Yunzai-Bot) | 喵喵维护版 Yunzai |
| Miao-Yunzai | [@喵喵](https://gitee.com/yoimiya-kokomi) | [☞GitHub](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [☞Gitee](https://gitee.com/yoimiya-kokomi/Miao-Yunzai) | 喵版 Yunzai |
| Yunzai-Bot 索引库 | [@渔火Arcadia](https://gitee.com/yhArcadia) | [☞GitHub](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [☞Gitee](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index) | 云崽相关内容索引库 |

## 免责声明：
使用此插件产生的一切后果与本人均无关

请不要用于任何商业性行为

插件所有资源都来自互联网，侵删
