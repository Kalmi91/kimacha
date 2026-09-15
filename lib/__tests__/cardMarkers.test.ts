import { cardMarkers } from '@/lib/cardMarkers';

const s = {
  card: {
    regionMx: 'Mexikóban használt',
    irregularPlural: 'rendhagyó többes',
    pluralOnly: 'csak többesben',
  },
};

describe('cardMarkers', () => {
  it('returns nothing for a plain word', () => {
    expect(cardMarkers({}, s)).toEqual({});
  });

  it('flags a Mexico-only word with the flag and its accessibility label', () => {
    expect(cardMarkers({ region: 'mx' }, s)).toEqual({
      flag: '🇲🇽',
      flagLabel: 'Mexikóban használt',
    });
  });

  it('gives no flag for the default (Spain) region', () => {
    expect(cardMarkers({ region: 'es' }, s).flag).toBeUndefined();
  });

  it('flags an irregular plural with the warning chip', () => {
    expect(cardMarkers({ plural: 'irregular' }, s).chip).toBe('⚠︎ rendhagyó többes');
  });

  it('flags a plural-only word with its own chip text', () => {
    expect(cardMarkers({ plural: 'only' }, s).chip).toBe('⚠︎ csak többesben');
  });

  it('combines both markers when both fields are set', () => {
    expect(cardMarkers({ region: 'mx', plural: 'irregular' }, s)).toEqual({
      flag: '🇲🇽',
      flagLabel: 'Mexikóban használt',
      chip: '⚠︎ rendhagyó többes',
    });
  });
});
