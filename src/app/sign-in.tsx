import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/text';
import { Button, Chip, Segmented, Wordmark } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette, useScheme } from '@/hooks/use-palette';
import { GOOGLE_RETURN_URL, googleSignInUrl, googleSessionError, readOAuthReturn } from '@/lib/google';
import { openOutside } from '@/lib/open';
import { authErrorMessage, cleanCode, PHONE_COUNTRIES, toE164Phone, type PhoneCountry } from '@/lib/phone';
import { SITE_ORIGIN } from '@/lib/site';
import { hideSplash } from '@/lib/splash';
import { supabase } from '@/lib/supabase';

/**
 * iOS 17.4 is the first that lets an auth session catch an https return address, which
 * Google sign-in needs (src/lib/google.ts).
 */
function canSignInWithGoogle(): boolean {
  if (Platform.OS !== 'ios') return false;
  const [major = 0, minor = 0] = String(Platform.Version).split('.').map(Number);
  return major > 17 || (major === 17 && minor >= 4);
}

/**
 * Sign in with the simplytk.com account: email and password, a texted code, Google, or
 * Sign in with Apple, which App Review requires because Google is offered. Like the
 * website, a code to a new number makes the account; email accounts are made on the site.
 */
export default function SignInScreen() {
  const palette = usePalette();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [country, setCountry] = useState<PhoneCountry>('GB');
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(hideSplash, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  async function signInWithPassword() {
    setError(null);
    setBusy(true);
    const { error: failure } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (failure) setError(authErrorMessage(failure));
  }

  async function sendCode(target: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    const { error: failure } = await supabase.auth.signInWithOtp({ phone: target });
    setBusy(false);
    if (failure) {
      setError(authErrorMessage(failure));
      return false;
    }
    return true;
  }

  async function sendPhoneCode() {
    const target = toE164Phone(country, phone);
    if (!target) {
      setError('That doesn’t look like a full mobile number. Check the country and the number.');
      return;
    }
    if (await sendCode(target)) {
      setCode('');
      setSentTo(target);
    }
  }

  async function resendCode() {
    if (sentTo && (await sendCode(sentTo))) setNotice('A new code is on its way.');
  }

  async function verifyCode() {
    if (!sentTo) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    const { data, error: failure } = await supabase.auth.verifyOtp({ phone: sentTo, token: code, type: 'sms' });
    setBusy(false);
    if (failure) setError(authErrorMessage(failure));
    else if (!data.session) setError('Couldn’t verify the code. Send a new one and try again.');
  }

  async function signInWithGoogle() {
    setError(null);
    setNotice(null);
    const state = Crypto.randomUUID();
    try {
      const result = await WebBrowser.openAuthSessionAsync(googleSignInUrl(state), GOOGLE_RETURN_URL, {
        preferUniversalLinks: true,
      });
      if (result.type !== 'success') {
        // iOS reports a session that couldn't open as a cancel with an error, so show it
        // rather than leave the button looking dead.
        const failure = googleSessionError((result as { error?: string | null }).error);
        if (failure) setError(failure);
        return;
      }
      const answer = readOAuthReturn(result.url, state);
      if ('error' in answer) {
        setError(answer.error);
        return;
      }
      setBusy(true);
      const { error: failure } = await supabase.auth.setSession(answer.tokens);
      setBusy(false);
      if (failure) setError(authErrorMessage(failure));
    } catch (failure) {
      setBusy(false);
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  async function signInWithApple() {
    setError(null);
    try {
      // Apple signs a hash of the nonce; Supabase checks it against the raw one.
      const nonce = Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashed,
      });
      if (!credential.identityToken) throw new Error('Apple did not return a sign-in token.');
      setBusy(true);
      const { error: failure } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce,
      });
      setBusy(false);
      if (failure) setError(failure.message);
    } catch (failure) {
      setBusy(false);
      if ((failure as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: palette.surface, borderColor: palette.hair, color: palette.text },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.head, { paddingTop: insets.top + Spacing.five }]}>
        <Wordmark size={26} />
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
          Welcome back
        </Text>
        <Text style={[styles.lede, { color: palette.textSecondary }]}>
          Your stars, streak and scores match simplytk.com.
        </Text>
      </View>

      {/* The sheet runs to the screen's bottom edge, so the display's own curved corners round it. */}
      <View
        style={[
          styles.sheet,
          { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, Spacing.four) + Spacing.two },
        ]}>
        <Segmented
          options={[
            ['email', 'Email'],
            ['phone', 'Phone'],
          ]}
          value={method}
          onChange={(next) => {
            setMethod(next);
            setError(null);
          }}
        />
        {method === 'email' ? (
          <>
            <TextInput
              accessibilityLabel="Email"
              placeholder="Email"
              placeholderTextColor={palette.faint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              style={inputStyle}
            />
            <TextInput
              accessibilityLabel="Password"
              placeholder="Password"
              placeholderTextColor={palette.faint}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={signInWithPassword}
              style={inputStyle}
            />
          </>
        ) : sentTo ? (
          <>
            <Text style={[styles.note, { color: palette.textSecondary }]}>We texted a code to {sentTo}.</Text>
            <TextInput
              accessibilityLabel="Code"
              placeholder="6-digit code"
              placeholderTextColor={palette.faint}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              returnKeyType="go"
              value={code}
              onChangeText={(text) => setCode(cleanCode(text))}
              onSubmitEditing={verifyCode}
              style={inputStyle}
            />
          </>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methods}>
              {PHONE_COUNTRIES.map((c) => (
                <Chip key={c.iso} label={`${c.name} +${c.dial}`} selected={country === c.iso} onPress={() => setCountry(c.iso)} />
              ))}
            </ScrollView>
            <TextInput
              accessibilityLabel="Mobile number"
              placeholder="Mobile number"
              placeholderTextColor={palette.faint}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="go"
              value={phone}
              onChangeText={setPhone}
              onSubmitEditing={sendPhoneCode}
              style={inputStyle}
            />
          </>
        )}
        {error ? (
          <Text accessibilityRole="alert" style={[styles.note, { color: palette.danger }]}>
            {error}
          </Text>
        ) : null}
        {notice ? <Text style={[styles.note, { color: palette.textSecondary }]}>{notice}</Text> : null}
        {method === 'email' ? (
          <Button label="Sign in" onPress={signInWithPassword} busy={busy} disabled={!email.trim() || !password} />
        ) : sentTo ? (
          <>
            <Button label="Verify and sign in" onPress={verifyCode} busy={busy} disabled={code.length < 6} />
            <View style={styles.methods}>
              <Chip label="Send a new code" selected={false} onPress={() => void resendCode()} />
              <Chip label="Use a different number" selected={false} onPress={() => { setSentTo(null); setNotice(null); setError(null); }} />
            </View>
          </>
        ) : (
          <Button label="Text me a code" onPress={sendPhoneCode} busy={busy} disabled={!phone.trim()} />
        )}
        {canSignInWithGoogle() ? (
          <Button variant="secondary" label="Continue with Google" onPress={signInWithGoogle} />
        ) : null}
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={Radius.pill}
            style={styles.apple}
            onPress={signInWithApple}
          />
        ) : null}
        <View style={styles.links}>
          <TextLink label="Forgot password?" onPress={() => void openOutside(`${SITE_ORIGIN}/auth/reset`, 'browser')} />
          <TextLink label="Create an account" onPress={() => void openOutside(`${SITE_ORIGIN}/auth`, 'browser')} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** A small text button for the two links under the sign-in buttons. */
function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}>
      {({ pressed }) => (
        <Text style={[styles.link, { color: palette.tint, opacity: pressed ? 0.5 : 1 }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    flex: 1,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.9,
    marginTop: Spacing.two,
  },
  lede: {
    fontSize: 16,
    lineHeight: 22,
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: 'continuous',
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  input: {
    minHeight: 50,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
  },
  apple: {
    height: 50,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
  },
  methods: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
  },
});
