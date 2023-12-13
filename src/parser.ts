import {
  ApplicationExpression,
  Context,
  Expression,
  MonoType,
  PolyType,
  TypeFunctionApplication,
  TypeQuantifier,
  TypeVariable,
  VariableExpression,
  makeContext,
} from './models';

export type JSONValue = JSONArray | JSONObject | boolean | null | number | string;
export type JSONObject = {[operation: string]: JSONValue};
export interface JSONArray extends Array<JSONValue> {}

// helpers to create types in the context
const bool: TypeFunctionApplication = {type: 'ty-app', C: 'Boolean', mus: []};
const bottom: TypeFunctionApplication = {type: 'ty-app', C: 'Null', mus: []};
const string: TypeFunctionApplication = {type: 'ty-app', C: 'String', mus: []};
const number: TypeFunctionApplication = {type: 'ty-app', C: 'Number', mus: []};
const array = (mu: MonoType): TypeFunctionApplication => ({type: 'ty-app', C: 'Array', mus: [mu]});
const f = (mu1: MonoType, mu2: MonoType, ...rest: MonoType[]): TypeFunctionApplication => {
  if (rest.length === 0) return {type: 'ty-app', C: '->', mus: [mu1, mu2]};
  const [mu3, ...extra] = rest;
  return {type: 'ty-app', C: '->', mus: [mu1, f(mu2, mu3, ...extra)]};
};
const makeTypeVars = (n: number): TypeVariable[] =>
  [...'abcdefghijklmnopqrstuvwxyz'].slice(0, n).map(a => ({type: 'ty-var', a}));
const [a, b] = makeTypeVars(2);
const forall = (typevars: TypeVariable[], sigma: PolyType): TypeQuantifier => {
  const [{a: name}, ...rest] = typevars;
  return {type: 'ty-quantifier', a: name, sigma: rest.length ? forall(rest, sigma) : sigma};
};

export const defaultContext = makeContext({
  // literals
  false: bool,
  true: bool,
  null: bottom,
  // Array
  '[]': forall([a], array(a)),
  cons: forall([a], f(a, array(a), array(a))),
  // Accessing Data
  missing: f(array(string), array(string)),
  missing_some: f(number, array(string), array(string)),
  // Logic and Boolean Operations
  if: forall([a, b], f(a, b, b, b)),
  '?:': forall([a, b], f(a, b, b, b)), // ternary from tests.json
  // TODO: should the parameters of (in-)equaility be of the same type 🤔
  // forcing === and !== isn't a eslint rule for nothing...
  '==': forall([a, b], f(a, b, bool)),
  '!=': forall([a, b], f(a, b, bool)),
  '===': forall([a], f(a, a, bool)),
  '!==': forall([a], f(a, a, bool)),
  '!': forall([a], f(a, bool)),
  '!!': forall([a], f(a, bool)),
  or: forall([a, b], f(a, b, bool)),
  and: forall([a, b], f(a, b, bool)),
  // Numeric Operations
  '>': f(number, number, bool),
  '>=': f(number, number, bool),
  '<': f(number, number, bool),
  '<=': f(number, number, bool),
  '3-ary <': f(number, number, number, bool),
  '3-ary <=': f(number, number, number, bool),
  // TODO min and max of [] returns null
  max: f(array(number), number),
  min: f(array(number), number),
  // Arithmatic
  '+': f(number, number, number),
  '-': f(number, number, number),
  '*': f(number, number, number),
  '/': f(number, number, number),
  // additive inverse
  '1-ary -': f(number, number),
  // casting to number
  '1-ary +': forall([a], f(a, number)),
  '%': f(number, number, number),
  // Array Operations
  // forall a b. :: [a] -> (a -> b) -> [b]
  map: forall([a, b], f(array(a), f(a, b), array(b))),
  // forall a truthy. :: [a] -> (a -> truthy) -> [a]
  filter: forall([a, b], f(array(a), f(a, b), array(a))),
  // forall a b. :: [b] -> (a -> b -> a) -> a -> a
  reduce: forall([a, b], f(array(b), f(a, b, a), a, a)),
  // forall a. :: [a] -> (a -> bool) -> bool
  all: forall([a], f(array(a), f(a, bool), bool)),
  none: forall([a], f(array(a), f(a, bool), bool)),
  some: forall([a], f(array(a), f(a, bool), bool)),
  // TODO: this doesn't cast everything to array
  // "merge": forall([a], f(array(either(A, array(A))), array(A))),
  merge: forall([a], f(array(array(a)), array(a))),
  in: forall([a], f(a, array(a), bool)),
  // String Operations
  // TODO: overload with sum type encoding
  // "in": f(string, string, bool),
  cat: f(array(string), string),
  // add a unary cat to cast to string
  '1-ary cat': forall([a], f(a, string)),
  substr: f(string, number, string),
  '3-ary substr': f(string, number, number, string),
  // Miscellaneous
  log: forall([a], f(a, a)),
});

