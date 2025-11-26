import { useMemo } from 'react';
import { textStyles } from '@/constants/TextStyles';
import { useThemeColor } from './useThemeColor';
import { useScale } from './useScale';

export function useTextStyles() {
  const linkColor = useThemeColor({}, 'link');
  const scale = useScale() ?? 1.0;
  return useMemo(() => textStyles(scale, linkColor), [scale, linkColor]);
}
