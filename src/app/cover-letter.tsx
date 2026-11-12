import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Copyable, Field, Note, Picker, Points, Rewrite, ScoreBadge } from '@/components/ai-tool';
import { LoadState } from '@/components/load-state';
import { Text } from '@/components/text';
import { Button, Card, Chip, Hero, HeroStats, Kicker, onHero, Screen, Segmented, SectionHeader, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoad } from '@/hooks/use-load';
import { usePalette } from '@/hooks/use-palette';
import { useRun } from '@/hooks/use-run';
import { countWords, quotaLine, tierNote } from '@/lib/ai-tools';
import { pickCv } from '@/lib/pick-cv';
import { draftLetter, getCoverLetter, reviewLetter, type LetterDraft, type LetterReview, type UploadedFile } from '@/lib/site-api';
import { hideSplash } from '@/lib/splash';

type Mode = 'draft' | 'review';

/** The cover letter tool: a first draft built from your CV, or a review of a letter you wrote. */
export default function CoverLetterScreen() {
  const palette = usePalette();
  const { data, error, missing, refreshing, refresh, reload } = useLoad(getCoverLetter);
  const [mode, setMode] = useState<Mode>('draft');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [sector, setSector] = useState('general');
  const [level, setLevel] = useState('internship');
  const [jobDescription, setJobDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [cvId, setCvId] = useState<string | null>(null);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [letter, setLetter] = useState('');
  const [username, setUsername] = useState('');
  const [draft, setDraft] = useState<LetterDraft | null>(null);
  const [review, setReview] = useState<LetterReview | null>(null);
  const picking = useRun();
  const working = useRun();

  useFocusEffect(hideSplash);

  const target = { company: company.trim(), role: role.trim(), sector, level, jobDescription };
  const chosenCv = cvId ?? data?.cvs[0]?.id ?? null;
  const needsUsername = data ? data.username === null : false;
  const targetReady = target.company.length >= 2 && target.role.length >= 3;

  async function choose() {
    const picked = await picking.run(pickCv);
    if (picked) setFile(picked);
  }

  async function write() {
    const source = file ?? (chosenCv ? { cvRatingId: chosenCv } : null);
    if (!source) return;
    const result = await working.run(() => draftLetter({ ...target, notes, ...source }));
    if (result) {
      setDraft(result);
      setLetter(result.letter);
      void reload();
    }
  }

  async function mark() {
    const result = await working.run(() => reviewLetter({ ...target, letter, username: username.trim() }));
    if (result) {
      setReview(result);
      void reload();
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Title eyebrow="AI tools" title="Cover letter" />
      <LoadState loaded={!!data} error={error} missing={missing} retry={refresh} web={{ path: '/cover-letter', title: 'Cover letter' }} />

      {data ? (
        <>
          <Hero>
            <Kicker color={onHero.secondary}>Grounded in your own CV</Kicker>
            <Text style={styles.heroBody}>
              Draft a first letter from your CV that never invents anything, or have a letter you wrote marked against what
              screeners look for.
            </Text>
          </Hero>

          <Segmented
            options={[
              ['draft', 'Write a draft'],
              ['review', 'Review my letter'],
            ]}
            value={mode}
            onChange={setMode}
          />

          <Card style={styles.card}>
            <Field label="Employer" placeholder="e.g. Deloitte" value={company} onChangeText={setCompany} />
            <Field label="Role" placeholder="e.g. Audit summer internship" value={role} onChangeText={setRole} />
            <Picker label="Sector" options={data.sectors} value={sector} onChange={setSector} />
            <Picker label="Level" options={data.levels} value={level} onChange={setLevel} />
            <Field label="Job advert (optional)" multiline minHeight={90} value={jobDescription} onChangeText={setJobDescription} />

            {mode === 'draft' ? (
              <>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: palette.textSecondary }]}>Your CV</Text>
                  {data.cvs.length && !file ? (
                    <View style={styles.chips}>
                      {data.cvs.slice(0, 4).map((cv) => (
                        <Chip key={cv.id} label={cv.targetRole || cv.fileName} selected={cv.id === chosenCv} onPress={() => setCvId(cv.id)} />
                      ))}
                    </View>
                  ) : null}
                  <Button
                    variant="secondary"
                    label={file ? file.fileName : data.cvs.length ? 'Or upload a different CV' : 'Choose your CV'}
                    icon={{ ios: 'doc.badge.plus', android: 'upload_file' }}
                    busy={picking.busy}
                    onPress={() => void choose()}
                  />
                  <Note text={picking.error} tone="error" />
                </View>
                <Field
                  label="Why this employer (optional)"
                  multiline
                  minHeight={90}
                  placeholder="A few notes in your own words: what drew you, who you spoke to, what you read."
                  value={notes}
                  onChangeText={setNotes}
                />
                <Button
                  label="Write my draft"
                  icon={{ ios: 'sparkles', android: 'auto_awesome' }}
                  busy={working.busy}
                  disabled={!targetReady || (!file && !chosenCv)}
                  onPress={() => void write()}
                />
                <Note text={working.error} tone="error" />
                <Note text={quotaLine(data.quota.drafts, 'draft')} />
              </>
            ) : (
              <>
                <Field
                  label="Your letter"
                  multiline
                  minHeight={220}
                  placeholder="Paste the whole letter."
                  value={letter}
                  onChangeText={setLetter}
                  hint={`${countWords(letter)} words`}
                />
                {needsUsername ? (
                  <Field
                    label="Leaderboard name"
                    placeholder="Pick a username"
                    value={username}
                    onChangeText={setUsername}
                    hint="Shown next to your score on the leaderboard. You only pick it once."
                  />
                ) : null}
                <Button
                  label="Review my letter"
                  icon={{ ios: 'sparkles', android: 'auto_awesome' }}
                  busy={working.busy}
                  disabled={!targetReady || countWords(letter) < 60 || (needsUsername && username.trim().length < 3)}
                  onPress={() => void mark()}
                />
                <Note text={working.error} tone="error" />
                <Note text={quotaLine(data.quota.reviews, 'review')} />
              </>
            )}
          </Card>

          {mode === 'draft' && draft ? (
            <>
              <Note text={tierNote(draft.tier)} />
              <Copyable title={`Your draft · ${draft.wordCount} words`} text={draft.letter}>
                <Button variant="secondary" label="Review this draft" onPress={() => setMode('review')} />
              </Copyable>
              <Points title="Other ways to open" points={draft.openings} />
              <Points title="Taken from your CV" points={draft.usedFromCv} tone="green" />
              <Points title="Fill these in before you send it" points={draft.gaps} tone="amber" />
            </>
          ) : null}

          {mode === 'review' && review ? (
            <>
              <Hero>
                <Kicker color={onHero.secondary}>{review.verdict}</Kicker>
                <HeroStats
                  stats={[
                    { value: `${review.score}`, label: 'Out of 100' },
                    { value: `#${review.rank}`, label: `Of ${review.totalReviewed}` },
                    { value: `${review.percentile}%`, label: 'Better than' },
                  ]}
                />
              </Hero>
              <Note text={tierNote(review.tier)} />
              {review.categories.map((category) => (
                <Card key={category.key} style={styles.card}>
                  <View style={styles.categoryHead}>
                    <Text style={[styles.categoryName, { color: palette.text }]}>{category.name}</Text>
                    <ScoreBadge score={category.score} outOf={10} />
                  </View>
                  <Text style={[styles.body, { color: palette.textSecondary }]}>{category.comment}</Text>
                </Card>
              ))}
              <Points title="Passed the first-glance checks" points={review.checks.filter((c) => c.passed).map((c) => c.name)} tone="green" />
              <Points title="Failed the first-glance checks" points={review.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`)} tone="red" />
              <Points title="Stock phrases to cut" points={review.cliches.map((c) => `“${c.phrase}”: ${c.fix}`)} tone="amber" />
              <Points title="Lines any applicant could write" points={review.genericLines} tone="amber" />
              {review.rewrites.length ? (
                <>
                  <SectionHeader title="Stronger lines" icon={{ ios: 'pencil.line', android: 'edit_note' }} count={review.rewrites.length} />
                  {review.rewrites.map((rewrite) => (
                    <Rewrite key={rewrite.original} {...rewrite} />
                  ))}
                </>
              ) : null}
              <Points title="Do next" points={review.nextActions} />
            </>
          ) : null}
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
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
