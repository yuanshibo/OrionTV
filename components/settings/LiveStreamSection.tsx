import React, { forwardRef } from "react";
import { SettingsInputSection, SettingsInputSectionRef } from "./SettingsInputSection";
import { useSettingsStore } from "@/stores/settingsStore";

export type LiveStreamSectionRef = SettingsInputSectionRef;

interface LiveStreamSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const LiveStreamSection = forwardRef<LiveStreamSectionRef, LiveStreamSectionProps>(
  (props, ref) => {
    const {
      m3uUrl,
      setM3uUrl,
      testM3uConnection,
      isTestingM3u,
      lastM3uTestResult,
    } = useSettingsStore();

    return (
      <SettingsInputSection
        ref={ref}
        title="直播源地址"
        value={m3uUrl}
        onChangeValue={setM3uUrl}
        placeholder="输入 M3U 直播源地址 (如: http://example.com/live.m3u)"
        buttonText="探测源"
        isLoading={isTestingM3u}
        onTest={testM3uConnection}
        emptyToastMessage="请输入 M3U 直播源地址"
        fallbackErrorMessage="探测失败"
        testResult={lastM3uTestResult}
        renderSuccessMessage={() => {
          const sample = lastM3uTestResult?.sampleChannels?.length
            ? ` · 示例: ${lastM3uTestResult.sampleChannels.join(", ")}`
            : "";
          return `解析成功 (共 ${lastM3uTestResult?.channelCount} 个频道${sample})`;
        }}
        {...props}
      />
    );
  }
);

LiveStreamSection.displayName = "LiveStreamSection";
