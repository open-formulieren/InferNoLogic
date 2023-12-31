// Copyright (c) 2023 Adam Jones
//
// SPDX-License-Identifier: MIT
import {InferenceError} from './exceptions';
import {Substitution, generalise, instantiate, newTypeVar, unify} from './helper';
import {Context, Expression, MonoType, makeContext} from './models';

export const M = (typEnv: Context, expr: Expression, type: MonoType): Substitution => {
  if (expr.type === 'var') {
    console.log(`Variable ${expr.x}: expected to have type ${JSON.stringify(type)}`);

    const value = typEnv[expr.x];
    if (value === undefined) throw new InferenceError(`Undefined variable: ${expr.x}`);
    return unify(type, instantiate(value), expr);
  }

  if (expr.type === 'num') {
    return unify(type, {type: 'ty-app', C: 'Number', mus: []}, expr);
  }

  if (expr.type === 'str') {
    return unify(type, {type: 'ty-app', C: 'String', mus: []}, expr);
  }

  if (expr.type === 'abs') {
    const beta1 = newTypeVar();
    const beta2 = newTypeVar();
    const s1 = unify(
      type,
      {
        type: 'ty-app',
        C: '->',
        mus: [beta1, beta2],
      },
      expr
    );
    const s2 = M(
      makeContext({
        ...s1(typEnv),
        [expr.x]: s1(beta1),
      }),
      expr.e,
      s1(beta2)
    );
    return s2(s1);
  }

  if (expr.type === 'app') {
    const beta = newTypeVar();
    const s1 = M(typEnv, expr.e1, {
      type: 'ty-app',
      C: '->',
      mus: [beta, type],
    });
    const s2 = M(s1(typEnv), expr.e2, s1(beta));
    return s2(s1);
  }

  if (expr.type === 'let') {
    const beta = newTypeVar();
    const s1 = M(typEnv, expr.e1, beta);
    const s2 = M(
      makeContext({
        ...s1(typEnv),
        [expr.x]: generalise(s1(typEnv), s1(beta)),
      }),
      expr.e2,
      s1(type)
    );
    return s2(s1);
  }

  throw new InferenceError('Unknown expression type');
};
