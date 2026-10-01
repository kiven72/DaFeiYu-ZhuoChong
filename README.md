# 大肥鱼离线桌宠 · Coopanion Offline

由 Codex 协助改造，并参考 [BongoCat](https://github.com/vladelaina/BongoCat) 的交互与轻量化思路。

Windows x64 离线桌宠，基于 [Pal-AI-Lab/Coopanion](https://github.com/Pal-AI-Lab/Coopanion) 改造。
无需账号、API Key、模型下载或联网服务；解压便携包即可使用。

![大肥鱼表情](docs/images/pet.png)

## 功能

- 大肥鱼 8 套配色，保留分层网格、头发与衣服弹簧动态。
- 单击戳戳、摸头、拖动拎起与抛掷、双击跳跃、右键列表菜单。
- 本地气泡台词、动态表情、跳跃、转圈、坐下、睡觉和音效。
- 可调整大小与走动程度，暂停、隐藏、托盘恢复及 Windows 登录自启动。
- 默认 WebGL2，随显示器刷新；不额外限制到 30/60 帧。实际帧率取决于硬件和显示器。
- 相同旋转参数和未变化的表情纹理复用，保留网格精度、mipmap 和采样质量。

当前没有右键轮盘；保持原有列表菜单。气泡为预设台词，不是 AI 对话。

## 下载与运行

发布者将 `Coopanion-Offline-0.1.9-win-x64.zip` 上传至仓库 **Releases**。
完整解压到有写入权限的目录，然后运行 `大肥鱼离线桌宠.exe`。
运行时不需要安装 Node.js，设置和缓存写入同目录的 `data/`。
右键 → 配色与习惯 → 习惯，可开关「开机自动启动」（登录 Windows 后运行）。
移动安装目录后，请在新目录重新设置自启动。

视频兼容模式：先从托盘退出当前桌宠，再双击 `视频兼容启动.cmd`。
它使用相对路径运行同目录 EXE；兼容模式可能低于默认 WebGL 的帧率。
退出并重新运行 EXE 即可恢复默认模式。

## 从源码运行

需要 Windows x64 和 Node.js **22.12 或更高版本**（建议 Node.js 24 LTS）。
首次安装开发依赖和 Electron 运行时需要网络，桌宠运行本身完全离线。

```powershell
npm ci
npm start
```

```powershell
npm run start:compatible
npm run check
npm run verify
npm run benchmark
```

## 构建便携 ZIP

```powershell
npm ci
npm run check
npm run build
npm run zip
```

输出在 `dist/Coopanion-Offline-Windows-x64/` 和 `dist/Coopanion-Offline-0.1.9-win-x64.zip`。
构建包含开机启动模块、设置界面、离线互动、验证脚本、模型和图标。
打包脚本自动排除运行后的 `data/` 与测试生成的 `test-data/`，不把个人偏好和缓存放入 ZIP。
输出目录已存在时构建会停止，请备份或移走旧输出再重建。
已有 Electron 运行时可用 `node scripts/build.mjs --runtime "完整运行时目录"` 构建。

```powershell
node scripts/verify.cjs --exe "dist/Coopanion-Offline-Windows-x64/大肥鱼离线桌宠.exe"
```

功能验证在独立的 `test-data/` 中运行，不改正常使用的偏好。
`npm run verify:startup` 需在打包版使用 `--exe` 才支持原生自启动写入测试，测试使用独立名称并自动清理；无需为日常构建运行此项。

## 上传到 GitHub

仓库上传本目录源码；便携 ZIP 上传 **Releases 附件**，不提交 EXE、DLL 或 ZIP 到代码仓库。
`.gitignore` 已排除运行时、依赖、构建产物、个人设置、缓存和日志。
可解压源码 ZIP 后上传其中的文件，或在 GitHub 新建空仓库后执行：

```powershell
git init -b main
git add .
git commit -m "Initial offline desktop pet release"
git remote add origin https://github.com/YOUR_USERNAME/Coopanion-Offline.git
git push -u origin main
```

把占位仓库地址换成自己的地址。GitHub 普通仓库禁止超过 100 MiB 的单文件，浏览器上传单文件上限为 25 MiB；便携包通过 Releases 分发。
来源：[GitHub 文件大小说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)。

## 结构

| 路径 | 用途 |
|---|---|
| `main.cjs` / `preload.cjs` | Electron 窗口、托盘与受限本地通信 |
| `autostart.cjs` / `preferences.cjs` | 登录自启动与偏好 |
| `web/` / `icons/` | 动画、互动、设置、模型贴图与图标 |
| `scripts/` | 检查、构建、打包和功能验证 |
| `self-test-*.cjs` | 功能、帧率与自启动检查 |

## 验证与限制

本快照的核心运行文件来自当前安装版，清晰度、动画核心与互动方式保持一致。
省电优化此前通过 821 组逐像素对比和 15 项功能检查，测试显示约 120 帧（测试显示器为 120 Hz）。
未测量电池耗电瓦数，不能将渲染耗时降幅当作整机耗电降幅。
视频播放器兼容性需在实际播放中确认；未进行 Windows 注销/重启自启动实测。
程序未作代码签名。

## 许可证与来源

MIT，保留原作者版权。详见 [LICENSE](LICENSE)、[第三方声明](THIRD_PARTY_NOTICES.md) 与 [修改记录](CHANGELOG.md)。
角色来源及商标说明也保存在第三方声明中。本版本与原项目及配色对应公司均无官方关联。
