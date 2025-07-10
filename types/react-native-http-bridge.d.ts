declare module 'react-native-http-bridge' {
  import { EmitterSubscription } from 'react-native';

  interface HttpBridge {
    start(port: number, serviceName: string, callback: (request: { url: string; type: string; requestId: string; postData: string }) => void): void;
    stop(): void;
    on(event: 'request', callback: (request: any) => void): EmitterSubscription;
    respond(requestId: string, code: number, type: string, body: string): void;
  }

  const httpBridge: HttpBridge;
  export default httpBridge;
}