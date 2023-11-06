import {TypeFunctionApplication} from '../src/models';
import {parseContext} from '../src/parser';

const number: TypeFunctionApplication = {type: 'ty-app', C: 'Number', mus: []};
const string: TypeFunctionApplication = {type: 'ty-app', C: 'String', mus: []};
const bool: TypeFunctionApplication = {type: 'ty-app', C: 'Boolean', mus: []};
const bottom: TypeFunctionApplication = {type: 'ty-app', C: 'Null', mus: []};

describe('parseContext', () => {
  describe('parses bare literals', () => {
    test('true', () => {
      const data = true;
      const context = parseContext(data);
      expect(context['var: ']).toEqual(bool);
    });
    test('false', () => {
      const data = false;
      const context = parseContext(data);
      expect(context['var: ']).toEqual(bool);
    });
    test('1', () => {
      const data = 1;
      const context = parseContext(data);
      expect(context['var: ']).toEqual(number);
    });
    test('"1"', () => {
      const data = '1';
      const context = parseContext(data);
      expect(context['var: ']).toEqual(string);
    });
    test('null', () => {
      const data = null;
      const context = parseContext(data);
      expect(context['var: ']).toEqual(bottom);
    });
  });
  describe('parses arrays', () => {
    test('[]', () => {
      // Referencing into the array with "var": 1, results in null at runtime
      // But this could contain any type a, so expecting a ty-var make more sense
      // so we can still use the Array operations
      const data: any[] = [];
      const context = parseContext(data);
      expect(context['var: ']).toEqual({
        type: 'ty-app',
        C: 'Array',
        mus: [{type: 'ty-var', a: '[typeof ]'}],
      });
    });
    test('["a", "b"]', () => {
      const data = ['a', 'b'];
      const context = parseContext(data);
      expect(context['var: 0']).toEqual(string);
      expect(context['var: 1']).toEqual(string);
      expect(context['var: ']).toEqual({type: 'ty-app', C: 'Array', mus: [string]});
    });
  });
  describe('parses objects', () => {
    test('{"a": 1}', () => {
      const data = {a: 1};
      const context = parseContext(data);
      expect(context['var: a']).toEqual(number);
    });
    test('{"integers": [1, 2, 3]}', () => {
      const data = {integers: [1, 2, 3]};
      const context = parseContext(data);
      expect(context['var: integers']).toEqual({type: 'ty-app', C: 'Array', mus: [number]});
    });
    test('{items: [{qty: 1, sku: "apple"}, {qty: 2, sku: "banana"}]}', () => {
      const data = {
        items: [
          {qty: 1, sku: 'apple'},
          {qty: 2, sku: 'banana'},
        ],
      };
      const context = parseContext(data);
      expect(context['var: items.0.qty']).toEqual(number);
      expect(context['var: items.0.sku']).toEqual(string);
      expect(context['var: items']).toEqual({
        type: 'ty-app',
        C: 'Array',
        mus: [{type: 'ty-var', a: '[typeof items]'}], // TODO: implement record type?
      });
    });
  });
});
