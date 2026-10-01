# 第三方声明

这个包依赖 sherpa-onnx 的 Node 插件,不带模型和 Electron。下面是随包安装的原生组件、运行时会去取的东西,以及各自的许可。

## 识别运行库

[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 的 Node 插件 `sherpa-onnx-node` 1.13.8 与各平台的
预编译包(`sherpa-onnx-win-x64`、`sherpa-onnx-darwin-arm64`、`sherpa-onnx-darwin-x64` 等),随 npm 依赖安装。
Apache-2.0;其中的 onnxruntime 为 MIT。

## 模型

FunASR 的 SenseVoiceSmall(FunAudioLLM,通义实验室)经 k2-fsa 转成 sherpa-onnx 用的 int8 ONNX,
放在 `<模型根>/desktop-pet/sensevoice-small-int8-2024-07-17/`,按固定的 SHA-256 校验。

| 文件 | 来源(按顺序尝试) | 许可 |
|---|---|---|
| `model.int8.onnx`、`tokens.txt` | [ModelScope pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue](https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue),再 [Hugging Face csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17](https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17) | [FunASR 模型开源协议](https://github.com/modelscope/FunASR/blob/main/MODEL_LICENSE) |

## 桌宠窗口

Electron 44.4.4,从 [electron/electron releases](https://github.com/electron/electron/releases/tag/v44.4.4)
取到 `<运行时根>/electron/44.4.4/`,或使用内嵌应用自带的那份。MIT;其中 Chromium 与依赖各随其许可。

## DeepSeek 大肥鱼形象

`web/whale/` 的贴图由 ChatGPT(OpenAI 的图像模型)按参考图生成后拆件:角色原设为「溟月」(上善无形),
DeepSeek 女仆装二创参考 ZipZipPipe。围裙上的标志是 DeepSeek、OpenAI、Anthropic(Claude)、Google(Gemini)、
阿里云(通义千问)、月之暗面(Kimi)、MiniMax 的商标图形,归各自的公司所有,只用来标明配色对应哪一家,
与这些公司没有关联,也不代表其认可。

## 其他运行时依赖

- `ws`:MIT
- `opencc-js`(繁简转换):MIT AND Apache-2.0

## 本包的许可

MIT,见 [`LICENSE`](LICENSE)。
