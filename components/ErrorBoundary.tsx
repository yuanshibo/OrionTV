import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import Logger from '@/utils/Logger';

const logger = Logger.withTag('ErrorBoundary');

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <ThemedView style={styles.container}>
                    <View style={styles.content}>
                        <ThemedText type="title" style={styles.title}>哎呀，出错了</ThemedText>
                        <ThemedText style={styles.message}>
                            程序遇到了一些问题，我们深表歉意。
                        </ThemedText>
                        {__DEV__ && (
                            <ThemedText style={styles.errorDetail}>
                                {this.state.error?.toString()}
                            </ThemedText>
                        )}
                        <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                            <ThemedText style={styles.buttonText}>重试</ThemedText>
                        </TouchableOpacity>
                    </View>
                </ThemedView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    content: {
        maxWidth: 400,
        alignItems: 'center',
    },
    title: {
        marginBottom: 10,
    },
    message: {
        textAlign: 'center',
        marginBottom: 20,
        opacity: 0.8,
    },
    errorDetail: {
        fontSize: 12,
        color: '#ff4444',
        marginBottom: 20,
        padding: 10,
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        borderRadius: 8,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
});