type JsonLogicExpression = JsonLogicOperation | boolean | string | number | JsonLogicExpression[];
type JsonLogicOperation =
  | {[operation: string]: JsonLogicExpression[]} // normal form e.g. {"var": ["path.in.data"]}
  | {[operation: string]: JsonLogicExpression}; // unary operation e.g. {"var": "path.in.data"}

/**
 * @param json - (malformed?) JsonLogic rule
 * @param context -
 * @returns all keys in json that have a definition in context (well-formed JsonLogic rules have just one per rule!)
 */
const operationsFrom = (
  json: Readonly<Record<string, JSONValue>>,
  context: Readonly<Context>
): string[] =>
  // "var" operation is not a function in context, but a name lookup
  Object.keys(json).filter(key => key === 'var' || context[key]);

const maybeJsonLogicExpression = (json: JSONValue, context: Context): json is JSONObject => {
  // We don't recursively validate all parameters, so do *not* return `json is JsonLogicExpression`
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return false;

  const operations = operationsFrom(json, context);
  // assert it's well formed
  if (operations.length < 1) return false;
  if (operations.length > 1) {
    // parseError
    throw Error(`JsonLogicExpression may only contain one operation.
    I found ${repr(operations)} in: ${repr(json)}.
    Maybe something went wrong with your braces?`);
  }
  return true;
};

/**
 * @thing - anything
 * @return a string for display to the user
 */
const repr = (thing: unknown): string => JSON.stringify(thing) || thing?.toString?.() || '';

/**
 * @thing - any JSONValue
 * @return a string for display the type of `thing` to the user
 */
const reprType = (thing: JSONValue, context: Context): string => {
  if (typeof thing === 'boolean') return 'Boolean';
  if (thing === null) return 'Null';
  if (typeof thing === 'number') return 'Number';
  if (typeof thing === 'string') return 'String';
  if (Array.isArray(thing)) return 'Array';
  try {
    if (thing && maybeJsonLogicExpression(thing, context)) {
      return 'JsonLogic rule';
    }
  } catch (error) {}
  return 'Object';
};

/**
 * Turn exp `{"var": "foo"}` into `["var", ["foo"]]`
 */
const destructureJsonLogicExpression = (
  exp: Readonly<JSONObject>,
  context: Readonly<Context>
): [operation: string, params: JSONArray] => {
  const [operation, ...tooMany] = operationsFrom(exp, context);
  if (tooMany.length) {
    throw Error(`JsonLogicExpression may only contain one operation.
    I found ${repr([operation, ...tooMany])} in: ${repr(exp)}.
    Maybe something went wrong with your braces?`);
  }
  const params = exp[operation];
  return [operation, Array.isArray(params) ? params : [params]];
};

/**
 * Create an ApplicationExpression for n-ary functions.
 *
 * The inference algorithm deals in curried, unary functions. In TS:
 *
 * ```ts
 * // This ternary function
 * const f = (a, b, c) => a + b + c
 * // is equivalent to this chain of unary functions that return anonymous unary functions
 * const g = (a) => (b) => (c) => a + b + c
 * f(1, 2, 3) === g(1)(2)(3)
 * ```
 * This helper creates a chain of applications.
 *
 * @example
 * This would return the {@link ApplicationExpression} for `e1(e2)(e3)`
 * ```ts
 * apply([e1, e2, e3])
 * ```
 *
 * @see {@link https://en.wikipedia.org/wiki/Arity | Arity - Wikipedia}
 * @see {@link https://en.wikipedia.org/wiki/Currying | Currying - Wikipedia}
 */
const apply = ([e1, e2, ...rest]: Expression[]): ApplicationExpression => {
  const e1_e2: ApplicationExpression = {type: 'app', e1, e2};
  if (rest.length === 0) return e1_e2;
  return apply([e1_e2, ...rest]);
};

