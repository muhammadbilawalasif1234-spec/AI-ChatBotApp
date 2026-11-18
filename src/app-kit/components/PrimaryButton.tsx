// src/app-kit/components/PrimaryButton.tsx

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  loading = false,
  style,
  disabled,
  ...props
}) => {
  const { colors, spacing } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.button,
        {
          backgroundColor: colors.primary,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: spacing.radiusLg,
          shadowColor: colors.primary,
        },
        disabled || loading ? styles.disabled : styles.enabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryText} />
      ) : (
        <Text style={[styles.text, { color: colors.primaryText }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  enabled: {
    opacity: 1,
  },
});