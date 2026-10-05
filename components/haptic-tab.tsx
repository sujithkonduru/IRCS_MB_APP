
import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

export function HapticTab(props: PressableProps) {
  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(
            Haptics.ImpactFeedbackStyle.Light
          );
        }

        props.onPressIn?.(event);
      }}
    />
  );
}

