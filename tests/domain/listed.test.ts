// The items a shop lists to buyers (its public page, the agent door) are the ones its picture is drawn from wherever it
// shows: the shop page, the dashboard header, the live step and the start page.
import { describe, expect, it } from 'vitest';
import { isListed, listedItems } from '@/lib/domain/listed';
import type { ItemStatus } from '@/lib/domain/types';

const item = (name: string, status: ItemStatus) => ({ name, status });

describe('listedItems', () => {
  it('keeps live and ask-in-person items, in order; drafts and removed items are not on the shop', () => {
    const all = [item('Draft loaf', 'draft'), item('Croissant', 'live'), item('Gone', 'removed'), item('Galette', 'in_person'), item('Rye', 'live')];
    expect(listedItems(all).map((i) => i.name)).toEqual(['Croissant', 'Galette', 'Rye']);
  });

  it('isListed answers per item', () => {
    const statuses: ItemStatus[] = ['draft', 'live', 'in_person', 'removed'];
    expect(statuses.map((s) => isListed(item('x', s)))).toEqual([false, true, true, false]);
  });
});