/**
 * Like {@link apply} but right associative.
 *
 * @example
 * This would return the {@link ApplicationExpression} for `e1(e2(e3))`
 * ```ts
 * applyRight([e1, e2, e3])
 * ```
 */
const applyRight = (expressions: Expression[]): ApplicationExpression => {
  // [...rest, e1, e2] = expressions; isn't legal TS
  const length = expressions.length;
  if (length < 2) {
    throw new Error('applyRight requires at least two expressions');
  }
  const rest = expressions.slice(0, length - 2);
  const [e1, e2] = expressions.slice(length - 2);

  const e1_e2: ApplicationExpression = {type: 'app', e1, e2};
  if (length === 2) return e1_e2;
  return applyRight([...rest, e1_e2]);
};

/**
 * Parse a JSONValue, iff it's a JSONObject, parse it as JsonLogic
 */
const parseValue = (arg: JSONValue, context: Context): [Context, Expression] => {
  if (typeof arg === 'boolean') return [context, {type: 'var', x: String(arg)}]; // 'true' and 'false' are in context
  if (arg === null) return [context, {type: 'var', x: 'null'}]; // 'null' is in context
  if (typeof arg === 'number') return [context, {type: 'num', x: arg}]; // NumberLiteral
  if (typeof arg === 'string') return [context, {type: 'str', x: arg}]; // StringLiteral

  // if parsing turns out to be slow or a memory hog, this can probably be made tail recursive by
  // introducing an accumulator for the remaining cases
  if (Array.isArray(arg)) {
    const emptyArray: VariableExpression = {type: 'var', x: '[]'};
    if (!arg.length) return [context, emptyArray];
    // Arrays are linked lists of cons pairs
    // [1, 2, 3] === cons(1, cons(2, cons(3, [])))
    // https://en.wikipedia.org/wiki/Cons
    const cons: VariableExpression = {type: 'var', x: 'cons'};
    const [newContext, consPairs]: [Context, Expression[]] = parseValues(
      arg,
      context,
      (exp: JSONValue, context: Context): [Context, Expression] => {
        const [c, e2] = parseValue(exp, context);
        return [c, {type: 'app', e1: cons, e2}];
      }
    );

    return [newContext, applyRight(consPairs.concat(emptyArray))];
  }
  // must be an object
  const [c, exp] = parseJsonLogicExpression(arg, context);
  return [{...context, ...c}, exp];
};

// parse a whole array
const parseValues = (
  args: JSONArray,
  context: Context,
  parse: (jsonValue: JSONValue, context: Context) => [Context, Expression] = parseValue
): [Context, Expression[]] =>
  args
    .map(json => parse(json, context))
    .reduce(
      (acc: [Context, Expression[]], curr: [Context, Expression]) => {
        return [{...acc[0], ...curr[0]}, acc[1].concat(curr[1])];
      },
      [context, []]
    );

const isString = (thing: unknown): thing is string => typeof thing === 'string';
const isNatural = (thing: unknown): thing is number =>
  typeof thing === 'number' && Number.isInteger(thing) && thing >= 0; // typeof

/**
 * Parse a JSON value as JsonLogic "rule"
 *
 * The inference algorithms can deal with parametric polymorphism, but not with variadics.
 * So the parser monomorphizes and adds a n-ary version of the operation to the
 * context it returns when it encounters a call with n parameters.
 *
 * @see @{link https://en.wikipedia.org/wiki/Monomorphization | Monomorphization - Wikipedia}
 *
 * @param json - The JSON object to parse which is believed to be JsonLogic.
 * @returns Context and Expression
 */
