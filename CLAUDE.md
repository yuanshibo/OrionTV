# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OrionTV is a React Native TVOS application for streaming video content, built with Expo and designed specifically for TV platforms (Apple TV and Android TV). This is a frontend-only application that connects to external APIs and includes a built-in remote control server for external device control.

## Key Commands

### Development Commands
- `yarn start-tv` - Start Metro bundler in TV mode (EXPO_TV=1)
- `yarn ios-tv` - Build and run on Apple TV
- `yarn android-tv` - Build and run on Android TV  
- `yarn prebuild-tv` - Generate native project files for TV (run after dependency changes)
- `yarn copy-config` - Copy TV-specific Android configurations
- `yarn lint` - Run linting checks
- `yarn test` - Run Jest tests with watch mode
- `yarn build-local` - Build Android APK locally (from android/ directory)

## Architecture Overview

### Frontend Structure
- **Expo Router**: File-based routing with screens in `/app` directory
- **State Management**: Zustand stores for global state (`/stores`)
- **TV-Specific Components**: Components optimized for TV remote control interaction
- **Services**: API layer, storage management, remote control server, and update service

### Key Technologies
- React Native TVOS (0.74.x) - TV-optimized React Native with TV-specific events
- Expo SDK 51 - Development platform and tooling
- TypeScript - Type safety throughout with `@/*` path mapping
- Zustand - Lightweight state management
- Expo AV - Video playback functionality

### State Management (Zustand Stores)
- `homeStore.ts` - Home screen content, categories, Douban API data, and play records
- `playerStore.ts` - Video player state, controls, and episode management
- `settingsStore.ts` - App settings, API configuration, and user preferences
- `remoteControlStore.ts` - Remote control server functionality and HTTP bridge
- `authStore.ts` - User authentication state
- `updateStore.ts` - Automatic update checking and version management
- `favoritesStore.ts` - User favorites management

### TV-Specific Features
- Remote control navigation (`useTVRemoteHandler` hook with HWEvent handling)
- TV-optimized UI components with focus management and `.tv.tsx` extensions
- Remote control server for external control via HTTP bridge (`remoteControlService.ts`)
- Gesture handling for TV remote interactions (select, left/right seeking, long press)
- TV-specific assets and icons for Apple TV and Android TV

### Service Layer Architecture
- `api.ts` - External API integration (search, video details, Douban data)
- `storage.ts` - AsyncStorage wrapper for local data persistence
- `remoteControlService.ts` - HTTP server for external device control
- `updateService.ts` - Automatic version checking and APK download
- `tcpHttpServer.ts` - TCP-based HTTP server implementation

## Development Workflow

### TV Development Notes
- Always use TV-specific commands (`*-tv` variants) with EXPO_TV=1 environment variable
- Run `yarn prebuild-tv` after adding new dependencies or Expo configuration changes
- Use `yarn copy-config` to apply TV-specific Android configurations
- Test on both Apple TV and Android TV simulators/devices
- TV components require focus management and remote control support
- TV builds use react-native-tvos instead of standard react-native

### State Management Patterns
- Use Zustand stores for global state
- Stores follow a consistent pattern with actions and state
- API calls are centralized in the `/services` directory
- Storage operations use AsyncStorage wrapper in `storage.ts`

### Component Structure
- TV-specific components have `.tv.tsx` extensions
- Common components in `/components` directory
- Custom hooks in `/hooks` directory for reusable logic
- TV remote handling is centralized in `useTVRemoteHandler`

## Testing

- Uses Jest with `jest-expo` preset
- Run tests with `yarn test`
- Component tests in `__tests__` directories
- Snapshot testing for UI components

## Common Issues

### TV Platform Specifics
- TV apps require special focus management
- Remote control events need careful handling
- TV-specific assets and icons required
- Platform-specific build configurations

### Development Environment
- Ensure Xcode is installed for Apple TV development
- Android Studio required for Android TV development
- Metro bundler must run in TV mode (`EXPO_TV=1`)
- External API servers configured in settings for video content

## File Structure Notes

- `/app` - Expo Router screens and navigation
- `/components` - Reusable UI components (including `.tv.tsx` variants)
- `/stores` - Zustand state management stores
- `/services` - API, storage, remote control, and update services
- `/hooks` - Custom React hooks including `useTVRemoteHandler`
- `/constants` - App constants, theme definitions, and update configuration
- `/assets` - Static assets including TV-specific icons and banners

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.