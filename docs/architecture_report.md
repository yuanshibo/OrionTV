# OrionTV 技术架构分析报告与优化建议

## 1. 整体技术架构总结

OrionTV 采用了一套高度工程化且解耦的 **View-Store-Service-Infrastructure** 四层架构，专为大屏 TV 端优化，同时兼顾移动端。

### 1.1 分层架构
- **View Layer**: 采用 `Expo Router` 进行路由管理。通过 `useResponsiveLayout` 钩子实现 **Mobile/Tablet/TV** 三端样式与交互的动态适配。组件层面实现了高度的平台原子化（如 `VideoCard.tv.tsx` vs `VideoCard.mobile.tsx`）。
- **Store Layer (Zustand)**: 状态管理极为细腻，将焦点（`focusStore`）、播放状态（`playerStore`）、首页数据（`homeDataStore`）等原子化，避免了全量组件重绘。
- **Service Layer**: 
  - **API**: 封装了自定义 `fetch` 逻辑，支持动态 `BaseURL` 与网络状态重放。
  - **持久化**: `storage.ts` 实现了本地 `AsyncStorage` 与远端 Redis/API 的无缝切换。
  - **交互增强**: `remoteControlService` 通过内置 HTTP Server 解决了 TV 输入法难用的痛点。
- **Infrastructure (Utils)**: 提供 `tvUtils`（焦点脉冲控制）、`Logger`（结构化日志）及响应式样式计算。

### 1.2 核心技术亮点
- **焦点控制脉冲**: 通过原生 `setNativeProps` 与 `requestAnimationFrame` 解决 TVOS 焦点粘滞问题。
- **并发预取与切源**: 在播放异常时具备分辨率感知的自动切源能力。
- **渐进式加载**: 支持根据历史播放权重优先加载源。

---

## 2. 深度优化方案建议

基于对现有代码库的分析，提出以下进一步提升性能与用户体验的优化方案：

### 2.1 性能优化 (Performance)
- **FlashList 稳定性增强**:
  - `ContentDisplay` 中的 `renderContentItem` 虽然使用了 `useCallback`，但 `VideoCard` 内部仍可能因 `style` 对象的微小变化重绘。建议在 `VideoCard` 内部实现更严格的 `React.memo` 比较函数，或移除不必要的动态 Style 嵌套。
- **图像加载与预取 (expo-image)**:
  - 当前瀑布流加载时，虽有基础缓存，但建议实施“视口感知预取”。在用户快速滚动 FlashList 时，利用 `onScroll` 事件提前触发下一屏图片的预加载（Prefetching）。
- **背景模糊性能**:
  - `DynamicBackground` 的模糊滤镜在低端 Android TV 盒子上极轻微导致丢帧。建议在 `DeviceUtils` 中根据设备性能等级（Performance Level）自动切换模糊半径或使用预生成的低像素模糊位图。

### 2.2 交互与焦点体验 (Interaction)
- **Leanback 自动模式**: 
  - 增加全屏“静默模式”。当用户在播放页或首页无操作超过 10 秒，自动隐藏非核心 UI 元素，仅保留最简背景或视频内容。
- **跨设备同步优化**:
  - 完善 `remoteControlService`。目前支持文本发送，建议扩展支持“一键投屏”配置，或在手机端操作详情页，电视端同步跳转。

### 2.3 健壮性与架构 (Architectural)
- **API 中间件拦截器**:
  - 考虑引入 `axios` 或完善 `API` 类的拦截器机制。统一处理全局令牌（Token）过期、自动重试逻辑（针对 Status 0 错误）及请求日志审计。
- **更精细的错误恢复路径**:
  - 针对 `ErrorService` 定义的异常，可以建立更细粒度的“自动修复动作集”。例如，检测到特定 SSL 错误时，不仅是切源，还可以尝试降低分辨率或切换播放协议（HLS -> Dash）。

### 2.4 测试与质量 (QA)
- **视觉回归自动化**:
  - 鉴于三端适配的复杂性，建议引入截图测试（Snapshot Testing）专门用于校验 TV 端的焦点框样式在不同分辨率下的对齐情况。
