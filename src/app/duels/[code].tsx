import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { Button, Card, Hero, Kicker, onHero, Pill, Screen } from '@/components/ui';
import { Spacing, Tabular } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { duelDeadline, duelHeadline, duelShareText, duelStatusLabel, duelStatusTone, yourMove } from '@/lib/duels';
import { shareLink } from '@/lib/open';
import { actOnDuel, getDuel, type Duel, type DuelSide } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';
import { openSitePath } from '@/lib/web-pages';

/** One 1v1: who's in it, the scores, and what to do next. */
export default function DuelScreen() {
  const palette = usePalette();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { data, error, missing, refreshing, refresh, reload, setData } = useLoad(() => getDuel(code), code);
  const [busy, setBusy] = useState(false);

  // Back from playing the run, the score may have landed.
  useFocusEffect(
    useCallback(() => {
      hideSplash();
      void reload();
    }, [reload]),
  );

  async function act(action: 'accept' | 'cancel') {
    setBusy(true);
    try {
      setData(await actOnDuel(code, action));
    } catch (failure) {
      Alert.alert('Couldn’t do that', failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  function share(duel: Duel) {
    void shareLink({ title: `1v1 on ${duel.label}`, text: duelShareText(duel.label, duel.challenger.scoreText, duel.link), url: duel.link });
  }

  const duel = data;
  const now = new Date();

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <LoadState loaded={!!duel} error={error} missing={missing} retry={refresh} web={{ path: `/1v1/${code}`, title: '1v1 challenge' }} />

      {duel ? (
        <>
          <Hero>
            <View style={styles.heroHead}>
              <Kicker color={onHero.secondary}>{`1v1 · ${duel.label}`}</Kicker>
              <Text style={styles.heroNote}>{duel.status === 'open' || duel.status === 'live' ? duelDeadline(duel.expiresAt, now) : ''}</Text>
            </View>
            <Text style={styles.headline}>{duelHeadline(duel)}</Text>
            <Text style={styles.heroBody}>{`One ranked run each, ${duel.lowerIsBetter ? 'lowest' : 'highest'} score wins.`}</Text>
          </Hero>

          <View style={styles.sides}>
            <SideCard title="Challenger" side={duel.challenger} winner={duel.result === 'challenger'} />
            <SideCard title="Opponent" side={duel.opponent} winner={duel.result === 'opponent'} />
          </View>

          <View style={styles.actions}>
            {duel.status === 'open' && duel.yourRole !== 'challenger' ? (
              <Button label="Accept the challenge" busy={busy} onPress={() => void act('accept')} />
            ) : null}
            {yourMove(duel) ? (
              <Button
                label={`Play ${duel.label}`}
                icon={{ ios: 'play.fill', android: 'play_arrow' }}
                onPress={() => openSitePath(duel.path, duel.label)}
              />
            ) : null}
            {duel.status === 'open' && duel.yourRole === 'challenger' ? (
              <>
                <Button label="Send the link" icon={{ ios: 'square.and.arrow.up', android: 'share' }} onPress={() => share(duel)} />
                <Button
                  variant="secondary"
                  label={duel.challenger.score == null ? `Play ${duel.label} now` : 'Play again'}
                  onPress={() => openSitePath(duel.path, duel.label)}
                />
                <Button
                  variant="secondary"
                  label="Cancel the challenge"
                  busy={busy}
                  onPress={() =>
                    Alert.alert('Cancel this 1v1?', 'The link stops working.', [
                      { text: 'Keep it', style: 'cancel' },
                      { text: 'Cancel it', style: 'destructive', onPress: () => void act('cancel') },
                    ])
                  }
                />
              </>
            ) : null}
            {duel.status !== 'open' ? (
              <Button variant="secondary" label="Share" icon={{ ios: 'square.and.arrow.up', android: 'share' }} onPress={() => share(duel)} />
            ) : null}
          </View>

          <View style={styles.statusRow}>
            <Pill label={duelStatusLabel(duel)} tone={duelStatusTone(duel)} />
            <Text style={[styles.note, { color: palette.textSecondary }]}>{`Code ${duel.code}`}</Text>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function SideCard({ title, side, winner }: { title: string; side: DuelSide | null; winner: boolean }) {
  const palette = usePalette();
  return (
    <Card style={[styles.side, winner && { borderColor: palette.success, borderWidth: 2 }]}>
      <Kicker color={winner ? palette.success : undefined}>{winner ? `${title} · Winner` : title}</Kicker>
      <Text style={[styles.player, { color: palette.text }]} numberOfLines={1}>
        {side ? (side.isYou ? 'You' : (side.username ?? 'A player')) : 'Empty seat'}
      </Text>
      <Text style={[styles.score, Tabular, { color: side?.scoreText ? palette.text : palette.faint }]}>
        {side?.scoreText ?? '–'}
      </Text>
      <Text style={[styles.note, { color: palette.textSecondary }]}>{side ? (side.scoreText ? 'Run in' : 'Not played yet') : 'Waiting'}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroNote: {
    color: onHero.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  headline: {
    color: onHero.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  heroBody: {
    color: onHero.secondary,
    fontSize: 15,
    lineHeight: 21,
  },
  sides: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  side: {
    flex: 1,
    gap: Spacing.one,
  },
  player: {
    fontSize: 17,
    fontWeight: '700',
  },
  score: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  actions: {
    gap: Spacing.three,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  note: {
    fontSize: 13,
  },
});
