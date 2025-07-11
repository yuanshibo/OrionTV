# 设置页面重构方案

## 目标
1. 将设置从弹窗模式改为独立页面
2. 新增直播源配置功能
3. 新增远程输入开关配置
4. 新增播放源启用配置

## 现有架构分析

### 当前设置相关文件：
- `stores/settingsStore.ts` - 设置状态管理，目前只有API地址配置
- `components/SettingsModal.tsx` - 设置弹窗组件
- `stores/remoteControlStore.ts` - 远程控制状态管理

### 现有功能：
- API基础地址配置
- 远程控制服务器（但未集成到设置中）

## 重构方案

### 1. 创建独立设置页面
- 新建 `app/settings.tsx` 页面
- 使用 Expo Router 的文件路由系统
- 删除现有的 `SettingsModal.tsx` 组件

### 2. 扩展设置Store
在 `settingsStore.ts` 中新增以下配置项：
```typescript
interface SettingsState {
  // 现有配置
  apiBaseUrl: string;
  
  // 新增配置项
  liveStreamSources: LiveStreamSource[];  // 直播源配置
  remoteInputEnabled: boolean;            // 远程输入开关
  videoSourceConfig: VideoSourceConfig; // 播放源配置
}

interface LiveStreamSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

interface VideoSourceConfig {
  primarySource: string;
  fallbackSources: string[];
  enabledSources: string[];
}
```

### 3. 设置页面UI结构
```
设置页面 (app/settings.tsx)
├── API 配置区域
│   └── API 基础地址输入框
├── 直播源配置区域
│   ├── 直播源列表
│   ├── 添加直播源按钮
│   └── 编辑/删除直播源功能
├── 远程输入配置区域
│   └── 远程输入开关
└── 播放源配置区域
    ├── 主播放源选择
    ├── 备用播放源配置
    └── 启用的播放源选择
```

### 4. 组件设计
- 使用 TV 适配的组件和样式
- 实现焦点管理和遥控器导航
- 遵循现有的设计规范（ThemedView, ThemedText, StyledButton）

### 5. 导航集成
- 在主页面添加设置入口
- 使用 Expo Router 的 router.push('/settings') 进行导航

## 实施步骤

1. **扩展 settingsStore.ts**
   - 添加新的状态接口
   - 实现新配置项的增删改查方法
   - 集成本地存储

2. **创建设置页面**
   - 新建 `app/settings.tsx`
   - 实现基础页面结构和导航

3. **实现配置组件**
   - API 配置组件（复用现有逻辑）
   - 直播源配置组件
   - 远程输入开关组件
   - 播放源配置组件

4. **集成远程控制**
   - 将远程控制功能集成到设置页面
   - 统一管理所有设置项

5. **更新导航**
   - 在主页面添加设置入口
   - 移除现有的设置弹窗触发逻辑

6. **测试验证**
   - 测试所有配置项的保存和加载
   - 验证TV平台的交互体验
   - 确保配置项生效

## 技术考虑

### TV平台适配
- 使用 `useTVRemoteHandler` 处理遥控器事件
- 实现合适的焦点管理
- 确保所有交互元素可通过遥控器操作

### 数据持久化
- 使用现有的 `SettingsManager` 进行本地存储
- 确保新配置项能正确保存和恢复

### 向后兼容
- 保持现有API配置功能不变
- 为新配置项提供默认值
- 处理旧版本设置数据的迁移

## 预期收益

1. **更好的用户体验**：独立页面提供更多空间展示配置选项
2. **功能扩展性**：为未来添加更多配置项提供良好基础
3. **代码组织**：将设置相关功能集中管理
4. **TV平台适配**：更好的遥控器交互体验