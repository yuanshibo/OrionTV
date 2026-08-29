# OrionTV M3U8 (HLS) 视频流去广告（AD）功能可行性分析与论证报告

## 1. 执行摘要 (Executive Summary)

本报告针对 **OrionTV** (基于 React Native / Expo 框架及 `expo-video` 播放内核) 引入 **HLS (M3U8) 视频流去广告（AD）功能** 进行深入的技术可行性分析与架构论证。

报告分析了 M3U8 广告切片的插入机制，对比了 Web 端（`Hls.js` Loader 拦截）与移动/电视原生端（Android ExoPlayer / iOS AVPlayer）的底层差异，提出了适合 OrionTV 架构的 **三大技术可行方案**，评估了潜在风险与优化路径，并给出了最终的技术落地方案与实施路线图。

**结论**：在 React Native (`expo-video`) 环境下，添加 M3U8 去广告功能在技术上**完全可行**。推荐采用 **后端服务端代理过滤（LunaTV Server Proxy）** 为主要方案，结合 **客户端 URL 路由切换与 UI 控制**，实现无缝、低延迟、高兼容度的去广告体验。

---

## 2. 去广告核心技术原理 (Core Filtering Principles)

### 2.1 HLS 协议与广告切片机制
在 HLS (HTTP Live Streaming) 协议中，视频内容被切分为多个小段（`.ts` 或 `.m4s` 文件），并由 `.m3u8` 文本清单文件索引。

很多网络视频平台或片源提供商在正片流中插入广告切片。由于广告切片的编码格式（如分辨率、码率、声道、PTS 时间戳）通常与正片不同，HLS 协议规定必须在属性突变处插入 `#EXT-X-DISCONTINUITY` 标签。

典型带有广告切片的 M3U8 结构如下：

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0

# 正片切片段
#EXTINF:9.000,
main_000.ts
#EXTINF:8.500,
main_001.ts

# 广告段开始 (属性不连续)
#EXT-X-DISCONTINUITY
#EXTINF:5.000,
ad_segment_01.ts
#EXTINF:5.000,
ad_segment_02.ts
#EXT-X-DISCONTINUITY
# 广告段结束，恢复正片

#EXTINF:9.200,
main_002.ts
```

### 2.2 基础清洗过滤算法
通过解析 M3U8 文本，定位 `#EXT-X-DISCONTINUITY` 标记块，将广告切片描述及对应 URL 彻底剔除，使播放器获取到的 M3U8 仅包含正片切片。

基础的单行过滤逻辑如下：
```typescript
function filterAdsFromM3U8(m3u8Content: string): string {
  if (!m3u8Content) return '';
  const lines = m3u8Content.split(/\r?\n/);
  const filteredLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 剔除包含 #EXT-X-DISCONTINUITY 的标记行
    if (!line.includes('#EXT-X-DISCONTINUITY')) {
      filteredLines.push(line);
    }
  }

  return filteredLines.join('\n');
}
```

---

## 3. 平台架构差异与技术瓶颈 (Web vs. Native Constraints)

在开发与移植去广告功能时，必须认清 **Web 浏览器环境** 与 **React Native 原生环境** 的技术壁垒：

| 维度 | Web 平台 (如 Hls.js / Artplayer) | React Native 平台 (OrionTV / expo-video) |
| :--- | :--- | :--- |
| **播放内核** | JavaScript (`Hls.js`) + HTML5 `<video>` | Android (`ExoPlayer`) / iOS (`AVPlayer`) |
| **网络请求层** | JS 运行时发起 (`fetch` / `XMLHttpRequest`) | 原生 C++/Java/Objective-C 层发起 |
| **Loader 拦截能力** | **完全支持**。可重写 `Hls.DefaultConfig.loader`，拦截 `manifest` & `level` 请求并修改内存文本 | **不支持直接 JS 拦截**。`expo-video` 仅接收视频 URL 地址，清单下载由原生 SDK 在后台处理 |
| **M3U8 篡改难度** | 极低（JS 回调中直接修改 `response.data`） | 中~高（需通过代理服务器、本地 HTTP 服务或 URL 重写） |

**关键结论**：在 OrionTV 中，**无法直接复用** Web 端基于 `Hls.js` 自定义 Loader 的模式，必须引入 **中间代理/拦截机制**，在 M3U8 交付给原生 `expo-video` 播放器之前完成文本清洗。

