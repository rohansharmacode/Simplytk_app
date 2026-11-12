import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, Note, Picker, Points, Rewrite, ScoreBadge } from '@/components/ai-tool';
import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { Button, Card, Group, Hero, HeroStats, Kicker, onHero, Row, Screen, SectionHeader, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { useRun } from '@/hooks/use-run';
import { quotaLine, scoreTone, tierNote } from '@/lib/ai-tools';
import { pickCv } from '@/lib/pick-cv';
import { getCvRater, rateCv, type CvRating, type UploadedFile } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';

/** The CV rater: upload a CV, get a mark out of 100 against the role, with rewrites. */
export default function CvRaterScreen() {
  const palette = usePalette();
  const { data, error, missing, refreshing, refresh, reload } = useLoad(getCvRater);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [sector, setSector] = useState('investment_banking');
  const [jobDescription, setJobDescription] = useState('');
  const [username, setUsername] = useState('');
  const [rating, setRating] = useState<CvRating | null>(null);
  const picking = useRun();
  const rating$ = useRun();

  useFocusEffect(hideSplash);

  async function choose() {
    const picked = await picking.run(pickCv);
    if (picked) setFile(picked);
  }

  async function rate() {
    if (!file) return;
    const result = await rating$.run(() =>
      rateCv({ ...file, targetRole: targetRole.trim(), targetCompany: targetCompany.trim(), sector, jobDescription, username: username.trim() }),
    );
    if (result) {
      setRating(result);
      void reload();
    }
  }

  const needsUsername = data ? data.username === null : false;
  const ready = !!file && targetRole.trim().length >= 3 && (!needsUsername || username.trim().length >= 3);
  const history = data?.history.slice().reverse() ?? [];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="AI tools" title="CV rater" />

      <LoadState loaded={!!data} error={error} missing={missing} retry={refresh} web={{ path: '/cv-rater', title: 'CV rater' }} />

      {data && !rating ? (
        <>
          <Hero>
            <Kicker color={onHero.secondary}>Marked like a recruiter would</Kicker>
            <Text style={styles.heroBody}>
              Upload your CV and say what you’re applying for. You get a mark out of 100, what’s working, what to fix and
              stronger versions of your weakest bullets.
            </Text>
          </Hero>
          <Card style={styles.card}>
            <Button
              variant={file ? 'secondary' : 'primary'}
              label={file ? file.fileName : 'Choose your CV'}
              icon={{ ios: 'doc.badge.plus', android: 'upload_file' }}
              busy={picking.busy}
              onPress={() => void choose()}
            />
            <Note text={picking.error ?? 'PDF, Word (.docx) or text, under 5 MB.'} tone={picking.error ? 'error' : undefined} />
            <Field label="Role you’re targeting" placeholder="e.g. Spring week, investment banking" value={targetRole} onChangeText={setTargetRole} />
            <Field label="Firm (optional)" placeholder="e.g. Morgan Stanley" value={targetCompany} onChangeText={setTargetCompany} />
            <Picker label="Sector" options={data.sectors} value={sector} onChange={setSector} />
            <Field
              label="Job advert (optional)"
              multiline
              placeholder="Paste the advert to see which requirements your CV shows. A rating against an advert stays off the leaderboard."
              value={jobDescription}
              onChangeText={setJobDescription}
            />
            {needsUsername ? (
              <Field
                label="Leaderboard name"
                placeholder="Pick a username"
                value={username}
                onChangeText={setUsername}
                hint="Shown next to your score on the CV leaderboard. You only pick it once."
              />
            ) : null}
            <Button label="Rate my CV" icon={{ ios: 'sparkles', android: 'auto_awesome' }} busy={rating$.busy} disabled={!ready} onPress={() => void rate()} />
            <Note text={rating$.error} tone="error" />
            <Note text={quotaLine(data.quota, 'rating')} />
          </Card>

          {history.length ? (
            <>
              <SectionHeader title="Your ratings" icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up' }} count={history.length} />
              <Group>
                {history.map((point) => (
                  <Row
                    key={point.id}
                    icon={{ ios: 'doc.text.fill', android: 'description' }}
                    title={point.targetRole || point.fileName}
                    subtitle={`${new Date(point.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${point.fileName}`}
                    pill={{ label: `${point.score}`, tone: scoreTone(point.score, 100) }}
                  />
                ))}
              </Group>
            </>
          ) : null}
        </>
      ) : null}

      {rating ? (
        <>
          <Hero>
            <Kicker color={onHero.secondary}>{targetRole.trim() || 'Your CV'}</Kicker>
            <HeroStats
              stats={[
                { value: `${rating.score}`, label: 'Out of 100' },
                { value: rating.ranked ? `#${rating.rank}` : '–', label: rating.ranked ? 'On the board' : 'Not ranked' },
                { value: `${rating.percentile}%`, label: 'Better than' },
              ]}
            />
          </Hero>
          <Note text={tierNote(rating.tier)} />
          {rating.previousBest != null ? (
            <Note text={rating.score > rating.previousBest ? `Up from your best of ${rating.previousBest}.` : `Your best is still ${rating.previousBest}.`} />
          ) : null}

          <SectionHeader title="By section" icon={{ ios: 'square.grid.2x2.fill', android: 'grid_view' }} />
          {rating.categories.map((category) => (
            <Card key={category.name} style={styles.card}>
              <View style={styles.categoryHead}>
                <Text style={[styles.categoryName, { color: palette.text }]}>{category.name}</Text>
                <ScoreBadge score={category.score} outOf={10} />
              </View>
              <Text style={[styles.body, { color: palette.textSecondary }]}>{category.comment}</Text>
            </Card>
          ))}

          <Points title="What’s working" points={rating.strengths} tone="green" />
          <Points title="What to fix first" points={rating.improvements} tone="amber" />
          {rating.jobMatch ? (
            <>
              <Points title="The advert asks for, and your CV shows" points={rating.jobMatch.met} tone="green" />
              <Points title="The advert asks for, and your CV doesn’t show" points={rating.jobMatch.missing} tone="red" />
            </>
          ) : null}

          {rating.bulletRewrites.length ? (
            <>
              <SectionHeader title="Stronger bullets" icon={{ ios: 'pencil.line', android: 'edit_note' }} count={rating.bulletRewrites.length} />
              {rating.bulletRewrites.map((rewrite) => (
                <Rewrite key={rewrite.original} {...rewrite} />
              ))}
            </>
          ) : null}

          {rating.atsChecks.length ? (
            <>
              <SectionHeader title="Screening checks" icon={{ ios: 'checklist', android: 'checklist' }} />
              <Group>
                {rating.atsChecks.map((check) => (
                  <Row
                    key={check.name}
                    icon={check.passed ? { ios: 'checkmark', android: 'check' } : { ios: 'exclamationmark', android: 'priority_high' }}
                    tone={check.passed ? 'green' : 'amber'}
                    title={check.name}
                    subtitle={check.detail}
                  />
                ))}
              </Group>
            </>
          ) : null}

          <Button variant="secondary" label="Rate another version" onPress={() => setRating(null)} />
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
  categoryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
});
