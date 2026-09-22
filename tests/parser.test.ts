import { parseReport } from '../src/services/parsing/reportParser';

describe('parseReport', () => {
  it('ignores sample metadata and cleans HTML line breaks in test names', () => {
    const markdown = [
      '| Test | Result | Unit | Reference Range |',
      '| --- | --- | --- | --- |',
      '| Primary Sample Type : | Blood | | |',
      '| Mean Corpuscular Volume (MCV)<br>Calculated | 87.75 | fL | 83 - 101 |',
    ].join('\n');

    expect(parseReport(markdown)).toEqual([
      {
        testName: 'Mean Corpuscular Volume (MCV) Calculated',
        rawValue: '87.75',
        value: 87.75,
        unit: 'fL',
        refLow: 83,
        refHigh: 101,
      },
    ]);
  });

  it('skips patient tables and parses five-column tables with flagged values', () => {
    const markdown = [
      '| Patient Information | | Sample Information |',
      '| --- | --- | --- |',
      '| Name | : Lyubochka Svetka | Lab Id |',
      '| Sex/Age | : Male / 41 Y | Sample Type |',
      '## Complete Blood Count',
      '| | | | |',
      '| --- | --- | --- | --- | --- |',
      '| WBC Count | SF Cube cell analysis | <b>H 10570</b> | /cmm | 4000 - 10000 |',
    ].join('\n');

    expect(parseReport(markdown)).toEqual([
      {
        testName: 'WBC Count',
        rawValue: 'H 10570',
        value: 10570,
        unit: '/cmm',
        refLow: 4000,
        refHigh: 10000,
      },
    ]);
  });
});