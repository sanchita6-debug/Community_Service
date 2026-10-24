/**
 * ============================================================================
 * Learn / Practice
 * ============================================================================
 *
 * Two activities, both deliberately shallow. Research on digital literacy
 * teaching for older adults is consistent: short, repeated, low-stakes
 * practice beats long explanation. So each lesson is three cards long, and the
 * practice game is a rapid-fire "Safe or Fraud?" with instant feedback.
 *
 * Progress is stored per-user and syncs when online. The streak/count is
 * shown to make returning feel worthwhile.
 */
import { motion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeech, useSpeakOnMount } from '../context/SpeechContext.jsx';
import { useProgress } from '../context/ProgressContext.jsx';
import BigButton from '../components/BigButton.jsx';
import SpeakerButton from '../components/SpeakerButton.jsx';
import { Card, PageHeader } from '../components/ui.jsx';
import {
  BookIcon,
  StarIcon,
  PlayIcon,
  ClockIcon,
  ArrowRightIcon,
} from '../components/icons.jsx';

export default function Learn() {
  const { t } = useSettings();
  const { ttsSupported } = useSpeech();
  const {
    lessons,
    completedCount,
    lessonCount,
    isLessonComplete,
    practiceCorrect,
    practiceAnswered,
  } = useProgress();

  useSpeakOnMount(`${t('learn.title')}. ${t('learn.subtitle')}`, { id: 'learn-intro' });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('learn.title')}
        subtitle={t('learn.subtitle')}
        icon={BookIcon}
        speakText={`${t('learn.title')}. ${t('learn.subtitle')}`}
      />

      {/* ---- Progress summary --------------------------------------------- */}
      <Card className="border-4 border-primary-200 bg-primary-50">
        <div className="grid gap-4 sm:grid-cols-2">
          <ProgressStat
            icon={BookIcon}
            value={`${completedCount} ${t('common.of')} ${lessonCount}`}
            label={t('learn.lessonsTitle')}
            tone="primary"
          />
          <ProgressStat
            icon={StarIcon}
            value={`${practiceCorrect} ${t('common.of')} ${Object.keys(practiceAnswered || {}).length}`}
            label={t('learn.practiceTitle')}
            tone="calm"
          />
        </div>
      </Card>

      {/* ---- Practice game: the headline action --------------------------- */}
      <motion.div
        whileHover={{ y: -2 }}
        className="rounded-card border-4 border-warn-400 bg-warn-50 p-5"
      >
        <div className="flex items-start gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-warn-600 text-white"
            aria-hidden="true"
          >
            <PlayIcon className="w-9 h-9" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold text-warn-900">{t('learn.practiceTitle')}</h2>
            <p className="mt-1 text-lg text-ink-soft">{t('learn.practiceSub')}</p>
          </div>
        </div>
        <div className="mt-5">
          <BigButton
            to="/learn/simulator"
            size="block"
            icon={ArrowRightIcon}
            iconPosition="right"
          >
            {t('learn.startPractice')}
          </BigButton>
        </div>
      </motion.div>

      {/* ---- Lessons -------------------------------------------------------- */}
      <section>
        <h2 className="mb-4 text-2xl font-extrabold text-ink">{t('learn.lessonsTitle')}</h2>
        <ul className="space-y-4">
          {lessons.map((lesson) => {
            const done = isLessonComplete(lesson.id);
            const title = t(lesson.titleKey);
            return (
              <li key={lesson.id}>
                <Card
                  className={`transition ${
                    done ? 'border-calm-300 bg-calm-50' : 'hover:border-primary-400'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={[
                        'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-black',
                        done ? 'bg-calm-600 text-white' : 'bg-primary-100 text-primary-800',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {done ? '✓' : lesson.order}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-extrabold leading-snug text-ink">{title}</h3>
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink-muted">
                        <ClockIcon className="w-4 h-4" />
                        {t('learn.minutes', { n: lesson.minutes })}
                      </p>
                    </div>

                    {ttsSupported && (
                      <SpeakerButton
                        text={title}
                        id={`lesson-title-${lesson.id}`}
                        size="sm"
                        hint={false}
                      />
                    )}
                  </div>

                  <div className="mt-4 flex gap-3">
                    <BigButton
                      to={`/learn/${lesson.id}`}
                      variant={done ? 'secondary' : 'primary'}
                      className="flex-1"
                    >
                      {done ? t('learn.doneBadge') : t('learn.start')}
                    </BigButton>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ProgressStat({ icon: Icon, value, label, tone }) {
  const tones = {
    primary: 'bg-primary-100 text-primary-900',
    calm: 'bg-calm-100 text-calm-900',
  };
  return (
    <div className={`flex items-center gap-4 rounded-card p-4 ${tones[tone]}`}>
      <Icon className="w-10 h-10 shrink-0" />
      <div className="min-w-0">
        <p className="tnum text-2xl font-extrabold leading-tight">{value}</p>
        <p className="text-sm font-bold opacity-80">{label}</p>
      </div>
    </div>
  );
}
