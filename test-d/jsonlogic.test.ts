import {Substitution, newTypeVar} from '../src/helper';
import {M} from '../src/m';
import {MonoType} from '../src/models';
import type {JSONValue} from '../src/parser';
import {parseContext, parseJsonLogicExpression} from '../src/parser';
import {W} from '../src/w';
import cases from './tests.json';

type Case = [rule: JSONValue, data: JSONValue, result: JSONValue];
// obvious cast; imported json
// filter "# commment string"
const isCase = (testCase: string | unknown[]): testCase is Case =>
  Array.isArray(testCase) && testCase.length == 3;
type ErrorCase = [rule: JSONValue, data: JSONValue, result: JSONValue, error: string];

const isErrorCase = (testCase: string | unknown[]): testCase is ErrorCase =>
  Array.isArray(testCase) && testCase.length == 4;

const inferResultType = (jsonLogic: JSONValue, data: JSONValue, use: 'W' | 'M' = 'W'): string => {
  const context = parseContext(data);
  let substitution: Substitution, t: MonoType;
  if (use === 'W') {
    [substitution, t] = W(...parseJsonLogicExpression(jsonLogic, context));
    return 'C' in t ? t.C : JSON.stringify([t.a, Object.keys(substitution.raw)]);
  } else if (use === 'M') {
    t = newTypeVar();
    substitution = M(...parseJsonLogicExpression(jsonLogic, context), t);
    t = substitution(t);
    return 'C' in t ? t.C : JSON.stringify([t.a, Object.keys(substitution.raw)]);
  }
  ((_: never): never => {
    throw Error();
  })(use);
};

const getType = (obj: unknown): 'Boolean' | 'Number' | 'String' | 'Array' | 'Null' | 'Object' =>
  typeof obj === 'boolean'
    ? 'Boolean'
    : obj === null
    ? 'Null'
    : typeof obj === 'number'
    ? 'Number'
    : typeof obj === 'string'
    ? 'String'
    : Array.isArray(obj)
    ? 'Array'
    : 'Object';

describe('Test against JsonLogic suite', () => {
  // https://jsonlogic.com/tests.json
  it.each(cases.filter(isCase))(
    'can infer %j, with context %j, to have the type of %j',
    (rule: JSONValue, data: JSONValue, result: JSONValue) => {
      const t = inferResultType(rule, data);
      expect(t).toBe(getType(result));
    }
  );
  it.each(cases.filter(isErrorCase))(
    'can detect %j, with context %j, does not typecheck',
    (rule: JSONValue, data: JSONValue, result: JSONValue, error: string) => {
      if (error.startsWith('Valid')) {
        // e.g. expressions like {"and": [1, 2]} are valid, but we infer them as Boolean
        // not Number (the type of the 2 literal)
        const t = inferResultType(rule, data);
        expect(t).not.toBe(getType(result));
      } else if (error == 'Snapshot')
        expect(() => inferResultType(rule, data)).toThrowErrorMatchingSnapshot();
      else if (error.startsWith('TODO')) expect(() => inferResultType(rule, data)).toThrow();
      else expect(() => inferResultType(rule, data)).toThrow(error);
    }
  );

  test('{"+": [{"var": "a"}, "1"]} with a: "1" ', () => {
    expect(() => inferResultType({'+': [{var: 'a'}, 1]}, {a: '1'})).toThrow(
      `"+" expects "a" to be a Number, but it is a String`
    );
  });
  test('{"+": [1, "1"]}', () => {
    expect(() => inferResultType({'+': ['1', 1]}, {})).toThrow(
      `"+" expects "1" to be a Number, but it is a String`
    );
  });
  test('{">": ["2", 1]}', () => {
    expect(() => inferResultType({'>': ['2', 1]}, {})).toThrowErrorMatchingInlineSnapshot(
      `"">" expects "2" to be a Number, but it is a String"`
    );
  });
  test('{"===": [{"var": ["items expression", [["value", "label"]]]}, {"var": "current_year"}]}', () => {
    expect(() =>
      inferResultType(
        {
          '===': [
            {
              if: [
                {'!!': [{var: 'items expression'}]},
                {var: 'items expression'},
                [['value', 'label']],
              ],
            },

            {var: 'current_year'},
          ],
        },

        // {'===': [{var: ['items expression', [['value', 'label']]]}, {var: 'current_year'}]},
        {current_year: 2023}
      )
    ).toThrowErrorMatchingInlineSnapshot(
      `""===" expects "current_year" to be a Array, but it is a Number"`
    ); // TODO improve this. While correct, user can't change current_year
  });
});
