import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, Kicker } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette, useScheme } from '@/hooks/use-palette';
import { openOutside } from '@/lib/open';
import { authErrorMessage, cleanCode, PHONE_COUNTRIES, toE164Phone, type PhoneCountry } from '@/lib/phone';
import { SITE_ORIGIN } from '@/lib/site';
import { hideSplash } from '@/lib/splash';
import { supabase } from '@/lib/supabase';

/**
 * Sign in with the simplytk.com account: email and password, a texted code, or Sign in
 * with Apple, which App Review requires because the website also offers Google. Like the
 * website, a code to a new number makes the account; email accounts are made on the site.
 */
export default function SignInScreen() {
  const palette = usePalette();
  const scheme = useScheme();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Kicker>simplytk</Kicker>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
              Sign in.
              <Text style={{ color: palette.textSecondary }}>{'\n'}Same account as the website.</Text>
            </Text>
            <Text style={[styles.lede, { color: palette.textSecondary }]}>
              Your stars, streak and scores are the same here and on simplytk.com.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.methods}>
              <Chip label="Email" selected={method === 'email'} onPress={() => { setMethod('email'); setError(null); }} />
              <Chip label="Phone" selected={method === 'phone'} onPress={() => { setMethod('phone'); setError(null); }} />
            </View>
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
                <Text style={[styles.note, styles.left, { color: palette.textSecondary }]}>
                  We texted a code to {sentTo}.
                </Text>
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
              <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>
                {error}
              </Text>
            ) : null}
            {notice ? <Text style={[styles.error, { color: palette.textSecondary }]}>{notice}</Text> : null}
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
          </View>

          <View style={styles.links}>
            <Button
              variant="secondary"
              label="Forgot password"
              onPress={() => void openOutside(`${SITE_ORIGIN}/auth/reset`, 'browser')}
            />
            <Text style={[styles.note, { color: palette.textSecondary }]}>
              New to simplytk? Sign in with your phone or Apple, or make an account on the website.
            </Text>
            <Button
              variant="secondary"
              label="Create an account on simplytk.com"
              onPress={() => void openOutside(`${SITE_ORIGIN}/auth`, 'browser')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.five,
    gap: Spacing.six,
    flexGrow: 1,
    justifyContent: 'center',
  },
  head: {
    gap: Spacing.three,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -1.2,
  },
  lede: {
    fontSize: 16,
    lineHeight: 23,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    minHeight: 52,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  apple: {
    height: 50,
  },
  links: {
    gap: Spacing.three,
  },
  methods: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  left: {
    textAlign: 'left',
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
