import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, Platform, Alert, ActivityIndicator,
  KeyboardAvoidingView, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/stores/userStore';
import { COLORS } from '@/constants';
import { SRCard, SRDivider, SRSectionLabel } from '@/components/ui';
import { validateUsername, describeProfileUsernameError } from '@/lib/validation';
import { supabase } from '@/lib/supabase';

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user, updateProfile, signOut } = useUserStore();

  // Profile fields
  const [nameDraft, setNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Username
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // Preferences
  const [unitsLbs, setUnitsLbs] = useState(false);
  const [restTimerDraft, setRestTimerDraft] = useState('90');
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    setNameDraft(user?.name ?? '');
    setBioDraft(user?.bio ?? '');
    setUsernameDraft(user?.username ?? '');
    setUsernameError('');
    setUnitsLbs(user?.units === 'lbs');
    setRestTimerDraft(String(user?.rest_timer_default ?? 90));
  }, [user?.id]);

  const saveProfile = useCallback(async () => {
    setSavingProfile(true);
    const { error } = await updateProfile({
      name: nameDraft.trim() || null,
      bio: bioDraft.trim() || null,
    });
    setSavingProfile(false);
    if (error) Alert.alert('Save failed', error.message);
    else Alert.alert('Saved', 'Profile updated.');
  }, [nameDraft, bioDraft, updateProfile]);

  const saveUsername = useCallback(async () => {
    if (!user) return;
    const clean = usernameDraft.trim().toLowerCase();
    if (!clean) { setUsernameError('Username is required.'); return; }
    const v = validateUsername(usernameDraft);
    if (v) { setUsernameError(v); return; }
    if (clean === (user.username ?? '').toLowerCase()) { setUsernameError(''); return; }
    setSavingUsername(true);
    setUsernameError('');
    const { error } = await updateProfile({ username: clean });
    setSavingUsername(false);
    if (error) setUsernameError(describeProfileUsernameError(error));
    else Alert.alert('Saved', 'Username updated.');
  }, [user, usernameDraft, updateProfile]);

  const savePrefs = useCallback(async () => {
    setSavingPrefs(true);
    const secs = parseInt(restTimerDraft, 10);
    const { error } = await updateProfile({
      units: unitsLbs ? 'lbs' : 'kg',
      rest_timer_default: isNaN(secs) || secs < 15 ? 90 : secs,
    });
    setSavingPrefs(false);
    if (error) Alert.alert('Save failed', error.message);
    else Alert.alert('Saved', 'Preferences updated.');
  }, [unitsLbs, restTimerDraft, updateProfile]);

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Sign out?')) void signOut();
      return;
    }
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This is permanent and irreversible. All your workouts, routines and data will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const { error } = await supabase.from('users').delete().eq('id', user.id);
            if (error) { Alert.alert('Error', error.message); return; }
            await supabase.auth.signOut();
            void signOut();
          },
        },
      ],
    );
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
        {/* ── Account ── */}
        <Text style={s.kicker}>Account</Text>
        <Text style={s.subKicker}>Profile</Text>
        <SRCard style={s.card}>
          <Text style={s.fieldLab}>Name</Text>
          <TextInput
            style={s.input}
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="Your name"
            placeholderTextColor={COLORS.ink3}
            autoComplete="name"
          />
          <Text style={[s.fieldLab, { marginTop: 14 }]}>Bio</Text>
          <TextInput
            style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={bioDraft}
            onChangeText={setBioDraft}
            placeholder="Short bio (optional)"
            placeholderTextColor={COLORS.ink3}
            multiline
            maxLength={160}
          />
          <TouchableOpacity
            style={[s.saveBtn, savingProfile && s.saveBtnDisabled]}
            onPress={() => void saveProfile()}
            disabled={savingProfile}
            activeOpacity={0.85}
          >
            {savingProfile ? <ActivityIndicator color={COLORS.bg} /> : <Text style={s.saveBtnTxt}>Save profile</Text>}
          </TouchableOpacity>
        </SRCard>

        <Text style={s.subKicker}>Account Settings</Text>
        <SRCard style={s.card}>
          <Text style={s.fieldLab}>Username</Text>
          <TextInput
            style={[s.input, usernameError ? s.inputErr : null]}
            value={usernameDraft}
            onChangeText={t => { setUsernameDraft(t); if (usernameError) setUsernameError(''); }}
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
            {savingUsername ? <ActivityIndicator color={COLORS.bg} /> : <Text style={s.saveBtnTxt}>Save username</Text>}
          </TouchableOpacity>
          <SRDivider indent={0} />
          <View style={s.staticRow}>
            <Text style={s.tapLab}>Email</Text>
            <Text style={s.mutedInline} numberOfLines={1}>{user?.email ?? '—'}</Text>
          </View>
        </SRCard>

        {/* ── Preferences ── */}
        <Text style={s.kicker}>Preferences</Text>
        <SRCard style={s.card}>
          <View style={s.prefRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.tapLab}>Weight units</Text>
              <Text style={s.hint}>{unitsLbs ? 'lbs' : 'kg'} — all weight displays use this</Text>
            </View>
            <Switch
              value={unitsLbs}
              onValueChange={setUnitsLbs}
              trackColor={{ false: COLORS.surface3, true: COLORS.blue }}
              thumbColor={COLORS.ink}
            />
          </View>
          <SRDivider indent={0} />
          <Text style={[s.fieldLab, { marginTop: 12 }]}>Rest timer default (seconds)</Text>
          <TextInput
            style={s.input}
            value={restTimerDraft}
            onChangeText={setRestTimerDraft}
            keyboardType="number-pad"
            placeholder="90"
            placeholderTextColor={COLORS.ink3}
          />
          <TouchableOpacity
            style={[s.saveBtn, savingPrefs && s.saveBtnDisabled]}
            onPress={() => void savePrefs()}
            disabled={savingPrefs}
            activeOpacity={0.85}
          >
            {savingPrefs ? <ActivityIndicator color={COLORS.bg} /> : <Text style={s.saveBtnTxt}>Save preferences</Text>}
          </TouchableOpacity>
        </SRCard>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/profile/import-export')}
          style={s.linkCard}
        >
          <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.blue} />
          <View style={{ flex: 1 }}>
            <Text style={s.tapLab}>Import / Export</Text>
            <Text style={s.hint}>Hevy workout CSV → import past sessions</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.ink3} />
        </TouchableOpacity>

        {/* ── Danger Zone ── */}
        <Text style={s.kicker}>Danger Zone</Text>
        <SRCard style={s.card}>
          <View style={s.staticRow}>
            <Text style={s.tapLab}>Version</Text>
            <Text style={s.mutedInline}>{appVersion}</Text>
          </View>
        </SRCard>

        <TouchableOpacity
          testID="settings-sign-out"
          onPress={handleSignOut}
          style={s.dangerBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.amber} style={{ marginRight: 8 }} />
          <Text style={[s.dangerBtnTxt, { color: COLORS.amber }]}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={[s.dangerBtn, s.dangerBtnRed]}
          activeOpacity={0.75}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.red} style={{ marginRight: 8 }} />
          <Text style={s.dangerBtnTxt}>Delete account</Text>
        </TouchableOpacity>

        <Text style={s.footer}>SuperReps v{appVersion} · Expo SDK 54 · Supabase + Groq</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 999, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  headerSpacer: { width: 40 },
  scroll: { paddingBottom: 60, paddingHorizontal: 14 },
  kicker: {
    fontSize: 11, color: COLORS.ink3, fontWeight: '800', letterSpacing: 1.1,
    marginBottom: 6, marginTop: 20, marginLeft: 6, textTransform: 'uppercase',
  },
  subKicker: { fontSize: 12, color: COLORS.ink3, fontWeight: '600', marginBottom: 6, marginLeft: 6, marginTop: 8 },
  card: { padding: 16, marginBottom: 0 },
  fieldLab: { fontSize: 12, fontWeight: '700', color: COLORS.ink3, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface2, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, fontWeight: '600', color: COLORS.ink,
  },
  inputErr: { borderColor: COLORS.red },
  fieldErr: { fontSize: 13, color: COLORS.red, marginTop: 8 },
  hint: { fontSize: 12, color: COLORS.ink3, marginTop: 6 },
  saveBtn: {
    marginTop: 14, backgroundColor: COLORS.blue, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnTxt: { fontSize: 15, fontWeight: '800', color: COLORS.bg },
  staticRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
  },
  tapLab: { fontSize: 15, color: COLORS.ink2, fontWeight: '600' },
  mutedInline: { fontSize: 14, color: COLORS.ink3, flex: 1, marginLeft: 12, textAlign: 'right' },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.border,
    paddingVertical: 16, paddingHorizontal: 16, marginTop: 10,
  },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, paddingVertical: 15, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.4)', backgroundColor: 'rgba(252,211,77,0.07)',
  },
  dangerBtnRed: {
    borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(248,113,113,0.07)',
  },
  dangerBtnTxt: { color: COLORS.red, fontWeight: '700', fontSize: 15 },
  footer: { fontSize: 11, color: COLORS.ink3, textAlign: 'center', marginTop: 24, marginBottom: 8 },
});
