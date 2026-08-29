import { useEffect } from "react";
import { useRemoteControlStore } from "@/stores/remoteControlStore";

/**
 * Hook to handle remote control messages.
 * @param onMessage Callback fired when a message matching the criteria is received.
 * @param expectedTargetPage If provided, only messages matching this targetPage are processed. If omitted, only messages with no targetPage are processed.
 */
export function useRemoteMessage(
  onMessage: (message: string) => void,
  expectedTargetPage?: string
) {
  const { lastMessage, targetPage, clearMessage } = useRemoteControlStore();

  useEffect(() => {
    if (lastMessage) {
      const isTargetMatch = expectedTargetPage 
        ? targetPage === expectedTargetPage 
        : !targetPage;

      if (isTargetMatch) {
        const realMessage = lastMessage.split("_")[0];
        onMessage(realMessage);
        clearMessage();
      }
    }
  }, [lastMessage, targetPage, clearMessage, expectedTargetPage, onMessage]);
}
