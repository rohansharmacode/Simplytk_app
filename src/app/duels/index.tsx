import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { LoadState } from '@/components/load-state';
import { Text, TextInput } from '@/components/text';
import { Button, Card, Chip, Group, Hero, HeroStats, Kicker, onHero, Row, Screen, SectionHeader, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { duelCodeFrom, duelStatusLabel, duelStatusTone, DUEL_WINDOW_DAYS, yourMove, yourSide } from '@/lib/duels';
import { createDuel, getDuels } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';

/** 1v1 challenges: pick a game, send the link, best ranked run wins. */
export default function DuelsScreen() {
  const palette = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ game?: string }>();
  const { data, error, missing, refreshing, refresh, reload } = useLoad(getDuels);
  const [game, setGame] = useState<string | null>(params.game ?? null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');

  useFocusEffect(
    useCallback(() => {
      hideSplash();
      void reload();
    }, [reload]),
  );

  const chosen = data?.games.find((g) => g.key === game) ?? data?.games[0];

  async function start() {
    if (!chosen) return;
    setCreating(true);
    try {
      const { code: created } = await createDuel(chosen.key);
      router.push({ pathname: '/duels/[code]', params: { code: created } });
    } catch (failure) {
      Alert.alert('Couldn’t start the 1v1', failure instanceof Error ? failure.message : String(failure));
    } finally {
      setCreating(false);
    }
  }

  function open() {
    const parsed = duelCodeFrom(code);
    if (!parsed) {
      Alert.alert('That isn’t a challenge link', 'Paste the 1v1 link your friend sent, or just its code.');
      return;
    }
    setCode('');
    router.push({ pathname: '/duels/[code]', params: { code: parsed } });
  }

  const duels = data?.duels ?? [];
  const wins = duels.filter((d) => d.status === 'settled' && d.result === d.yourRole).length;
  const live = duels.filter((d) => d.status === 'open' || d.status === 'live');

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="Practice" title="1v1 challenge" />

      <Hero>
        <Kicker color={onHero.secondary}>One run each</Kicker>
        <Text style={styles.heroBody}>
          Pick a game and send the link. Whoever accepts is your opponent, and the best ranked run wins.
        </Text>
        <HeroStats
          stats={[
            { value: data ? String(live.length) : '–', label: 'In play' },
            { value: data ? String(wins) : '–', label: 'Won' },
            { value: data ? String(duels.length) : '–', label: 'All time' },
          ]}
        />
      </Hero>

      <LoadState loaded={!!data} error={error} missing={missing} retry={refresh} web={{ path: '/1v1', title: '1v1 challenge' }} />

      {data ? (
        <>
          <SectionHeader title="Start a challenge" icon={{ ios: 'figure.fencing', android: 'sports_kabaddi' }} />
          <Card style={styles.card}>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              Your first ranked run of the game after you start counts, so start first and play second.
            </Text>
            <View style={styles.chips}>
              {data.games.map((option) => (
                <Chip key={option.key} label={option.label} selected={chosen?.key === option.key} onPress={() => setGame(option.key)} />
              ))}
            </View>
            <Button label={chosen ? `Challenge on ${chosen.label}` : 'Pick a game'} busy={creating} disabled={!chosen} onPress={() => void start()} />
          </Card>

          <Card style={styles.card}>
            <Kicker>Got a link?</Kicker>
            <View style={[styles.search, { backgroundColor: palette.raised }]}>
              <SymbolView name={{ ios: 'link', android: 'link', web: 'link' }} tintColor={palette.faint} size={16} />
              <TextInput
                accessibilityLabel="Challenge link or code"
                placeholder="Paste a 1v1 link or code"
                placeholderTextColor={palette.faint}
                autoCapitalize="none"
                autoCorrect={false}
                value={code}
                onChangeText={setCode}
                onSubmitEditing={open}
                returnKeyType="go"
                style={[styles.input, { color: palette.text }]}
              />
            </View>
            <Button variant="secondary" label="Open challenge" disabled={!code.trim()} onPress={open} />
          </Card>

          {duels.length ? (
            <>
              <SectionHeader title="Your challenges" icon={{ ios: 'list.bullet', android: 'list' }} count={duels.length} />
              <Group>
                {duels.map((duel) => {
                  const mine = yourSide(duel);
                  const theirs = duel.yourRole === 'challenger' ? duel.opponent : duel.challenger;
                  return (
                    <Row
                      key={duel.code}
                      icon={{ ios: 'person.2.fill', android: 'group' }}
                      tone={duelStatusTone(duel)}
                      title={`${duel.label}${theirs?.username ? ` vs ${theirs.username}` : ''}`}
                      subtitle={
                        yourMove(duel)
                          ? 'Your move: play your run'
                          : [mine?.scoreText && `You ${mine.scoreText}`, theirs?.scoreText && `Them ${theirs.scoreText}`]
                              .filter(Boolean)
                              .join(' · ') || duelStatusLabel(duel)
                      }
                      pill={{ label: duelStatusLabel(duel), tone: duelStatusTone(duel) }}
                      onPress={() => router.push({ pathname: '/duels/[code]', params: { code: duel.code } })}
                    />
                  );
                })}
              </Group>
            </>
          ) : null}

          <Text style={[styles.note, { color: palette.textSecondary }]}>
            {`Both runs have to land within ${DUEL_WINDOW_DAYS} days. At the deadline, one run in is a walkover for the side that played, and none makes it void. Runs still count for the leaderboards as usual.`}
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBody: {
    color: onHero.secondary,
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    gap: Spacing.three,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
});
