# 📷 拍立得照相馆 · Polaroid Booth

一个在浏览器里运行的**拟物拍立得相机**。打开摄像头，连拍几张，选相纸、配胶片、贴贴纸，最后导出成一张真正能打印的相纸。

**在线体验 →** https://jinferth.github.io/polaroid-booth/

> 照片全程在你自己的浏览器里处理，**不会上传到任何服务器**。

---

## ✨ 功能

### 相机

- **10 款机身**，来自真实机型的结构复刻：
  - **Instax Mini 12** — 圆润机身、扭转镜头开关机、圆形快门
  - **Instax Mini Evo** — 双拨盘（镜头效果 × 胶片模拟），方正的复古机身
  - **Polaroid SX-70** — 矮长折叠比例、顶部闪光插槽、底部双调轮
  - **Polaroid OneStep 600** — 方块机身 + 经典彩虹条纹
  - 另有 X100 风格旁轴，以及银黑 / 全黑 / 奶油白 / 樱粉 / 薄荷绿 / 奶油黄 / 透明壳 / 军绿 / 酒红 / 天空蓝等配色
- 4 种材质表现（金属 / 高光 / 哑光 / 半透明），不只是换色
- 点镜头开关机、按快门连拍、相纸从顶部滑出并**从灰白慢慢显影**
- 快门音效由 Web Audio 实时合成，无需音频文件
- **机身绑定默认胶片模拟**——选酒红皮革自动切到 VELVIA

### 胶片模拟

13 种富士胶片模拟，**逐像素真实调色**（分通道色调曲线 → 分离调色 → 亮度锚定饱和度 → 褪色 → 黑白转换 → 胶片颗粒）：

`PROVIA` `VELVIA` `ASTIA` `CLASSIC CHROME` `PRO NEG STD/HI` `ETERNA` `CLASSIC NEG` `NOSTALGIC NEG` `ACROS（含黄/红滤片）` `MONOCHROME`

另有 10 种镜头效果（暗角 / 柔焦 / 鱼眼 / 色散 / 漏光 / 重曝…），可与胶片模拟自由组合。

### 相纸

20 种相纸设计，**版式与花色两个维度独立组合**：

- 花色：彩虹、柔彩、樱花、日落、海洋、格子、圆点、星星、彩屑、方格、糖果、经典白、暗房黑、报纸灰、牛皮纸…
- 版式：竖条叠压、接触印相表、主片 + 胶片条、35mm 齿孔条、单张大相纸、双联、杂志拼贴
- **零裁切**：每个照片窗口按照片自身比例生成，竖图给竖窗，绝不把脸裁掉
- **自动匹配**：按照片数量与宽高比自动选款，也可手动指定

### 编辑与导出

- 手写留言 + 日期戳
- 贴纸：2026 热点梗包（背背负鼠 / 哭哭马 / 不烧心 / 雪山狐狸 / 打工人），支持拖拽、缩放、旋转；文字贴纸是描边气泡样式
- **高清导出**：标准 380px / 高清 760px / 超清 1140px，离屏重绘而非放大
- 相册持久化到 localStorage，支持**导出备份 / 导入恢复**（合并或覆盖）

---

## 🛠 技术栈

- [Vite](https://vite.dev) + [React 18](https://react.dev) + [TypeScript](https://www.typescriptlang.org)（strict）
- [Tailwind CSS v4](https://tailwindcss.com)（`@tailwindcss/vite`）
- 渲染全部基于原生 **Canvas 2D**，无图片素材：相机机身、相纸花纹、胶片颗粒都是程序化绘制
- [Vitest](https://vitest.dev) + jsdom，**94 个单元测试**

## 🚀 本地运行

```bash
pnpm install
pnpm dev        # http://127.0.0.1:5173
```

> 摄像头需要 **HTTPS 或 localhost** 才能使用。直接用 `file://` 打开是不行的。

### 可用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 类型检查 + 生产构建到 `dist/` |
| `pnpm preview` | 预览生产构建 |
| `pnpm test` | 运行单元测试 |
| `pnpm typecheck` | 仅做类型检查 |

## 📁 目录结构

```
src/
  components/     # UI：相机外壳、机身陈列、显影室、相册、贴纸图层
  hooks/          # useCamera / useCountdown / useShutter
  lib/
    bodies.ts     # 10 款机身的配色与结构族
    fuji.ts       # 13 种胶片模拟 + 10 种镜头效果
    layouts.ts    # 20 种相纸：花色、版式、自动选款、零裁切几何
    polaroid.ts   # 相纸渲染器
    stickers.ts   # 贴纸目录与绘制
    backup.ts     # 相册备份的序列化与合并
  camera-shell.css   # 拟物机身的 CSS 渐变
  camera-shapes.css  # 四种结构族的结构差异
tests/            # Vitest 单元测试
```

## 🧪 测试

```bash
pnpm test
```

覆盖布局几何（**零裁切保证**、边界不出框）、胶片色彩特征、贴纸尺寸契约、备份序列化与合并逻辑。

## 📄 License

[MIT](./LICENSE)