export const parseJsonLogicExpression = (
  json: JSONValue,
  context: Context = defaultContext
): [Context, Expression] => {
  if (!maybeJsonLogicExpression(json, context)) return parseValue(json, context);

  const [declaredOperation, args] = destructureJsonLogicExpression(json, context);
  let operation = declaredOperation;

  if (operation === 'var') {
    const [varPath, defaultValue, ...tooMany] = args;
    // parseErrors
    if (varPath === undefined)
      throw Error(
        `The "var" operation needs a string or positive integer argument.\n` +
          `It's missing in ${repr(json)}. Did you mean {"var": [""]} ?`
      );
    if (!isString(varPath) && !isNatural(varPath))
      throw Error(
        `The argument of a "var" operation should be a string or positive integer.\n` +
          `I found a ${reprType(varPath, context)} in: ${repr(json)}.${
            !varPath
              ? '\nDid you mean {"var": [""]} ?'
              : maybeJsonLogicExpression(varPath, context)
              ? '\nIt could be correct; "var" can take a rule that describes a string or positive integer value. But I can\'t judge the correctness of its further use, because that completely depends on the data.'
              : ''
          }`
      );
    if (tooMany.length) {
      throw Error(`The "var" operation takes only one value.
      I found ${repr(args)} in: ${repr(json)}.
      Maybe something went wrong with your braces?`);
    }
    if (defaultValue !== undefined)
      throw Error(`I can't handle more than 1 argument to "var" operation yet.
      If you rewrite ${repr(json)} as

        {"if": [
          {"!!": [{"var": ${repr(varPath)}}]},
          {"var": ${repr(varPath)}},
          ${repr(defaultValue)}
        ]}

      I can still follow what's going on.`);
    // well formed "var" expression
    // Add a type var to the context with a name in "var: ..." namespace
    const varName = `var: ${varPath}`;
    return [
      {[varName]: {type: 'ty-var', a: varName}, ...context},
      {type: 'var', x: varName},
    ];
  } else if (['<', '<=', 'substr'].includes(operation) && args.length === 3) {
    operation = `3-ary ${operation}`;
  } else if (['-', '+'].includes(operation) && args.length === 1) {
    operation = `1-ary ${operation}`;
  } else if ((operation === '+' || operation === '*') && args.length != 2) {
    if (args.length == 0)
      throw Error(
        `This ${operation} operation is incomplete ${repr(json)}.\nIt needs some arguments.`
      );
    // NB unary + should be handled already...
    // monomorphise sum and product versions of + and *
    operation = `${args.length}-ary ${operation}`;
    // add n-ary function to the context as f(n+1 numbers) (one extra for the return value)
    context[operation] = f(number, number, ...Array(args.length - 1).fill(number));
  } else if ((operation === 'and' || operation === 'or') && args.length != 2) {
    if (args.length === 1)
      throw Error(
        `This ${operation} operation is incomplete ${repr(json)}.\n` +
          `Either add more arguments or replace it with just ${args[0]}.`
      );
    // variadic and/or
    // monomorphise to: forall a b c ... .:: a -> b -> c -> ... -> bool
    operation = `${args.length}-ary ${operation}`;
    const [a, b, ...cdef] = makeTypeVars(args.length);
    context[operation] = forall([a, b, ...cdef], f(a, b, ...cdef, bool));
  } else if (operation === 'if') {
    if (args.length % 2 == 0 || args.length == 1) {
      throw Error(
        `This ${operation} operation is incomplete ${repr(json)}.${
          args.length >= 2
            ? // TODO: add a variable infer its type, (int/string) and suggest resp. 0 and ""
              '\n"var" takes an odd number of values. Did you forget the value for the else case?'
            : ''
        }`
      );
    }
    if (args.length > 3) {
      // it's easy to make mistakes in long "elif chains"
      // let's enforce explicit bools instead of truthy values
      operation = `${args.length}-ary ${operation}`;
      // bool, a, bool, a, ..., a, a
      context[operation] = f(
        bool,
        a,
        ...Array((args.length - 3) / 2)
          .fill(null)
          .flatMap(_ => [bool, a]),
        a,
        a
      );
    }
  } else if (['map', 'filter', 'all', 'some', 'none'].includes(operation)) {
    const [newContext, [arrayExp, e2]] = parseValues(args, context);
    return [
      newContext,
      apply([
        {type: 'var', x: operation},
        arrayExp,
        {type: 'abs', x: 'var: ', e: e2}, // ('var ""') => e2
      ]),
    ];
  } else if (operation === 'reduce') {
    const [newContext, [arrayExp, e2, initialAccumulator]] = parseValues(args, context);
    return [
      newContext,
      apply([
        {type: 'var', x: operation},
        arrayExp,
        {type: 'abs', x: 'var: accumulator', e: {type: 'abs', x: 'var: current', e: e2}}, // (acc, curr) => e2
        initialAccumulator,
      ]),
    ];
  } else if (['cat', 'merge', 'missing', 'min', 'max'].includes(operation)) {
    // pass all params for n-adic functions as a single array
    const [newContext, arrayExp] = parseValue(args, context);
    return [newContext, apply([{type: 'var', x: operation}, arrayExp])];
  }
  // parse the args
  const [newContext, argumentExpressions]: [Context, Expression[]] = parseValues(args, context);
  // turn it in the ApplicationExpressoin of the operation over the args
  return [newContext, apply([{type: 'var', x: operation}, ...argumentExpressions])];
};

