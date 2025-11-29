import errorService, { ErrorType } from '../ErrorService';
import Toast from 'react-native-toast-message';
import Logger from '@/utils/Logger';

// Mock dependencies
jest.mock('react-native-toast-message', () => ({
    show: jest.fn(),
}));

jest.mock('@/utils/Logger', () => ({
    withTag: jest.fn().mockReturnValue({
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    }),
}));

describe('ErrorService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('detectErrorType', () => {
        it('should detect SSL errors', () => {
            expect(errorService.detectErrorType('SSLHandshakeException')).toBe(ErrorType.SSL);
            expect(errorService.detectErrorType(new Error('CertPathValidatorException'))).toBe(ErrorType.SSL);
        });

        it('should detect Network errors', () => {
            expect(errorService.detectErrorType('Network request failed')).toBe(ErrorType.NETWORK);
            expect(errorService.detectErrorType(new Error('SocketTimeoutException'))).toBe(ErrorType.NETWORK);
        });

        it('should detect API errors', () => {
            expect(errorService.detectErrorType('404 Not Found')).toBe(ErrorType.API);
            expect(errorService.detectErrorType('API_URL_NOT_SET')).toBe(ErrorType.API);
        });

        it('should return UNKNOWN for other errors', () => {
            expect(errorService.detectErrorType('Random Error')).toBe(ErrorType.UNKNOWN);
        });
    });

    describe('formatMessage', () => {
        it('should format API configuration errors', () => {
            expect(errorService.formatMessage('API_URL_NOT_SET')).toBe('请点击右上角设置按钮，配置您的服务器地址');
        });

        it('should format Unauthorized errors', () => {
            expect(errorService.formatMessage('UNAUTHORIZED')).toBe('认证失败，请重新登录');
        });

        it('should format 404 errors', () => {
            expect(errorService.formatMessage('Error: 404')).toBe('服务器API路径不正确，请检查服务器配置');
        });

        it('should format Network errors', () => {
            expect(errorService.formatMessage('Network Error')).toBe('网络连接失败，请检查网络连接');
        });

        it('should provide a default fallback for empty or object errors', () => {
            expect(errorService.formatMessage({})).toBe('加载失败，请重试');
            expect(errorService.formatMessage(null)).toBe('加载失败，请重试');
        });

        it('should pass through unknown string errors', () => {
            expect(errorService.formatMessage('Custom Error Message')).toBe('Custom Error Message');
        });
    });

    describe('handle', () => {
        it('should log error and show toast by default', () => {
            const error = new Error('Test Error');
            errorService.handle(error, { context: 'TestContext' });

            // Verify Logger
            const logger = Logger.withTag('ErrorService');
            expect(logger.error).toHaveBeenCalledWith(
                { tag: 'TestContext' },
                'Test Error',
                error
            );

            // Verify Toast
            expect(Toast.show).toHaveBeenCalledWith({
                type: 'error',
                text1: 'Test Error',
                text2: undefined,
            });
        });

        it('should not show toast if showToast is false', () => {
            errorService.handle('Error', { showToast: false });
            expect(Toast.show).not.toHaveBeenCalled();
        });

        it('should use custom toast type', () => {
            errorService.handle('Info', { toastType: 'info' });
            expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
        });
    });
});
