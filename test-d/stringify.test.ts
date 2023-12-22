import fc from 'fast-check';

import {JSONValue, parseJsonLogicExpression, stringify} from '../src/parser';

const number = (): fc.Arbitrary<number> => fc.oneof(fc.integer(), fc.float());

test('number literals', () => {
  fc.assert(
    fc.property(number(), logic => {
      const [_ctx, expr] = parseJsonLogicExpression(logic);
      expect(stringify(expr)).toEqual(logic);
    })
  );
});

test('string literals', () => {
  fc.assert(
    fc.property(fc.string(), logic => {
      const [_ctx, expr] = parseJsonLogicExpression(logic);
      expect(stringify(expr)).toEqual(logic);
    })
  );
});

test('"var" expressions', () => {
  fc.assert(
    fc.property(fc.string(), name => {
      const logic = {var: name};
      const [_ctx, expr] = parseJsonLogicExpression(logic);
      expect(stringify(expr)).toEqual(logic);
    })
  );
});

describe('"+" operations', () => {
  test('binary', () => {
    fc.assert(
      fc.property(number(), number(), (x, y) => {
        const logic = {'+': [x, y]};
        const [_ctx, expr] = parseJsonLogicExpression(logic);
        expect(stringify(expr)).toEqual(logic);
      })
    );
  });
  test('unary cast', () => {
    fc.assert(
      fc.property(number(), x => {
        const logic = {'+': `${x}`}; // {"+": "x"}
        const [_ctx, expr] = parseJsonLogicExpression(logic);
        expect(stringify(expr)).toEqual({'+': [`${x}`]});
      })
    );
  });

  test('n-ary sum', () => {
    fc.assert(
      fc.property(fc.array(number(), {minLength: 1}), xs => {
        const logic = {'+': xs};
        const [_ctx, expr] = parseJsonLogicExpression(logic);
        expect(stringify(expr)).toEqual(logic);
      })
    );
  });
  test('not enough arguments', () => {
    const logic = {'+': []};
    expect(() => parseJsonLogicExpression(logic)).toThrowErrorMatchingSnapshot();
  });
});

test('array literal [1, 2]', () => {
  const logic = [1, 2];
  const [_ctx, expr] = parseJsonLogicExpression(logic);
  expect(stringify(expr)).toEqual(logic);
});

test('array literal [1]', () => {
  const logic = [1];
  const [_ctx, expr] = parseJsonLogicExpression(logic);
  expect(stringify(expr)).toEqual(logic);
});

test('array literal []', () => {
  const logic: number[] = [];
  const [_ctx, expr] = parseJsonLogicExpression(logic);
  expect(stringify(expr)).toEqual(logic);
});

test('arrays of literals', () => {
  fc.assert(
    fc.property(nestedArrays(), logic => {
      const [_ctx, expr] = parseJsonLogicExpression(logic);
      expect(stringify(expr)).toEqual(logic);
    })
  );
});

const nestedArrays = (): fc.Arbitrary<JSONValue> =>
  fc.letrec(tie => ({
    nestedArray: fc.array(
      fc.oneof(
        number(), // Number literal
        fc.string(), // String literal
        tie('nestedArray')
      )
    ),
  })).nestedArray as fc.Arbitrary<JSONValue>; // blegh
