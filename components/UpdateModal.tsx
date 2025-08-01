import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useUpdateStore } from '../stores/updateStore';
import { Colors } from '../constants/Colors';

export function UpdateModal() {
  const {
    showUpdateModal,
    currentVersion,
    remoteVersion,
    downloading,
    downloadProgress,
    error,
    setShowUpdateModal,
    startDownload,
    installUpdate,
    skipThisVersion,
    downloadedPath,
  } = useUpdateStore();

  const updateButtonRef = React.useRef<TouchableOpacity>(null);
  const laterButtonRef = React.useRef<TouchableOpacity>(null);
  const skipButtonRef = React.useRef<TouchableOpacity>(null);

  async function handleUpdate() {
    if (!downloading && !downloadedPath) {
      // 开始下载
      await startDownload();
    } else if (downloadedPath) {
      // 已下载完成，安装
      await installUpdate();
    }
  }

  function handleLater() {
    setShowUpdateModal(false);
  }

  async function handleSkip() {
    await skipThisVersion();
  }

  React.useEffect(() => {
    if (showUpdateModal && Platform.isTV) {
      // TV平台自动聚焦到更新按钮
      setTimeout(() => {
        updateButtonRef.current?.focus();
      }, 100);
    }
  }, [showUpdateModal]);

  const getButtonText = () => {
    if (downloading) {
      return `下载中 ${downloadProgress}%`;
    } else if (downloadedPath) {
      return '立即安装';
    } else {
      return '立即更新';
    }
  };

  return (
    <Modal
      visible={showUpdateModal}
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>发现新版本</Text>
          
          <View style={styles.versionInfo}>
            <Text style={styles.versionText}>
              当前版本: v{currentVersion}
            </Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={[styles.versionText, styles.newVersion]}>
              新版本: v{remoteVersion}
            </Text>
          </View>

          {downloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${downloadProgress}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{downloadProgress}%</Text>
            </View>
          )}

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              ref={updateButtonRef}
              style={[styles.button, styles.primaryButton]}
              onPress={handleUpdate}
              disabled={downloading && !downloadedPath}
            >
              {downloading && !downloadedPath ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{getButtonText()}</Text>
              )}
            </TouchableOpacity>

            {!downloading && !downloadedPath && (
              <>
                <TouchableOpacity
                  ref={laterButtonRef}
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleLater}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    稍后再说
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  ref={skipButtonRef}
                  style={[styles.button, styles.textButton]}
                  onPress={handleSkip}
                >
                  <Text style={[styles.buttonText, styles.textButtonText]}>
                    跳过此版本
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 24,
    width: Platform.isTV ? 500 : '90%',
    maxWidth: 500,
    alignItems: 'center',
  },
  title: {
    fontSize: Platform.isTV ? 28 : 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 20,
  },
  versionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  versionText: {
    fontSize: Platform.isTV ? 18 : 16,
    color: Colors.dark.text,
  },
  newVersion: {
    color: Colors.dark.primary || '#00bb5e',
    fontWeight: 'bold',
  },
  arrow: {
    fontSize: Platform.isTV ? 20 : 18,
    color: Colors.dark.text,
    marginHorizontal: 12,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.dark.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.dark.primary || '#00bb5e',
  },
  progressText: {
    fontSize: Platform.isTV ? 16 : 14,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  errorText: {
    fontSize: Platform.isTV ? 16 : 14,
    color: '#ff4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: Platform.isTV ? 14 : 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.isTV ? 56 : 48,
  },
  primaryButton: {
    backgroundColor: Colors.dark.primary || '#00bb5e',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  textButton: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: Colors.dark.text,
  },
  textButtonText: {
    color: Colors.dark.text,
    fontWeight: 'normal',
  },
});