import React, { ComponentProps } from "react";
import { StyledButton } from "./StyledButton";
import { StyleSheet } from "react-native";

type StyledButtonProps = ComponentProps<typeof StyledButton>;

export const MediaButton = (props: StyledButtonProps) => (
  <StyledButton {...props} style={[styles.mediaControlButton, props.style]} variant="ghost" />
);

const styles = StyleSheet.create({
  mediaControlButton: {
    padding: 12,
    minWidth: 80,
  },
});
