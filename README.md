# InferNoLogic

[![Run CI build and tests](https://github.com/open-formulieren/InferNoLogic/actions/workflows/ci.yml/badge.svg)](https://github.com/open-formulieren/InferNoLogic/actions/workflows/ci.yml)
[![NPM package](https://img.shields.io/npm/v/@open-formulieren/infernologic.svg)](https://www.npmjs.com/package/@open-formulieren/infernologic)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat)](https://github.com/prettier/prettier)

Type checker for [JsonLogic](https://jsonlogic.com/) expressions with full type inference

## Design goal

Infer the result types of JsonLogic expressions and possibly of data referenced in `{"var": ...}`
expressions.

- without the need of extra annotations; full inference without extra JsonLogic syntax
- fast; should run in a browser while editing
- soundness over completeness; prefer false negatives over false positives. For example: in
  `{"if": [predicate-expression, then-expression, else-expression]}` require then- and
  else-expressions of the same type, even though JsonLogic allows them to differing ones.
- actionable error messages; No "Computer says no" but a location in the expression tree with as
  narrow a scope as possible, with some helpful humane hint. (Aim for [Elm](https://elm-lang.org)
  and [Rust](https://www.rust-lang.org) compiler helpfulness)

## Usage

Install with npm or yarn:

```bash
npm install --save-dev @open-formulieren/infernologic
yarn add -D @open-formulieren/infernologic
```

## References

Builds on implementations from
[domdomegg/hindley-milner-typescript-minimal](https://github.com/domdomegg/hindley-milner-typescript-minimal)
for

- Algorithm W

  Damas, L. and Milner, R. (1982). Principal type-schemes for functional programs. Proceedings of
  the 9th ACM SIGPLAN-SIGACT Symposium on Principles of Programming Languages - POPL '82.
  https://doi.org/10.1145/582153.582176

- Algorithm M

  Lee, O. and Yi, K. (1998). Proofs about a folklore let-polymorphic type inference algorithm. ACM
  Transactions on Programming Languages and Systems, 20(4), 707-723.
  https://doi.org/10.1145/291891.291892
