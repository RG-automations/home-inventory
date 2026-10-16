import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { signInWithGoogle } from '../lib/oauth';
import { describeError } from '../lib/error-message';
import { pb } from '../lib/pocketbase';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsGoogleSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  async function handleSubmit() {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        await pb.collection('users').create({ email, password, passwordConfirm: password });
      }
      // Po rejestracji od razu logujemy — PocketBase nie wymaga potwierdzenia e-maila.
      await pb.collection('users').authWithPassword(email, password);
    } catch (error) {
      setErrorMessage(describeError(error, t, 'common.error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('common.appName')}</Text>
      <Text style={styles.subtitle}>
        {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.googleButton,
          isGoogleSubmitting && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleGoogleSignIn}
        disabled={isGoogleSubmitting}
      >
        {isGoogleSubmitting ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Text style={styles.googleButtonText}>{t('auth.continueWithGoogle')}</Text>
        )}
      </Pressable>

      <View style={styles.separatorRow}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>{t('auth.or')}</Text>
        <View style={styles.separatorLine} />
      </View>

      <TextInput
        style={styles.input}
        placeholder={t('auth.email')}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      {infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          (isSubmitting || !email || !password) && styles.buttonDisabled,
          pressed && !isSubmitting && styles.buttonPressed,
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting || !email || !password}
      >
        {isSubmitting ? (
          <ActivityIndicator color={theme.colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>
            {isSignUp ? t('auth.signUp') : t('auth.signIn')}
          </Text>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.switchPressable, pressed && styles.switchPressed]}
        onPress={() => setIsSignUp(!isSignUp)}
      >
        <Text style={styles.switchText}>
          {isSignUp
            ? t('auth.switchToSignIn')
            : t('auth.switchToSignUp')}
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: theme.fontSize.xxxl,
      fontWeight: 'bold',
      textAlign: 'center',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: theme.fontSize.md,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
    },
    googleButton: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 14,
      alignItems: 'center',
    },
    googleButtonText: {
      color: theme.colors.text,
      fontSize: theme.fontSize.md,
      fontWeight: '600',
    },
    separatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.spacing.lg,
    },
    separatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    separatorText: {
      color: theme.colors.textFaint,
      fontSize: theme.fontSize.sm,
      marginHorizontal: theme.spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      padding: 14,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    buttonPressed: { transform: [{ scale: 0.97 }] },
    buttonDisabled: { opacity: 0.5 },
    buttonText: {
      color: theme.colors.primaryText,
      fontSize: theme.fontSize.md,
      fontWeight: '600',
    },
    switchPressable: { alignSelf: 'center', padding: theme.spacing.sm, borderRadius: theme.radius.md },
    switchPressed: { backgroundColor: theme.colors.surfaceAlt },
    switchText: {
      color: theme.colors.primary,
      textAlign: 'center',
    },
    error: {
      color: theme.colors.danger,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
    },
    info: {
      color: theme.colors.success,
      marginBottom: theme.spacing.md,
      textAlign: 'center',
    },
  });
}
