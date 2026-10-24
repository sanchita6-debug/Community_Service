/**
 * Not found.
 *
 * Someone using a large-text, voice-first app is likely to land here by
 * following an old link or a mis-typed address. So: a plain sentence, a speaker
 * button, and one big obvious way back. No stack traces, no jargon.
 */
import { useSettings } from '../context/SettingsContext.jsx';
import { useSpeakOnMount } from '../context/SpeechContext.jsx';
import BigButton from '../components/BigButton.jsx';
import { Card } from '../components/ui.jsx';
import { HelpIcon, HomeIcon } from '../components/icons.jsx';

export default function NotFound() {
  const { t } = useSettings();
  const title = t('common.error');
  const body = t('nav.back');

  useSpeakOnMount(`${title}. ${body}`, { id: 'notfound' });

  return (
    <Card className="text-center">
      <HelpIcon className="mx-auto w-16 h-16 text-ink-muted" />
      <h1 className="mt-4 text-3xl font-extrabold text-ink">{title}</h1>
      <p className="mt-3 text-lg text-ink-soft">{body}</p>
      <div className="mt-6 flex justify-center">
        <BigButton to="/" icon={HomeIcon} size="block">
          {t('nav.home')}
        </BigButton>
      </div>
    </Card>
  );
}
