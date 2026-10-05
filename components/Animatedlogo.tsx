import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  StyleSheet,
} from "react-native";

interface AnimatedLogoProps {
  onAnimationComplete?: () => void;
}

export default function AnimatedLogo({
  onAnimationComplete,
}: AnimatedLogoProps) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),

      // Initial zoom
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Small continuous breathing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        {
          iterations: 2,
        }
      ).start(({ finished }) => {
        if (finished) {
          onAnimationComplete?.();
        }
      });
    });
  }, [onAnimationComplete]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require("../assets/images/logo.png")}
        style={[
          styles.logo,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },

  logo: {
    width: 200,
    height: 200,
  },
});