# 署名与版权说明

## 作者

药理闯关 · 红烧肉大王TCA

## 题库内容

- 药物分组与 186 种药物：依据课程讲义《药理学 186 种药物｜按“药物组”分组记忆》整理。
- 单药考点、同类药物辨析（第二批）、病例：按通用教科书整理，与讲义不一致时以讲义为准。
- 公开发布前，请确认讲义 / 教材内容允许公开使用。

## 背景音乐

所有曲目都由程序实时合成（Web Audio），不含录音文件。旋律来源：

| 曲目 | 来源 | 公开发布 |
|---|---|---|
| 茉莉花、茉莉花 · 钢琴 | 中国民歌（公有领域） | 可以 |
| 白大褂 Lo-fi、急诊室 8-bit、药房爵士、考前冥想、夜班 Synthwave、查房 Bossa、冲刺 House、雨夜自习 Piano、古琴 · 山水、江南、国风 · 侠客行、西安 · 长安城、开封 · 汴京、杭州 · 临安、成都 · 锦官城、重庆 · 渝州、上海 · 松江 | 本项目程序原创编配（曲名只是风格命名） | 可以 |



## 第三方工具

- [esbuild](https://esbuild.github.io)（MIT）：打包
- [acorn](https://github.com/acornjs/acorn)、[eslint-scope](https://github.com/eslint/js)（MIT / BSD-2）：仅用于当初拆分模块的工具
- 字体：JetBrains Mono、Noto Sans SC 等通过 Google Fonts 加载（SIL Open Font License）

## 摇滚医生的乐器采样（CC0 1.0）

摇滚医生用到的真实乐器采样来自 Karoryfer Samples 的开源采样库（经 sfzinstruments 发布在 GitHub），许可均为 CC0 1.0（公有领域，可以免费使用、修改、分发，不要求署名）。软件里只取了其中一小部分单发音，做了截短、混合近 / 远话筒、归一化和降采样，存在 `src/music/samples.js`：

- 鼓：[karoryfer.big-rusty-drums](https://github.com/sfzinstruments/karoryfer.big-rusty-drums)
- 电吉他：[karoryfer.black-and-green-guitars](https://github.com/sfzinstruments/karoryfer.black-and-green-guitars)
- 电贝斯：[karoryfer.black-and-blue-basses](https://github.com/sfzinstruments/karoryfer.black-and-blue-basses)

摇滚医生的三首曲子（复苏、强心剂、电除颤）为本项目原创，用代码合成并调用上面的采样。