---

## 4. 可行性方案论证 (Feasibility Implementation Options)

针对 OrionTV 的架构，提出以下三种技术实现方案：

### 方案一：后端代理过滤接口（Server-side Proxy Filter - 强烈推荐）

#### 架构设计
OrionTV 与 Companion 项目 **LunaTV** 配合运行。在 LunaTV 后端增加 `/api/proxy/ad-free` 路由。

```
[OrionTV (expo-video)] ---> [LunaTV Backend (/api/proxy/ad-free?url=...)] ---> [原始 M3U8 源]
                              |-- 下载 M3U8 文本
                              |-- 清洗 #EXT-X-DISCONTINUITY & 广告切片
                              |-- 补全相对路径为绝对路径
                              |-- 返回清洗后的 M3U8 文本
```

#### 实现细节
1. **客户端（OrionTV）**：
   在 `stores/playerStore.ts` 或 `hooks/useVideoHandlers.ts` 中，当去广告功能开启时，将视频源 URL 进行包装：
   ```typescript
   const getPlayableUrl = (rawUrl: string, isAdBlockEnabled: boolean, baseUrl: string) => {
     if (!isAdBlockEnabled || !rawUrl.includes('.m3u8')) {
       return rawUrl;
     }
     return `${baseUrl}/api/proxy/ad-free?url=${encodeURIComponent(rawUrl)}`;
   };
   ```
2. **服务端（LunaTV）**：
   请求远程 M3U8，清洗文本，修复相对 URL（保证 `.ts` 切片能够正确定位），并返回 `application/vnd.apple.mpegurl` 类型响应。

#### 方案评估
* **优点**：
  * **客户端零算力开销**：Android TV / Fire TV 等低配设备无需额外解析大体积 M3U8。
  * **100% 兼容原生内核**：`expo-video` (ExoPlayer/AVPlayer) 仅感知到一个标准的 M3U8 URL。
  * **集中维护**：广告过滤规则更新时，仅需更新 LunaTV 服务端，无需更新客户端 APP。
* **缺点**：
  * 依赖 LunaTV 服务端的网络连通性与带宽。

---

### 方案二：应用内本地 TCP HTTP 代理（In-App Local TCP HTTP Proxy - 客户端闭环）

#### 架构设计
利用 OrionTV 中现有的 `TCPHttpServer` (`services/tcpHttpServer.ts`)，在应用启动时建立本地 HTTP 服务（如 `http://127.0.0.1:12346`）。

```
[expo-video] ---> [127.0.0.1:12346/ad-free-m3u8?url=...] ---> [TCPHttpServer (JS)] ---> [远程 M3U8]
```

#### 实现细节
在 `TCPHttpServer` 的 `requestHandler` 中捕获 `/ad-free-m3u8` 请求，使用 JS `fetch` 获取远端 M3U8，调用 `filterAdsFromM3U8` 过滤，再将结果输出给本地 Socket。

#### 方案评估
* **优点**：
  * 完全脱离 LunaTV 后端，实现离线/纯客户端闭环。
* **缺点**：
  * Android/iOS 原生 Socket 生命周期管理复杂（切后台容易断开）。
  * 移动端/电视端本地并发 Socket 性能及内存开销较大。

---

### 方案三：客户端预读取 + Data URI / 本地缓存文件（Pre-fetch Local File）

#### 架构设计
在播放前，JS 端先行 `fetch(m3u8Url)` 拿到文本，清洗后保存为本地文件 (`file:///.../cleaned.m3u8`) 或 Base64 Data URI，将本地路径传给 `expo-video`。

#### 方案评估
* **优点**：
  * 代码量小，逻辑直观。
* **缺点**：
  * **仅对单级 M3U8 生效**：若是 Master Playlist（多码率/清晰度层级播放列表），播放器请求 Level M3U8 时依然会发起远程原生请求，导致去广告失效。
  * iOS/Android 部分原生播放器对 Data URI 或 `file://` 协议中的相对路径 `.ts` 解析存在兼容性缺陷。

---

## 5. 算法优化与风险防范 (Algorithm Enhancements & Risk Mitigation)

仅粗暴删除 `#EXT-X-DISCONTINUITY` 单行标签存在较大风险，必须进行算法升级与健壮性处理：

