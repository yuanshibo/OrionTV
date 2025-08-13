# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OrionTV is a React Native TVOS application for streaming video content, built with Expo and designed specifically for TV platforms (Apple TV and Android TV). This is a frontend-only application that connects to external APIs and includes a built-in remote control server for external device control.

## Key Commands

### Development Commands

#### TV Development (Apple TV & Android TV)
- `yarn start-tv` - Start Metro bundler in TV mode (EXPO_TV=1)
- `yarn android-tv` - Build and run on Android TV
- `yarn ios-tv` - Build and run on Apple TV
- `yarn prebuild-tv` - Generate native project files for TV (run after dependency changes)
- `yarn build-tv` - Build Android APK for TV release

#### Mobile/Tablet Development (Responsive)
- `yarn start` or `yarn start-mobile` - Start Metro bundler for mobile/tablet
- `yarn android` or `yarn android-mobile` - Build and run on Android mobile/tablet
- `yarn ios` or `yarn ios-mobile` - Build and run on iOS mobile/tablet
- `yarn prebuild` or `yarn prebuild-mobile` - Generate native project files for mobile
- `yarn build` or `yarn build-mobile` - Build Android APK for mobile release

#### General Commands
- `yarn copy-config` - Copy TV-specific Android configurations
- `yarn build-debug` - Build Android APK for debugging
- `yarn lint` - Run linting checks
- `yarn typecheck` - Run TypeScript type checking
- `yarn test` - Run Jest tests with watch mode
- `yarn test-ci` - Run Jest tests for CI with coverage
- `yarn clean` - Clean cache and build artifacts
- `yarn clean-modules` - Reinstall all node modules

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

### Responsive Development Notes

- Use TV commands (`*-tv` variants) with EXPO_TV=1 for TV development
- Use mobile/tablet commands (without EXPO_TV=1) for responsive mobile/tablet development
- Run `yarn prebuild-tv` after adding new dependencies for TV builds
- Run `yarn prebuild-mobile` after adding new dependencies for mobile builds
- Use `yarn copy-config` to apply TV-specific Android configurations (TV builds only)
- Test on both TV devices (Apple TV/Android TV) and mobile devices (phones/tablets)
- TV components require focus management and remote control support
- Mobile/tablet components use touch-optimized responsive design
- The same codebase supports all platforms through responsive architecture

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
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
ALWAYS When plan mode switches to edit, the contents of plan and todo need to be output as a document.
