# StyledButton 组件设计文档

## 1. 目的

为了统一整个应用中的按钮样式和行为，减少代码重复，并提高开发效率和一致性，我们设计了一个通用的 `StyledButton` 组件。

该组件将取代以下位置的自定义 `Pressable` 和 `TouchableOpacity` 实现：

- `app/index.tsx` (分类按钮, 头部图标按钮)
- `components/DetailButton.tsx`
- `components/EpisodeSelectionModal.tsx` (剧集分组按钮, 剧集项按钮, 关闭按钮)
- `components/SettingsModal.tsx` (取消和保存按钮)
- `app/search.tsx` (清除按钮)
- `components/MediaButton.tsx` (媒体控制按钮)
- `components/NextEpisodeOverlay.tsx` (取消按钮)

## 2. API 设计

`StyledButton` 组件将基于 React Native 的 `Pressable` 构建，并提供以下 props：

```typescript
import { PressableProps, StyleProp, ViewStyle, TextStyle } from "react-native";

interface StyledButtonProps extends PressableProps {
  // 按钮的主要内容，可以是文本或图标等 React 节点
  children?: React.ReactNode;

  // 如果按钮只包含文本，可以使用此 prop 快速设置
  text?: string;

  // 按钮的视觉变体，用于应用不同的预设样式
  // 'default': 默认灰色背景
  // 'primary': 主题色背景，用于关键操作
  // 'ghost': 透明背景，通常用于图标按钮
  variant?: "default" | "primary" | "ghost";

  // 按钮是否处于选中状态
  isSelected?: boolean;

  // 覆盖容器的样式
  style?: StyleProp<ViewStyle>;

  // 覆盖文本的样式 (当使用 `text` prop 时生效)
  textStyle?: StyleProp<TextStyle>;
}
```

## 3. 样式和行为

### 状态样式:

- **默认状态 (`default`)**:
  - 背景色: `#333`
  - 边框: `transparent`
- **聚焦状态 (`focused`)**:
  - 背景色: `#0056b3` (深蓝色)
  - 边框: `#fff`
  - 阴影/光晕效果
  - 轻微放大 (`transform: scale(1.1)`)
- **选中状态 (`isSelected`)**:
  - 背景色: `#007AFF` (亮蓝色)
- **主操作 (`primary`)**:
  - 默认背景色: `#007AFF`
- **透明背景 (`ghost`)**:
  - 默认背景色: `transparent`

### 结构:

组件内部将使用 `Pressable` 作为根元素，并根据 `focused` 和 `isSelected` props 动态计算样式。如果 `children` 和 `text` prop 都提供了，`children` 将优先被渲染。

## 4. 实现计划

1.  **创建 `components/StyledButton.tsx` 文件**。
2.  **实现上述 API 和样式逻辑**。
3.  **逐个重构目标文件**，将原有的 `Pressable`/`TouchableOpacity` 替换为新的 `StyledButton` 组件。
4.  **删除旧的、不再需要的样式**。
5.  **测试所有被修改的界面**，确保按钮的功能和视觉效果符合预期。
