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

const inferResultType = (jsonLogic: JSONValue, data: JSONValue): string => {
  const context = parseContext(data);
  const [subsitution, t] = W(...parseJsonLogicExpression(jsonLogic, context));
  // TODO: get "var" from subsitution
  return 'C' in t ? t.C : JSON.stringify([t.a, Object.keys(subsitution.raw)]);
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
    'can detect %j, with context %j, does not typecheck with %j and raises some Error containing %j',
    (rule: JSONValue, data: JSONValue, result: JSONValue, error: string) => {
      if (error.startsWith("TODO"))
        expect(() => inferResultType(rule, data)).toThrow("")
      else if (error.startsWith("Valid")){
        const t = inferResultType(rule, data);
        expect(t).not.toBe(getType(result));
      } else
        expect(() => inferResultType(rule, data)).toThrow(error)

      }
  );
});
