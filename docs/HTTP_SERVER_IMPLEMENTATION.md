# OrionTV Native HTTP Server Implementation Documentation

## Overview

OrionTV implements a sophisticated native HTTP server solution that enables remote control functionality for the TV application. This implementation uses TCP sockets to create a custom HTTP server directly within the React Native application, providing a web-based remote control interface accessible from mobile devices.

## Architecture

### Core Components

#### 1. TCPHttpServer (`/services/tcpHttpServer.ts`)

A custom HTTP server implementation built on top of `react-native-tcp-socket` that handles raw TCP connections and implements HTTP protocol parsing and response formatting.

**Key Features:**
- Custom HTTP request/response parsing
- Fixed port configuration (12346)
- Automatic IP address detection via `@react-native-community/netinfo`
- Support for GET and POST methods
- Error handling and connection management

**Class Structure:**
```typescript
class TCPHttpServer {
  private server: TcpSocket.Server | null = null;
  private isRunning = boolean;
  private requestHandler: RequestHandler | null = null;
}
```

**Core Methods:**
- `start()`: Initializes server and binds to `0.0.0.0:12346`
- `stop()`: Gracefully shuts down the server
- `setRequestHandler()`: Sets the request handling logic
- `parseHttpRequest()`: Parses raw HTTP request data
- `formatHttpResponse()`: Formats HTTP responses

#### 2. RemoteControlService (`/services/remoteControlService.ts`)

A service layer that wraps the TCPHttpServer and provides the remote control functionality with predefined routes and HTML interface.

**API Endpoints:**
- `GET /` - Serves HTML remote control interface
- `POST /message` - Receives messages from mobile devices
- `POST /handshake` - Connection handshake for mobile clients

**Features:**
- Built-in HTML interface generation
- JSON message parsing
- Callback-based event handling
- Error handling and validation

#### 3. RemoteControlStore (`/stores/remoteControlStore.ts`)

Zustand store that manages the remote control server state and provides React component integration.

**State Management:**
```typescript
interface RemoteControlState {
  isServerRunning: boolean;
  serverUrl: string | null;
  error: string | null;
  isModalVisible: boolean;
  lastMessage: string | null;
  startServer: () => Promise<void>;
  stopServer: () => void;
  showModal: () => void;
  hideModal: () => void;
  setMessage: (message: string) => void;
}
```

## Technical Implementation Details

### HTTP Protocol Implementation

#### Request Parsing
The server implements custom HTTP request parsing that handles:
- HTTP method and URL extraction
- Header parsing with case-insensitive keys
- Body content extraction
- Malformed request detection

#### Response Formatting
Responses are formatted according to HTTP/1.1 specification:
- Status line with appropriate status codes (200, 400, 404, 500)
- Content-Length header calculation
- Connection: close header for stateless operation
- Proper CRLF line endings

### Network Configuration

#### IP Address Detection
The server automatically detects the device's IP address using `@react-native-community/netinfo`:
- Supports WiFi and Ethernet connections
- Validates network connectivity before starting
- Provides clear error messages for network issues

#### Server Binding
- Binds to `0.0.0.0:12346` for universal access
- Fixed port configuration for consistency
- Supports all network interfaces on the device

### Security Considerations

#### Current Implementation
- No authentication mechanism
- Open access on local network
- Basic request validation
- Error handling prevents information disclosure

#### Limitations
- Suitable only for local network use
- No HTTPS/TLS encryption
- No rate limiting or DDoS protection
- Assumes trusted network environment

## Web Interface

### HTML Template
The service provides a responsive web interface optimized for mobile devices:
- Dark theme design matching TV app aesthetics
- Touch-friendly controls with large buttons
- Real-time message sending capability
- Automatic handshake on page load

### JavaScript Functionality
- Automatic handshake POST request on page load
- Message submission via JSON POST requests
- Input field clearing after submission
- Error handling for network issues

## Integration with React Native App

### App Initialization
The server is automatically started when the app launches (`/app/_layout.tsx`):
```typescript
useEffect(() => {
  const { setMessage, hideModal } = useRemoteControlStore.getState();
  remoteControlService.init({
    onMessage: setMessage,
    onHandshake: hideModal,
  });
  useRemoteControlStore.getState().startServer();
  
  return () => {
    useRemoteControlStore.getState().stopServer();
  };
}, []);
```

