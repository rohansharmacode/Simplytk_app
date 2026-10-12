import { useIsFocused } from 'expo-router';
import { useEffect, useState, type RefObject } from 'react';
import { Keyboard, Platform, type View } from 'react-native';

/**
 * How far the Android keyboard overlaps `ref`, to pad it by. Edge-to-edge apps aren't
 * resized for the keyboard, and a WebView doesn't know it's covered, so without this the
 * field being typed in can sit behind the keyboard. Measuring the actual overlap keeps it
 * right whether or not the window was resized. iOS WebViews handle the keyboard themselves.
 */
export function useKeyboardOverlap(ref: RefObject<View | null>): number {
  const focused = useIsFocused();
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android' || !focused) return;

    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _width, height) => {
        setOverlap(Math.max(0, Math.round(y + height - keyboardTop)));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
      setOverlap(0);
    };
  }, [focused, ref]);

  return overlap;
}
