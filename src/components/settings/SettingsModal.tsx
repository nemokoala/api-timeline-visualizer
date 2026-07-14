import { useEffect, type ReactNode } from 'react';
import { useLocale, useT, type Locale } from '../../i18n';
import { useTheme } from '../../hooks/useTheme';
import { useJsonViewPrefs } from '../../hooks/useJsonViewPrefs';
import { useTableViewPrefs } from '../../hooks/useTableViewPrefs';
import { useBackdropDismiss } from '../../hooks/useBackdropDismiss';
import { DetailPanelCloseButton } from '../shared/DetailPanelCloseButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ToggleControl } from '../ui/ToggleControl';
import { GUIDE_COLOR_OPTIONS, type JsonGuideColor } from '../../utils/jsonViewPrefs';
import type { ThemeName } from '../../utils/themePrefs';

type SettingsModalProps = {
  clearNetworkOnReload: boolean;
  onClearNetworkOnReloadChange: (value: boolean) => void;
  onClose: () => void;
};

/**
 * 전역 설정 창. 흩어져 있거나(우클릭 메뉴 등) 잘 안 보이던 앱 전역 설정을 한곳에 모은다.
 * 필터·wrap·레이아웃 같은 뷰별 컨텍스트 컨트롤은 여기 넣지 않는다(쓰는 자리에 그대로 둔다).
 * JSON 표시 옵션은 뷰어 우클릭 메뉴와 같은 pref store를 쓰므로 양쪽이 자동 동기화된다.
 */
export function SettingsModal({
  clearNetworkOnReload,
  onClearNetworkOnReloadChange,
  onClose,
}: SettingsModalProps) {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const [jsonPrefs, setJsonPrefs] = useJsonViewPrefs();
  const [tablePrefs, setTablePrefs] = useTableViewPrefs();
  const backdropDismiss = useBackdropDismiss(onClose);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-backdrop p-7"
      role="presentation"
      {...backdropDismiss}
    >
      <section
        className="flex max-h-full w-[min(440px,100%)] flex-col overflow-hidden rounded-2xl border border-line-weak bg-surface shadow-float"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line-weak px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">{t('settings.title')}</h2>
          <DetailPanelCloseButton onClick={onClose} label={t('settings.close')} />
        </div>

        <div className="grid gap-4 overflow-auto px-4 py-4">
          <SettingsGroup title={t('settings.appearance')}>
            <SettingRow label={t('settings.theme')}>
              <SegmentedControl<ThemeName>
                size="sm"
                ariaLabel={t('settings.theme')}
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'light', label: t('settings.themeLight') },
                  { value: 'dark', label: t('settings.themeDark') },
                ]}
              />
            </SettingRow>
            <SettingRow label={t('settings.language')}>
              <SegmentedControl<Locale>
                size="sm"
                ariaLabel={t('settings.language')}
                value={locale}
                onChange={setLocale}
                options={[
                  { value: 'ko', label: '한국어' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </SettingRow>
          </SettingsGroup>

          <SettingsGroup title={t('settings.jsonDisplay')}>
            <ToggleControl
              label={t('jsonViewer.indentGuide')}
              checked={jsonPrefs.indentGuide}
              onChange={(next) => setJsonPrefs((prev) => ({ ...prev, indentGuide: next }))}
            />
            {/* 가이드선 색은 가이드선이 켜져 있을 때만 효과가 있어, 그때만 노출한다. */}
            {jsonPrefs.indentGuide ? (
              <SettingRow label={t('jsonViewer.guideColor')}>
                <SegmentedControl<JsonGuideColor>
                  size="sm"
                  ariaLabel={t('jsonViewer.guideColor')}
                  value={jsonPrefs.guideColor}
                  onChange={(next) => setJsonPrefs((prev) => ({ ...prev, guideColor: next }))}
                  options={GUIDE_COLOR_OPTIONS.map(({ value, labelKey }) => ({
                    value,
                    label: t(labelKey),
                  }))}
                />
              </SettingRow>
            ) : null}
            <ToggleControl
              label={t('jsonViewer.arrayLengthOption')}
              checked={jsonPrefs.arrayLength}
              onChange={(next) => setJsonPrefs((prev) => ({ ...prev, arrayLength: next }))}
            />
          </SettingsGroup>

          <SettingsGroup title={t('settings.listDisplay')}>
            <ToggleControl
              label={t('table.rowStripe')}
              checked={tablePrefs.rowStripe}
              onChange={(next) => setTablePrefs((prev) => ({ ...prev, rowStripe: next }))}
            />
          </SettingsGroup>

          <SettingsGroup title={t('settings.capture')}>
            <ToggleControl
              label={t('networkOptions.clearOnReload')}
              checked={clearNetworkOnReload}
              onChange={onClearNetworkOnReloadChange}
            />
          </SettingsGroup>
        </div>
      </section>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="m-0 text-[10px] font-bold uppercase tracking-[0.04em] text-ink-weak">
        {title}
      </h3>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-ink-sub">{label}</span>
      {children}
    </div>
  );
}