### Message Handling
Messages received from mobile devices are processed and displayed as Toast notifications in the TV app, providing visual feedback for remote interactions.

### QR Code Integration
The app generates QR codes containing the server URL (`http://{device_ip}:12346`) for easy mobile device connection via `RemoteControlModal.tsx`.

## Dependencies

### Required Packages
- `react-native-tcp-socket@^6.0.6` - TCP socket implementation
- `@react-native-community/netinfo@^11.3.2` - Network interface information
- `react-native-qrcode-svg@^6.3.1` - QR code generation for UI

### Platform Compatibility
- iOS (Apple TV)
- Android (Android TV)
- Requires network connectivity (WiFi or Ethernet)

## Performance Characteristics

### Connection Handling
- Single-threaded event-driven architecture
- Stateless HTTP connections with immediate closure
- Memory-efficient request buffering
- Graceful error recovery

### Resource Usage
- Minimal CPU overhead for HTTP parsing
- Low memory footprint
- Network I/O bound operations
- Automatic connection cleanup

## Error Handling

### Server Level
- Network binding failures with descriptive messages
- Socket error handling and logging
- Graceful server shutdown procedures
- IP address detection error handling

### Request Level
- Malformed HTTP request detection
- JSON parsing error handling
- 400/404/500 status code responses
- Request timeout and connection cleanup

## Debugging and Monitoring

### Logging
Comprehensive logging throughout the system:
- Server startup/shutdown events
- Client connection/disconnection
- Request processing details
- Error conditions and stack traces

### Console Output Format
```
[TCPHttpServer] Server listening on 192.168.1.100:12346
[RemoteControl] Received request: POST /message
[RemoteControlStore] Server started, URL: http://192.168.1.100:12346
```

## Usage Example

### Starting the Server
```typescript
// Automatic startup via store
const { startServer } = useRemoteControlStore();
await startServer();

// Manual service usage
await remoteControlService.startServer();
```

### Stopping the Server
```typescript
// Via store
const { stopServer } = useRemoteControlStore();
stopServer();

// Direct service call
remoteControlService.stopServer();
```

### Mobile Device Access
1. Ensure mobile device is on the same network as TV
2. Scan QR code displayed in TV app
3. Access web interface at `http://{tv_ip}:12346`
4. Send messages that appear as notifications on TV

## Comparison with Alternatives

### vs react-native-http-bridge
- **Advantages**: More control over HTTP implementation, custom error handling
- **Disadvantages**: More complex implementation, requires manual HTTP parsing

### vs External Backend Server
- **Advantages**: No additional infrastructure, embedded in app
- **Disadvantages**: Limited scalability, single device constraint

## Future Enhancement Opportunities

### Security
- Authentication token implementation
- HTTPS/TLS encryption support
- Request rate limiting
- CORS configuration

### Functionality
- Multi-device support
- WebSocket integration for real-time communication
- File upload/download capabilities
- Advanced remote control commands

### Performance
- Connection pooling
- Request caching
- Compression support
- IPv6 compatibility

## Troubleshooting

### Common Issues

#### "Unable to get IP address" Error
- Verify WiFi/Ethernet connection
- Check network interface availability
- Restart network services

#### Server Won't Start
- Check if port 12346 is already in use
- Verify network permissions
- Restart the application

#### Mobile Device Can't Connect
- Confirm both devices on same network
- Verify firewall settings
- Check IP address in QR code

### Diagnostic Commands
```bash
# Check network connectivity
yarn react-native log-ios  # View iOS logs
yarn react-native log-android  # View Android logs

# Network debugging
netstat -an | grep 12346  # Check port binding (debugging environment)
```

## Conclusion

The OrionTV native HTTP server implementation provides a robust, embedded solution for remote control functionality without requiring external infrastructure. The custom TCP-based approach offers flexibility and control while maintaining simplicity and performance suitable for TV applications.

The implementation demonstrates sophisticated understanding of HTTP protocol handling, React Native integration, and TV-specific user experience requirements, making it an effective solution for cross-device interaction in smart TV environments.