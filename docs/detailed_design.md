# OrionTV 详细设计文档 (终极全量版)

## 1. 项目概述
OrionTV 是一个专为大屏电视（TVOS/Android TV）设计的高性能视频播放器应用。基于 React Native TVOS 和 Expo 构建，旨在通过精细化的焦点管理、多级缓存架构和响应式布局，在嵌入式硬件上实现媲美原生应用的流畅体验。

---

## 2. 系统核心架构

### 2.1 逻辑分层
- **View Layer**: 基于 React 组件和 `useResponsiveLayout` 钩子，实现 TV、手机、平板的三端适配。
- **Store Layer (Zustand)**: 原子化状态管理（`focusStore`, `playerStore`, `homeDataStore`, `detailStore` 等），确保状态变化的可预测性。
- **Service Layer**: 核心业务基石，包括 `HomeService`（数据转换）、`ContentCacheService`（缓存算法）、`ErrorService`（异常监控）。
- **Infrastructure**: 底层工具集，包括 `tvUtils`（焦点脉冲）、`Logger`（结构化日志）及协议适配。

---

## 3. 全局画面交互设计 (Global Interaction Design)

### 3.1 首页焦点调度 (Home Screen)
- **垂直锚点与导航**: 分类栏通过 `buttonRefs` 实现精准聚焦。从导航切换到瀑布流时，焦点自动锁定首项。
- **弹窗恢复机制**: 关闭筛选面板（`FilterPanel`）后，通过 `focusTrigger` 强制将焦点归还给对应的分类按钮，防止消失后焦点掉入“黑洞”。
- **双击返回逻辑**: 在首页非顶部时，返回键执行“平滑回顶”；在首页顶部时，2 秒内连按两次执行“安全退出”。

### 3.2 详情页动态路径 (Detail Screen)
- **路径记忆 (Target Tagging)**: 当用户在源列表（Source）与剧集列表（Episode）之间纵向切换时，系统记录 `targetEpisodeTag`。再次向下移动时，焦点会精确回到用户上次选中的剧集，而非重置到第一集。
- **分段器联动**: 选集范围切换后，利用 `scrollToIndex` 和动画帧回调，实现焦点的即时视觉对齐。

---

## 4. 播放器焦点交互设计 (Player Focus Logic)

### 4.1 初始着陆与面板激活
- **优先级锁定**: 进入播放页即设为 `FocusPriority.MODAL`，拦截全局非播放相关的遥控输入。
- **动态锚点**: 呼出播放控制条时，播放按钮（Play/Pause）利用 `hasTVPreferredFocus` 作为首选焦点对齐点。

### 4.2 智能返回层次
1. 关闭详情/选集/倍速浮层。
2. 隐藏播放器控制工具条。
3. 退出播放器并同步进度到本地。

---

## 5. 交互动作详细设计 (Detailed Interaction Actions)

### 5.1 遥控器原生按键映射 (Remote Mapping)
- **上键 (UP)**: 呼出视频元数据（详情）视图。
- **下键 (DOWN)**: 呼出播放控制条。
- **确认键 (SELECT)**: 切换播放/暂停状态。
- **左右键**: 触发快进/快退。

### 5.2 阶梯式加速快进 (Accelerated Seeking)
- **长按加速**: 左右键长按触发步长递增逻辑。
- **递增算法**: 从 20s 起步，每 200ms 以 1.2x 速率阶梯加速，封顶 5 分钟/跳。按键抬起后步长归位。

---

## 6. 核心逻辑实现深度总结

### 6.1 高性能存储与预取
- **双级缓存架构**: L1 内存 Map 实现即时读写，L2 AsyncStorage 实现持久化。
- **LRU 修剪**: 当缓存条目超过预设阈值时，`ContentCacheService` 根据 `timestamp` 自动剔除过期记录。
- **并发预取**: 进入特定分类时，系统受控地启动并发预取队列，提前填充缓存。

### 6.2 渐进式初始化与智能切源
- **Progressive Loading**: 详情页优先加载最近观看的源，若历史失效，则依序并发获取其他源并合并去重。
- **Fallback 策略**: 播放异常时，系统自动根据分辨率（1080p > 720p > ...）权值排序，寻找下一个可用源进行静默切换。

### 6.3 焦点脉冲机制 (tvUtils)
- **逻辑**: 通过 `requestTVFocus` 封装原生 `setNativeProps`。利用 `requestAnimationFrame` 发送一个微小的状态脉冲（True -> False），强制 TVOS 原生渲染引擎刷新焦点导航树，解决焦点“粘滞”或失效问题。

---

## 7. 基础设施与辅助系统
- **远程控制 (Remote Input)**: 针对 TV 端输入文字难的问题，App 内置微型服务器支持手机扫码远程同步输入字符。
- **自动更新系统**: 集成 `UpdateStore` 实现版本静默探测、强制更新阻断或推荐更新。
- **错误容灾**: 统一的 `ErrorService` 捕获 SSL/403 等流媒体协议错误，并翻译为友好的用户端提示。
