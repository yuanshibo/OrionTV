import React, { forwardRef } from "react";
import { SettingsInputSection, SettingsInputSectionRef } from "./SettingsInputSection";
import { useSettingsStore } from "@/stores/settingsStore";

export type APIConfigSectionRef = SettingsInputSectionRef;

interface APIConfigSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  hideDescription?: boolean;
}

export const APIConfigSection = forwardRef<APIConfigSectionRef, APIConfigSectionProps>(
  (props, ref) => {
    const {
      apiBaseUrl,
      setApiBaseUrl,
      testApiConnection,
      isTestingApi,
      lastApiTestResult,
    } = useSettingsStore();

    return (
      <SettingsInputSection
        ref={ref}
        title="API 地址"
        value={apiBaseUrl}
        onChangeValue={setApiBaseUrl}
        placeholder="输入服务器地址 (如: http://192.168.1.100:8080)"
        buttonText="测试连接"
        isLoading={isTestingApi}
        onTest={testApiConnection}
        emptyToastMessage="请输入 API 服务器地址"
        fallbackErrorMessage="连接失败"
        testResult={lastApiTestResult}
        renderSuccessMessage={() =>
          `连通正常 (${lastApiTestResult?.siteName} · 存储: ${lastApiTestResult?.storageType} · 延迟: ${lastApiTestResult?.latency}ms)`
        }
        {...props}
      />
    );
  }
);

APIConfigSection.displayName = "APIConfigSection";
