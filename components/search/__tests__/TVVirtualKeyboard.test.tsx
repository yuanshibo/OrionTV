import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { TVVirtualKeyboard } from "../TVVirtualKeyboard";

describe("TVVirtualKeyboard", () => {
  const mockOnKeyPress = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders keys and handles key press", () => {
    const { getByText } = render(
      <TVVirtualKeyboard
        onKeyPress={mockOnKeyPress}
        onDelete={mockOnDelete}
        onClear={mockOnClear}
      />
    );

    const keyK = getByText("K");
    expect(keyK).toBeTruthy();
    fireEvent.press(keyK);
    expect(mockOnKeyPress).toHaveBeenCalledWith("K");

    const keyB = getByText("B");
    fireEvent.press(keyB);
    expect(mockOnKeyPress).toHaveBeenCalledWith("B");
  });

  it("handles clear and delete actions", () => {
    const { getByText } = render(
      <TVVirtualKeyboard
        onKeyPress={mockOnKeyPress}
        onDelete={mockOnDelete}
        onClear={mockOnClear}
      />
    );

    const clearButton = getByText("清空");
    fireEvent.press(clearButton);
    expect(mockOnClear).toHaveBeenCalledTimes(1);

    const deleteButton = getByText("退格");
    fireEvent.press(deleteButton);
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });
});