// const parseMonoType = (json: JSONValue): MonoType => {
//   if (typeof json === 'number') return number;
//   if (typeof json === 'boolean') return bool;
//   if (json === null) return bottom;
//   if (typeof json === 'string') string;
// };

/**
 * Parse a JSON value as JsonLogic "data"
 *
 * JsonLogic "data" is the execution context of a JsonLogic "rule" that the "var" operation can reference.
 * This function infers the types and returns a context with those types added.
 *
 * @example
 * ```ts
 * console.dir(parseContext({"a": 1}))
 * // {..., "var: a": {type: "ty-app", C:"Number", mus:[]}}
 * ```
 *
 * @see {@link https://jsonlogic.com/#data-driven}
 *
 * @param json - The JSON value
 * @param context
 * @param path - Objects and arrays are recursed over. e.g. at some point this is
 * ["users", "0", "login"] when parsing {"users": [{"login": "root"}]}
 * @returns Context with variable types added
 */
export const parseContext = (
  json: Readonly<JSONValue>,
  context: Readonly<Context> = defaultContext,
  path: Readonly<string[]> = []
): Context => {
  const identifier = path.join('.');
  if (typeof json === 'number') return {...context, [`var: ${identifier}`]: number};
  if (typeof json === 'boolean') return {...context, [`var: ${identifier}`]: bool};
  if (json === null) return {...context, [`var: ${identifier}`]: bottom};
  if (typeof json === 'string') return {...context, [`var: ${identifier}`]: string};
  if (Array.isArray(json)) {
    if (!json.length)
      return {
        ...context,
        [`var: ${identifier}`]: array({type: 'ty-var', a: `[typeof ${identifier}]`}),
      };
    const newContext: Context = json
      .map((value: JSONValue, idx: number) =>
        parseContext(value, makeContext({}), [...path, idx.toString()])
      )
      .reduce((acc, curr) => ({...acc, ...curr}), makeContext({}));
    // TODO check array member types align this assumes all elements have the type of the first
    // This ignores expressions like ["apple",["banana","beer"]] which is *not* an array,
    // but a tuple [string, string[]]
    const firstIdentifier = `var: ${[...path, 0].join('.')}`;
    const firstType: MonoType = !(firstIdentifier in newContext)
      ? {type: 'ty-var', a: `[typeof ${identifier}]`} // record type not implemented => use typevar
      : (newContext[firstIdentifier] as MonoType); // cast because *we* only add MonoTypes
    return {
      ...context,
      ...newContext,
      [`var: ${identifier}`]: array(firstType),
    };
  }
  // must be an object
  return Object.entries(json)
    .map(([key, value]) => parseContext(value, context, [...path, key]))
    .reduce((acc, curr) => ({...acc, ...curr}), context);
};

export const stringify = (expr: Expression): JsonLogicExpression => {
  switch (expr.type) {
    case 'num':
      return expr.x;
    case 'str':
      return expr.x;
    case 'var':
      const name = expr.x.replace(/^var: /, '');
      return name === '[]' ? [] : {var: name}; // [] is the cons cell "nil"
    case 'app':
      const {e1, e2} = expr;
      switch (e1.type) {
        case 'var':
          const op = e1.x.replace(/^\d+-ary /, '');
          return {[op]: [stringify(e2)]};
        case 'app':
          if (e1.e1.type === 'var' && e1.e1.x == 'cons')
            return [stringify(e1.e2)].concat(stringify(e2)); // handle cons cell
          return Object.fromEntries(
            Object.entries(stringify(e1)).map(([op, arg]) => [op, [...arg, stringify(e2)]])
          );
      }
  }
  const unexpectedExpression = JSON.stringify(expr);
  ((_: never): never => {
    throw unexpectedExpression;
    // @ts-ignore
  })(expr);
};
