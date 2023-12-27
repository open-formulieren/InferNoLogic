// Copyright (c) 2023 Adam Jones
// Copyright (c) 2023 Maykin
//
// SPDX-License-Identifier: MIT
import {InferenceError} from './exceptions';
import {Substitution, generalise, instantiate, makeSubstitution, newTypeVar, unify} from './helper';
import {Context, Expression, MonoType, PolyType, makeContext} from './models';

export const W = (typEnv: Context, expr: Expression): [Substitution, MonoType] => {
  if (expr.type === 'var') {
    const value = typEnv[expr.x];
    if (value === undefined) throw new InferenceError(`Undefined variable: ${expr.x}`);
    return [makeSubstitution({}), instantiate(value)];
  }

  if (expr.type === 'num') {
    return [makeSubstitution({}), {type: 'ty-app', C: 'Number', mus: []}];
  }

  if (expr.type === 'str') {
    return [makeSubstitution({}), {type: 'ty-app', C: 'String', mus: []}];
  }

  if (expr.type === 'abs') {
    const beta = newTypeVar();
    const [s1, t1] = W(
      makeContext({
        ...typEnv,
        [expr.x]: beta,
      }),
      expr.e
    );
    return [
      s1,
      s1({
        type: 'ty-app',
        C: '->',
        mus: [beta, t1],
      }),
    ];
  }

  if (expr.type === 'app') {
    const [s1, t1] = W(typEnv, expr.e1);
    const [s2, t2] = W(s1(typEnv), expr.e2);
    const beta = newTypeVar();

    try {
      const s3 = unify(
        s2(t1),
        {
          type: 'ty-app',
          C: '->',
          mus: [t2, beta],
        },
        expr
      );
      return [s3(s2(s1)), s3(beta)];
    } catch (error) {
      const hasExplanation = ([k, t]: [string, PolyType]): boolean =>
        k.startsWith('var') && t.type == 'ty-var' && t.explain != undefined;
      const withExpl = Object.fromEntries(Object.entries(typEnv).filter(hasExplanation));
      withExpl;
      // TODO expr here !== expr from the throw site in unify!!
      // reversing explainPaths is tricky... stringifying the larger expr and the sub expr from unify
      // will probably provide enough context.
      throw error;
    }
  }

  if (expr.type === 'let') {
    const [s1, t1] = W(typEnv, expr.e1);
    const [s2, t2] = W(
      makeContext({
        ...s1(typEnv),
        [expr.x]: generalise(typEnv, t1),
      }),
      expr.e2
    );
    return [s2(s1), t2];
  }
  throw new InferenceError('Unknown expression type');
};
