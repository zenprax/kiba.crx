import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MousePointerClick } from 'lucide-react';
import { Card } from './Card';
import { StatCard } from './StatCard';
import { Toggle } from './Toggle';
import { TenantList } from './TenantList';
import { FeatureToggleCard } from './FeatureToggleCard';
import type { TenantWhitelistEntry } from '../../types';

describe('Card', () => {
  it('子要素をレンダリングする', () => {
    render(<Card>内容</Card>);
    expect(screen.getByText('内容')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('label と value を表示する', () => {
    render(<StatCard label="ブロック数" value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('ブロック数')).toBeInTheDocument();
  });

  it('accent=warn のとき warn カラークラスを付与する', () => {
    render(<StatCard label="状態" value="armed" accent="warn" />);
    expect(screen.getByText('armed').className).toContain('text-status-warn-text');
  });

  it('accent=brand (デフォルト) のとき brand カラークラスを付与する', () => {
    render(<StatCard label="状態" value="off" />);
    expect(screen.getByText('off').className).toContain('text-brand-primary');
  });
});

describe('Toggle', () => {
  it('checked=true のとき aria-checked が true になる', () => {
    render(<Toggle checked={true} onChange={vi.fn()} label="テスト" />);
    expect(screen.getByRole('switch', { name: 'テスト' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('checked=false のとき aria-checked が false になる', () => {
    render(<Toggle checked={false} onChange={vi.fn()} label="テスト" />);
    expect(screen.getByRole('switch', { name: 'テスト' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('クリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="テスト" />);
    await user.click(screen.getByRole('switch', { name: 'テスト' }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('disabled のとき onChange が呼ばれない', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} disabled onChange={onChange} label="テスト" />);
    await user.click(screen.getByRole('switch', { name: 'テスト' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('TenantList', () => {
  const entries: TenantWhitelistEntry[] = [
    { provider: 'slack', tenantId: 'T12345', label: 'Zenprax Slack' },
    { provider: 'github', tenantId: 'zenprax', label: 'Zenprax GitHub' },
  ];

  it('エントリが空のとき空状態 UI を表示する', () => {
    render(<TenantList entries={[]} />);
    expect(screen.getByText(/テナントを追加すると/)).toBeInTheDocument();
  });

  it('空状態かつ onNavigateToSettings があるとき追加ボタンを表示する', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    render(<TenantList entries={[]} onNavigateToSettings={onNav} />);
    await user.click(screen.getByRole('button'));
    expect(onNav).toHaveBeenCalledOnce();
  });

  it('エントリがあるとき label と tenantId を表示する', () => {
    render(<TenantList entries={entries} />);
    expect(screen.getByText('Zenprax Slack')).toBeInTheDocument();
    expect(screen.getByText('T12345')).toBeInTheDocument();
    expect(screen.getByText('Zenprax GitHub')).toBeInTheDocument();
  });

  it('エントリがあるとき provider バッジを表示する', () => {
    render(<TenantList entries={entries} />);
    expect(screen.getByText('slack')).toBeInTheDocument();
    expect(screen.getByText('github')).toBeInTheDocument();
  });
});

describe('FeatureToggleCard', () => {
  const defaultProps = {
    icon: MousePointerClick,
    title: 'Anti-ClickFix',
    description: 'クリップボード監視',
    checked: false,
    disabled: false,
    onChange: vi.fn(),
    label: 'Anti-ClickFix',
  };

  it('title と description を表示する', () => {
    render(<FeatureToggleCard {...defaultProps} />);
    expect(screen.getByText('Anti-ClickFix')).toBeInTheDocument();
    expect(screen.getByText('クリップボード監視')).toBeInTheDocument();
  });

  it('Toggle が checked 状態を反映する', () => {
    render(<FeatureToggleCard {...defaultProps} checked={true} />);
    expect(screen.getByRole('switch', { name: 'Anti-ClickFix' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('クリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FeatureToggleCard {...defaultProps} onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: 'Anti-ClickFix' }));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('disabled のとき onChange が呼ばれない', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FeatureToggleCard {...defaultProps} disabled onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: 'Anti-ClickFix' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
