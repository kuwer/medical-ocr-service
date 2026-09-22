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
});