# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OrionTV is a React Native TVOS application for streaming video content, built with Expo and designed specifically for TV platforms (Apple TV and Android TV). The project includes both a frontend React Native app and a backend Express service.

## Key Commands

### Development Commands
- `yarn start-tv` - Start Metro bundler in TV mode
- `yarn ios-tv` - Build and run on Apple TV
- `yarn android-tv` - Build and run on Android TV  
- `yarn prebuild-tv` - Generate native project files for TV (run this after dependency changes)
- `yarn lint` - Run linting checks
- `yarn test` - Run Jest tests with watch mode
- `yarn build-local` - Build Android APK locally

### Backend Commands (from `/backend` directory)
- `yarn dev` - Start backend development server with hot reload
- `yarn build` - Build TypeScript backend
- `yarn start` - Start production backend server

## Architecture Overview

### Frontend Structure
- **Expo Router**: File-based routing with screens in `/app` directory
- **State Management**: Zustand stores for global state (`/stores`)
- **TV-Specific Components**: Components optimized for TV remote control interaction
- **Services**: API layer, storage management, and remote control service

### Key Technologies
- React Native TVOS (0.74.x) - TV-optimized React Native
- Expo SDK 51 - Development platform and tooling
- TypeScript - Type safety throughout
- Zustand - Lightweight state management
- Expo AV - Video playback functionality

### State Management (Zustand Stores)
- `homeStore.ts` - Home screen content, categories, and play records
- `playerStore.ts` - Video player state and controls
- `settingsStore.ts` - App settings and configuration
- `remoteControlStore.ts` - Remote control server functionality

### TV-Specific Features
- Remote control navigation (`useTVRemoteHandler` hook)
- TV-optimized UI components with focus management
- Remote control server for external control via HTTP bridge
- Gesture handling for TV remote interactions

### Backend Architecture
- Express.js server providing API endpoints
- Routes for search, video details, and Douban integration
- Image proxy service for handling external images
- CORS enabled for cross-origin requests

## Development Workflow

### TV Development Notes
- Always use TV-specific commands (`*-tv` variants)
- Run `yarn prebuild-tv` after adding new dependencies
- Test on both Apple TV and Android TV simulators
- TV components require focus management and remote control support

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
- Backend server must be running on port 3001 for full functionality

## File Structure Notes

- `/app` - Expo Router screens and navigation
- `/components` - Reusable UI components
- `/stores` - Zustand state management
- `/services` - API, storage, and external service integrations
- `/hooks` - Custom React hooks
- `/backend` - Express.js backend service
- `/constants` - App constants and theme definitions