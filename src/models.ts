// Copyright (c) 2023 Adam Jones
// Copyright (c) 2023 Maykin
//
// SPDX-License-Identifier: MIT

// Expressions

// e ::= x
//     | e1 e2
//     | \x -> e
//     | let x = e1 in e2

export type Expression =
  | VariableExpression
  | ApplicationExpression
  | AbstractionExpression
  | LetExpression
  | NumberLiteral
  | StringLiteral;

export interface NumberLiteral {
  type: 'num';
  x: number;
}

export interface StringLiteral {
  type: 'str';
  x: string;
}

export interface VariableExpression {
  type: 'var';
  x: string;
}

export interface ApplicationExpression {
  type: 'app';
  e1: Expression;
  e2: Expression;
}

export interface AbstractionExpression {
  type: 'abs';
  x: string;
  e: Expression;
}

export interface LetExpression {
  type: 'let';
  x: string;
  e1: Expression;
  e2: Expression;
}

// Types

// mu ::= a
//      | C mu_0 ... mu_n

// sigma ::= mu
//         | Va. sigma

export type MonoType = TypeVariable | TypeFunctionApplication;

export type PolyType = MonoType | TypeQuantifier;

export type TypeFunction = '->' | 'Array' | 'Boolean' | 'Number' | 'String' | 'Null';

export interface TypeVariable {
  type: 'ty-var';
  a: string;
  explain?: [MonoType, TypeExplanation]; // Optional explanation
}

export type TypeExplanation =
  | {type: 'ExplainAlias'; path1: ExplainPath; path2: ExplainPath; expr: Expression}
  | {type: 'ExplainInstan'; path: ExplainPath; expr: Expression};

export type ExplainPath = TypeVariable[];

export interface TypeFunctionApplication {
  type: 'ty-app';
  C: TypeFunction;
  mus: MonoType[];
}

export interface TypeQuantifier {
  type: 'ty-quantifier';
  a: string;
  sigma: PolyType;
}

// Contexts

export const ContextMarker = Symbol();
export type Context = {[ContextMarker]: boolean; [variable: string]: PolyType};

export const makeContext = (raw: {
  [ContextMarker]?: boolean;
  [variable: string]: PolyType;
}): Context => {
  raw[ContextMarker] = true;
  return raw as Context;
};

export const isContext = (something: unknown): something is Context => {
  return typeof something === 'object' && something !== null && ContextMarker in something;
};