### 5.1 潜在风险与副作用
1. **切片残留问题**：仅删 `#EXT-X-DISCONTINUITY` 标签，而保留了广告 `.ts` 切片的 `#EXTINF` 与 URL，播放器仍会播放广告切片，且可能因编码参数突变导致画面花屏或卡死。
2. **正片误删问题**：部分合法 M3U8 在正片多视角或码率切换时会正常使用 `#EXT-X-DISCONTINUITY`。若一刀切，会导致正片播放断流。
3. **相对路径失效**：M3U8 被代理后，清单中的相对路径切片（如 `segment_01.ts`）会相对代理服务器路径寻址，导致 404 错误。

### 5.2 进阶过滤算法设计 (Precise Block Filter)

建议采用 **基于不连续标记块 (Discontinuity Block Filter) & 正则表达式特征匹配** 的双重清洗算法：

```typescript
export function advancedFilterAdsFromM3U8(m3u8Content: string, targetUrl: string): string {
  if (!m3u8Content) return '';

  const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
  const lines = m3u8Content.split(/\r?\n/);
  const resultLines: string[] = [];

  let inDiscontinuityBlock = false;
  let currentBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    // 修复相对路径为绝对路径
    let processedLine = line;
    if (!line.startsWith('#') && !line.startsWith('http://') && !line.startsWith('https://')) {
      processedLine = new URL(line, baseUrl).toString();
    }

    if (processedLine.startsWith('#EXT-X-DISCONTINUITY')) {
      if (inDiscontinuityBlock) {
        // 结束前一个不连续块
        inDiscontinuityBlock = false;
        // 评估 currentBlockLines 是否为广告块（检查时长、关键词等）
        if (!isAdBlock(currentBlockLines)) {
          resultLines.push(...currentBlockLines);
        }
        currentBlockLines = [];
      } else {
        inDiscontinuityBlock = true;
        currentBlockLines.push(processedLine);
      }
      continue;
    }

    if (inDiscontinuityBlock) {
      currentBlockLines.push(processedLine);
    } else {
      resultLines.push(processedLine);
    }
  }

  return resultLines.join('\n');
}

function isAdBlock(lines: string[]): boolean {
  const blockText = lines.join('\n').toLowerCase();
  // 特征1: 块总时长较短 (通常广告切片在 5-30 秒)
  // 特征2: 包含常见广告域名/路径特征如 /ad/, /ads/, ad_segment 等
  if (blockText.includes('/ad/') || blockText.includes('ad_') || blockText.includes('advertisement')) {
    return true;
  }
  // 默认将 #EXT-X-DISCONTINUITY 包裹的异常片段判定为广告段过滤
  return true;
}
```

---

## 6. 最终落地实施路线图 (Implementation Roadmap)

### 第一阶段：后端代理能力建设 (LunaTV Backend)
1. 在 LunaTV 中新增 `/api/proxy/ad-free` 路由。
2. 实现 `advancedFilterAdsFromM3U8` 逻辑，处理 M3U8 抓取、广告块过滤及相对路径重写。

### 第二阶段：客户端配置与 UI 交互 (OrionTV Frontend)
1. **设置扩展**：在 `stores/settingsStore.ts` 与 `services/storage.ts` 中新增 `adBlockEnabled` 状态控制（默认推荐 `true`）。
2. **设置 UI**：在 `app/settings.tsx` 及 `components/settings/` 中增加“去广告”开关切换按钮。
3. **播放器对接**：在 `stores/playerStore.ts` 的 `loadVideo` 与 `useVideoHandlers.ts` 中，根据 `adBlockEnabled` 对 M3U8 URL 进行动态映射代理。

### 第三阶段：测试验证与容错回退
1. **单元测试**：针对各种复杂 M3U8 文本（包含主播表、相对路径、无广告标的 M3U8）编写 Jest 单元测试。
2. **容错机制**：当代理接口返回 HTTP 5xx 或解析失败时，自动降级并回退至原始 M3U8 播放，确保播放连续性。

---

## 7. 结论 (Conclusion)

在 React Native (`expo-video`) 架构下添加 HLS 去广告功能在**技术上完全可行**。通过 **后端 API 代理过滤 (LunaTV Proxy)** 的架构方案，不仅完美解决了原生播放器无法拦截 JS 回调的瓶颈，而且具备轻量、稳定、跨平台兼容性好的显著优势。
