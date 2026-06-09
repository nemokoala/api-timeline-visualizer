import { useEffect, useState, type ReactNode } from 'react';
import { getDetailSectionOpen, setDetailSectionOpen } from '../utils/detailSectionPrefs';

type DetailSectionProps = {
  sectionId: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  expandForSearch?: boolean;
  searchExpandToken?: string;
};

export function DetailSection({
  sectionId,
  title,
  children,
  defaultOpen = false,
  expandForSearch = false,
  searchExpandToken = '',
}: DetailSectionProps) {
  const [open, setOpen] = useState(() => getDetailSectionOpen(sectionId, defaultOpen));

  useEffect(() => {
    if (!expandForSearch) return;
    setOpen(true);
    setDetailSectionOpen(sectionId, true);
  }, [expandForSearch, searchExpandToken, sectionId]);

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      setDetailSectionOpen(sectionId, next);
      return next;
    });
  };

  return (
    <section className={`detail-section ${open ? 'is-open' : ''} ${expandForSearch ? 'has-search-match' : ''}`}>
      <button
        className="detail-section-toggle"
        type="button"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span className="detail-section-title">{title}</span>
        <span className="detail-section-chevron" aria-hidden="true" />
      </button>
      {open ? <div className="detail-section-body">{children}</div> : null}
    </section>
  );
}
