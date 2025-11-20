# 播放器架构深度分析与优化建议报告

## 1. 架构概览 (Architecture Overview)

当前播放器采用 **"Controller-Store-View"** 模式：
*   **Controller (`app/play.tsx`):** 作为入口容器，负责生命周期管理、路由参数解析、以及挂载各个子组件（视图、模态框）。它通过 Hooks 将逻辑粘合在一起。
*   **Store (`stores/playerStore.ts`):** 采用 Zustand 的单一数据源（Single Source of Truth）。它是整个播放器的核心，承担了状态管理（Play/Pause, Loading）、业务逻辑（自动连播、源切换）和数据持久化（播放记录）。
*   **View (`components/PlayerView.tsx` 等):** 负责纯 UI 渲染。通过 `expo-video` 进行视频渲染，并根据设备类型 (`deviceType`) 响应式调整布局。
*   **Interaction (`hooks/useTVRemoteHandler.ts`):** 专门针对 TV 端的遥控器按键进行拦截和处理。

---

## 2. 深度分析 (Detailed Analysis)

### 2.1 状态管理 (`stores/playerStore.ts`)
*   **现状:** `playerStore` 是一个“上帝对象 (God Object)”。它混合了三种不同性质的状态：
    1.  **瞬时播放状态:** `positionMillis`, `isPlaying`, `isBuffering` (高频更新)。
    2.  **UI 交互状态:** `showControls`, `showDetails`, `showEpisodeModal`。
    3.  **持久化数据:** `episodes` 列表, `introEndTime`, `playbackRate`。
*   **问题:**
    *   **性能隐患:** `handlePlaybackStatusUpdate` 每 500ms 触发一次。虽然 Zustand 只有在 selector 变化时才触发组件重渲染，但 store 内部的计算逻辑在每次回调中都会执行。该函数内部包含大量 `if/else` 判断（自动跳过片头、自动连播、记录保存），逻辑极其复杂且耦合。
    *   **耦合过重:** 播放器 store 直接依赖 `detailStore` 来获取数据和处理源回退。

### 2.2 TV 端交互体验 (`hooks/useTVRemoteHandler.ts`)
*   **现状:** 采用“模态框守卫 (Modal Guard)”模式。当 `showDetails` 或其他模态框打开时，它会屏蔽除了 `backPress` 以外的所有自定义按键事件。
*   **优点:** 有效防止了在模态框打开时，遥控器误触导致底层视频快进/暂停。
*   **风险:**
    *   **焦点丢失:** 当 `showControls` 隐藏时，按 `Up` 键显示详情页。代码中没有明确的“焦点恢复”逻辑。如果用户关闭详情页，焦点是否能准确回到之前的状态（或默认焦点）依赖于原生行为，这在 Android TV 上往往不可靠。
    *   **按键冲突:** `useTVEventHandler` 监听的是全局事件。虽然目前的逻辑是“不拦截原生焦点移动”，但在某些极端情况下（如模态框动画过程中），可能会导致操作不跟手。

### 2.3 稳定性与生命周期 (`play.tsx` & `usePlayerLifecycle.ts`)
*   **BackHandler 竞态:**
    *   `usePlayerLifecycle.ts` 注册了一个 `hardwareBackPress` 监听器。
    *   `app/play.tsx` 内部也注册了一个 `hardwareBackPress` 监听器。
    *   **风险:** React Native 的 BackHandler 遵循“后注册先执行 (LIFO)”原则。由于 `useEffect` 执行顺序的不确定性（依赖于子组件挂载顺序），可能导致两个监听器的执行顺序不可控，从而产生 Bug（例如：本该关闭模态框，结果直接退出了页面）。
*   **错误处理:** `useVideoHandlers` 中的错误检测基于字符串匹配 (`ERROR_SIGNATURES`)。这是一种脆弱的实现方式，如果底层报错信息变更，错误处理就会失效。

---

## 3. 优化建议清单 (Optimization Suggestions)

### 优先级 1：性能优化 (Performance)

1.  **拆分 `handlePlaybackStatusUpdate` 逻辑 (Critical):**
    *   目前该函数在每次时间更新（500ms）时都会执行大量逻辑检查。
    *   **建议:** 将“高频”逻辑（进度条更新）与“低频”逻辑（自动连播检查、播放记录保存）分离。
    *   **方案:** 使用 `useMemo` 或在 Store 内部引入 `Ref` 记录上一次的检查时间/状态，仅在状态发生**实质性变更**（如 `Math.floor(position)` 改变）时才执行复杂逻辑。

2.  **优化 Zustand Selector:**
    *   在 `app/play.tsx` 中，使用了大量的独立 Selector hook (e.g., `const status = usePlayerStore(s => s.status)`).
    *   **建议:** 使用 `useShallow` (Zustand 中间件) 或手动合并 Selector，减少 Hook 的调用次数，尽管 Zustand 自身有优化，但减少订阅数依然有益。

### 优先级 2：可维护性 (Maintainability)

3.  **Store 拆分 (Refactoring):**
    *   `playerStore` 过于臃肿。
    *   **建议:** 将 UI 状态拆分到独立的 `playerUIStore`，或者在 store 内部使用 Slice 模式。至少应将“模态框可见性”相关的逻辑提取出来，让 `playerStore` 专注于视频播放核心逻辑。

4.  **统一 BackHandler 管理:**
    *   **建议:** 移除 `play.tsx` 中的 `BackHandler` 监听，将其逻辑完全整合进 `usePlayerLifecycle`。或者创建一个专门的 `usePlayerBackHandler` hook，集中处理优先级逻辑（Related -> Details -> Controls -> Exit）。

### 优先级 3：TV 体验增强 (TV Experience)

5.  **显式焦点管理 (Focus Management):**
    *   **建议:** 在 `play.tsx` 中引入 `Ref` 指向主播放器容器。当模态框关闭时，使用 `utils/tvUtils.ts` 中的 `requestTVFocus` 强制将焦点归还给播放器或“显示控件”按钮。这能解决“关闭侧边栏后焦点丢失”的常见 TV Bug。

6.  **优化遥控器长按体验:**
    *   目前的长按快进逻辑使用了 `setInterval`。
    *   **建议:** 增加“加速度”逻辑。即按住时间越久，快进跨度越大（从 10s -> 30s -> 60s），提升长视频的定位效率。

### 优先级 4：功能与稳定性 (Stability)

7.  **健壮的错误处理:**
    *   **建议:** 在 `handleVideoError` 中增加对 `player.error` 对象的完整日志记录，而不仅仅是依赖 `message` 字符串匹配。

8.  **去除冗余的 `useEffect`:**
    *   `play.tsx` 中有一段处理 seeking 的 `useEffect` (`if (isSeekBuffering && player) ...`). 这段逻辑其实更适合放在 `useVideoHandlers` 或 Store 的 `seek` action 内部处理，减少组件层的副作用。
