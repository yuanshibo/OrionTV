import Toast from 'react-native-toast-message';
import Logger from '@/utils/Logger';

export enum ErrorType {
    NETWORK = 'network',
    API = 'api',
    PLAYBACK = 'playback',
    SSL = 'ssl',
    UNKNOWN = 'unknown',
}

export interface ErrorHandlerOptions {
    context?: string;
    showToast?: boolean;
    toastType?: 'success' | 'error' | 'info';
}

const ERROR_SIGNATURES = {
    ssl: ['SSLHandshakeException', 'CertPathValidatorException', 'Trust anchor for certification path not found'],
    network: ['HttpDataSourceException', 'IOException', 'SocketTimeoutException', 'Network', 'timeout'],
    api: ['404', '500', '403', 'API_URL_NOT_SET', 'UNAUTHORIZED'],
} as const;

class ErrorService {
    private logger = Logger.withTag('ErrorService');

    /**
     * Main entry point for handling errors
     */
    handle(error: unknown, options: ErrorHandlerOptions = {}): string {
        const { context, showToast = true, toastType = 'error' } = options;
        const message = this.formatMessage(error);
        const errorType = this.detectErrorType(error);

        // Log the error
        this.logger.error({ tag: context }, message, error);

        // Show toast if requested
        if (showToast) {
            this.showToast(message, toastType);
        }

        return message;
    }

    /**
     * Detects the type of error based on message content
     */
    detectErrorType(error: unknown): ErrorType {
        const message = this.getErrorMessage(error).toLowerCase();

        if (ERROR_SIGNATURES.ssl.some(token => message.includes(token.toLowerCase()))) return ErrorType.SSL;
        if (ERROR_SIGNATURES.network.some(token => message.includes(token.toLowerCase()))) return ErrorType.NETWORK;
        if (ERROR_SIGNATURES.api.some(token => message.includes(token.toLowerCase()))) return ErrorType.API;

        return ErrorType.UNKNOWN;
    }

    /**
     * Formats error into a user-friendly message
     */
    formatMessage(error: unknown): string {
        const message = this.getErrorMessage(error);

        // API specific messages
        if (message === "API_URL_NOT_SET") return "请点击右上角设置按钮，配置您的服务器地址";
        if (message === "UNAUTHORIZED") return "认证失败，请重新登录";
        if (message.includes("404")) return "服务器API路径不正确，请检查服务器配置";
        if (message.includes("500")) return "服务器内部错误，请联系管理员";
        if (message.includes("403")) return "访问被拒绝，请检查权限设置";

        // Network specific messages
        if (message.includes("Network")) return "网络连接失败，请检查网络连接";
        if (message.includes("timeout")) return "请求超时，请检查网络或服务器状态";

        // SSL specific messages
        if (ERROR_SIGNATURES.ssl.some(token => message.includes(token))) {
            return "SSL证书错误，正在尝试其他播放源...";
        }

        // Playback specific messages (from useVideoHandlers)
        if (ERROR_SIGNATURES.network.some(token => message.includes(token))) {
            return "网络连接失败，正在尝试其他播放源...";
        }

        // Default fallback
        if (!message || message === "object" || message === "[object Object]") {
            return "加载失败，请重试";
        }

        return message;
    }

    /**
     * Helper to extract string message from unknown error
     */
    private getErrorMessage(error: unknown): string {
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        if (typeof error === 'object' && error !== null && 'message' in error) {
            return String((error as any).message);
        }
        return '';
    }

    /**
     * Show a toast message
     */
    showToast(text1: string, type: 'success' | 'error' | 'info' = 'error', text2?: string) {
        Toast.show({ type, text1, text2 });
    }
}

export const errorService = new ErrorService();
export default errorService;
