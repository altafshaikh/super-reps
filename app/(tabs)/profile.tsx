import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, StatusBar } from 'react-native';
import { useUserStore } from '@/stores/userStore';
import { COLORS, GOAL_OPTIONS, LEVEL_OPTIONS } from '@/constants';
import { SRCard, SRPill, SRDivider, SRSectionLabel } from '@/components/ui';

export default function ProfileScreen() {
  const { user, signOut } = useUserStore();

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const goalLabel = GOAL_OPTIONS.find(g => g.value === user?.goal)?.label ?? 'Not set';
  const levelLabel = LEVEL_OPTIONS.find(l => l.value === user?.level)?.label ?? 'Not set';
  const equipmentLabel = (user?.equipment ?? []).join(', ') || 'Not set';
  const userName = user?.username ?? user?.email?.split('@')[0] ?? 'Lifter';
  const initial = userName[0]?.toUpperCase() ?? 'U';

  const rows = [
    { label: 'Goal', value: goalLabel },
    { label: 'Level', value: levelLabel },
    { label: 'Equipment', value: equipmentLabel },
  ];

  const appRows = [
    { label: 'Version', value: '1.0.0' },
    { label: 'AI Model', value: 'Groq Llama 3.3' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={s.header}>
          <Text style={s.pageTitle}>Profile</Text>
        </View>

        <View style={s.content}>
          {/* Avatar card */}
          <SRCard>
            <View style={s.avatarSection}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initial}</Text>
              </View>
              <Text style={s.userName}>{userName}</Text>
              <Text style={s.userEmail}>{user?.email}</Text>
              <SRPill label={`${user?.plan ?? 'Free'} Plan`} muted size="xs" style={{ marginTop: 8 }} />
            </View>
          </SRCard>

          {/* Training Profile */}
          <SRCard>
            <SRSectionLabel>Training Profile</SRSectionLabel>
            {rows.map((row, i) => (
              <View key={row.label}>
                {i > 0 && <SRDivider indent={20} />}
                <View style={s.listRow}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={s.rowValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </SRCard>

          {/* App */}
          <SRCard>
            <SRSectionLabel>App</SRSectionLabel>
            {appRows.map((row, i) => (
              <View key={row.label}>
                {i > 0 && <SRDivider indent={20} />}
                <View style={s.listRow}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={[s.rowValue, { color: COLORS.ink3 }]}>{row.value}</Text>
                </View>
              </View>
            ))}
          </SRCard>

          {/* Sign out */}
          <TouchableOpacity onPress={handleSignOut} style={s.signOutBtn} activeOpacity={0.8}>
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.ink },
  content: { paddingHorizontal: 14, gap: 10 },
  avatarSection: { alignItems: 'center', padding: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 99,
    backgroundColor: COLORS.ink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: COLORS.bg, fontSize: 28, fontWeight: '900' },
  userName: { fontSize: 20, fontWeight: '700', color: COLORS.ink },
  userEmail: { fontSize: 13, color: COLORS.ink3, marginTop: 2 },
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14, paddingHorizontal: 20,
  },
  rowLabel: { fontSize: 14, color: COLORS.ink2 },
  rowValue: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  signOutBtn: {
    borderWidth: 0.5, borderColor: COLORS.red,
    backgroundColor: COLORS.redLight,
    borderRadius: 14, padding: 16, alignItems: 'center',
    marginTop: 4,
  },
  signOutText: { color: COLORS.red, fontWeight: '700', fontSize: 15 },
});
