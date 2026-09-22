"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validator_1 = require("../src/services/validation/validator");
function makeRow(overrides = {}) {
    return {
        testName: 'Hemoglobin',
        rawValue: '11.2',
        value: 11.2,
        unit: 'g/dL',
        refLow: 12.0,
        refHigh: 16.0,
        ...overrides,
    };
}
describe('isValidNumber', () => {
    it('passes a clean numeric value', () => {
        expect((0, validator_1.isValidNumber)(makeRow({ rawValue: '11.2', value: 11.2 }))).toBe(true);
    });
    it('passes a clean integer value', () => {
        expect((0, validator_1.isValidNumber)(makeRow({ rawValue: '7800', value: 7800 }))).toBe(true);
    });
    it('fails a value contaminated with a trailing marker (e.g. "11.2*")', () => {
        expect((0, validator_1.isValidNumber)(makeRow({ rawValue: '11.2*', value: 11.2 }))).toBe(false);
    });
    it('fails when no numeric value could be parsed at all', () => {
        expect((0, validator_1.isValidNumber)(makeRow({ rawValue: 'N/A', value: null }))).toBe(false);
    });
});
describe('hasUnit', () => {
    it('passes when a unit is present', () => {
        expect((0, validator_1.hasUnit)(makeRow({ unit: 'g/dL' }))).toBe(true);
    });
    it('fails when unit is null', () => {
        expect((0, validator_1.hasUnit)(makeRow({ unit: null }))).toBe(false);
    });
    it('fails when unit is an empty/whitespace string', () => {
        expect((0, validator_1.hasUnit)(makeRow({ unit: '   ' }))).toBe(false);
    });
});
describe('needsReview', () => {
    it('is false for a fully clean row', () => {
        expect((0, validator_1.needsReview)(makeRow())).toBe(false);
    });
    it('is true when the value is contaminated', () => {
        expect((0, validator_1.needsReview)(makeRow({ rawValue: '11.2*' }))).toBe(true);
    });
    it('is true when the unit is missing', () => {
        expect((0, validator_1.needsReview)(makeRow({ unit: null }))).toBe(true);
    });
    it('is true when both value and unit checks fail', () => {
        expect((0, validator_1.needsReview)(makeRow({ rawValue: '11.2*', unit: null }))).toBe(true);
    });
});
