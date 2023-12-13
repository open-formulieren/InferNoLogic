// Copyright (c) 2023 Adam Jones
//
// SPDX-License-Identifier: MIT
import {
  Context,
  ExplainPath,
  Expression,
  MonoType,
  PolyType,
  TypeFunctionApplication,
  TypeVariable,
  isContext,
  makeContext,
} from './models';

// substitutions

export type Substitution = {
  type: 'substitution';
  (m: MonoType): MonoType;
  (t: PolyType): PolyType;
  (c: Context): Context;
  (s: Substitution): Substitution;
  raw: {[typeVariables: string]: MonoType};
};

export const makeSubstitution = (raw: Substitution['raw']): Substitution => {
  const fn = ((arg: MonoType | PolyType | Context | Substitution) => {
    if (arg.type === 'substitution') return combine(fn, arg);
    return apply(fn, arg);
  }) as Substitution;
  fn.type = 'substitution';
  fn.raw = raw;
  return fn;
};

function apply<T extends MonoType | PolyType | Context>(substitution: Substitution, value: T): T;
function apply(
  s: Substitution,
  value: MonoType | PolyType | Context
): MonoType | PolyType | Context {
  if (isContext(value)) {
    return makeContext(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, apply(s, v)])));
  }

  if (value.type === 'ty-var') {
    if (s.raw[value.a]) return s.raw[value.a];
    return value;
  }

  if (value.type === 'ty-app') {
    return {...value, mus: value.mus.map(m => apply(s, m))};
  }

  if (value.type === 'ty-quantifier') {
    return {...value, sigma: apply(s, value.sigma)};
  }
  ((_: never): never => {
    throw new Error('Unknown argument passed to substitution');
  })(value);
}

const combine = (s1: Substitution, s2: Substitution): Substitution => {
  return makeSubstitution({
    ...s1.raw,
    ...Object.fromEntries(Object.entries(s2.raw).map(([k, v]) => [k, s1(v)])),
  });
};

// new type variable
let currentTypeVar = 0;
export const newTypeVar = (): TypeVariable => ({
  type: 'ty-var',
  a: `t${currentTypeVar++}`,
});

// instantiate
// mappings = { a |-> t0, b |-> t1 }
// Va. Vb. a -> b
// t0 -> t1
export const instantiate = (
  type: PolyType,
  mappings: Map<string, TypeVariable> = new Map()
): MonoType => {
  if (type.type === 'ty-var') {
    return mappings.get(type.a) ?? type;
  }

  if (type.type === 'ty-app') {
    return {...type, mus: type.mus.map(m => instantiate(m, mappings))};
  }

  if (type.type === 'ty-quantifier') {
    mappings.set(type.a, newTypeVar());
    return instantiate(type.sigma, mappings);
  }

  ((_: never): never => {
    throw new Error('Unknown type passed to instantiate');
  })(type);
};

// generalise
export const generalise = (ctx: Context, type: MonoType): PolyType => {
  const quantifiers = diff(freeVars(type), freeVars(ctx));
  let t: PolyType = type;
  quantifiers.forEach(q => {
    t = {type: 'ty-quantifier', a: q, sigma: t};
  });
  return t;
};

const diff = <T>(a: T[], b: T[]): T[] => {
  const bset = new Set(b);
  return a.filter(v => !bset.has(v));
};

const freeVars = (value: PolyType | Context): string[] => {
  if (isContext(value)) {
    return Object.values(value).flatMap(freeVars);
  }

  if (value.type === 'ty-var') {
    return [value.a];
  }

  if (value.type === 'ty-app') {
    return value.mus.flatMap(freeVars);
  }

  if (value.type === 'ty-quantifier') {
    return freeVars(value.sigma).filter(v => v !== value.a);
  }

  ((_: never): never => {
    throw new Error('Unknown argument passed to substitution');
  })(value);
};

// unify

export const unify = (
  type1: MonoType,
  type2: MonoType,
  expr: Expression,
  path1: ExplainPath = [],
  path2: ExplainPath = []
): Substitution => {
  if (type1.type === 'ty-var' && type2.type === 'ty-var' && type1.a === type2.a) {
    return makeSubstitution({});
  }

  if (type1.type === 'ty-var') {
    if (contains(type2, type1))
      throw new Error(`Infinite type detected: ${type1} occurs in ${type2}`);

    if (type2.type === 'ty-var') {
      // var with other name -> explain
      // TODO? reverseAliasPath(type1);
      type1.explain = [type2, {type: 'ExplainAlias', path1, path2, expr}];
    } else if (type2.type === 'ty-app') {
      // instantiation
      // TODO? reverseAliasPath(type1);
      type1.explain = [type2, {type: 'ExplainInstan', path: path1, expr}];
    } else {
      ((_: never): never => {
        throw new Error('Unknown argument passed to unify');
      })(type2);
    }
    return makeSubstitution({
      [type1.a]: type2,
    });
  }

  if (type2.type === 'ty-var') {
    return unify(type2, type1, expr, path2, path1);
  }

  if (type1.C !== type2.C) {
    const msg = formatUnificationError(type1, type2, expr, path1, path2);
    throw new Error(msg);
  }

  if (type1.mus.length !== type2.mus.length) {
    throw new Error(`Could not unify types (different argument lengths): ${type1} and ${type2}`);
  }

  let s: Substitution = makeSubstitution({});
  for (let i = 0; i < type1.mus.length; i++) {
    s = s(
      unify(s(type1.mus[i]), s(type2.mus[i]), expr, addHist(path1, type1), addHist(path2, type2))
    );
  }
  return s;
};

const formatUnificationError = (
  type1: TypeFunctionApplication,
  type2: TypeFunctionApplication,
  expr: Expression,
  _path1: ExplainPath,
  _path2: ExplainPath
): string => {
  // console.dir({type1, type2, expr, _path1, _path2}, {depth: Infinity});
  if (expr.type === 'app') {
    const msg = `"${reprExpression(expr.e1)}" expects "${reprExpression(expr.e2)}" to be a ${
      type1.C
    }, but it is a ${type2.C}`;
    return msg;
  }
  throw new Error(`Unexpected expression type ${expr}`);
};

export const reprExpression = (expr: Expression): string => {
  if (expr.type === 'app') return reprExpression(expr.e1);
  if (expr.type === 'var') return expr.x.startsWith('var: ') ? expr.x.substring(5) : expr.x;
  if (expr.type === 'num') return expr.x.toString();
  if (expr.type === 'str') return expr.x.toString();
  if (expr.type === 'abs') return `{"${expr.x}": ${reprExpression(expr.e)}}`;
  if (expr.type === 'let')
    return `"${expr.x}" = ${reprExpression(expr.e1)} in ${reprExpression(expr.e2)}`;
  ((_: never): never => {
    throw new Error(`Unexpected expression type ${expr}`);
  })(expr);
};

const addHist = (history: ExplainPath, root: MonoType): ExplainPath => {
  const _addHist = (root: MonoType): ExplainPath => {
    if (root.type === 'ty-app' || !root.explain) return [];
    const [ty, _explain] = root.explain;
    const explPath = _addHist(ty);
    // root.explain = [explPath, _explain]
    return [root, ...explPath];
  };
  // and return the new history
  return history.concat(_addHist(root));
};

const contains = (value: MonoType, type2: TypeVariable): boolean => {
  if (value.type === 'ty-var') {
    return value.a === type2.a;
  }

  if (value.type === 'ty-app') {
    return value.mus.some(t => contains(t, type2));
  }

  ((_: never): never => {
    throw new Error('Unknown argument passed to substitution');
  })(value);
};
