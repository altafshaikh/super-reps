import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/stores/userStore';
import { COLORS, GOAL_OPTIONS, LEVEL_OPTIONS } from '@/constants';
import type { Plan } from '@/types';
import { SRCard, SRPill, SRDivider, SRSectionLabel } from '@/components/ui';
import { validateUsername, describeProfileUsernameError } from '@/lib/validation';

function planLabel(plan: Plan | undefined) {
  const p = plan ?? 'free';
  return `${p.charAt(0).toUpperCase() + p.slice(1)} plan`;
}

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user, updateProfile, signOut } = useUserStore();
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    setUsernameDraft(user?.username ?? '');
    setUsernameError('');
  }, [user?.username]);

  const goalLabel = GOAL_OPTIONS.find(g => g.value === user?.goal)?.label ?? 'Not set';
  const levelLabel = LEVEL_OPTIONS.find(l => l.value === user?.level)?.label ?? 'Not set';
  const equipmentLabel = (user?.equipment ?? []).join(', ') || 'Not set';
  const plan = user?.plan ?? 'free';

  const trainingRows: {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    href: '/(auth)/onboarding/goal' | '/(auth)/onboarding/level' | '/(auth)/onboarding/equipment';
  }[] = [
    { label: 'Goal', value: goalLabel, icon: 'flag-outline', href: '/(auth)/onboarding/goal' },
    { label: 'Level', value: levelLabel, icon: 'barbell-outline', href: '/(auth)/onboarding/level' },
    {
      label: 'Equipment',
      value: equipmentLabel,
      icon: 'hardware-chip-outline',
      href: '/(auth)/onboarding/equipment',
    },
  ];

  const saveUsername = useCallback(async () => {
    if (!user) return;
    const clean = usernameDraft.trim().toLowerCase();
    if (!clean) {
      setUsernameError('Username is required.');
      return;
    }
    const v = validateUsername(usernameDraft);
    if (v) {
      setUsernameError(v);
      return;
    }
    if (clean === (user.username ?? '').toLowerCase()) {
      setUsernameError('');
      return;
    }
    setSavingUsername(true);
    setUsernameError('');
    const { error } = await updateProfile({ username: clean });
    setSavingUsername(false);
    if (error) {
      setUsernameError(describeProfileUsernameError(error));
      return;
    }
    Alert.alert('Saved', 'Your username was updated.');
  }, [user, usernameDraft, updateProfile]);

  const signOutRun = () => {
    void signOut();
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Sign out?')) signOutRun();
      return;
    }
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOutRun },
    ]);
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={hitSlop}>
          <Ionicons name="arrow-back" size={22} color={COLORS.ink} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.kicker}>Profile</Text>
        <SRCard>
          <Text style={s.fieldLab}>Username</Text>
          <TextInput
            style={[s.input, usernameError ? s.inputErr : null]}
            value={usernameDraft}
            onChangeText={t => {
              setUsernameDraft(t);
              if (usernameError) setUsernameError('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            placeholder="your_handle"
            placeholderTextColor={COLORS.ink3}
          />
          {!!usernameError && <Text style={s.fieldErr}>{usernameError}</Text>}
          <Text style={s.hint}>Lowercase letters, numbers, and underscores only.</Text>
          <TouchableOpacity
            style={[s.saveBtn, savingUsername && s.saveBtnDisabled]}
            onPress={() => void saveUsername()}
            disabled={savingUsername}
            activeOpacity={0.85}
          >
            {savingUsername ? (
              <ActivityIndicator color={COLORS.bg} />
            ) : (
              <Text style={s.saveBtnTxt}>Save username</Text>
            )}
          </TouchableOpacity>
          <SRDivider indent={0} />
          <View style={s.staticRow}>
            <Text style={s.tapLab}>Email</Text>
            <Text style={s.mutedInline} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
        </SRCard>

        <Text style={s.kicker}>Training profile</Text>
        <SRCard>
          <SRSectionLabel action="Edit" onAction={() => router.push('/(auth)/onboarding/goal')}>
            Goal, level & equipment
          </SRSectionLabel>
          {trainingRows.map((row, i) => (
            <View key={row.label}>
              {i > 0 && <SRDivider indent={20} />}
              <TouchableOpacity
                style={s.tapRow}
                onPress={() => router.push(row.href)}
                activeOpacity={0.65}
              >
                <View style={s.tapLeft}>
                  <View style={s.iconWrap}>
                    <Ionicons name={row.icon} size={20} color={COLORS.blue} />
                  </View>
                  <Text style={s.tapLab}>{row.label}</Text>
                </View>
                <View style={s.tapRight}>
                  <Text style={s.tapVal} numberOfLines={1}>
                    {row.value}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.ink3} />
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </SRCard>

        <Text style={s.kicker}>Data</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/profile/import-export')}
          style={s.dataCard}
        >
          <View style={s.dataCardInner}>
            <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.blue} />
            <View style={{ flex: 1 }}>
              <Text style={s.dataCardTitle}>Import / Export</Text>
              <Text style={s.dataCardSub}>Hevy workout CSV → import past sessions</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
          </View>
        </TouchableOpacity>

        <Text style={s.kicker}>About</Text>
        <SRCard>
          <SRSectionLabel>About this app</SRSectionLabel>
          <View style={s.staticRow}>
            <Text style={s.tapLab}>Version</Text>
            <Text style={s.mutedInline}>{appVersion}</Text>
          </View>
          <SRDivider indent={20} />
          <View style={s.staticRow}>
            <Text style={s.tapLab}>AI model</Text>
            <Text style={s.mutedInline}>Groq Llama 3.3</Text>
          </View>
        </SRCard>

        <SRPill
          label={planLabel(plan)}
          green={plan === 'pro'}
          ghost={plan === 'free'}
          size="sm"
          style={{ alignSelf: 'center', marginTop: 8 }}
        />

        <TouchableOpacity onPress={handleSignOut} style={s.signOut} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.red} style={{ marginRight: 8 }} />
          <Text style={s.signOutTxt}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  headerSpacer: { width: 40 },
  scroll: { paddingBottom: 48, paddingHorizontal: 14 },
  kicker: {
    fontSize: 11,
    color: COLORS.ink3,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 8,
    marginTop: 12,
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  fieldLab: { fontSize: 12, fontWeight: '700', color: COLORS.ink3, marginBottom: 8, paddingHorizontal: 4 },
  input: {
    backgroundColor: COLORS.surface2,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
  },
  inputErr: { borderColor: COLORS.red },
  fieldErr: { fontSize: 13, color: COLORS.red, marginTop: 8, paddingHorizontal: 4 },
  hint: { fontSize: 12, color: COLORS.ink3, marginTop: 8, paddingHorizontal: 4 },
  saveBtn: {
    marginTop: 14,
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnTxt: { fontSize: 16, fontWeight: '800', color: COLORS.bg },
  staticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  tapLab: { fontSize: 15, color: COLORS.ink2, fontWeight: '600' },
  mutedInline: { fontSize: 14, color: COLORS.ink3, flex: 1, marginLeft: 12, textAlign: 'right' },
  tapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 16,
  },
  tapLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tapRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end', marginLeft: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapVal: { fontSize: 14, fontWeight: '600', color: COLORS.ink, textAlign: 'right', maxWidth: '55%' },
  dataCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    marginBottom: 10,
    marginHorizontal: 2,
  },
  dataCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  dataCardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
  dataCardSub: { fontSize: 12, color: COLORS.ink3, marginTop: 3 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
  },
  signOutTxt: { color: COLORS.red, fontWeight: '700', fontSize: 15 },
});
