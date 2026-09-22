"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mapper_1 = require("../src/services/fhir/mapper");
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
describe('toFhirObservation', () => {
    it('produces a valid Observation shape with status preliminary', () => {
        const obs = (0, mapper_1.toFhirObservation)(makeRow());
        expect(obs.resourceType).toBe('Observation');
        expect(obs.status).toBe('preliminary');
        expect(obs.valueQuantity.value).toBe(11.2);
        expect(obs.valueQuantity.unit).toBe('g/dL');
    });
    it('flags Low when value is below the reference range', () => {
        const obs = (0, mapper_1.toFhirObservation)(makeRow({ value: 10.0 }));
        expect(obs.interpretation?.[0].coding[0].code).toBe('L');
    });
    it('flags High when value is above the reference range', () => {
        const obs = (0, mapper_1.toFhirObservation)(makeRow({ value: 20.0 }));
        expect(obs.interpretation?.[0].coding[0].code).toBe('H');
    });
    it('flags Normal when value is within range', () => {
        const obs = (0, mapper_1.toFhirObservation)(makeRow({ value: 14.0 }));
        expect(obs.interpretation?.[0].coding[0].code).toBe('N');
    });
    it('omits interpretation when reference range is unavailable', () => {
        const obs = (0, mapper_1.toFhirObservation)(makeRow({ refLow: null, refHigh: null }));
        expect(obs.interpretation).toBeUndefined();
    });
    it('attaches a LOINC code for a recognized test name', () => {
        const obs = (0, mapper_1.toFhirObservation)(makeRow({ testName: 'Hemoglobin' }));
        expect(obs.code.coding?.[0].code).toBe('718-7');
    });
    it('falls back to text-only code for an unrecognized test name', () => {
        const obs = (0, mapper_1.toFhirObservation)(makeRow({ testName: 'Some Obscure Panel Marker' }));
        expect(obs.code.coding).toBeUndefined();
        expect(obs.code.text).toBe('Some Obscure Panel Marker');
    });
});
