import { getTheme } from '@zenprax/design-tokens';
import type { AuditEventType, AuditLogEntry } from '../../types';
import { Card } from '../Popup';
import { useLang } from '../i18n';

/** type 別の集計結果（多い順）。 */
export interface AuditSummarySlice {
  type: AuditEventType;
  count: number;
}

/**
 * 監査ログを type 別に集計し、件数の多い順に返す純粋関数。
 * 0 件の type は含めない。テスト対象（DOM 非依存）。
 */
export function summarizeAuditEvents(entries: AuditLogEntry[]): AuditSummarySlice[] {
  const counts = new Map<AuditEventType, number>();
  for (const e of entries) {
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

// viz パレット（デザイントークン由来。生 HEX は書かない）でセグメントを塗る。
const VIZ = getTheme('dark').color.viz;
const SLICE_COLORS = [VIZ['1'], VIZ['2'], VIZ['3'], VIZ['4'], VIZ['5'], VIZ['6']];

/** ラベル表示用の type → 短縮ラベル（AuditLog と同じ語彙）。 */
const TYPE_LABEL: Record<AuditEventType, string> = {
  'paste-block': 'PASTE',
  'file-block': 'FILE',
  'bypass-grant': 'BYPASS',
  'paste-mask': 'MASK',
  'sso-fill': 'SSO',
  'tenant-block': 'TENANT',
  'extension-audit': 'EXT',
  'download-block': 'DL',
  'screen-share': 'SCREEN',
};

/** SVG ドーナツの 1 セグメントを表す stroke-dasharray を計算する。 */
function donutSegments(slices: AuditSummarySlice[], total: number) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return slices.map((slice, i) => {
    const fraction = slice.count / total;
    const length = fraction * circumference;
    const seg = {
      color: SLICE_COLORS[i % SLICE_COLORS.length],
      dasharray: `${length} ${circumference - length}`,
      dashoffset: -offset,
      radius,
      circumference,
    };
    offset += length;
    return seg;
  });
}

/** 監査ログのイベント内訳を SVG ドーナツ + 凡例で可視化する。 */
export function AuditChart({ entries }: { entries: AuditLogEntry[] }) {
  const t = useLang();
  const slices = summarizeAuditEvents(entries);
  const total = slices.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card>
      <div className="text-zp-base font-semibold">{t.audit.chart.title}</div>
      {total === 0 ? (
        <div className="mt-zp-2 rounded-zp-lg border border-dashed border-border-default py-zp-4 text-center text-zp-md text-text-muted">
          {t.audit.chart.noData}
        </div>
      ) : (
        <div className="mt-zp-3 flex items-center gap-zp-4">
          <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90">
            {donutSegments(slices, total).map((seg, i) => (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={seg.radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="14"
                strokeDasharray={seg.dasharray}
                strokeDashoffset={seg.dashoffset}
              />
            ))}
          </svg>
          <ul className="min-w-0 flex-1 space-y-1">
            {slices.map((slice, i) => {
              const pct = Math.round((slice.count / total) * 100);
              return (
                <li key={slice.type} className="flex items-center gap-zp-2 text-zp-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-zp-sm"
                    style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
                    aria-hidden
                  />
                  <span className="font-semibold text-text-primary">{TYPE_LABEL[slice.type]}</span>
                  <span className="ml-auto text-text-muted">
                    {slice.count} ({pct}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
