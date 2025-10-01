import React from "react";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
import * as ReactNative from "react-native";
import { ThemedText } from "../ThemedText";

const useWindowDimensionsMock = jest.spyOn(ReactNative, "useWindowDimensions");

beforeEach(() => {
  useWindowDimensionsMock.mockReturnValue({
    width: 1920,
    height: 1080,
    scale: 1,
    fontScale: 1,
  });
});

afterEach(() => {
  useWindowDimensionsMock.mockRestore();
});

describe("ThemedText", () => {
  it("renders consistently", () => {
    let tree: ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(<ThemedText>Snapshot test!</ThemedText>);
    });

    expect(tree).toBeDefined();
    expect(tree!.toJSON()).toMatchSnapshot();
  });
});
